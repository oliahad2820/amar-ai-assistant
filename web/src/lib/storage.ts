import type {
  AssistantSettings,
  CheckinRecord,
  EmailItem,
  FacebookEventItem,
  TaskItem,
} from "../types";

const KEYS = {
  SETTINGS: "amar_ai_settings_v1",
  TASKS: "amar_ai_tasks_v1",
  EMAILS: "amar_ai_emails_v1",
  FACEBOOK: "amar_ai_fb_v1",
  CHECKINS: "amar_ai_checkins_v1",
  FACE_SIGNATURE: "amar_ai_face_sig_v1",
};

export const DEFAULT_SETTINGS: AssistantSettings = {
  ownerName: "অলি আহাদ",
  assistantName: "আমার এআই",
  customDomain: "",
  geminiApiKey: "",
  geminiModel: "gemini-4-hydrogen",
  backendUrl: import.meta.env.VITE_DEFAULT_BACKEND_URL || "",
  backendToken: "",
  voiceEnabled: true,
  voiceRate: 1.0,
  checkinIntervalMinutes: 30,
  greetingCooldownMinutes: 15,
  pinCode: "",
  faceProfileName: "",
  faceEnrolledAt: "",
};

export const STARTER_TASKS: TaskItem[] = [
  {
    id: 1,
    title: "সকালের ক্লায়েন্ট ইমেইল ও কোটেশন রিভিউ",
    description: "জরুরি ক্লায়েন্ট রিকোয়েস্ট যাচাই করে রিপ্লাই ড্রাফট তৈরি",
    category: "অফিস",
    priority: "urgent",
    estimated_minutes: 45,
    status: "in_progress",
    depends_on_id: null,
    scheduled_start: "09:30",
    scheduled_end: "10:15",
    order_index: 0,
    rationale_bn: "সবচেয়ে জরুরি হিসেবে #১ নম্বরে রাখা হয়েছে (৪৫ মিনিট)।",
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    title: "অফিসের প্রজেক্ট প্রগ্রেস রিপোর্ট প্রস্তুত করা",
    description: "টিমের সাপ্তাহিক আপডেট একসাথে করে ম্যানেজমেন্টের জন্য রিপোর্ট",
    category: "অফিস",
    priority: "high",
    estimated_minutes: 60,
    status: "pending",
    depends_on_id: 1,
    scheduled_start: "10:25",
    scheduled_end: "11:25",
    order_index: 1,
    rationale_bn: "ক্লায়েন্ট রিভিউ শেষ হওয়ার পর এটি করা জরুরি।",
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    title: "দুপুরের টিম মিটিং ও পরবর্তী কাজের বণ্টন",
    description: "অফিসের পরবর্তী ২ দিনের টাস্কগুলো টিমের সাথে ফাইনাল করা",
    category: "মিটিং",
    priority: "normal",
    estimated_minutes: 40,
    status: "pending",
    depends_on_id: 2,
    scheduled_start: "11:35",
    scheduled_end: "12:15",
    order_index: 2,
    rationale_bn: "রিপোর্ট তৈরির পর মিটিংয়ে আলোচনা করলে সময় বাঁচবে।",
    created_at: new Date().toISOString(),
  },
];

export const STARTER_EMAILS: EmailItem[] = [
  {
    id: 101,
    sender: "HR & Operations <ops@company.com>",
    subject: "Urgent: Monthly Project Plan Approval Needed",
    snippet: "আজ দুপুর ২টার মধ্যে মাসিক কাজের প্ল্যানটি কনফার্ম করার অনুরোধ রইলো।",
    body: "আসসালামু আলাইকুম, আজ দুপুর ২টার মধ্যে এই মাসের অফিস প্রজেক্ট শিডিউল এবং বাজেট প্ল্যানটি অনুমোদন করে জানালে আমরা পরের ধাপ শুরু করতে পারবো।",
    urgency: "urgent",
    summary_bn: "অফিস অপারেশন টিম আজ দুপুর ২টার মধ্যে মাসিক প্রজেক্ট প্ল্যানের অনুমোদন চেয়েছে।",
    draft_reply: "আসসালামু আলাইকুম,\n\nআপনার ইমেইল পেয়েছি। আমি প্ল্যানটি রিভিউ করে দুপুর ১:৩০-এর আগেই কনফার্মেশন পাঠিয়ে দিচ্ছি।\n\nধন্যবাদ।",
    is_read: false,
    received_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 102,
    sender: "Client Support <client@partner.io>",
    subject: "Meeting follow-up & next deliverable",
    snippet: "গতকালের মিটিংয়ের নোটস এবং নতুন রিকোয়ারমেন্ট সংযুক্ত করা হলো।",
    body: "গতকালের আলোচনা অনুযায়ী নতুন ল্যান্ডিং পেজ এবং ডোমেইন সেটআপের রিকোয়ারমেন্ট পাঠানো হলো। আগামীকাল সকালে ফিডব্যাক জানালে ভালো হয়।",
    urgency: "action_required",
    summary_bn: "ক্লায়েন্ট গতকালের মিটিংয়ের ফলো-আপ পাঠিয়েছে এবং আগামীকাল সকালে ফিডব্যাক চেয়েছে।",
    draft_reply: "ধন্যবাদ! রিকোয়ারমেন্টগুলো পেয়েছি। দেখে আগামীকাল সকাল ১০টার মধ্যে আপডেট জানাচ্ছি।",
    is_read: false,
    received_at: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
  },
];

export const STARTER_FACEBOOK: FacebookEventItem[] = [
  {
    id: 201,
    source: "page_api",
    event_type: "comment",
    actor_name: "তানভীর হাসান",
    post_title: "নতুন এআই অটোমেশন প্রজেক্ট আপডেট",
    content: "মাশাআল্লাহ দারুণ উদ্যোগ ভাই! এটা কীভাবে সেটআপ করবো একটু জানাবেন?",
    url: "https://www.facebook.com",
    suggested_reply: "অসংখ্য ধন্যবাদ তানভীর ভাই! শীঘ্রই পুরো সেটআপ গাইড শেয়ার করছি, ইনবক্সেও নক দিতে পারেন।",
    is_read: false,
    created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
  },
  {
    id: 202,
    source: "email_alert",
    event_type: "like",
    actor_name: "রাফি আহমেদ এবং আরও ১২ জন",
    post_title: "অফিস প্রোডাক্টিভিটি টিপস",
    content: "আপনার পোস্টে লাইক ও লাভ রিঅ্যাকশন দিয়েছে।",
    url: "https://www.facebook.com/notifications",
    suggested_reply: "সবাইকে অনেক ধন্যবাদ পাশে থাকার জন্য!",
    is_read: false,
    created_at: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
  },
];

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota issues cleanly
  }
}

export const storage = {
  loadSettings: (): AssistantSettings => ({
    ...DEFAULT_SETTINGS,
    ...safeRead<Partial<AssistantSettings>>(KEYS.SETTINGS, {}),
  }),
  saveSettings: (s: AssistantSettings) => safeWrite(KEYS.SETTINGS, s),

  loadTasks: (): TaskItem[] => safeRead<TaskItem[]>(KEYS.TASKS, STARTER_TASKS),
  saveTasks: (tasks: TaskItem[]) => safeWrite(KEYS.TASKS, tasks),

  loadEmails: (): EmailItem[] => safeRead<EmailItem[]>(KEYS.EMAILS, STARTER_EMAILS),
  saveEmails: (emails: EmailItem[]) => safeWrite(KEYS.EMAILS, emails),

  loadFacebook: (): FacebookEventItem[] =>
    safeRead<FacebookEventItem[]>(KEYS.FACEBOOK, STARTER_FACEBOOK),
  saveFacebook: (events: FacebookEventItem[]) => safeWrite(KEYS.FACEBOOK, events),

  loadCheckins: (): CheckinRecord[] => safeRead<CheckinRecord[]>(KEYS.CHECKINS, []),
  saveCheckins: (records: CheckinRecord[]) => safeWrite(KEYS.CHECKINS, records),

  loadFaceSignature: (): number[] | null => safeRead<number[] | null>(KEYS.FACE_SIGNATURE, null),
  saveFaceSignature: (sig: number[] | null) => safeWrite(KEYS.FACE_SIGNATURE, sig),

  clearDemoData: () => {
    safeWrite(KEYS.TASKS, []);
    safeWrite(KEYS.EMAILS, []);
    safeWrite(KEYS.FACEBOOK, []);
    safeWrite(KEYS.CHECKINS, []);
  },
};
