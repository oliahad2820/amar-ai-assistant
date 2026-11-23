import React, { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Heart,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import type { FacebookEventItem, FacebookEventType } from "../types";

interface FacebookPanelProps {
  events: FacebookEventItem[];
  backendConnected: boolean;
  onSyncFacebook: () => Promise<void>;
  onAddManual: (actor: string, type: FacebookEventType, content: string) => void;
  onMarkRead: (id: number) => void;
  onSpeakSummary: () => void;
}

export const FacebookPanel: React.FC<FacebookPanelProps> = ({
  events,
  backendConnected,
  onSyncFacebook,
  onAddManual,
  onMarkRead,
  onSpeakSummary,
}) => {
  const [syncing, setSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [actor, setActor] = useState("");
  const [etype, setEtype] = useState<FacebookEventType>("comment");
  const [content, setContent] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSyncFacebook();
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor.trim()) return;
    onAddManual(actor.trim(), etype, content.trim() || "আপনার পোস্টে রিঅ্যাকশন দিয়েছে।");
    setActor("");
    setContent("");
    setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">ফেসবুক কমেন্ট ও লাইক মনিটর</h2>
          <p className="text-xs text-slate-400">
            Facebook Page-এর জন্য Meta Graph API ও পার্সোনাল আইডির জন্য নিরাপদ Email Alert Parser
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSpeakSummary}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 text-emerald-300 hover:bg-slate-700 border border-slate-700 cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            আপডেট শোনাও
          </button>
          {backendConnected && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 text-white hover:bg-blue-400 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              পেজ সিঙ্ক করুন
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            টেস্ট অ্যালার্ট যোগ
          </button>
        </div>
      </div>

      {/* Safe Mode Note */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/25 p-3 flex items-start gap-2.5 text-xs text-blue-200">
        <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">নিরাপদ কানেকশন গাইড:</span> Facebook Page হলে ব্যাকএন্ডে{" "}
          <code className="text-blue-100">FB_PAGE_ID</code> ও{" "}
          <code className="text-blue-100">FB_PAGE_ACCESS_TOKEN</code> দিন। আর পার্সোনাল Facebook
          প্রোফাইল হলে Facebook Settings → Notifications → Email চালু করে Gmail/IMAP সিঙ্ক করলেই সব
          কমেন্ট-ট্যাগ-লাইক এখানে নিরাপদে চলে আসবে (আইডি ব্যানের কোনো ঝুঁকি নেই)।
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-slate-900 border border-blue-500/30 p-4 grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <input
            type="text"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="কে কমেন্ট/লাইক করেছে (নাম)..."
            className="sm:col-span-4 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
          />
          <select
            value={etype}
            onChange={(e) => setEtype(e.target.value as FacebookEventType)}
            className="sm:col-span-3 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
          >
            <option value="comment">কমেন্ট (Comment)</option>
            <option value="like">লাইক / রিঅ্যাকশন</option>
            <option value="mention">মেনশন / ট্যাগ</option>
          </select>
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="কমেন্টের লেখা..."
            className="sm:col-span-3 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
          />
          <button
            type="submit"
            className="sm:col-span-2 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-500 text-white hover:bg-blue-400 cursor-pointer"
          >
            যোগ করুন
          </button>
        </form>
      )}

      {/* Feed Cards */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 text-center text-sm text-slate-400">
            এখনো কোনো ফেসবুক আপডেট নেই।
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className={`rounded-2xl p-4 border space-y-2.5 ${
                ev.is_read
                  ? "bg-slate-900/50 border-slate-800/80"
                  : "bg-slate-900 border-slate-700"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {ev.event_type === "like" ? (
                    <Heart className="w-4 h-4 text-rose-400" />
                  ) : (
                    <MessageCircle className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="text-sm font-semibold text-white">{ev.actor_name}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {ev.source === "page_api"
                      ? "Page API"
                      : ev.source === "email_alert"
                      ? "Personal Alert"
                      : "Manual"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!ev.is_read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(ev.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-emerald-300 hover:bg-slate-700 cursor-pointer"
                    >
                      পড়া হয়েছে
                    </button>
                  )}
                  <a
                    href={ev.url || "https://www.facebook.com"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                  >
                    ফেসবুকে দেখুন
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              <p className="text-xs text-slate-200">{ev.content}</p>
              {ev.post_title && (
                <p className="text-[11px] text-slate-500">পোস্ট: {ev.post_title}</p>
              )}

              {ev.suggested_reply && (
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-300">
                    <span className="text-emerald-400 font-medium">প্রস্তাবিত রিপ্লাই: </span>
                    {ev.suggested_reply}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(ev.suggested_reply);
                      setCopiedId(ev.id);
                      setTimeout(() => setCopiedId(null), 1500);
                    }}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    {copiedId === ev.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    কপি
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
