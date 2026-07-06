from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    display_name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class MeResponse(UserResponse):
    permissions: list[str]


class UserCreate(BaseModel):
    email: str
    password: str = Field(min_length=6)
    display_name: str = ""
    role: str = "Viewer"


class UserUpdate(BaseModel):
    email: str | None = None
    display_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6)


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    current_password: str | None = None
    new_password: str | None = Field(default=None, min_length=6)


class RoleResponse(BaseModel):
    name: str
    permissions: list[str]


class PermissionCatalogResponse(BaseModel):
    permissions: list[str]
    roles: list[RoleResponse]


class GroupCreate(BaseModel):
    name: str
    description: str = ""
    color: str = "#5c6bc0"
    icon: str = "folder"


class GroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None


class GroupResponse(BaseModel):
    id: UUID
    name: str
    description: str
    color: str
    icon: str

    model_config = {"from_attributes": True}


class ScriptCreate(BaseModel):
    name: str
    description: str = ""
    group_id: UUID | None = None
    script_type: str = "script"
    entrypoint: str = "main.py"
    code: str | None = None
    metadata: dict = Field(default_factory=dict)


class ScriptUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    group_id: UUID | None = None
    status: str | None = None
    entrypoint: str | None = None
    max_concurrent_runs: int | None = None
    max_runtime_seconds: int | None = None
    max_memory_bytes: int | None = None
    metadata: dict | None = None


class ActiveRunSummary(BaseModel):
    id: UUID
    status: str
    started_at: datetime | None
    queued_at: datetime

    model_config = {"from_attributes": True}


class ScriptResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str
    script_type: str
    status: str
    entrypoint: str
    group_id: UUID | None
    version: int
    max_concurrent_runs: int
    max_runtime_seconds: int
    max_memory_bytes: int
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_")
    active_run: ActiveRunSummary | None = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class ScriptFileResponse(BaseModel):
    id: UUID
    path: str
    content: str | None
    file_type: str
    size_bytes: int

    model_config = {"from_attributes": True}


class ScriptFileUpdate(BaseModel):
    content: str


class ScriptFileCreate(BaseModel):
    path: str
    content: str = ""


class ScriptFileOrderUpdate(BaseModel):
    paths: list[str]


class RunResponse(BaseModel):
    id: UUID
    script_id: UUID
    status: str
    trigger_type: str
    exit_code: int | None
    error_message: str | None
    queued_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    duration_ms: int | None

    model_config = {"from_attributes": True}


class RunLogResponse(BaseModel):
    id: int
    ts: datetime
    level: str
    message: str

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    name: str
    trigger_type: str = "cron"
    cron_expression: str | None = None
    interval_seconds: int | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    max_instances: int = 1
    max_runtime_seconds: int | None = None
    is_active: bool = True


class ScheduleUpdate(BaseModel):
    name: str | None = None
    trigger_type: str | None = None
    cron_expression: str | None = None
    interval_seconds: int | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    max_instances: int | None = None
    max_runtime_seconds: int | None = None
    is_active: bool | None = None


class ScheduleResponse(BaseModel):
    id: UUID
    script_id: UUID
    name: str
    trigger_type: str
    cron_expression: str | None
    interval_seconds: int | None
    start_at: datetime | None
    end_at: datetime | None
    max_instances: int
    max_runtime_seconds: int | None
    is_active: bool
    next_run_at: datetime | None
    webhook_token: str | None

    model_config = {"from_attributes": True}


class WebhookCreate(BaseModel):
    script_id: UUID
    name: str
    max_runtime_seconds: int | None = None


class WebhookUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    max_runtime_seconds: int | None = None


class WebhookResponse(BaseModel):
    id: UUID
    script_id: UUID
    name: str
    token: str
    is_active: bool
    max_runtime_seconds: int | None
    last_invoked_at: datetime | None

    model_config = {"from_attributes": True}


class SecretCreate(BaseModel):
    key: str
    value: str
    description: str = ""


class SecretResponse(BaseModel):
    id: UUID
    key: str
    description: str
    has_value: bool


class NotificationResponse(BaseModel):
    id: UUID
    title: str
    body: str
    severity: str
    is_read: bool
    run_id: UUID | None

    model_config = {"from_attributes": True}


class BackupResponse(BaseModel):
    id: UUID
    backup_type: str
    status: str
    size_bytes: int
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class BackupSettingsResponse(BaseModel):
    enabled: bool
    cron_expression: str
    retention_count: int
    last_run_at: datetime | None

    model_config = {"from_attributes": True}


class BackupSettingsUpdate(BaseModel):
    enabled: bool | None = None
    cron_expression: str | None = Field(default=None, min_length=5, max_length=100)
    retention_count: int | None = Field(default=None, ge=1, le=100)


class BackupRestoreResponse(BaseModel):
    groups_restored: int
    scripts_restored: int
    scripts_skipped: int


class DashboardStats(BaseModel):
    total_scripts: int
    active_scripts: int
    stopped_scripts: int
    errors_24h: int
    completed_tasks: int
    active_cron_jobs: int
    running_now: int


class DashboardTimeseries(BaseModel):
    labels: list[str]
    runs: list[int]
    errors: list[int]
    successes: list[int]
    load: list[int]
    schedules: list[int]
    cpu: list[float]
    memory_mb: list[float]
    network: list[float]
    disk_io: list[float]


class SystemServiceStatus(BaseModel):
    name: str
    status: str


class SystemCounts(BaseModel):
    scripts: int
    scripts_enabled: int
    groups: int
    users: int
    users_active: int
    schedules: int
    schedules_active: int
    webhooks: int
    runs_total: int
    runs_queued: int
    runs_running: int
    notifications_unread: int


class SystemConfigInfo(BaseModel):
    runtime_queue: str
    minio_bucket: str
    minio_endpoint: str
    minio_console_url: str | None = None
    grafana_url: str | None = None
    cors_origins: list[str]


class SystemResources(BaseModel):
    memory_total_mb: float = 0
    memory_used_mb: float = 0
    memory_percent: float = 0
    disk_total_gb: float = 0
    disk_used_gb: float = 0
    disk_percent: float = 0


class SystemInfoResponse(BaseModel):
    name: str
    version: str
    environment: str
    uptime_seconds: int
    started_at: str
    services: dict[str, str]
    counts: SystemCounts
    config: SystemConfigInfo
    resources: SystemResources


class McpToolInfo(BaseModel):
    name: str
    category: str
    description: str


class McpInfoResponse(BaseModel):
    status: str
    transport: str
    http_url: str
    tools: list[McpToolInfo]
    resource: str


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    description: str
    category: str
    file_tree: dict

    model_config = {"from_attributes": True}


class UpdateCheckResponse(BaseModel):
    current_version: str
    latest_version: str | None
    update_available: bool
    release_notes: str = ""


class InternalRunComplete(BaseModel):
    run_id: UUID
    status: str
    exit_code: int
    duration_ms: int
    stdout: str = ""
    stderr: str = ""
    hostname: str = ""


class InternalRunStart(BaseModel):
    run_id: UUID
    pid: int
    hostname: str = ""


class InternalRunLog(BaseModel):
    run_id: UUID
    level: str = "info"
    message: str


class InternalRunMetric(BaseModel):
    run_id: UUID
    cpu_percent: float = 0
    memory_bytes: int = 0
    thread_count: int = 0
    open_files: int = 0
    network_connections: int = 0
