import json
import tarfile
from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.run import Backup, BackupSettings
from app.models.script import Script
from app.models.user import Group
from app.services.script_service import export_script_zip, import_script_zip, storage_service


async def get_backup_settings(db: AsyncSession) -> BackupSettings:
    result = await db.execute(select(BackupSettings).where(BackupSettings.id == 1))
    row = result.scalar_one_or_none()
    if not row:
        row = BackupSettings(id=1)
        db.add(row)
        await db.flush()
    return row


async def apply_retention(db: AsyncSession, retention_count: int) -> int:
    if retention_count < 1:
        return 0
    result = await db.execute(
        select(Backup)
        .where(Backup.status == "completed")
        .order_by(Backup.completed_at.desc(), Backup.id.desc())
    )
    backups = result.scalars().all()
    removed = 0
    for backup in backups[retention_count:]:
        await delete_backup(db, backup.id)
        removed += 1
    return removed


async def create_backup(db: AsyncSession, user_id: UUID | None, backup_type: str = "manual") -> Backup:
    backup_settings = await get_backup_settings(db)
    backup = Backup(created_by_user_id=user_id, backup_type=backup_type, status="pending")
    db.add(backup)
    await db.flush()

    try:
        buf = BytesIO()
        manifest: dict = {"scripts": [], "groups": [], "created_at": datetime.now(timezone.utc).isoformat()}

        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            scripts = (await db.execute(select(Script).options(selectinload(Script.files)))).scalars().all()
            for script in scripts:
                zip_data = await export_script_zip(script)
                info = tarfile.TarInfo(name=f"scripts/{script.slug}.zip")
                info.size = len(zip_data)
                tar.addfile(info, BytesIO(zip_data))
                manifest["scripts"].append(
                    {
                        "id": str(script.id),
                        "slug": script.slug,
                        "name": script.name,
                        "group_id": str(script.group_id) if script.group_id else None,
                    }
                )

            groups = (await db.execute(select(Group))).scalars().all()
            manifest["groups"] = [
                {"id": str(g.id), "name": g.name, "description": g.description, "color": g.color, "icon": g.icon}
                for g in groups
            ]
            meta_bytes = json.dumps(manifest, indent=2).encode()
            info = tarfile.TarInfo(name="manifest.json")
            info.size = len(meta_bytes)
            tar.addfile(info, BytesIO(meta_bytes))

        data = buf.getvalue()
        path = f"backups/{backup.id}/snapshot.tar.gz"
        storage_service.ensure_bucket()
        storage_service.client.put_object(settings.minio_bucket, path, BytesIO(data), len(data))

        backup.storage_path = path
        backup.size_bytes = len(data)
        backup.manifest = manifest
        backup.status = "completed"
        backup.completed_at = datetime.now(timezone.utc)
        if backup_type == "scheduled":
            backup_settings.last_run_at = backup.completed_at
        await db.flush()
        await apply_retention(db, backup_settings.retention_count)
        return backup
    except Exception as exc:
        backup.status = "failed"
        backup.manifest = {"error": str(exc)}
        await db.flush()
        raise


async def get_backup_or_404(db: AsyncSession, backup_id: UUID) -> Backup:
    result = await db.execute(select(Backup).where(Backup.id == backup_id))
    backup = result.scalar_one_or_none()
    if not backup:
        raise LookupError("Backup not found")
    return backup


async def get_backup_download(db: AsyncSession, backup_id: UUID) -> tuple[bytes, str]:
    backup = await get_backup_or_404(db, backup_id)
    if backup.status != "completed" or not backup.storage_path:
        raise ValueError("Backup is not ready for download")
    resp = storage_service.client.get_object(settings.minio_bucket, backup.storage_path)
    try:
        data = resp.read()
    finally:
        resp.close()
        resp.release_conn()
    filename = f"pyorch-backup-{backup.id}.tar.gz"
    return data, filename


async def delete_backup(db: AsyncSession, backup_id: UUID) -> None:
    backup = await get_backup_or_404(db, backup_id)
    if backup.storage_path:
        try:
            storage_service.client.remove_object(settings.minio_bucket, backup.storage_path)
        except Exception:
            pass
    await db.delete(backup)
    await db.flush()


async def restore_backup(db: AsyncSession, backup_id: UUID) -> dict[str, int]:
    data, _ = await get_backup_download(db, backup_id)
    groups_restored = 0
    scripts_restored = 0
    scripts_skipped = 0

    with tarfile.open(fileobj=BytesIO(data), mode="r:gz") as tar:
        manifest_member = tar.getmember("manifest.json")
        manifest = json.loads(tar.extractfile(manifest_member).read().decode())

        group_id_by_old: dict[str, UUID] = {}
        for group_data in manifest.get("groups", []):
            result = await db.execute(select(Group).where(Group.name == group_data["name"]))
            group = result.scalar_one_or_none()
            if not group:
                group = Group(
                    name=group_data["name"],
                    description=group_data.get("description", ""),
                    color=group_data.get("color", "#5c6bc0"),
                    icon=group_data.get("icon", "folder"),
                )
                db.add(group)
                await db.flush()
                groups_restored += 1
            group_id_by_old[group_data["id"]] = group.id

        old_groups = {g["id"]: g for g in manifest.get("groups", [])}

        for script_data in manifest.get("scripts", []):
            slug = script_data["slug"]
            existing = await db.execute(select(Script.id).where(Script.slug == slug))
            if existing.scalar_one_or_none():
                scripts_skipped += 1
                continue

            member_name = f"scripts/{slug}.zip"
            try:
                zip_member = tar.getmember(member_name)
            except KeyError:
                scripts_skipped += 1
                continue

            zip_data = tar.extractfile(zip_member).read()
            group_id = None
            old_group_id = script_data.get("group_id")
            if old_group_id and old_group_id in group_id_by_old:
                group_id = group_id_by_old[old_group_id]
            elif old_group_id and old_group_id in old_groups:
                result = await db.execute(select(Group).where(Group.name == old_groups[old_group_id]["name"]))
                group = result.scalar_one_or_none()
                group_id = group.id if group else None

            await import_script_zip(db, zip_data, group_id=group_id)
            scripts_restored += 1

    return {
        "groups_restored": groups_restored,
        "scripts_restored": scripts_restored,
        "scripts_skipped": scripts_skipped,
    }
