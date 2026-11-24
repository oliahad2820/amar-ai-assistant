from __future__ import annotations

from fastapi.testclient import TestClient

from app import main as app_main
from app.database import Database


def make_client(tmp_path) -> TestClient:
    app_main.db = Database(str(tmp_path / "test_assistant.db"))
    return TestClient(app_main.app)


def test_health_and_dashboard(tmp_path):
    client = make_client(tmp_path)
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.headers.get("access-control-allow-private-network") == "true"
    assert "provider_order" in res.json()

    voices = client.get("/api/tts/voices")
    assert voices.status_code == 200
    assert any(v["id"] == "bn-BD-NabanitaNeural" for v in voices.json())

    dash = client.get("/api/dashboard")
    assert dash.status_code == 200
    assert dash.json()["stats"]["total_tasks"] == 0


def test_task_lifecycle_auto_plan_and_checkin(tmp_path):
    client = make_client(tmp_path)

    t1 = client.post(
        "/api/tasks",
        json={"title": "অফিসের মাসিক রিপোর্ট তৈরি", "priority": "urgent", "estimated_minutes": 60},
    ).json()
    t2 = client.post(
        "/api/tasks",
        json={
            "title": "বসকে রিপোর্ট ইমেইল করা",
            "priority": "high",
            "estimated_minutes": 20,
            "depends_on_id": t1["id"],
        },
    ).json()

    plan_res = client.post("/api/planner/auto-plan", json={"start_hour": 9, "start_minute": 0})
    assert plan_res.status_code == 200
    tasks = plan_res.json()["tasks"]
    assert tasks[0]["id"] == t1["id"]
    assert tasks[0]["scheduled_start"] == "09:00"
    assert tasks[1]["id"] == t2["id"]
    assert tasks[1]["scheduled_start"] == "10:10"

    # Mark first task done and run proactive check-in
    client.patch(f"/api/tasks/{t1['id']}", json={"status": "done"})
    checkin = client.post("/api/planner/checkin")
    assert checkin.status_code == 200
    assert checkin.json()["completion_rate"] == 50
    assert checkin.json()["summary_bn"]


def test_email_ingest_extracts_facebook_alert_and_task(tmp_path):
    client = make_client(tmp_path)

    res = client.post(
        "/api/emails",
        json={
            "sender": "Facebook <notification@facebookmail.com>",
            "subject": "Rahim Ahmed commented on your post",
            "body": "Rahim Ahmed wrote: দারুণ হয়েছে ভাই! https://www.facebook.com/post/123",
        },
    )
    assert res.status_code == 200
    email_id = res.json()["id"]

    # Should have parsed personal FB notification safely
    fb_events = client.get("/api/facebook").json()
    assert len(fb_events) == 1
    assert fb_events[0]["actor_name"] == "Rahim Ahmed"
    assert fb_events[0]["event_type"] == "comment"

    # Extract task from email
    ext = client.post(f"/api/emails/{email_id}/extract-task")
    assert ext.status_code == 200
    assert "ইমেইল ফলো-আপ" in ext.json()["task"]["title"]


def test_facebook_webhook_and_presence_greeting(tmp_path):
    client = make_client(tmp_path)

    # Verify webhook handshake
    verify = client.get(
        "/api/facebook/webhook",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "amar_ai_fb_verify_token",
            "hub.challenge": "CHALLENGE_OK",
        },
    )
    assert verify.status_code == 200
    assert verify.text == "CHALLENGE_OK"

    # Receive live page comment webhook
    wh = client.post(
        "/api/facebook/webhook",
        json={
            "entry": [
                {
                    "id": "page_1",
                    "changes": [
                        {
                            "field": "feed",
                            "value": {
                                "item": "comment",
                                "comment_id": "c_999",
                                "from": {"name": "Karim Uddin"},
                                "message": "দাম কত ভাই?",
                            },
                        }
                    ],
                }
            ]
        },
    )
    assert wh.status_code == 200
    assert wh.json()["received"] == 1

    # Trigger camera arrival greeting
    greet = client.post("/api/presence/event", json={"event_type": "arrived", "face_position": "center"})
    assert greet.status_code == 200
    assert "আসসালামু আলাইকুম" in greet.json()["greeting_text"]

    # Chat query
    chat_res = client.post("/api/chat", json={"message": "ফেসবুকে কে কমেন্ট করলো?"})
    assert chat_res.status_code == 200
    assert "Karim Uddin" in chat_res.json()["reply"]
