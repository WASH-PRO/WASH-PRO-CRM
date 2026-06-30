import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, new_uuid


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)
    value: Mapped[dict | str | int | float | bool | None] = mapped_column(JSONB, default=dict)
    description: Mapped[str] = mapped_column(Text, default="")


class UpdateJob(Base, TimestampMixin):
    __tablename__ = "update_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    from_version: Mapped[str] = mapped_column(String(64))
    target_version: Mapped[str] = mapped_column(String(64))
    target_tag: Mapped[str] = mapped_column(String(64))
    release_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    release_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    steps: Mapped[list] = mapped_column(JSONB, default=list)
    rollback_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    trigger: Mapped[str] = mapped_column(String(32), default="manual")
    triggered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
