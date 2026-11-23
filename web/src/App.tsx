import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  CalendarClock,
  CheckCircle2,
  LayoutDashboard,
  Lock,
  Mail,
  MessageSquareHeart,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { CameraPresence } from "./components/CameraPresence";
import { EmailPanel } from "./components/EmailPanel";
import { FacebookPanel } from "./components/FacebookPanel";
import { PlannerPanel } from "./components/PlannerPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { analyzeEmailLocalOrAI, askAssistant, generateArrivalGreeting } from "./lib/ai";
import { autoPlanTasks, evaluateProgress } from "./lib/planner";
import { storage } from "./lib/storage";
import { createBengaliRecognizer, speakBengali, stopSpeaking } from "./lib/voice";
import type {
  AssistantSettings,
  ChatMessage,
  CheckinRecord,
  EmailItem,
  FacebookEventItem,
  FacebookEventType,
  Priority,
  TaskItem,
  TaskStatus,
} from "./types";

type ActiveTab = "dashboard" | "planner" | "emails" | "facebook" | "settings";

export default function App() {
  const [tab, setTab] = useState<ActiveTab>("dashboard");
  const [settings, setSettings] = useState<AssistantSettings>(() => storage.loadSettings());
  const [tasks, setTasks] = useState<TaskItem[]>(() => storage.loadTasks());
  const [emails, setEmails] = useState<EmailItem[]>(() => storage.loadEmails());
  const [fbEvents, setFbEvents] = useState<FacebookEventItem[]>(() => storage.loadFacebook());
  const [checkins, setCheckins] = useState<CheckinRecord[]>(() => storage.loadCheckins());

  const [lastGreeting, setLastGreeting] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [clockText, setClockText] = useState("");
  const [locked, setLocked] = useState<boolean>(() => Boolean(storage.loadSettings().pinCode));
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [toast, setToast] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome-1",
      role: "assistant",
      text: `আসসালামু আলাইকুম ${storage.loadSettings().ownerName}! আমি আপনার ব্যক্তিগত এআই অ্যাসিস্ট্যান্ট। ক্যামেরা চালু করলে আমি আপনাকে দেখেই সালাম দেব, সারাদিনের অফিস কাজ সাজিয়ে দেব এবং একটু পর পর ফিডব্যাক দেব।`,
      timestamp: new Date().toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const backendConnected = Boolean(settings.backendUrl.trim());

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  // Persist local state
  useEffect(() => storage.saveSettings(settings), [settings]);
  useEffect(() => storage.saveTasks(tasks), [tasks]);
  useEffect(() => storage.saveEmails(emails), [emails]);
  useEffect(() => storage.saveFacebook(fbEvents), [fbEvents]);
  useEffect(() => storage.saveCheckins(checkins), [checkins]);

  // Live Clock
  useEffect(() => {
    const updateClock = () => {
      setClockText(
        new Date().toLocaleString("bn-BD", {
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    };
    updateClock();
    const id = window.setInterval(updateClock, 15000);
    return () => window.clearInterval(id);
  }, []);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Optional Backend initial fetch
  useEffect(() => {
    if (!backendConnected) return;
    const base = settings.backendUrl.replace(/\/$/, "");
    fetch(`${base}/api/dashboard`, {
      headers: settings.backendToken
        ? { Authorization: `Bearer ${settings.backendToken}` }
        : undefined,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.tasks) && data.tasks.length > 0) setTasks(data.tasks);
        if (Array.isArray(data.emails) && data.emails.length > 0) setEmails(data.emails);
        if (Array.isArray(data.facebook_events) && data.facebook_events.length > 0) {
          setFbEvents(data.facebook_events);
        }
      })
      .catch(() => {});
  }, [backendConnected, settings.backendUrl, settings.backendToken]);

  const latestCheckin = useMemo(
    () => checkins[0] || evaluateProgress(tasks),
    [checkins, tasks]
  );

  const runProactiveCheckin = useCallback(
    (speak = true) => {
      const record = evaluateProgress(tasks);
      setCheckins((prev) => [record, ...prev.slice(0, 9)]);
      if (speak) {
        speakBengali(
          `${record.summary_bn} ${record.recommendation_bn}`,
          settings.voiceEnabled,
          settings.voiceRate
        );
      }
      showToast("প্রোঅ্যাক্টিভ প্রগ্রেস চেক-ইন সম্পন্ন হয়েছে।");
    },
    [tasks, settings.voiceEnabled, settings.voiceRate, showToast]
  );

  // Periodic Proactive Feedback Timer ("একটু পর পর ফিডব্যাক দিবে")
  useEffect(() => {
    const mins = Math.max(5, settings.checkinIntervalMinutes || 30);
    const timer = window.setInterval(() => {
      runProactiveCheckin(true);
    }, mins * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [settings.checkinIntervalMinutes, runProactiveCheckin]);

  const handleArrival = useCallback(
    async (_position: string) => {
      const greeting = await generateArrivalGreeting(settings, tasks, emails, fbEvents);
      setLastGreeting(greeting);
      speakBengali(greeting, settings.voiceEnabled, settings.voiceRate);
      setMessages((prev) => [
        ...prev,
        {
          id: `greet-${Date.now()}`,
          role: "assistant",
          text: greeting,
          timestamp: new Date().toLocaleTimeString("bn-BD", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    },
    [settings, tasks, emails, fbEvents]
  );

  const sendChat = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || chatBusy) return;
      const nowTime = new Date().toLocaleTimeString("bn-BD", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", text: clean, timestamp: nowTime },
      ]);
      setChatInput("");
      setChatBusy(true);
      try {
        const res = await askAssistant(clean, settings, tasks, emails, fbEvents);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: res.reply,
            timestamp: new Date().toLocaleTimeString("bn-BD", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
        speakBengali(res.reply, settings.voiceEnabled, settings.voiceRate);
      } finally {
        setChatBusy(false);
      }
    },
    [chatBusy, settings, tasks, emails, fbEvents]
  );

  const recognizerRef = useRef<ReturnType<typeof createBengaliRecognizer> | null>(null);
  const toggleMic = () => {
    if (!recognizerRef.current) {
      recognizerRef.current = createBengaliRecognizer(
        (transcript) => sendChat(transcript),
        (state) => setListening(state)
      );
    }
    if (!recognizerRef.current.supported) {
      showToast("এই ব্রাউজারে বাংলা ভয়েস ইনপুট সাপোর্ট নেই—Chrome বা Edge ব্যবহার করুন।");
      return;
    }
    if (listening) {
      recognizerRef.current.stop();
    } else {
      stopSpeaking();
      recognizerRef.current.start();
    }
  };

  // ---------- TASK ACTIONS ----------
  const handleAddTask = (payload: {
    title: string;
    description: string;
    category: string;
    priority: Priority;
    estimated_minutes: number;
    depends_on_id: number | null;
  }) => {
    const newTask: TaskItem = {
      id: Date.now(),
      ...payload,
      status: "pending",
      scheduled_start: "",
      scheduled_end: "",
      order_index: tasks.length,
      rationale_bn: "",
      created_at: new Date().toISOString(),
    };
    const next = autoPlanTasks([...tasks, newTask], false);
    setTasks(next);
    showToast("নতুন কাজ যোগ করে অটো-প্ল্যান আপডেট করা হয়েছে।");
  };

  const handleTaskStatus = (id: number, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    if (status === "done") {
      showToast("দারুণ! কাজটি সম্পন্ন হিসেবে মার্ক করা হয়েছে।");
    }
  };

  const handleDeleteTask = (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAutoPlan = (startNow: boolean) => {
    const planned = autoPlanTasks(tasks, startNow);
    setTasks(planned);
    const first = planned.find((t) => t.status !== "done");
    const msg = first
      ? `প্ল্যান সাজানো হয়েছে! প্রথম কাজ "${first.title}" (${first.scheduled_start} থেকে ${first.scheduled_end})।`
      : "সব কাজ ইতিমধ্যে শেষ হয়ে গেছে!";
    showToast(msg);
    speakBengali(msg, settings.voiceEnabled, settings.voiceRate);
  };

  const handleSpeakPlan = () => {
    const active = tasks.filter((t) => t.status !== "done");
    if (active.length === 0) {
      speakBengali("আজকের সব অফিসের কাজ সম্পন্ন হয়ে গেছে।", settings.voiceEnabled, settings.voiceRate);
      return;
    }
    const text =
      "আজকের কাজের ক্রম হলো: " +
      active
        .slice(0, 5)
        .map((t, i) => `${i + 1} নম্বর, ${t.title}, সময় ${t.scheduled_start || "নির্ধারিত নয়"}।`)
        .join(" ");
    speakBengali(text, settings.voiceEnabled, settings.voiceRate);
  };

  // ---------- EMAIL ACTIONS ----------
  const handleSyncEmails = async () => {
    if (!backendConnected) return;
    const base = settings.backendUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/api/emails/sync`, {
      method: "POST",
      headers: settings.backendToken
        ? { Authorization: `Bearer ${settings.backendToken}` }
        : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "সিঙ্ক ব্যর্থ হয়েছে" }));
      showToast(err.detail || "ইমেইল সিঙ্ক ব্যর্থ হয়েছে");
      return;
    }
    const data = await res.json();
    if (Array.isArray(data.emails)) setEmails(data.emails);
    showToast(`${data.synced_emails}টি ইমেইল সিঙ্ক হয়েছে!`);
  };

  const handleManualEmail = async (sender: string, subject: string, body: string) => {
    const analysis = await analyzeEmailLocalOrAI(sender, subject, body, settings);
    const newEmail: EmailItem = {
      id: Date.now(),
      sender,
      subject,
      snippet: body.slice(0, 140),
      body,
      urgency: analysis.urgency,
      summary_bn: analysis.summary_bn,
      draft_reply: analysis.draft_reply,
      is_read: false,
      received_at: new Date().toISOString(),
    };
    setEmails((prev) => [newEmail, ...prev]);

    // If this is a Facebook email notification, also surface it cleanly in Facebook Monitor!
    if (sender.toLowerCase().includes("facebook")) {
      setFbEvents((prev) => [
        {
          id: Date.now() + 1,
          source: "email_alert",
          event_type: subject.toLowerCase().includes("like") ? "like" : "comment",
          actor_name: subject.split(" ")[0] || "Facebook Friend",
          post_title: subject,
          content: body.slice(0, 200) || subject,
          url: "https://www.facebook.com/notifications",
          suggested_reply: "অনেক ধন্যবাদ! শীঘ্রই উত্তর দিচ্ছি।",
          is_read: false,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    showToast("ইমেইল বিশ্লেষণ ও সারাংশ তৈরি হয়েছে।");
  };

  const handleExtractTaskFromEmail = (em: EmailItem) => {
    handleAddTask({
      title: `ইমেইল ফলো-আপ: ${em.subject}`,
      description: em.summary_bn,
      category: "ইমেইল",
      priority: em.urgency === "urgent" ? "urgent" : "high",
      estimated_minutes: 30,
      depends_on_id: null,
    });
    setEmails((prev) => prev.map((e) => (e.id === em.id ? { ...e, is_read: true } : e)));
  };

  const handleSendApprovedReply = async (em: EmailItem, replyBody: string) => {
    if (!backendConnected) return;
    const base = settings.backendUrl.replace(/\/$/, "");
    const emailAddrMatch = em.sender.match(/<([^>]+)>/);
    const toAddr = emailAddrMatch ? emailAddrMatch[1] : em.sender;
    const res = await fetch(`${base}/api/emails/${em.id}/send-reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.backendToken ? { Authorization: `Bearer ${settings.backendToken}` } : {}),
      },
      body: JSON.stringify({ to_address: toAddr, reply_body: replyBody, confirmed: true }),
    });
    if (res.ok) {
      showToast("অনুমোদিত ইমেইল রিপ্লাই সফলভাবে পাঠানো হয়েছে।");
    } else {
      showToast("ইমেইল পাঠানো যায়নি—ব্যাকএন্ডে SMTP সেটিংস যাচাই করুন।");
    }
  };

  // ---------- FACEBOOK ACTIONS ----------
  const handleSyncFacebook = async () => {
    if (!backendConnected) return;
    const base = settings.backendUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/api/facebook/sync`, {
      method: "POST",
      headers: settings.backendToken
        ? { Authorization: `Bearer ${settings.backendToken}` }
        : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "ফেসবুক সিঙ্ক ব্যর্থ হয়েছে" }));
      showToast(err.detail || "ফেসবুক সিঙ্ক ব্যর্থ হয়েছে");
      return;
    }
    const data = await res.json();
    if (Array.isArray(data.events)) setFbEvents(data.events);
    showToast(`${data.synced_events}টি ফেসবুক আপডেট সিঙ্ক হয়েছে!`);
  };

  const handleAddManualFb = (actor: string, type: FacebookEventType, content: string) => {
    setFbEvents((prev) => [
      {
        id: Date.now(),
        source: "manual",
        event_type: type,
        actor_name: actor,
        post_title: "আমার পোস্ট",
        content,
        url: "https://www.facebook.com",
        suggested_reply: `অনেক ধন্যবাদ ${actor}! আপনার ${
          type === "like" ? "ভালোবাসার" : "মন্তব্যের"
        } জন্য কৃতজ্ঞ।`,
        is_read: false,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    showToast("ফেসবুক আপডেট যোগ করা হয়েছে।");
  };

  const handleSpeakFbSummary = () => {
    const unread = fbEvents.filter((f) => !f.is_read);
    const list = unread.length > 0 ? unread : fbEvents.slice(0, 3);
    if (list.length === 0) {
      speakBengali("ফেসবুকে কোনো নতুন লাইক বা কমেন্ট নেই।", settings.voiceEnabled, settings.voiceRate);
      return;
    }
    const msg =
      `ফেসবুকে ${unread.length}টি নতুন আপডেট আছে। ` +
      list
        .slice(0, 3)
        .map((f) => `${f.actor_name} লিখেছেন বা রিঅ্যাক্ট করেছেন: ${f.content}।`)
        .join(" ");
    speakBengali(msg, settings.voiceEnabled, settings.voiceRate);
  };

  const handleExportBackup = () => {
    const blob = new Blob(
      [JSON.stringify({ tasks, emails, fbEvents, checkins, exportedAt: new Date().toISOString() }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amar-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- STATS ----------
  const pendingCount = tasks.filter((t) => t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const progressPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 100;
  const unreadEmailCount = emails.filter((e) => !e.is_read).length;
  const unreadFbCount = fbEvents.filter((f) => !f.is_read).length;

  // ---------- PIN LOCK SCREEN ----------
  if (locked && settings.pinCode) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pinEntry === settings.pinCode) {
              setLocked(false);
              setPinEntry("");
              setPinError("");
            } else {
              setPinError("ভুল পিন কোড!");
            }
          }}
          className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-800 p-6 text-center space-y-4"
        >
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">{settings.assistantName} লক করা আছে</h1>
            <p className="text-xs text-slate-400 mt-1">আনলক করতে আপনার পিন কোড দিন</p>
          </div>
          <input
            type="password"
            value={pinEntry}
            onChange={(e) => setPinEntry(e.target.value)}
            placeholder="পিন কোড"
            autoFocus
            className="w-full text-center tracking-widest px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white"
          />
          {pinError && <p className="text-xs text-rose-400">{pinError}</p>}
          <button
            type="submit"
            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
          >
            আনলক করুন
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-slate-950/85 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white leading-none">
                  {settings.assistantName}
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  {backendConnected ? "লাইভ ব্যাকএন্ড" : settings.geminiApiKey ? "Gemini AI" : "ফ্রি লোকাল মোড"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {settings.ownerName} • {clockText}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (settings.voiceEnabled) stopSpeaking();
                setSettings((s) => ({ ...s, voiceEnabled: !s.voiceEnabled }));
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border cursor-pointer transition ${
                settings.voiceEnabled
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : "bg-slate-900 text-slate-400 border-slate-800"
              }`}
            >
              {settings.voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              {settings.voiceEnabled ? "ভয়েস চালু" : "মিউট"}
            </button>

            {settings.pinCode && (
              <button
                type="button"
                onClick={() => setLocked(true)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
                title="স্ক্রিন লক করুন"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-2.5 flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "dashboard", label: "ড্যাশবোর্ড ও ক্যামেরা", icon: LayoutDashboard, count: 0 },
            { id: "planner", label: "অফিস প্ল্যানার", icon: CalendarClock, count: pendingCount },
            { id: "emails", label: "ইমেইল", icon: Mail, count: unreadEmailCount },
            { id: "facebook", label: "ফেসবুক", icon: MessageSquareHeart, count: unreadFbCount },
            { id: "settings", label: "সেটিংস ও ডোমেইন", icon: Settings, count: 0 },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as ActiveTab)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap cursor-pointer transition ${
                  active
                    ? "bg-emerald-500 text-slate-950 font-semibold"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
                {item.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      active ? "bg-slate-950/20 text-slate-950" : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold shadow-xl">
          {toast}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setTab("planner")}
            className="text-left p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 cursor-pointer transition"
          >
            <div className="text-xs text-slate-400">বাকি অফিস কাজ</div>
            <div className="text-xl font-bold text-white mt-0.5">{pendingCount}টি</div>
            <div className="text-[11px] text-emerald-400 mt-0.5">সম্পন্ন: {doneCount}টি ({progressPct}%)</div>
          </button>

          <button
            type="button"
            onClick={() => runProactiveCheckin(true)}
            className="text-left p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-sky-500/40 cursor-pointer transition"
          >
            <div className="text-xs text-slate-400">প্ল্যানের অবস্থা</div>
            <div className="text-sm font-bold text-sky-300 mt-1">
              {latestCheckin.status === "on_track"
                ? "প্ল্যান অনুযায়ী চলছে"
                : latestCheckin.status === "slightly_behind"
                ? "সামান্য পিছিয়ে"
                : "রিশিডিউল দরকার"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">প্রতি {settings.checkinIntervalMinutes} মি. চেক-ইন</div>
          </button>

          <button
            type="button"
            onClick={() => setTab("emails")}
            className="text-left p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition"
          >
            <div className="text-xs text-slate-400">নতুন ইমেইল</div>
            <div className="text-xl font-bold text-white mt-0.5">{unreadEmailCount}টি</div>
            <div className="text-[11px] text-amber-300 mt-0.5">মোট ইনবক্স: {emails.length}টি</div>
          </button>

          <button
            type="button"
            onClick={() => setTab("facebook")}
            className="text-left p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 cursor-pointer transition"
          >
            <div className="text-xs text-slate-400">ফেসবুক লাইক/কমেন্ট</div>
            <div className="text-xl font-bold text-white mt-0.5">{unreadFbCount}টি</div>
            <div className="text-[11px] text-blue-300 mt-0.5">মোট রেকর্ড: {fbEvents.length}টি</div>
          </button>
        </div>

        {/* DASHBOARD TAB */}
        {tab === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Camera + Proactive Progress Feedback */}
            <div className="lg:col-span-6 space-y-4">
              <CameraPresence
                ownerName={settings.ownerName}
                cooldownMinutes={settings.greetingCooldownMinutes}
                faceEnrolledAt={settings.faceEnrolledAt}
                onFaceEnrolled={(ts) => {
                  setSettings((s) => ({ ...s, faceEnrolledAt: ts }));
                  showToast("আপনার চেহারা লোকাল ডিভাইসে সেভ হয়েছে!");
                }}
                onArrival={handleArrival}
                lastGreeting={lastGreeting}
              />

              {/* Proactive Progress Check-in Card */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-white">প্রোঅ্যাক্টিভ ফিডব্যাক ও ফলো-আপ</h2>
                      <p className="text-xs text-slate-400">প্ল্যান অনুযায়ী কাজ এগোচ্ছে কিনা নজর রাখছে</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => runProactiveCheckin(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      এখনই ফিডব্যাক
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAutoPlan(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      রিশিডিউল
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>আজকের অগ্রগতি</span>
                    <span className="font-mono text-emerald-400">{progressPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
                  <p className="text-white font-medium">{latestCheckin.summary_bn}</p>
                  <p className="text-slate-400">{latestCheckin.recommendation_bn}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Live Bengali Voice & AI Chat */}
            <div className="lg:col-span-6 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col h-[560px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">বাংলা ভয়েস ও চ্যাট অ্যাসিস্ট্যান্ট</h2>
                </div>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition ${
                    listening
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                  }`}
                >
                  {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {listening ? "শুনছি..." : "মুখে বলুন"}
                </button>
              </div>

              {/* Quick Prompts */}
              <div className="flex flex-wrap gap-1.5 py-2.5 border-b border-slate-800/70">
                {[
                  "আজ আমার কী কী কাজ আছে?",
                  "নতুন ইমেইল পড়ে শোনাও",
                  "ফেসবুকে কে কমেন্ট করলো?",
                  "প্ল্যান অনুযায়ী কাজ হচ্ছে?",
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendChat(q)}
                    className="px-2.5 py-1 text-[11px] rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                        m.role === "user"
                          ? "bg-emerald-500 text-slate-950 font-medium"
                          : "bg-slate-800/90 text-slate-100 border border-slate-700/70"
                      }`}
                    >
                      {m.text}
                      <span
                        className={`block text-[10px] mt-1 ${
                          m.role === "user" ? "text-slate-900/70" : "text-slate-400"
                        }`}
                      >
                        {m.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
                {chatBusy && (
                  <div className="text-xs text-slate-400 italic">আমার এআই চিন্তা করছে...</div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat(chatInput);
                }}
                className="pt-2 border-t border-slate-800 flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="বাংলায় কিছু জিজ্ঞেস করুন বা নির্দেশ দিন..."
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={chatBusy || !chatInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {tab === "planner" && (
          <PlannerPanel
            tasks={tasks}
            onAddTask={handleAddTask}
            onStatusChange={handleTaskStatus}
            onDeleteTask={handleDeleteTask}
            onAutoPlan={handleAutoPlan}
            onSpeakPlan={handleSpeakPlan}
          />
        )}

        {tab === "emails" && (
          <EmailPanel
            emails={emails}
            backendConnected={backendConnected}
            onSyncBackend={handleSyncEmails}
            onIngestManual={handleManualEmail}
            onExtractTask={handleExtractTaskFromEmail}
            onSpeakEmail={(em) =>
              speakBengali(
                `${em.sender} থেকে ইমেইল এসেছে। বিষয়: ${em.subject}। সারাংশ: ${em.summary_bn}`,
                settings.voiceEnabled,
                settings.voiceRate
              )
            }
            onMarkRead={(id) =>
              setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, is_read: true } : e)))
            }
            onSendApprovedReply={handleSendApprovedReply}
          />
        )}

        {tab === "facebook" && (
          <FacebookPanel
            events={fbEvents}
            backendConnected={backendConnected}
            onSyncFacebook={handleSyncFacebook}
            onAddManual={handleAddManualFb}
            onMarkRead={(id) =>
              setFbEvents((prev) => prev.map((f) => (f.id === id ? { ...f, is_read: true } : f)))
            }
            onSpeakSummary={handleSpeakFbSummary}
          />
        )}

        {tab === "settings" && (
          <SettingsPanel
            settings={settings}
            onSave={(next) => {
              setSettings(next);
              showToast("সেটিংস সেভ করা হয়েছে!");
            }}
            onClearDemo={() => {
              storage.clearDemoData();
              setTasks([]);
              setEmails([]);
              setFbEvents([]);
              setCheckins([]);
              showToast("সব নমুনা ডেটা মুছে ফেলা হয়েছে।");
            }}
            onExportBackup={handleExportBackup}
          />
        )}
      </main>
    </div>
  );
}
