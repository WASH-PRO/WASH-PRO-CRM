import enum


class ScriptStatus(str, enum.Enum):
    ENABLED = "enabled"
    DISABLED = "disabled"
    ARCHIVED = "archived"


class ScriptType(str, enum.Enum):
    SCRIPT = "script"
    BOT = "bot"


class RunStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class TriggerType(str, enum.Enum):
    MANUAL = "manual"
    CRON = "cron"
    INTERVAL = "interval"
    ONCE = "once"
    WEBHOOK = "webhook"
    EVENT = "event"
    API = "api"


class RoleName(str, enum.Enum):
    ADMINISTRATOR = "Administrator"
    DEVELOPER = "Developer"
    OPERATOR = "Operator"
    VIEWER = "Viewer"


class NotificationSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class BackupStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
