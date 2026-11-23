"""Standalone briefing script for free GitHub Actions scheduled cron runs."""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ai_service import ai_service
from app.email_service import fetch_imap_emails
from app.facebook_service import fetch_page_activity


async def send_telegram(message: str) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        print("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured; printing briefing to logs.")
        print(message)
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json={"chat_id": chat_id, "text": message})
        resp.raise_for_status()


async def main() -> None:
    owner = os.getenv("OWNER_NAME", "অলি আহাদ")
    emails: list[dict] = []
    fb_events: list[dict] = []

    if os.getenv("IMAP_USER") and os.getenv("IMAP_PASS"):
        try:
            emails, email_fb = fetch_imap_emails(limit=8)
            fb_events.extend(email_fb)
        except Exception as exc:
            print(f"IMAP sync skipped: {exc}")

    if os.getenv("FB_PAGE_ID") and os.getenv("FB_PAGE_ACCESS_TOKEN"):
        try:
            fb_events.extend(await fetch_page_activity(limit=5))
        except Exception as exc:
            print(f"Facebook Page sync skipped: {exc}")

    if not emails and not fb_events:
        print("No IMAP or Facebook credentials configured in GitHub Secrets yet. Exiting cleanly.")
        return

    briefing = ai_service.generate_greeting(owner, [], emails, fb_events)
    await send_telegram(f"🤖 আমার এআই আপডেট:\n\n{briefing}")


if __name__ == "__main__":
    asyncio.run(main())
