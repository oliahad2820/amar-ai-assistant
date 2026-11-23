from __future__ import annotations

import json
import logging
from typing import Any

from .config import settings

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION_BN = f"""তুমি '{settings.assistant_name}', {settings.owner_name}-এর ব্যক্তিগত এআই অ্যাসিস্ট্যান্ট।
নিয়মাবলি:
- সবসময় মার্জিত, আন্তরিক এবং সংক্ষিপ্ত বাংলায় উত্তর দাও (প্রয়োজনে টেকনিক্যাল শব্দ ইংরেজিতে রাখা যাবে)।
- ব্যবহারকারী ফিরে এলে 'আসসালামু আলাইকুম' বলে স্বাগত জানাও।
- অফিসের কাজের প্ল্যান করার সময় কোনটার পর কোনটা করলে ভালো হবে তা স্পষ্টভাবে বলো।
- প্রগ্রেস ফিডব্যাকে উৎসাহ দাও এবং সময় পিছিয়ে গেলে বাস্তবসম্মত রিশিডিউল সাজেশন দাও।
- কখনো ইমেইল বা ফেসবুক রিপ্লাই নিজে পাঠাবে না—আগে ড্রাফট দিয়ে অনুমতি নেবে।"""


class AIService:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
        self.model = model or settings.gemini_model
        self._client = None

    def _get_client(self):
        if not self.api_key:
            return None
        if self._client is None:
            try:
                from google import genai

                self._client = genai.Client(api_key=self.api_key)
            except Exception as exc:  # pragma: no cover
                logger.warning("Failed to initialize google-genai client: %s", exc)
                return None
        return self._client

    def _ask_gemini(
        self,
        prompt: str,
        previous_interaction_id: str | None = None,
        json_schema: dict[str, Any] | None = None,
    ) -> tuple[str | None, str | None]:
        client = self._get_client()
        if not client:
            return None, None
        try:
            kwargs: dict[str, Any] = {
                "model": self.model,
                "input": prompt,
                "system_instruction": SYSTEM_INSTRUCTION_BN,
            }
            if previous_interaction_id:
                kwargs["previous_interaction_id"] = previous_interaction_id
            if json_schema:
                kwargs["response_format"] = {
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": json_schema,
                }
            interaction = client.interactions.create(**kwargs)
            return interaction.output_text, getattr(interaction, "id", None)
        except Exception as exc:  # pragma: no cover
            logger.warning("Gemini API call failed, falling back cleanly: %s", exc)
            return None, None

    def generate_greeting(
        self,
        owner_name: str,
        tasks: list[dict[str, Any]],
        emails: list[dict[str, Any]],
        fb_events: list[dict[str, Any]],
    ) -> str:
        pending = [t for t in tasks if t["status"] != "done"]
        unread_emails = [e for e in emails if not e.get("is_read")]
        unread_fb = [f for f in fb_events if not f.get("is_read")]

        prompt = (
            f"{owner_name} এইমাত্র ডেস্কের সামনে এসেছেন। ২-৩ বাক্যে আন্তরিক বাংলায় "
            f"'আসসালামু আলাইকুম' বলে স্বাগত জানাও এবং সংক্ষেপে বলো: "
            f"বাকি কাজ {len(pending)}টি (সবচেয়ে জরুরি: {pending[0]['title'] if pending else 'কিছু নেই'}), "
            f"নতুন ইমেইল {len(unread_emails)}টি, নতুন ফেসবুক নোটিফিকেশন {len(unread_fb)}টি।"
        )
        text, _ = self._ask_gemini(prompt)
        if text:
            return text.strip()

        top_task = pending[0]["title"] if pending else "কোনো পেন্ডিং কাজ নেই"
        parts = [f"আসসালামু আলাইকুম {owner_name}! আপনাকে আবার দেখে ভালো লাগলো।"]
        if pending:
            parts.append(
                f"আজ আপনার {len(pending)}টি কাজ বাকি আছে—প্রথমে '{top_task}' দিয়ে শুরু করা ভালো হবে।"
            )
        else:
            parts.append("আজকের সব কাজ শেষ হয়ে গেছে!")
        if unread_emails or unread_fb:
            parts.append(
                f"এছাড়া {len(unread_emails)}টি নতুন ইমেইল আর {len(unread_fb)}টি ফেসবুক আপডেট অপেক্ষা করছে।"
            )
        return " ".join(parts)

    def summarize_email(
        self, sender: str, subject: str, body: str
    ) -> dict[str, str]:
        schema = {
            "type": "object",
            "properties": {
                "urgency": {
                    "type": "string",
                    "enum": ["urgent", "action_required", "fyi"],
                },
                "summary_bn": {"type": "string"},
                "draft_reply": {"type": "string"},
            },
            "required": ["urgency", "summary_bn", "draft_reply"],
        }
        prompt = (
            "নিচের ইমেইলটি বিশ্লেষণ করো। জরুরি মাত্রা (urgent/action_required/fyi), "
            "১ বাক্যে বাংলা সারাংশ এবং একটি ভদ্র ড্রাফট রিপ্লাই দাও।\n"
            f"প্রেরক: {sender}\nবিষয়: {subject}\nবিবরণ: {body[:1500]}"
        )
        raw, _ = self._ask_gemini(prompt, json_schema=schema)
        if raw:
            try:
                parsed = json.loads(raw)
                return {
                    "urgency": parsed.get("urgency", "fyi"),
                    "summary_bn": parsed.get("summary_bn", subject),
                    "draft_reply": parsed.get("draft_reply", ""),
                }
            except json.JSONDecodeError:
                pass

        lowered = f"{subject} {body}".lower()
        if any(k in lowered for k in ("urgent", "asap", "deadline", "জরুরি", "invoice", "payment")):
            urgency = "urgent"
        elif any(k in lowered for k in ("please", "review", "meeting", "confirm", "reply", "অফিস", "মিটিং")):
            urgency = "action_required"
        else:
            urgency = "fyi"

        return {
            "urgency": urgency,
            "summary_bn": f"{sender} থেকে '{subject}' বিষয়ে ইমেইল এসেছে।",
            "draft_reply": (
                f"আসসালামু আলাইকুম,\n\nআপনার ইমেইল ('{subject}') পেয়েছি। "
                "বিষয়টি দেখে শীঘ্রই বিস্তারিত জানাচ্ছি।\n\nধন্যবাদ।"
            ),
        }

    def suggest_fb_reply(self, actor_name: str, event_type: str, content: str) -> str:
        prompt = (
            f"ফেসবুকে {actor_name} একটি {event_type} করেছে: '{content[:300]}'।"
            "এর জন্য ১-২ বাক্যে আন্তরিক বাংলা রিপ্লাই ড্রাফট লেখো।"
        )
        text, _ = self._ask_gemini(prompt)
        if text:
            return text.strip()
        if event_type == "like":
            return f"অসংখ্য ধন্যবাদ {actor_name} ভাই/আপু!"
        return f"অনেক ধন্যবাদ {actor_name}! আপনার মন্তব্যের জন্য কৃতজ্ঞ, বিস্তারিত শীঘ্রই জানাচ্ছি।"

    def chat(
        self,
        message: str,
        tasks: list[dict[str, Any]],
        emails: list[dict[str, Any]],
        fb_events: list[dict[str, Any]],
        previous_interaction_id: str | None = None,
    ) -> dict[str, Any]:
        pending = [t for t in tasks if t["status"] != "done"]
        unread_emails = [e for e in emails if not e.get("is_read")]
        unread_fb = [f for f in fb_events if not f.get("is_read")]

        context_summary = (
            f"বর্তমান অবস্থা:\n"
            f"- বাকি কাজ ({len(pending)}টি): "
            + (", ".join(f"{t['title']} ({t['scheduled_start'] or t['priority']})" for t in pending[:6]) or "নেই")
            + f"\n- না পড়া ইমেইল ({len(unread_emails)}টি): "
            + (", ".join(f"{e['sender']}: {e['subject']}" for e in unread_emails[:5]) or "নেই")
            + f"\n- ফেসবুক আপডেট ({len(unread_fb)}টি): "
            + (", ".join(f"{f['actor_name']} ({f['event_type']}): {f['content'][:60]}" for f in unread_fb[:5]) or "নেই")
        )

        text, interaction_id = self._ask_gemini(
            f"{context_summary}\n\nব্যবহারকারীর কথা: {message}",
            previous_interaction_id=previous_interaction_id,
        )
        if text:
            return {
                "reply": text.strip(),
                "interaction_id": interaction_id,
                "used_gemini": True,
            }

        # Smart local Bengali fallback when GEMINI_API_KEY is not configured yet
        m = message.lower()
        if any(w in m for w in ("ইমেইল", "email", "mail", "মেইল")):
            if not emails:
                reply = "এখন কোনো নতুন ইমেইল নেই। সেটিংস থেকে Gmail বা IMAP যুক্ত করলে আমি স্বয়ংক্রিয়ভাবে পড়ে শোনাব।"
            else:
                lines = [f"মোট {len(unread_emails)}টি না পড়া ইমেইল আছে। সর্বশেষগুলো হলো:"]
                for idx, em in enumerate(emails[:3], 1):
                    lines.append(f"{idx}. {em['sender']} — {em['subject']} ({em['summary_bn'] or em['urgency']})")
                reply = "\n".join(lines)
        elif any(w in m for w in ("ফেসবুক", "facebook", "কমেন্ট", "লাইক", "fb")):
            if not fb_events:
                reply = "ফেসবুকে এখন কোনো নতুন লাইক বা কমেন্ট রেকর্ড নেই।"
            else:
                lines = [f"ফেসবুকে {len(unread_fb)}টি নতুন আপডেট আছে:"]
                for idx, ev in enumerate(fb_events[:3], 1):
                    lines.append(f"{idx}. {ev['actor_name']} ({ev['event_type']}): {ev['content'][:80]}")
                reply = "\n".join(lines)
        elif any(w in m for w in ("প্ল্যান", "কাজ", "অফিস", "task", "plan", "রুটিন")):
            if not pending:
                reply = "দারুণ! আপনার আজকের সব অফিসের কাজ শেষ হয়ে গেছে।"
            else:
                lines = [f"আজ আপনার {len(pending)}টি কাজ বাকি আছে—কাজের ক্রম অনুযায়ী:"]
                for idx, t in enumerate(pending[:5], 1):
                    slot = f" [{t['scheduled_start']}-{t['scheduled_end']}]" if t.get("scheduled_start") else ""
                    lines.append(f"{idx}. {t['title']}{slot} ({t['priority']})")
                reply = "\n".join(lines)
        else:
            reply = (
                f"আসসালামু আলাইকুম! আমি আপনার {len(pending)}টি বাকি কাজ, {len(unread_emails)}টি নতুন ইমেইল "
                f"এবং {len(unread_fb)}টি ফেসবুক আপডেট নজরে রাখছি। আমাকে জিজ্ঞেস করতে পারেন: "
                "'আজকের কাজগুলো কী?', 'ইমেইল পড়ে শোনাও', অথবা 'ফেসবুকে কে কমেন্ট করলো?' "
                "(পূর্ণ AI কথোপকথনের জন্য সেটিংসে ফ্রি Gemini API Key দিন।)"
            )

        return {"reply": reply, "interaction_id": None, "used_gemini": False}


ai_service = AIService()
