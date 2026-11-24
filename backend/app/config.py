from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv

_BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BASE_DIR / ".env")
load_dotenv(_BASE_DIR.parent / ".env")


@dataclass(frozen=True)
class Settings:
    assistant_name: str = os.getenv("ASSISTANT_NAME", "আমার এআই")
    owner_name: str = os.getenv("OWNER_NAME", "অলি আহাদ")
    timezone: str = os.getenv("TIMEZONE", "Asia/Dhaka")

    # Multi-provider unlimited free AI chain
    ai_provider_order: str = os.getenv("AI_PROVIDER_ORDER", "ollama,gemini,openai_compat")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")

    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-4-hydrogen")

    openai_compat_base_url: str = os.getenv(
        "OPENAI_COMPAT_BASE_URL", "https://api.groq.com/openai/v1"
    )
    openai_compat_api_key: str = os.getenv("OPENAI_COMPAT_API_KEY", "")
    openai_compat_model: str = os.getenv(
        "OPENAI_COMPAT_MODEL", "llama-3.3-70b-versatile"
    )

    backend_api_token: str = os.getenv("BACKEND_API_TOKEN", "")
    cors_origins: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,https://oliahad2820.github.io",
    )

    db_path: str = os.getenv("DB_PATH", str(_BASE_DIR / "data" / "assistant.db"))

    # Email (Gmail App Password or Custom Domain IMAP/SMTP)
    imap_host: str = os.getenv("IMAP_HOST", "imap.gmail.com")
    imap_port: int = int(os.getenv("IMAP_PORT", "993"))
    imap_user: str = os.getenv("IMAP_USER", "")
    imap_pass: str = os.getenv("IMAP_PASS", "")
    smtp_host: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))

    # Facebook Page Graph API + Personal Safe Email Parser
    fb_page_id: str = os.getenv("FB_PAGE_ID", "")
    fb_page_access_token: str = os.getenv("FB_PAGE_ACCESS_TOKEN", "")
    fb_verify_token: str = os.getenv("FB_VERIFY_TOKEN", "amar_ai_fb_verify_token")
    fb_app_secret: str = os.getenv("FB_APP_SECRET", "")
    fb_parse_email_alerts: bool = (
        os.getenv("FB_PARSE_EMAIL_ALERTS", "true").lower() == "true"
    )

    checkin_interval_minutes: int = int(os.getenv("CHECKIN_INTERVAL_MINUTES", "60"))

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def provider_order_list(self) -> list[str]:
        return [p.strip().lower() for p in self.ai_provider_order.split(",") if p.strip()]


settings = Settings()
