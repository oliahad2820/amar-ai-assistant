from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from .ai_service import ai_service
from .config import settings
from .database import Database
from .email_service import fetch_imap_emails, parse_facebook_notification_email, send_approved_email
from .facebook_service import fetch_page_activity, parse_webhook_payload, verify_webhook_signature
from .planner_service import build_daily_plan, evaluate_checkin

db = Database()


class ConnectionManager:
    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, event: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


ws_manager = ConnectionManager()


async def _proactive_checkin_loop() -> None:
    interval = max(5, settings.checkin_interval_minutes) * 60
    while True:
        await asyncio.sleep(interval)
        tasks = db.list_tasks()
        if not tasks:
            continue
        evaluation = evaluate_checkin(tasks)
        checkin = db.create_checkin(**evaluation)
        await ws_manager.broadcast({"type": "proactive_checkin", "data": checkin})


@asynccontextmanager
async def lifespan(_app: FastAPI):
    loop_task = asyncio.create_task(_proactive_checkin_loop())
    try:
        yield
    finally:
        loop_task.cancel()


app = FastAPI(
    title="Amar AI Personal Assistant API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_auth(authorization: str | None = Header(default=None)) -> None:
    if not settings.backend_api_token:
        return
    if authorization != f"Bearer {settings.backend_api_token}":
        raise HTTPException(status_code=401, detail="অননুমোদিত অ্যাক্সেস (Invalid API Token)")


# ---------- SCHEMAS ----------
class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=240)
    description: str = ""
    category: str = "অফিস"
    priority: str = "normal"
    estimated_minutes: int = Field(default=45, ge=5, le=480)
    depends_on_id: int | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    priority: str | None = None
    estimated_minutes: int | None = None
    status: str | None = None
    depends_on_id: int | None = None
    scheduled_start: str | None = None
    scheduled_end: str | None = None


class AutoPlanRequest(BaseModel):
    start_hour: int = Field(default=9, ge=0, le=23)
    start_minute: int = Field(default=0, ge=0, le=59)
    break_minutes: int = Field(default=10, ge=0, le=60)


class PresenceEventRequest(BaseModel):
    event_type: str = "arrived"
    face_position: str = "center"
    owner_name: str | None = None


class EmailIngestRequest(BaseModel):
    sender: str
    subject: str
    body: str = ""


class SendReplyRequest(BaseModel):
    to_address: str
    reply_body: str
    confirmed: bool = False


class FacebookManualEventRequest(BaseModel):
    actor_name: str
    event_type: str = "comment"
    post_title: str = "আমার পোস্ট"
    content: str = ""
    url: str = "https://www.facebook.com"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    previous_interaction_id: str | None = None


# ---------- ROUTES ----------
@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "assistant": settings.assistant_name,
        "owner": settings.owner_name,
        "gemini_configured": bool(settings.gemini_api_key),
        "imap_configured": bool(settings.imap_user and settings.imap_pass),
        "facebook_page_configured": bool(settings.fb_page_id and settings.fb_page_access_token),
    }


@app.get("/api/dashboard", dependencies=[Depends(require_auth)])
def get_dashboard() -> dict[str, Any]:
    tasks = db.list_tasks()
    emails = db.list_emails()
    fb = db.list_facebook_events()
    checkins = db.list_checkins(limit=5)
    return {
        "owner_name": settings.owner_name,
        "assistant_name": settings.assistant_name,
        "tasks": tasks,
        "emails": emails,
        "facebook_events": fb,
        "checkins": checkins,
        "stats": {
            "total_tasks": len(tasks),
            "done_tasks": sum(1 for t in tasks if t["status"] == "done"),
            "unread_emails": sum(1 for e in emails if not e["is_read"]),
            "unread_facebook": sum(1 for f in fb if not f["is_read"]),
        },
    }


@app.get("/api/tasks", dependencies=[Depends(require_auth)])
def list_tasks() -> list[dict[str, Any]]:
    return db.list_tasks()


@app.post("/api/tasks", dependencies=[Depends(require_auth)])
def create_task(payload: TaskCreate) -> dict[str, Any]:
    return db.create_task(payload.model_dump())


@app.patch("/api/tasks/{task_id}", dependencies=[Depends(require_auth)])
def update_task(task_id: int, payload: TaskUpdate) -> dict[str, Any]:
    updated = db.update_task(task_id, payload.model_dump(exclude_none=True))
    if not updated:
        raise HTTPException(status_code=404, detail="কাজটি পাওয়া যায়নি")
    return updated


@app.delete("/api/tasks/{task_id}", dependencies=[Depends(require_auth)])
def delete_task(task_id: int) -> dict[str, bool]:
    if not db.delete_task(task_id):
        raise HTTPException(status_code=404, detail="কাজটি পাওয়া যায়নি")
    return {"deleted": True}


@app.post("/api/planner/auto-plan", dependencies=[Depends(require_auth)])
def auto_plan(payload: AutoPlanRequest) -> dict[str, Any]:
    tasks = db.list_tasks()
    planned = build_daily_plan(
        tasks,
        start_hour=payload.start_hour,
        start_minute=payload.start_minute,
        break_minutes=payload.break_minutes,
    )
    for item in planned:
        db.update_task(
            item["id"],
            {
                "order_index": item["order_index"],
                "scheduled_start": item["scheduled_start"],
                "scheduled_end": item["scheduled_end"],
                "rationale_bn": item["rationale_bn"],
            },
        )
    return {"planned_count": len(planned), "tasks": db.list_tasks()}


@app.post("/api/planner/checkin", dependencies=[Depends(require_auth)])
async def run_checkin() -> dict[str, Any]:
    evaluation = evaluate_checkin(db.list_tasks())
    checkin = db.create_checkin(**evaluation)
    await ws_manager.broadcast({"type": "proactive_checkin", "data": checkin})
    return checkin


@app.post("/api/presence/event", dependencies=[Depends(require_auth)])
async def presence_event(payload: PresenceEventRequest) -> dict[str, Any]:
    owner = payload.owner_name or settings.owner_name
    greeting = ""
    if payload.event_type == "arrived":
        greeting = ai_service.generate_greeting(
            owner, db.list_tasks(), db.list_emails(), db.list_facebook_events()
        )
    record = db.log_presence(payload.event_type, payload.face_position, greeting)
    await ws_manager.broadcast({"type": "presence", "data": record})
    return record


@app.get("/api/emails", dependencies=[Depends(require_auth)])
def list_emails() -> list[dict[str, Any]]:
    return db.list_emails()


@app.post("/api/emails", dependencies=[Depends(require_auth)])
def ingest_email(payload: EmailIngestRequest) -> dict[str, Any]:
    analysis = ai_service.summarize_email(payload.sender, payload.subject, payload.body)
    saved = db.upsert_email(
        {
            "sender": payload.sender,
            "subject": payload.subject,
            "snippet": payload.body[:180],
            "body": payload.body,
            **analysis,
        }
    )
    fb_alert = parse_facebook_notification_email(
        payload.sender, payload.subject, payload.body, saved["message_id"]
    )
    if fb_alert:
        db.upsert_facebook_event(fb_alert)
    return saved


@app.post("/api/emails/sync", dependencies=[Depends(require_auth)])
def sync_emails() -> dict[str, Any]:
    try:
        emails_list, fb_alerts = fetch_imap_emails()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"IMAP সিঙ্ক ব্যর্থ হয়েছে: {exc}") from exc

    saved_emails = [db.upsert_email(e) for e in emails_list]
    saved_fb = [db.upsert_facebook_event(ev) for ev in fb_alerts]
    return {
        "synced_emails": len(saved_emails),
        "extracted_facebook_alerts": len(saved_fb),
        "emails": db.list_emails(),
    }


@app.post("/api/emails/{email_id}/extract-task", dependencies=[Depends(require_auth)])
def extract_task_from_email(email_id: int) -> dict[str, Any]:
    em = db.get_email(email_id)
    if not em:
        raise HTTPException(status_code=404, detail="ইমেইলটি পাওয়া যায়নি")
    task = db.create_task(
        {
            "title": f"ইমেইল ফলো-আপ: {em['subject']}",
            "description": em["summary_bn"] or em["snippet"],
            "category": "ইমেইল",
            "priority": "urgent" if em["urgency"] == "urgent" else "high",
            "estimated_minutes": 30,
        }
    )
    db.mark_email_read(email_id, extracted_task_id=task["id"])
    return {"task": task, "email": db.get_email(email_id)}


@app.post("/api/emails/{email_id}/send-reply", dependencies=[Depends(require_auth)])
def send_reply(email_id: int, payload: SendReplyRequest) -> dict[str, Any]:
    if not payload.confirmed:
        raise HTTPException(
            status_code=400,
            detail="নিরাপত্তার জন্য ইমেইল পাঠানোর আগে confirmed=true দিয়ে অনুমতি নিশ্চিত করতে হবে।",
        )
    em = db.get_email(email_id)
    if not em:
        raise HTTPException(status_code=404, detail="ইমেইলটি পাওয়া যায়নি")
    try:
        send_approved_email(payload.to_address, em["subject"], payload.reply_body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    db.mark_email_read(email_id)
    return {"sent": True}


@app.get("/api/facebook", dependencies=[Depends(require_auth)])
def list_facebook() -> list[dict[str, Any]]:
    return db.list_facebook_events()


@app.post("/api/facebook", dependencies=[Depends(require_auth)])
def add_facebook_event(payload: FacebookManualEventRequest) -> dict[str, Any]:
    data = payload.model_dump()
    data["source"] = "manual"
    data["suggested_reply"] = ai_service.suggest_fb_reply(
        payload.actor_name, payload.event_type, payload.content
    )
    return db.upsert_facebook_event(data)


@app.post("/api/facebook/sync", dependencies=[Depends(require_auth)])
async def sync_facebook() -> dict[str, Any]:
    try:
        events = await fetch_page_activity()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Facebook Graph API ত্রুটি: {exc}") from exc

    saved = [db.upsert_facebook_event(e) for e in events]
    return {"synced_events": len(saved), "events": db.list_facebook_events()}


@app.get("/api/facebook/webhook")
def verify_facebook_webhook(
    hub_mode: str = Query(default="", alias="hub.mode"),
    hub_verify_token: str = Query(default="", alias="hub.verify_token"),
    hub_challenge: str = Query(default="", alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == settings.fb_verify_token:
        return PlainTextResponse(content=hub_challenge, status_code=200)
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@app.post("/api/facebook/webhook")
async def receive_facebook_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None),
) -> dict[str, Any]:
    raw = await request.body()
    if not verify_webhook_signature(raw, x_hub_signature_256):
        raise HTTPException(status_code=403, detail="Invalid Meta webhook signature")
    payload = await request.json()
    parsed = parse_webhook_payload(payload)
    saved = [db.upsert_facebook_event(ev) for ev in parsed]
    for ev in saved:
        await ws_manager.broadcast({"type": "facebook_event", "data": ev})
    return {"received": len(saved)}


@app.post("/api/chat", dependencies=[Depends(require_auth)])
def chat(payload: ChatRequest) -> dict[str, Any]:
    return ai_service.chat(
        payload.message,
        tasks=db.list_tasks(),
        emails=db.list_emails(),
        fb_events=db.list_facebook_events(),
        previous_interaction_id=payload.previous_interaction_id,
    )


@app.websocket("/ws/live")
async def live_socket(ws: WebSocket) -> None:
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
