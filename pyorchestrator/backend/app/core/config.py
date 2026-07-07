from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    app_version: str = "0.1.13"

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "pyorchestrator"
    postgres_user: str = "pyorch"
    postgres_password: str = "pyorch_secret"

    redis_url: str = "redis://redis:6379/0"

    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "pyorchestrator"
    minio_secure: bool = False
    minio_console_port: int = 9001
    minio_console_enabled: bool = False
    minio_console_public_url: str = ""

    grafana_public_url: str = ""
    grafana_internal_url: str = "http://grafana:3000"

    secret_master_key: str = "change-me-in-production-32chars!!"
    jwt_secret: str = "jwt-dev-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173"

    runtime_queue_key: str = "runtime:jobs"
    internal_api_key: str = "internal-dev-key"
    scheduler_reload_channel: str = "scheduler:reload"
    script_updated_channel: str = "script:updated"

    mcp_internal_url: str = "http://mcp:8010"
    mcp_public_url: str = "http://localhost:8010"
    mcp_transport: str = "streamable-http"

    default_admin_email: str = "admin@pyorchestrator.local"
    default_admin_password: str = "admin"

    backend_port: int = 8000

    github_update_repo: str = "PyOrchestrator/PyOrchestrator"
    github_update_token: str | None = None

    update_executor_enabled: bool = True
    update_deploy_mode: str = "docker"
    update_compose_file: str = "/deploy/docker-compose.yml"
    update_project_root: str = "/deploy"
    update_host_project_root: str = ""
    update_data_dir: str = "/app/data/updates"
    update_data_volume: str = "pyorchestrator_update_data"
    update_docker_network: str = "pyorchestrator_pyorch-net"
    update_health_url: str = "http://backend:8000/health"
    update_runner_image: str = "docker:26-cli"
    compose_project_name: str = "pyorchestrator"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
