from __future__ import annotations

import email
import imaplib
import re
import smtplib
from email.header import decode_header
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Any

from .ai_service import ai_service
from .config import settings


def _decode_mime(value: str | None) -> str:
    if not value:
        return ""
    parts = decode_header(value)
    decoded = []
    for raw, enc in parts:
        if isinstance(raw, bytes):
            decoded.append(raw.decode(enc or "utf-8", errors="replace"))
        else:
            decoded.append(str(raw))
    return "".join(decoded).strip()


def _extract_body(msg: email.message.Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            disp = str(part.get("Content-Disposition", ""))
            if ctype == "text/plain" and "attachment" not in disp:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace").strip()
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace").strip()
    return ""


def parse_facebook_notification_email(
    sender: str, subject: str, body: str, message_id: str
) -> dict[str, Any] | None:
    """Safely extracts Personal Facebook likes/comments/mentions from Facebook email alerts."""
    sender_lower = sender.lower()
    if "facebookmail.com" not in sender_lower and "facebook" not in sender_lower:
        return None

    subj_clean = subject.strip()
    lower = f"{subj_clean} {body[:400]}".lower()

    if any(k in lower for k in ("commented", "replied", "কমেন্ট", "মন্তব্য")):
        event_type = "comment"
    elif any(k in lower for k in ("liked", "reacted", "লাইক", "love")):
        event_type = "like"
    elif any(k in lower for k in ("mentioned", "tagged", "ট্যাগ")):
        event_type = "mention"
    elif any(k in lower for k in ("sent you a message", "মেসেজ")):
        event_type = "message"
    else:
        event_type = "notification"

    # Extract actor name before action verbs like "commented on", "liked", "tagged"
    actor_match = re.match(
        r"^([A-Za-z0-9\u0980-\u09FF ._-]{2,40}?)\s+(?:commented|liked|reacted|mentioned|tagged|replied|sent)",
        subj_clean,
        flags=re.IGNORECASE,
    )
    actor_name = actor_match.group(1).strip() if actor_match else "Facebook User"

    url_match = re.search(r"https?://(?:www\.|m\.)?facebook\.com/[^\s\"'<>]+", body)
    fb_url = url_match.group(0) if url_match else "https://www.facebook.com/notifications"

    content = body[:240].strip() or subj_clean
    return {
        "external_id": f"fb-email-{message_id}",
        "source": "email_alert",
        "event_type": event_type,
        "actor_name": actor_name,
        "post_title": subj_clean,
        "content": content,
        "url": fb_url,
        "suggested_reply": ai_service.suggest_fb_reply(actor_name, event_type, content),
    }


def fetch_imap_emails(limit: int = 12) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Fetches recent emails via IMAP (supports Gmail App Password & custom domain webmail)."""
    if not settings.imap_user or not settings.imap_pass:
        raise ValueError(
            "IMAP_USER এবং IMAP_PASS সেট করা নেই। .env ফাইলে Gmail App Password অথবা ডোমেইন ইমেইল তথ্য দিন।"
        )

    fetched_emails: list[dict[str, Any]] = []
    fb_alerts: list[dict[str, Any]] = []

    with imaplib.IMAP4_SSL(settings.imap_host, settings.imap_port) as mail:
        mail.login(settings.imap_user, settings.imap_pass)
        mail.select("INBOX")
        status, data = mail.search(None, "ALL")
        if status != "OK" or not data or not data[0]:
            return [], []

        ids = data[0].split()[-limit:]
        for num in reversed(ids):
            res_status, msg_data = mail.fetch(num, "(RFC822)")
            if res_status != "OK" or not msg_data or not isinstance(msg_data[0], tuple):
                continue
            msg = email.message_from_bytes(msg_data[0][1])
            msg_id = _decode_mime(msg.get("Message-ID")) or f"imap-{num.decode()}"
            sender_raw = _decode_mime(msg.get("From"))
            sender_name, sender_addr = parseaddr(sender_raw)
            sender = sender_name or sender_addr or "Unknown"
            subject = _decode_mime(msg.get("Subject")) or "(বিষয় নেই)"
            body = _extract_body(msg)
            snippet = body[:180].replace("\n", " ").strip()

            if settings.fb_parse_email_alerts:
                fb_event = parse_facebook_notification_email(sender_raw, subject, body, msg_id)
                if fb_event:
                    fb_alerts.append(fb_event)

            analysis = ai_service.summarize_email(sender, subject, body)
            fetched_emails.append(
                {
                    "message_id": msg_id,
                    "sender": sender,
                    "subject": subject,
                    "snippet": snippet,
                    "body": body[:4000],
                    "urgency": analysis["urgency"],
                    "summary_bn": analysis["summary_bn"],
                    "draft_reply": analysis["draft_reply"],
                }
            )

    return fetched_emails, fb_alerts


def send_approved_email(to_address: str, subject: str, body: str) -> None:
    """Sends a reply ONLY after explicit user approval."""
    if not settings.imap_user or not settings.imap_pass:
        raise ValueError("SMTP পাঠানোর জন্য IMAP_USER এবং IMAP_PASS কনফিগার করতে হবে।")

    msg = EmailMessage()
    msg["From"] = settings.imap_user
    msg["To"] = to_address
    msg["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.starttls()
        smtp.login(settings.imap_user, settings.imap_pass)
        smtp.send_message(msg)
