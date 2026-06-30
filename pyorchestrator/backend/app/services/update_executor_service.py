from __future__ import annotations

import json
import subprocess
from pathlib import Path
from uuid import UUID

from app.core.config import settings


DEFAULT_STEPS = [
    {"id": "snapshot", "label": "Save rollback snapshot", "status": "pending"},
    {"id": "fetch", "label": "Fetch release", "status": "pending"},
    {"id": "deploy", "label": "Apply update", "status": "pending"},
    {"id": "health", "label": "Verify health", "status": "pending"},
]


class UpdateExecutorService:
    def is_available(self) -> bool:
        return self.get_unavailable_reason() is None

    def get_unavailable_reason(self) -> str | None:
        if not settings.update_executor_enabled:
            return "Update executor is disabled (UPDATE_EXECUTOR_ENABLED=false)"
        if settings.update_deploy_mode in {"docker", "docker-replica"}:
            if not Path("/var/run/docker.sock").exists():
                return "Docker socket is not available — run from the project directory with Docker Compose"
            host_project = self._host_project_root()
            compose = self._host_compose_path(host_project)
            if not compose.exists() and not Path(settings.update_compose_file).exists():
                return f"Compose file not found: {settings.update_compose_file}"
            script = host_project / "scripts" / "self-update.sh"
            if not script.exists() and not Path("/app/scripts/self-update.sh").exists():
                return "Update scripts not found in the project mount"
            return None
        if settings.update_deploy_mode == "native":
            if not Path(settings.update_project_root).exists():
                return f"Project root not found: {settings.update_project_root}"
            return None
        return f"Unsupported deploy mode: {settings.update_deploy_mode}"

    def get_script_path(self) -> Path:
        deployed = Path(settings.update_project_root) / "scripts" / "self-update.sh"
        if deployed.exists():
            return deployed
        return Path("/app/scripts/self-update.sh")

    def write_job_manifest(
        self,
        job_id: UUID,
        *,
        target_tag: str,
        target_version: str,
        from_version: str,
        github_repo: str,
    ) -> None:
        data_dir = Path(settings.update_data_dir)
        data_dir.mkdir(parents=True, exist_ok=True)
        manifest = {
            "jobId": str(job_id),
            "targetTag": target_tag,
            "targetVersion": target_version,
            "fromVersion": from_version,
            "githubRepo": github_repo,
        }
        (data_dir / f"job-{job_id}.json").write_text(json.dumps(manifest), encoding="utf-8")

    async def run_job(self, job_id: UUID, job_data: dict) -> None:
        from app.services.update_service import update_service

        reason = self.get_unavailable_reason()
        if reason:
            await update_service.finish_job(job_id, "failed", reason)
            return

        script = self.get_script_path()
        if not script.exists():
            await update_service.finish_job(job_id, "failed", f"Update script not found: {script}")
            return

        self.write_job_manifest(
            job_id,
            target_tag=job_data["target_tag"],
            target_version=job_data["target_version"],
            from_version=job_data["from_version"],
            github_repo=job_data["github_repo"],
        )

        script_args = [
            str(job_id),
            settings.update_data_dir,
            settings.update_deploy_mode,
            settings.update_compose_file,
            settings.update_project_root,
            str(settings.backend_port),
            settings.update_health_url,
        ]

        if settings.update_deploy_mode in {"docker", "docker-replica"}:
            host_project = str(self._host_project_root())
            container_name = f"pyorch-update-{str(job_id).replace('-', '')[-12:]}"
            container_data_dir = "/data"
            container_project_root = "/deploy"
            host_compose = self._host_compose_path(Path(host_project))
            container_compose = str(host_compose).replace(host_project, container_project_root)
            container_args = [
                str(job_id),
                container_data_dir,
                settings.update_deploy_mode,
                container_compose,
                container_project_root,
                str(settings.backend_port),
                settings.update_health_url,
            ]
            quoted = " ".join(f"'{arg.replace(chr(39), chr(39) + chr(92) + chr(39) + chr(39))}'" for arg in container_args)
            inner = (
                "apk add --no-cache bash git jq curl rsync >/dev/null 2>&1; "
                f"bash /deploy/scripts/self-update.sh {quoted}"
            )
            docker_args = [
                "run",
                "--rm",
                "-d",
                "--name",
                container_name,
                "--add-host=host.docker.internal:host-gateway",
                "-v",
                "/var/run/docker.sock:/var/run/docker.sock",
                "-v",
                f"{host_project}:{container_project_root}",
                "-v",
                f"{settings.update_data_volume}:{container_data_dir}",
                "-w",
                container_project_root,
            ]
            if settings.update_docker_network:
                docker_args.extend(["--network", settings.update_docker_network])
            docker_args.extend(["-e", f"PYORCH_HOST_PROJECT_ROOT={host_project}"])
            docker_args.extend(["-e", f"PYORCH_BUILD_ROOT={container_project_root}"])
            docker_args.extend(["-e", f"COMPOSE_PROJECT_NAME={settings.compose_project_name}"])
            docker_args.extend(["-e", f"UPDATE_HOST_PROJECT_ROOT={host_project}"])
            docker_args.extend([settings.update_runner_image, "sh", "-c", inner])
            try:
                self._spawn_docker(docker_args)
                await update_service.mark_job_started(job_id)
            except Exception as exc:
                await update_service.finish_job(job_id, "failed", str(exc))
            return

        try:
            subprocess.Popen(
                ["bash", str(script), *script_args],
                start_new_session=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            await update_service.mark_job_started(job_id)
        except Exception as exc:
            await update_service.finish_job(job_id, "failed", str(exc))

    async def rollback_job(self, job_id: UUID) -> None:
        from app.services.update_service import update_service

        for candidate in (
            Path(settings.update_project_root) / "scripts" / "self-update-rollback.sh",
            Path("/app/scripts/self-update-rollback.sh"),
        ):
            if candidate.exists():
                rollback_script = candidate
                break
        else:
            raise RuntimeError("Rollback script not found")

        args = [
            str(rollback_script),
            str(job_id),
            settings.update_data_dir,
            settings.update_deploy_mode,
            settings.update_compose_file,
            settings.update_project_root,
            str(settings.backend_port),
            settings.update_health_url,
        ]
        proc = subprocess.run(args, check=False)
        if proc.returncode != 0:
            raise RuntimeError(f"Rollback exited with code {proc.returncode}")
        await update_service.finish_job(job_id, "rolled_back", "Manual rollback completed")

    def _host_project_root(self) -> Path:
        if settings.update_host_project_root:
            path = Path(settings.update_host_project_root)
            if path.is_dir() and str(path) != "/deploy":
                return path
        detected = self._detect_via_docker_inspect() or self._detect_deploy_mount_source()
        if detected:
            return detected
        return Path(settings.update_project_root)

    def _detect_deploy_mount_source(self) -> Path | None:
        try:
            for line in Path("/proc/self/mountinfo").read_text().splitlines():
                parts = line.split()
                if len(parts) < 10 or parts[4] != "/deploy":
                    continue
                dash = parts.index("-")
                fs_type = parts[dash + 1]
                if fs_type == "bind":
                    source = parts[dash + 2].replace("\\040", " ")
                    if source.startswith("/") and source != "/deploy":
                        return Path(source)
                if fs_type == "fakeowner":
                    # Docker Desktop (macOS): root field is the path under /Users
                    root = parts[3]
                    if root.startswith("/"):
                        return Path("/Users") / root.lstrip("/")
        except (OSError, ValueError):
            pass
        return None

    def _detect_via_docker_inspect(self) -> Path | None:
        import os

        container_id = os.environ.get("HOSTNAME", "").strip()
        if not container_id:
            return None
        try:
            proc = subprocess.run(
                [
                    "docker",
                    "inspect",
                    "-f",
                    '{{range .Mounts}}{{if eq .Destination "/deploy"}}{{.Source}}{{end}}{{end}}',
                    container_id,
                ],
                capture_output=True,
                text=True,
                check=False,
                timeout=10,
            )
            source = proc.stdout.strip()
            if source and source != "/deploy":
                return Path(source)
        except Exception:
            pass
        return None

    def _host_compose_path(self, host_project: Path) -> Path:
        compose = Path(settings.update_compose_file)
        if compose.is_absolute() and str(compose).startswith("/deploy"):
            return host_project / compose.name
        if compose.is_absolute():
            return compose
        return host_project / compose

    def _spawn_docker(self, args: list[str]) -> None:
        proc = subprocess.run(
            ["docker", *args],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or f"docker run exited with code {proc.returncode}")


update_executor_service = UpdateExecutorService()
