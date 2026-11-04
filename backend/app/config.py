"""Settings from the environment (see .env.example)."""
import os
from dataclasses import dataclass, field
from pathlib import Path


def _list(name: str, default: str = "") -> list[str]:
    return [x.strip().lower() for x in os.getenv(name, default).split(",") if x.strip()]


@dataclass(frozen=True)
class Settings:
    # Owner connection: runs migrations and the few admin-only cross-tenant operations.
    database_url: str = os.getenv("KEROSOP_DATABASE_URL", "postgresql+psycopg://localhost:5433/kerosop")
    # Application connection: a role without BYPASSRLS, so row-level security always applies.
    app_database_url: str = os.getenv("KEROSOP_APP_DATABASE_URL", "postgresql+psycopg://kerosop_app:kerosop_app@localhost:5433/kerosop")
    firebase_project_id: str = os.getenv("KEROSOP_FIREBASE_PROJECT_ID", "kerosop-c907e")
    admin_emails: list[str] = field(default_factory=lambda: _list("KEROSOP_ADMIN_EMAILS", "ngclaire75@gmail.com"))
    cors_origins: list[str] = field(
        default_factory=lambda: _list("KEROSOP_CORS_ORIGINS", "http://localhost:3417,http://app.localhost:3417,https://app.kerosop.site,https://kerosop.site")
    )
    # Vercel preview deployments of this project, e.g. kerosop-abc123-clayclays-projects.vercel.app
    cors_origin_regex: str = os.getenv("KEROSOP_CORS_ORIGIN_REGEX", r"https://kerosop-[a-z0-9-]+-clayclays-projects\.vercel\.app")
    storage_dir: Path = Path(os.getenv("KEROSOP_STORAGE_DIR", Path(__file__).resolve().parent.parent / "storage"))
    max_upload_mb: int = int(os.getenv("KEROSOP_MAX_UPLOAD_MB", "20"))
    # OpenAI-compatible model endpoint: Ollama locally, vLLM or a hosted Qwen3 in production.
    llm_base_url: str = os.getenv("KEROSOP_LLM_BASE_URL", "http://localhost:11434")
    llm_model: str = os.getenv("KEROSOP_LLM_MODEL", "qwen3:8b")
    embed_model: str = os.getenv("KEROSOP_EMBED_MODEL", "qwen3-embedding:0.6b")
    llm_enabled: bool = os.getenv("KEROSOP_LLM_ENABLED", "1") == "1"
    llm_max_pairs: int = int(os.getenv("KEROSOP_LLM_MAX_PAIRS", "24"))
    # Demo requests are emailed to admin_emails. Gmail: smtp.gmail.com, port 587, an app password.
    smtp_host: str = os.getenv("KEROSOP_SMTP_HOST", "")
    smtp_port: int = int(os.getenv("KEROSOP_SMTP_PORT", "587"))
    smtp_user: str = os.getenv("KEROSOP_SMTP_USER", "")
    smtp_password: str = os.getenv("KEROSOP_SMTP_PASSWORD", "")
    smtp_from: str = os.getenv("KEROSOP_SMTP_FROM", "")
    # Testing only: accept "test:<uid>:<email>" bearer tokens instead of Firebase ID tokens.
    allow_test_tokens: bool = os.getenv("KEROSOP_ALLOW_TEST_TOKENS", "0") == "1"


settings = Settings()
