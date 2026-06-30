# PyOrchestrator — Database ER Model

PostgreSQL 16. All tables use UUID primary keys unless noted. Timestamps: `created_at`, `updated_at` on every entity.

---

## ER Diagram

```mermaid
erDiagram
    users ||--o{ user_roles : has
    roles ||--o{ user_roles : assigned
    roles ||--o{ role_permissions : grants
    permissions ||--o{ role_permissions : includes

    users ||--o{ audit_logs : performs
    users ||--o{ notifications : receives

    groups ||--o{ scripts : contains
    groups ||--o{ group_permissions : scoped

    scripts ||--o{ script_files : has
    scripts ||--o{ script_secrets : stores
    scripts ||--o{ script_dependencies : lists
    scripts ||--o{ schedules : scheduled_by
    scripts ||--o{ runs : executes
    scripts ||--o{ script_metrics : aggregates
    scripts }o--o| script_templates : cloned_from

    schedules ||--o{ schedule_triggers : has
    schedules ||--o{ runs : triggers

    runs ||--o{ run_logs : streams
    runs ||--o{ run_metrics : snapshots
    runs ||--o{ run_events : emits

    scripts ||--o{ webhooks : exposes
    notification_channels ||--o{ notification_rules : delivers
    notification_rules }o--|| scripts : optional_scope

    backups ||--o{ backup_items : contains
    system_updates ||--o{ update_artifacts : tracks

    users {
        uuid id PK
        string email UK
        string password_hash
        string display_name
        boolean is_active
        timestamptz last_login_at
    }

    roles {
        uuid id PK
        string name UK
        string description
    }

    permissions {
        uuid id PK
        string code UK
        string resource
        string action
    }

    user_roles {
        uuid user_id FK
        uuid role_id FK
        uuid group_id FK "nullable, group-scoped role"
    }

    groups {
        uuid id PK
        string name UK
        string description
        string color
        string icon
        jsonb default_permissions
    }

    group_permissions {
        uuid id PK
        uuid group_id FK
        uuid role_id FK
        uuid user_id FK
    }

    scripts {
        uuid id PK
        uuid group_id FK
        string name
        string slug UK
        string description
        enum script_type "script|bot"
        enum status "enabled|disabled|archived"
        text entrypoint "main.py"
        bigint storage_quota_bytes
        int max_concurrent_runs
        int max_runtime_seconds
        bigint max_memory_bytes
        float max_cpu_percent
        int restart_policy "0=never,1=on_failure,2=always"
        uuid template_id FK
        int version
        jsonb metadata
    }

    script_files {
        uuid id PK
        uuid script_id FK
        string path UK "relative path"
        text content "nullable if blob in MinIO"
        string content_hash
        enum file_type "source|config|data|asset|requirements"
        bigint size_bytes
    }

    script_dependencies {
        uuid id PK
        uuid script_id FK
        string package_name
        string version_spec
        enum source "requirements|manual"
    }

    script_secrets {
        uuid id PK
        uuid script_id FK
        string key UK "per script"
        bytea ciphertext
        bytea nonce
        string description
        timestamptz rotated_at
    }

    script_templates {
        uuid id PK
        string name UK
        string description
        string category
        jsonb file_tree
        boolean is_system
    }

    schedules {
        uuid id PK
        uuid script_id FK
        string name
        enum trigger_type "cron|interval|once|webhook|event|api"
        string cron_expression
        int interval_seconds
        timestamptz start_at
        timestamptz end_at
        int max_instances
        int max_runtime_seconds
        jsonb retry_policy
        boolean is_active
        timestamptz next_run_at
    }

    schedule_triggers {
        uuid id PK
        uuid schedule_id FK
        enum trigger_type "on_script_complete|webhook|mqtt|custom"
        uuid source_script_id FK
        string webhook_token UK
        jsonb trigger_config
    }

    runs {
        uuid id PK
        uuid script_id FK
        uuid schedule_id FK
        uuid triggered_by_user_id FK
        enum trigger_type "manual|cron|interval|webhook|event|api"
        enum status "queued|running|success|failed|cancelled|timeout"
        int exit_code
        text error_message
        timestamptz queued_at
        timestamptz started_at
        timestamptz finished_at
        int duration_ms
        int restart_count
        string runtime_hostname
    }

    run_logs {
        bigserial id PK
        uuid run_id FK
        timestamptz ts
        enum level "debug|info|warn|error"
        text message
        jsonb context
    }

    run_metrics {
        uuid id PK
        uuid run_id FK
        timestamptz sampled_at
        float cpu_percent
        bigint memory_bytes
        int thread_count
        int open_files
        int network_connections
    }

    run_events {
        uuid id PK
        uuid run_id FK
        string event_type
        jsonb payload
        timestamptz ts
    }

    script_metrics {
        uuid script_id PK_FK
        bigint total_runs
        bigint success_count
        bigint error_count
        bigint restart_count
        float avg_duration_ms
        timestamptz last_run_at
        timestamptz next_run_at
        float last_cpu_percent
        bigint last_memory_bytes
    }

    webhooks {
        uuid id PK
        uuid script_id FK
        string token UK
        string name
        boolean is_active
        timestamptz last_invoked_at
    }

    notification_channels {
        uuid id PK
        uuid user_id FK
        enum channel_type "email|telegram|webhook|internal"
        jsonb config
        boolean is_verified
    }

    notification_rules {
        uuid id PK
        uuid channel_id FK
        uuid script_id FK "nullable"
        enum event_type "started|completed|failed|memory_limit|timeout|system"
        boolean is_active
    }

    notifications {
        uuid id PK
        uuid user_id FK
        uuid run_id FK
        string title
        text body
        enum severity "info|warning|error"
        boolean is_read
        timestamptz read_at
    }

    backups {
        uuid id PK
        uuid created_by_user_id FK
        enum backup_type "manual|scheduled|pre_update"
        enum status "pending|completed|failed"
        string storage_path
        bigint size_bytes
        jsonb manifest
        timestamptz completed_at
    }

    backup_items {
        uuid id PK
        uuid backup_id FK
        enum item_type "scripts|settings|secrets|groups|schedules|database|logs"
        string path
        bigint size_bytes
    }

    system_updates {
        uuid id PK
        string from_version
        string to_version
        enum status "available|downloading|applying|completed|rolled_back|failed"
        string artifact_path
        jsonb changelog
        timestamptz applied_at
    }

    update_artifacts {
        uuid id PK
        uuid update_id FK
        string filename
        string checksum_sha256
        bigint size_bytes
    }

    audit_logs {
        bigserial id PK
        uuid user_id FK
        string action
        string resource_type
        uuid resource_id
        jsonb details
        inet ip_address
        timestamptz ts
    }

    system_settings {
        string key PK
        jsonb value
        string description
    }
```

---

## Key Indexes

```sql
CREATE INDEX idx_scripts_group_status ON scripts(group_id, status);
CREATE INDEX idx_scripts_slug ON scripts(slug);
CREATE INDEX idx_runs_script_status ON runs(script_id, status, queued_at DESC);
CREATE INDEX idx_runs_queued_at ON runs(queued_at DESC) WHERE status IN ('queued', 'running');
CREATE INDEX idx_schedules_next_run ON schedules(next_run_at) WHERE is_active = true;
CREATE INDEX idx_run_logs_run_ts ON run_logs(run_id, ts);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_audit_logs_ts ON audit_logs(ts DESC);
```

---

## Enums Reference

### `scripts.status`
`enabled` | `disabled` | `archived`

### `runs.status`
`queued` | `running` | `success` | `failed` | `cancelled` | `timeout`

### `schedules.trigger_type`
`cron` | `interval` | `once` | `webhook` | `event` | `api`

### `notification_rules.event_type`
`started` | `completed` | `failed` | `memory_limit` | `timeout` | `system` | `service_down`

---

## Redis Key Schema (non-relational)

| Key pattern | Purpose |
|-------------|---------|
| `runtime:jobs` | List — pending run jobs |
| `runtime:run:{run_id}:logs` | Stream — live log lines |
| `runtime:run:{run_id}:status` | Hash — pid, phase, metrics |
| `scheduler:reload` | Pub/sub — schedule refresh |
| `script:updated:{script_id}` | Pub/sub — invalidate venv |
| `session:{token}` | String — user session |
| `ratelimit:hook:{token}` | Counter — webhook rate limit |

---

## MinIO ↔ DB Relationship

- `script_files.content` may be NULL when `size_bytes > threshold`; full content lives at `s3://scripts/{script_id}/{path}`.
- `backups.storage_path` points to `s3://backups/{backup_id}/snapshot.tar.zst`.
- `runs` may reference artifact prefix `s3://runs/{run_id}/`.
