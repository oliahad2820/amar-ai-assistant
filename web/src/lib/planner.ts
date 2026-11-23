import type { CheckinRecord, Priority, TaskItem } from "../types";

const PRIORITY_WEIGHT: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const PRIORITY_LABEL_BN: Record<Priority, string> = {
  urgent: "সবচেয়ে জরুরি",
  high: "উচ্চ অগ্রাধিকার",
  normal: "নিয়মিত কাজ",
  low: "সময় পেলে করবেন",
};

function formatHHMM(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function autoPlanTasks(
  tasks: TaskItem[],
  startNow = false,
  breakMinutes = 10
): TaskItem[] {
  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const byId = new Map(active.map((t) => [t.id, t]));

  const ordered: TaskItem[] = [];
  const visited = new Set<number>();
  const visiting = new Set<number>();

  const sortedActive = [...active].sort((a, b) => {
    const progA = a.status === "in_progress" ? 0 : 1;
    const progB = b.status === "in_progress" ? 0 : 1;
    if (progA !== progB) return progA - progB;
    const pDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.id - b.id;
  });

  function visit(task: TaskItem) {
    if (visited.has(task.id) || visiting.has(task.id)) return;
    visiting.add(task.id);
    if (task.depends_on_id && byId.has(task.depends_on_id)) {
      visit(byId.get(task.depends_on_id)!);
    }
    visiting.delete(task.id);
    visited.add(task.id);
    ordered.push(task);
  }

  sortedActive.forEach(visit);

  const now = new Date();
  let cursorMin = startNow
    ? now.getHours() * 60 + Math.ceil((now.getMinutes() + 1) / 5) * 5
    : Math.max(9 * 60 + 30, now.getHours() * 60 + Math.ceil((now.getMinutes() + 1) / 5) * 5);

  // If it's late night (after 21:00), plan for tomorrow 09:30 AM cleanly
  if (cursorMin >= 21 * 60) {
    cursorMin = 9 * 60 + 30;
  }

  const plannedActive = ordered.map((task, idx) => {
    const dur = Math.max(10, task.estimated_minutes || 45);
    const startStr = formatHHMM(cursorMin);
    const endStr = formatHHMM(cursorMin + dur);
    cursorMin += dur + breakMinutes;

    const depTask = task.depends_on_id ? byId.get(task.depends_on_id) : undefined;
    const rationale = depTask
      ? `'${depTask.title}' শেষ হওয়ার পর এটি করা জরুরি।`
      : `${PRIORITY_LABEL_BN[task.priority]} হিসেবে #${idx + 1} নম্বরে সাজানো হয়েছে (${dur} মিনিট)।`;

    return {
      ...task,
      order_index: idx,
      scheduled_start: startStr,
      scheduled_end: endStr,
      rationale_bn: rationale,
    };
  });

  return [...plannedActive, ...done];
}

export function evaluateProgress(tasks: TaskItem[]): CheckinRecord {
  const total = tasks.length;
  const now = new Date();
  const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (total === 0) {
    return {
      id: Date.now(),
      status: "on_track",
      completion_rate: 100,
      summary_bn: "আজকের তালিকায় এখনো কোনো কাজ নেই।",
      recommendation_bn: "অফিস প্ল্যানার থেকে আপনার আজকের কাজগুলো যোগ করে 'অটো-প্ল্যান' চাপুন।",
      created_at: now.toISOString(),
    };
  }

  const done = tasks.filter((t) => t.status === "done");
  const inProgress = tasks.filter((t) => t.status === "in_progress");
  const pending = tasks.filter((t) => t.status === "pending");
  const completionRate = Math.round((done.length / total) * 100);

  const overdue = [...inProgress, ...pending].filter(
    (t) => t.scheduled_end && t.scheduled_end < nowHHMM
  );

  if (pending.length === 0 && inProgress.length === 0) {
    return {
      id: Date.now(),
      status: "on_track",
      completion_rate: 100,
      summary_bn: `চমৎকার! আজকের সবগুলো (${total}টি) কাজ প্ল্যান অনুযায়ী শেষ হয়েছে।`,
      recommendation_bn: "আগামীকালের গুরুত্বপূর্ণ কাজগুলো এখনই নোট করে রাখতে পারেন।",
      created_at: now.toISOString(),
    };
  }

  if (overdue.length >= 2) {
    return {
      id: Date.now(),
      status: "off_track",
      completion_rate: completionRate,
      summary_bn: `সতর্কতা: ${overdue.length}টি কাজ নির্ধারিত সময়ের চেয়ে পিছিয়ে গেছে (${done.length}/${total} সম্পন্ন)।`,
      recommendation_bn: `'${overdue[0].title}' এখনই শেষ করুন অথবা 'রিশিডিউল' বাটনে চাপ দিয়ে বাকি দিনের প্ল্যান নতুন করে সাজান।`,
      created_at: now.toISOString(),
    };
  }

  if (overdue.length === 1) {
    return {
      id: Date.now(),
      status: "slightly_behind",
      completion_rate: completionRate,
      summary_bn: `মোটামুটি ভালো এগোচ্ছেন (${completionRate}% সম্পন্ন), তবে '${overdue[0].title}' একটু পিছিয়ে আছে।`,
      recommendation_bn: "পরের ২০ মিনিট একটানা ফোকাস করে এই কাজটি শেষ করলেই প্ল্যান ঠিক হয়ে যাবে।",
      created_at: now.toISOString(),
    };
  }

  const activeTask = inProgress[0] || pending[0];
  return {
    id: Date.now(),
    status: "on_track",
    completion_rate: completionRate,
    summary_bn: `প্ল্যান অনুযায়ী দারুণ এগোচ্ছেন (${done.length}/${total} কাজ শেষ, ${completionRate}%)।`,
    recommendation_bn: `বর্তমান ফোকাস: '${activeTask.title}' — শেষ হলেই টিক চিহ্ন দিন।`,
    created_at: now.toISOString(),
  };
}
