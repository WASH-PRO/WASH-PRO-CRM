from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class UpdateStepResponse(BaseModel):
    id: str
    label: str
    status: str = "pending"
    message: str | None = None
    at: datetime | None = None

    model_config = {"from_attributes": True}


class UpdateJobResponse(BaseModel):
    id: UUID
    status: str
    from_version: str
    target_version: str
    target_tag: str
    release_url: str | None = None
    release_notes: str | None = None
    steps: list[UpdateStepResponse] = Field(default_factory=list)
    rollback_snapshot: dict | None = None
    trigger: str
    triggered_by_user_id: UUID | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateSettingsResponse(BaseModel):
    check_enabled: bool
    notify_enabled: bool
    auto_update_enabled: bool
    check_interval_hours: int
    auto_update_interval_hours: int
    github_repo: str
    include_prerelease: bool
    last_check_at: str | None = None
    last_known_latest_version: str | None = None
    last_notified_version: str | None = None
    dismissed_version: str | None = None
    last_applied_version: str | None = None


class UpdateSettingsUpdateRequest(BaseModel):
    check_enabled: bool | None = None
    notify_enabled: bool | None = None
    auto_update_enabled: bool | None = None
    check_interval_hours: int | None = Field(default=None, ge=1, le=168)
    auto_update_interval_hours: int | None = Field(default=None, ge=1, le=720)
    github_repo: str | None = None
    include_prerelease: bool | None = None


class UpdateCheckResponse(BaseModel):
    current_version: str
    latest_version: str | None = None
    latest_tag: str | None = None
    update_available: bool
    release_url: str | None = None
    release_notes: str | None = None
    published_at: str | None = None
    checked_at: str
    executor_available: bool
    executor_reason: str | None = None
    deploy_mode: str


class UpdateStatusResponse(UpdateCheckResponse):
    settings: UpdateSettingsResponse
    active_job: UpdateJobResponse | None = None
    recent_jobs: list[UpdateJobResponse] = Field(default_factory=list)
    show_notification: bool = False


class UpdateApplyRequest(BaseModel):
    target_version: str | None = None
    target_tag: str | None = None


class UpdateDismissRequest(BaseModel):
    version: str


class UpdateCheckResponseLegacy(BaseModel):
    current_version: str
    latest_version: str | None
    update_available: bool
    release_notes: str = ""
