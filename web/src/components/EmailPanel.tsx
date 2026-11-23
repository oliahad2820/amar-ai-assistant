import React, { useState } from "react";
import {
  Check,
  Copy,
  ListPlus,
  Mail,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Volume2,
} from "lucide-react";
import type { EmailItem } from "../types";

interface EmailPanelProps {
  emails: EmailItem[];
  backendConnected: boolean;
  onSyncBackend: () => Promise<void>;
  onIngestManual: (sender: string, subject: string, body: string) => Promise<void>;
  onExtractTask: (email: EmailItem) => void;
  onSpeakEmail: (email: EmailItem) => void;
  onMarkRead: (id: number) => void;
  onSendApprovedReply: (email: EmailItem, replyBody: string) => Promise<void>;
}

const URGENCY_BADGE = {
  urgent: { label: "জরুরি", cls: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  action_required: { label: "অ্যাকশন দরকার", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  fyi: { label: "তথ্য", cls: "bg-slate-700/60 text-slate-300 border-slate-600" },
};

export const EmailPanel: React.FC<EmailPanelProps> = ({
  emails,
  backendConnected,
  onSyncBackend,
  onIngestManual,
  onExtractTask,
  onSpeakEmail,
  onMarkRead,
  onSendApprovedReply,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [approvingEmail, setApprovingEmail] = useState<EmailItem | null>(null);
  const [draftText, setDraftText] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSyncBackend();
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sender.trim() || !subject.trim()) return;
    await onIngestManual(sender.trim(), subject.trim(), body.trim());
    setSender("");
    setSubject("");
    setBody("");
    setShowAdd(false);
  };

  const copyReply = (em: EmailItem) => {
    navigator.clipboard.writeText(em.draft_reply);
    setCopiedId(em.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">ইমেইল হাব (Gmail ও ডোমেইন IMAP)</h2>
          <p className="text-xs text-slate-400">
            AI ইমেইল পড়ে সারাংশ দেবে, অফিস কাজে যোগ করবে এবং অনুমোদন ছাড়া কখনো রিপ্লাই পাঠাবে না
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {backendConnected && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              লাইভ ইনবক্স সিঙ্ক
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAdd((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            ইমেইল বিশ্লেষণ / টেস্ট
          </button>
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={handleManualSubmit}
          className="rounded-2xl bg-slate-900 border border-sky-500/30 p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="প্রেরক (যেমন: Boss <boss@office.com>)"
              className="px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="ইমেইলের বিষয় (Subject)"
              className="px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </div>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="ইমেইলের মূল টেক্সট পেস্ট করুন — AI সাথে সাথে বাংলা সারাংশ ও রিপ্লাই ড্রাফট বানাবে..."
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
          />
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-sky-500 text-slate-950 hover:bg-sky-400 cursor-pointer"
          >
            AI দিয়ে বিশ্লেষণ ও সেভ করুন
          </button>
        </form>
      )}

      {/* Email Cards */}
      <div className="space-y-3">
        {emails.length === 0 ? (
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 text-center text-sm text-slate-400">
            কোনো ইমেইল নেই। সেটিংস থেকে ব্যাকএন্ড IMAP/Gmail যুক্ত করুন অথবা উপরে টেস্ট ইমেইল দিন।
          </div>
        ) : (
          emails.map((em) => {
            const u = URGENCY_BADGE[em.urgency];
            return (
              <div
                key={em.id}
                className={`rounded-2xl p-4 border space-y-2.5 ${
                  em.is_read
                    ? "bg-slate-900/50 border-slate-800/80"
                    : "bg-slate-900 border-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Mail className="w-4 h-4 text-sky-400" />
                      <span className="text-sm font-semibold text-white">{em.subject}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${u.cls}`}>
                        {u.label}
                      </span>
                      {!em.is_read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="নতুন" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{em.sender}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onMarkRead(em.id);
                        onSpeakEmail(em);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-slate-800 text-emerald-300 hover:bg-slate-700 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      পড়ে শোনাও
                    </button>
                    <button
                      type="button"
                      onClick={() => onExtractTask(em)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 cursor-pointer"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      অফিস কাজে যোগ
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                  <span className="text-emerald-400 font-semibold">AI সারাংশ: </span>
                  {em.summary_bn}
                </div>

                {em.draft_reply && (
                  <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>AI রিপ্লাই ড্রাফট (পাঠানোর আগে আপনার অনুমতি জরুরি)</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyReply(em)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                        >
                          {copiedId === em.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          কপি
                        </button>
                        {backendConnected && (
                          <button
                            type="button"
                            onClick={() => {
                              setApprovingEmail(em);
                              setDraftText(em.draft_reply);
                              setConfirmed(false);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            অনুমোদন ও পাঠান
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 whitespace-pre-line">{em.draft_reply}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Human-in-the-loop Approval Modal */}
      {approvingEmail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-300">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-sm font-semibold">ইমেইল পাঠানোর চূড়ান্ত অনুমতি</h3>
            </div>
            <p className="text-xs text-slate-400">
              প্রাপক: <span className="text-white">{approvingEmail.sender}</span>
            </p>
            <textarea
              rows={5}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              className="w-full p-3 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="accent-emerald-500"
              />
              আমি টেক্সটটি পড়েছি এবং এই ইমেইল পাঠানোর অনুমতি দিচ্ছি।
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApprovingEmail(null)}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-300 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={!confirmed}
                onClick={async () => {
                  await onSendApprovedReply(approvingEmail, draftText);
                  setApprovingEmail(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 disabled:opacity-40 cursor-pointer"
              >
                পাঠান
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
