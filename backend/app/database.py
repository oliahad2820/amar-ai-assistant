from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .config import settings


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = Path(db_path or settings.db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT DEFAULT '',
                    category TEXT DEFAULT 'অফিস',
                    priority TEXT DEFAULT 'normal',
                    estimated_minutes INTEGER DEFAULT 45,
                    status TEXT DEFAULT 'pending',
                    depends_on_id INTEGER,
                    scheduled_start TEXT DEFAULT '',
                    scheduled_end TEXT DEFAULT '',
                    order_index INTEGER DEFAULT 0,
                    rationale_bn TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    completed_at TEXT DEFAULT ''
                );

                CREATE TABLE IF NOT EXISTS emails (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    message_id TEXT UNIQUE,
                    sender TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    snippet TEXT DEFAULT '',
                    body TEXT DEFAULT '',
                    urgency TEXT DEFAULT 'fyi',
                    summary_bn TEXT DEFAULT '',
                    draft_reply TEXT DEFAULT '',
                    is_read INTEGER DEFAULT 0,
                    extracted_task_id INTEGER,
                    received_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS facebook_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    external_id TEXT UNIQUE,
                    source TEXT DEFAULT 'page_api',
                    event_type TEXT DEFAULT 'comment',
                    actor_name TEXT NOT NULL,
                    post_title TEXT DEFAULT '',
                    content TEXT DEFAULT '',
                    url TEXT DEFAULT '',
                    suggested_reply TEXT DEFAULT '',
                    is_read INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS checkins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    status TEXT NOT NULL,
                    summary_bn TEXT NOT NULL,
                    recommendation_bn TEXT NOT NULL,
                    completion_rate INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS presence_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT NOT NULL,
                    face_position TEXT DEFAULT 'center',
                    greeting_text TEXT DEFAULT '',
                    created_at TEXT NOT NULL
                );
                """
            )

    # ---------- TASKS ----------
    def list_tasks(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM tasks
                ORDER BY
                    CASE status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                    order_index ASC,
                    id ASC
                """
            ).fetchall()
            return [dict(r) for r in rows]

    def get_task(self, task_id: int) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
            return dict(row) if row else None

    def create_task(self, payload: dict[str, Any]) -> dict[str, Any]:
        created = now_iso()
        with self.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO tasks (
                    title, description, category, priority, estimated_minutes,
                    status, depends_on_id, scheduled_start, scheduled_end,
                    order_index, rationale_bn, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["title"],
                    payload.get("description", ""),
                    payload.get("category", "অফিস"),
                    payload.get("priority", "normal"),
                    int(payload.get("estimated_minutes", 45)),
                    payload.get("status", "pending"),
                    payload.get("depends_on_id"),
                    payload.get("scheduled_start", ""),
                    payload.get("scheduled_end", ""),
                    int(payload.get("order_index", 0)),
                    payload.get("rationale_bn", ""),
                    created,
                ),
            )
            task_id = cur.lastrowid
        return self.get_task(int(task_id))  # type: ignore[arg-type]

    def update_task(self, task_id: int, updates: dict[str, Any]) -> dict[str, Any] | None:
        allowed = {
            "title",
            "description",
            "category",
            "priority",
            "estimated_minutes",
            "status",
            "depends_on_id",
            "scheduled_start",
            "scheduled_end",
            "order_index",
            "rationale_bn",
            "completed_at",
        }
        filtered = {k: v for k, v in updates.items() if k in allowed}
        if filtered.get("status") == "done" and "completed_at" not in filtered:
            filtered["completed_at"] = now_iso()
        if not filtered:
            return self.get_task(task_id)

        sets = ", ".join(f"{k} = ?" for k in filtered)
        values = list(filtered.values()) + [task_id]
        with self.connect() as conn:
            conn.execute(f"UPDATE tasks SET {sets} WHERE id = ?", values)
        return self.get_task(task_id)

    def delete_task(self, task_id: int) -> bool:
        with self.connect() as conn:
            cur = conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            return cur.rowcount > 0

    # ---------- EMAILS ----------
    def list_emails(self, limit: int = 30) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM emails ORDER BY received_at DESC, id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_email(self, email_id: int) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM emails WHERE id = ?", (email_id,)).fetchone()
            return dict(row) if row else None

    def upsert_email(self, payload: dict[str, Any]) -> dict[str, Any]:
        msg_id = payload.get("message_id") or f"local-{now_iso()}-{payload['subject'][:20]}"
        received = payload.get("received_at") or now_iso()
        with self.connect() as conn:
            existing = conn.execute(
                "SELECT * FROM emails WHERE message_id = ?", (msg_id,)
            ).fetchone()
            if existing:
                return dict(existing)
            cur = conn.execute(
                """
                INSERT INTO emails (
                    message_id, sender, subject, snippet, body, urgency,
                    summary_bn, draft_reply, is_read, received_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    msg_id,
                    payload["sender"],
                    payload["subject"],
                    payload.get("snippet", ""),
                    payload.get("body", ""),
                    payload.get("urgency", "fyi"),
                    payload.get("summary_bn", ""),
                    payload.get("draft_reply", ""),
                    int(payload.get("is_read", 0)),
                    received,
                ),
            )
            email_id = cur.lastrowid
        return self.get_email(int(email_id))  # type: ignore[arg-type]

    def mark_email_read(self, email_id: int, extracted_task_id: int | None = None) -> dict[str, Any] | None:
        with self.connect() as conn:
            if extracted_task_id is not None:
                conn.execute(
                    "UPDATE emails SET is_read = 1, extracted_task_id = ? WHERE id = ?",
                    (extracted_task_id, email_id),
                )
            else:
                conn.execute("UPDATE emails SET is_read = 1 WHERE id = ?", (email_id,))
        return self.get_email(email_id)

    # ---------- FACEBOOK EVENTS ----------
    def list_facebook_events(self, limit: int = 30) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM facebook_events ORDER BY created_at DESC, id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    def upsert_facebook_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        ext_id = payload.get("external_id") or f"fb-{now_iso()}-{payload['actor_name'][:12]}"
        created = payload.get("created_at") or now_iso()
        with self.connect() as conn:
            existing = conn.execute(
                "SELECT * FROM facebook_events WHERE external_id = ?", (ext_id,)
            ).fetchone()
            if existing:
                return dict(existing)
            cur = conn.execute(
                """
                INSERT INTO facebook_events (
                    external_id, source, event_type, actor_name, post_title,
                    content, url, suggested_reply, is_read, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    ext_id,
                    payload.get("source", "page_api"),
                    payload.get("event_type", "comment"),
                    payload["actor_name"],
                    payload.get("post_title", ""),
                    payload.get("content", ""),
                    payload.get("url", ""),
                    payload.get("suggested_reply", ""),
                    int(payload.get("is_read", 0)),
                    created,
                ),
            )
            row = conn.execute(
                "SELECT * FROM facebook_events WHERE id = ?", (cur.lastrowid,)
            ).fetchone()
            return dict(row)

    def mark_facebook_read(self, event_id: int) -> bool:
        with self.connect() as conn:
            cur = conn.execute(
                "UPDATE facebook_events SET is_read = 1 WHERE id = ?", (event_id,)
            )
            return cur.rowcount > 0

    # ---------- CHECK-INS & PRESENCE ----------
    def create_checkin(
        self,
        status: str,
        summary_bn: str,
        recommendation_bn: str,
        completion_rate: int,
    ) -> dict[str, Any]:
        created = now_iso()
        with self.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO checkins (status, summary_bn, recommendation_bn, completion_rate, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (status, summary_bn, recommendation_bn, completion_rate, created),
            )
            row = conn.execute(
                "SELECT * FROM checkins WHERE id = ?", (cur.lastrowid,)
            ).fetchone()
            return dict(row)

    def list_checkins(self, limit: int = 10) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT * FROM checkins ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]

    def log_presence(
        self, event_type: str, face_position: str, greeting_text: str
    ) -> dict[str, Any]:
        created = now_iso()
        with self.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO presence_logs (event_type, face_position, greeting_text, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (event_type, face_position, greeting_text, created),
            )
            row = conn.execute(
                "SELECT * FROM presence_logs WHERE id = ?", (cur.lastrowid,)
            ).fetchone()
            return dict(row)
