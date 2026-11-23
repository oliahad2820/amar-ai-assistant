from __future__ import annotations

import hashlib
import hmac
from typing import Any

import httpx

from .ai_service import ai_service
from .config import settings

GRAPH_API_BASE = "https://graph.facebook.com/v21.0"


def verify_webhook_signature(raw_body: bytes, signature_header: str | None) -> bool:
    if not settings.fb_app_secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(
        settings.fb_app_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature_header.split("=", 1)[1], expected)


async def fetch_page_activity(limit: int = 10) -> list[dict[str, Any]]:
    """Fetches recent comments & reactions from a Facebook Page via official Meta Graph API."""
    if not settings.fb_page_id or not settings.fb_page_access_token:
        raise ValueError(
            "FB_PAGE_ID এবং FB_PAGE_ACCESS_TOKEN সেট করা নেই। পার্সোনাল প্রোফাইলের জন্য ইমেইল অ্যালার্ট সিঙ্ক ব্যবহার করুন।"
        )

    url = f"{GRAPH_API_BASE}/{settings.fb_page_id}/feed"
    params = {
        "fields": "id,message,permalink_url,comments.limit(5){id,from,message,created_time},reactions.limit(5).summary(true){id,name,type}",
        "limit": limit,
        "access_token": settings.fb_page_access_token,
    }
    events: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        payload = resp.json()

    for post in payload.get("data", []):
        post_title = (post.get("message") or "Facebook Post")[:80]
        post_url = post.get("permalink_url", "https://www.facebook.com")

        for comment in post.get("comments", {}).get("data", []):
            actor = (comment.get("from") or {}).get("name", "Page Visitor")
            text = comment.get("message", "")
            events.append(
                {
                    "external_id": f"fb-comment-{comment['id']}",
                    "source": "page_api",
                    "event_type": "comment",
                    "actor_name": actor,
                    "post_title": post_title,
                    "content": text,
                    "url": post_url,
                    "suggested_reply": ai_service.suggest_fb_reply(actor, "comment", text),
                    "created_at": comment.get("created_time"),
                }
            )

        for reaction in post.get("reactions", {}).get("data", []):
            actor = reaction.get("name", "Page Visitor")
            rtype = reaction.get("type", "LIKE").lower()
            events.append(
                {
                    "external_id": f"fb-react-{post['id']}-{reaction.get('id', actor)}",
                    "source": "page_api",
                    "event_type": "like",
                    "actor_name": actor,
                    "post_title": post_title,
                    "content": f"আপনার পোস্টে {rtype} রিঅ্যাকশন দিয়েছে।",
                    "url": post_url,
                    "suggested_reply": ai_service.suggest_fb_reply(actor, "like", rtype),
                }
            )

    return events


def parse_webhook_payload(body: dict[str, Any]) -> list[dict[str, Any]]:
    """Parses incoming Meta Page Webhook notifications for feed comments & reactions."""
    events: list[dict[str, Any]] = []
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "feed":
                continue
            val = change.get("value", {})
            item = val.get("item", "")
            actor = (val.get("from") or {}).get("name", "Facebook User")
            if item == "comment":
                cid = val.get("comment_id") or f"{entry.get('id')}-{val.get('created_time')}"
                msg = val.get("message", "")
                events.append(
                    {
                        "external_id": f"fb-wh-comment-{cid}",
                        "source": "page_api",
                        "event_type": "comment",
                        "actor_name": actor,
                        "post_title": "Page Post",
                        "content": msg,
                        "url": "https://www.facebook.com",
                        "suggested_reply": ai_service.suggest_fb_reply(actor, "comment", msg),
                    }
                )
            elif item == "reaction":
                rtype = val.get("reaction_type", "like")
                rid = val.get("post_id", "post")
                events.append(
                    {
                        "external_id": f"fb-wh-react-{rid}-{actor}-{val.get('created_time', '')}",
                        "source": "page_api",
                        "event_type": "like",
                        "actor_name": actor,
                        "post_title": "Page Post",
                        "content": f"পোস্টে {rtype} দিয়েছে।",
                        "url": "https://www.facebook.com",
                        "suggested_reply": ai_service.suggest_fb_reply(actor, "like", rtype),
                    }
                )
    return events
