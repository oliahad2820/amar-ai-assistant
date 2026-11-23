from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from .config import settings

PRIORITY_WEIGHT = {
    "urgent": 0,
    "high": 1,
    "normal": 2,
    "low": 3,
}

PRIORITY_LABEL_BN = {
    "urgent": "সবচেয়ে জরুরি",
    "high": "উচ্চ অগ্রাধিকার",
    "normal": "নিয়মিত কাজ",
    "low": "সময় পেলে করবেন",
}


def build_daily_plan(
    tasks: list[dict[str, Any]],
    start_hour: int = 9,
    start_minute: int = 0,
    break_minutes: int = 10,
) -> list[dict[str, Any]]:
    """Orders pending/in-progress tasks honoring dependencies & priority, assigning time blocks."""
    active = [t for t in tasks if t["status"] != "done"]
    by_id = {t["id"]: t for t in active}

    # Topological sort with priority tie-breaker
    ordered: list[dict[str, Any]] = []
    visited: set[int] = set()
    visiting: set[int] = set()

    def sort_key(t: dict[str, Any]) -> tuple[int, int, int]:
        in_prog = 0 if t["status"] == "in_progress" else 1
        return (in_prog, PRIORITY_WEIGHT.get(t.get("priority", "normal"), 2), t["id"])

    def visit(task: dict[str, Any]) -> None:
        tid = task["id"]
        if tid in visited or tid in visiting:
            return
        visiting.add(tid)
        dep_id = task.get("depends_on_id")
        if dep_id and dep_id in by_id:
            visit(by_id[dep_id])
        visiting.remove(tid)
        visited.add(tid)
        ordered.append(task)

    for t in sorted(active, key=sort_key):
        visit(t)

    now_local = datetime.now(ZoneInfo(settings.timezone))
    cursor = now_local.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)
    # If planning mid-day, start from next 5-minute mark when start_hour already passed
    if start_hour == 0:
        minute_round = ((now_local.minute // 5) + 1) * 5
        cursor = now_local.replace(minute=0, second=0, microsecond=0) + timedelta(minutes=minute_round)

    planned: list[dict[str, Any]] = []
    for idx, task in enumerate(ordered):
        duration = max(10, int(task.get("estimated_minutes") or 45))
        end_dt = cursor + timedelta(minutes=duration)
        dep_id = task.get("depends_on_id")
        if dep_id and dep_id in by_id:
            rationale = f"'{by_id[dep_id]['title']}' শেষ হওয়ার পর এটি করা জরুরি।"
        else:
            label = PRIORITY_LABEL_BN.get(task.get("priority", "normal"), "নিয়মিত কাজ")
            rationale = f"{label} হিসেবে #{idx + 1} নম্বরে রাখা হয়েছে ({duration} মিনিট)।"

        planned.append(
            {
                "id": task["id"],
                "order_index": idx,
                "scheduled_start": cursor.strftime("%H:%M"),
                "scheduled_end": end_dt.strftime("%H:%M"),
                "rationale_bn": rationale,
            }
        )
        cursor = end_dt + timedelta(minutes=break_minutes)

    return planned


def evaluate_checkin(tasks: list[dict[str, Any]]) -> dict[str, Any]:
    """Evaluates whether today's tasks are progressing according to plan."""
    total = len(tasks)
    if total == 0:
        return {
            "status": "on_track",
            "completion_rate": 100,
            "summary_bn": "আজকের তালিকায় এখনো কোনো কাজ যোগ করা হয়নি।",
            "recommendation_bn": "অফিসের প্রধান ৩টি কাজ যোগ করে 'অটো-প্ল্যান' চাপুন—আমি ক্রম সাজিয়ে দেব।",
        }

    done = [t for t in tasks if t["status"] == "done"]
    in_progress = [t for t in tasks if t["status"] == "in_progress"]
    pending = [t for t in tasks if t["status"] == "pending"]
    completion_rate = round((len(done) / total) * 100)

    now_hhmm = datetime.now(ZoneInfo(settings.timezone)).strftime("%H:%M")
    overdue = [
        t
        for t in (pending + in_progress)
        if t.get("scheduled_end") and t["scheduled_end"] < now_hhmm
    ]

    if not pending and not in_progress:
        status = "on_track"
        summary = f"দারুণ! আজকের সবগুলো ({total}টি) কাজ প্ল্যান অনুযায়ী সম্পন্ন হয়েছে।"
        recommendation = "আগামীকালের কাজগুলো এখনই লিস্ট করে রাখতে পারেন।"
    elif len(overdue) >= 2:
        status = "off_track"
        summary = (
            f"প্ল্যান অনুযায়ী {len(overdue)}টি কাজ নির্ধারিত সময়ের চেয়ে পিছিয়ে আছে "
            f"(সম্পন্ন: {len(done)}/{total})।"
        )
        recommendation = (
            f"এখনই '{overdue[0]['title']}' শেষ করুন অথবা 'রিশিডিউল' করে বাকি কাজগুলোর সময় নতুন করে সাজিয়ে নিন।"
        )
    elif len(overdue) == 1:
        status = "slightly_behind"
        summary = (
            f"প্রায় ঠিক পথে আছেন ({completion_rate}% সম্পন্ন), তবে '{overdue[0]['title']}' "
            "কাজটি সামান্য পিছিয়ে গেছে।"
        )
        recommendation = "পরের ১৫-২০ মিনিট ফোকাস করে এই কাজটি শেষ করলে আজকের প্ল্যান ঠিক থাকবে।"
    else:
        status = "on_track"
        next_title = in_progress[0]["title"] if in_progress else pending[0]["title"]
        summary = f"আপনি প্ল্যান অনুযায়ী দারুণ এগোচ্ছেন ({len(done)}/{total} সম্পন্ন, {completion_rate}%)।"
        recommendation = f"এখনকার ফোকাস: '{next_title}'—শেষ হলেই ড্যাশবোর্ডে টিক দিন।"

    return {
        "status": status,
        "completion_rate": completion_rate,
        "summary_bn": summary,
        "recommendation_bn": recommendation,
    }
