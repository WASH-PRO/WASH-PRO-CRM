import uuid

from sqlalchemy import BigInteger, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid
from app.models.enums import ScriptStatus, ScriptType


class Script(Base, TimestampMixin):
    __tablename__ = "scripts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    group_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    script_type: Mapped[str] = mapped_column(String(20), default=ScriptType.SCRIPT.value)
    status: Mapped[str] = mapped_column(String(20), default=ScriptStatus.ENABLED.value, index=True)
    entrypoint: Mapped[str] = mapped_column(String(255), default="main.py")
    storage_quota_bytes: Mapped[int] = mapped_column(BigInteger, default=100 * 1024 * 1024)
    max_concurrent_runs: Mapped[int] = mapped_column(Integer, default=1)
    max_runtime_seconds: Mapped[int] = mapped_column(Integer, default=3600)
    max_memory_bytes: Mapped[int] = mapped_column(BigInteger, default=512 * 1024 * 1024)
    max_cpu_percent: Mapped[float] = mapped_column(default=100.0)
    restart_policy: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)

    group: Mapped["Group"] = relationship(back_populates="scripts")
    files: Mapped[list["ScriptFile"]] = relationship(back_populates="script", cascade="all, delete-orphan")
    runs: Mapped[list["Run"]] = relationship(back_populates="script", cascade="all, delete-orphan")
    schedules: Mapped[list["Schedule"]] = relationship(
        back_populates="script", cascade="all, delete-orphan", foreign_keys="Schedule.script_id"
    )
    webhooks: Mapped[list["Webhook"]] = relationship(back_populates="script", cascade="all, delete-orphan")
    secrets: Mapped[list["ScriptSecret"]] = relationship(back_populates="script", cascade="all, delete-orphan")


class ScriptFile(Base, TimestampMixin):
    __tablename__ = "script_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    script_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scripts.id", ondelete="CASCADE"))
    path: Mapped[str] = mapped_column(String(512))
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_hash: Mapped[str] = mapped_column(String(64), default="")
    file_type: Mapped[str] = mapped_column(String(20), default="source")
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)

    script: Mapped["Script"] = relationship(back_populates="files")


class ScriptTemplate(Base, TimestampMixin):
    __tablename__ = "script_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(50), default="general")
    file_tree: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_system: Mapped[bool] = mapped_column(default=True)


class ScriptSecret(Base, TimestampMixin):
    __tablename__ = "script_secrets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    script_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scripts.id", ondelete="CASCADE"))
    key: Mapped[str] = mapped_column(String(255))
    ciphertext: Mapped[bytes] = mapped_column()
    nonce: Mapped[bytes] = mapped_column()
    description: Mapped[str] = mapped_column(Text, default="")

    script: Mapped["Script"] = relationship(back_populates="secrets")


from app.models.user import Group  # noqa: E402
from app.models.run import Run, Schedule  # noqa: E402
from app.models.webhook import Webhook  # noqa: E402
