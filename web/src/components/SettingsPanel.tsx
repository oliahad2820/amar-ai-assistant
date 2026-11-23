import React, { useState } from "react";
import {
  CheckCircle2,
  Download,
  Globe,
  KeyRound,
  Lock,
  Server,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { AssistantSettings } from "../types";

interface SettingsPanelProps {
  settings: AssistantSettings;
  onSave: (next: AssistantSettings) => void;
  onClearDemo: () => void;
  onExportBackup: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSave,
  onClearDemo,
  onExportBackup,
}) => {
  const [form, setForm] = useState<AssistantSettings>(settings);
  const [savedToast, setSavedToast] = useState(false);
  const [backendStatus, setBackendStatus] = useState<string>("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const testBackend = async () => {
    if (!form.backendUrl.trim()) {
      setBackendStatus("আগে ব্যাকএন্ড URL দিন (যেমন http://localhost:8000 বা আপনার Render URL)।");
      return;
    }
    setBackendStatus("চেক করা হচ্ছে...");
    try {
      const res = await fetch(`${form.backendUrl.replace(/\/$/, "")}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendStatus(
          `কানেক্টেড! Gemini: ${data.gemini_configured ? "চালু" : "অফ"}, IMAP: ${
            data.imap_configured ? "চালু" : "অফ"
          }, FB Page: ${data.facebook_page_configured ? "চালু" : "অফ"}`
        );
      } else {
        setBackendStatus(`সার্ভার উত্তর দিয়েছে (${res.status}) — URL যাচাই করুন।`);
      }
    } catch {
      setBackendStatus("ব্যাকএন্ডে কানেক্ট করা যায়নি। সার্ভার চালু আছে কিনা দেখুন।");
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">অ্যাসিস্ট্যান্ট সেটিংস ও API কনফিগ</h2>
            <p className="text-xs text-slate-400">
              সব কী কেবল আপনার ব্রাউজারেই (localStorage) সংরক্ষিত থাকে—গিটহাবে কখনো যায় না
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {savedToast ? "সেভ হয়েছে!" : "সেভ করুন"}
          </button>
        </div>

        {/* Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">আপনার নাম (সালামের সময় বলবে)</span>
            <input
              type="text"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">অ্যাসিস্ট্যান্টের নাম</span>
            <input
              type="text"
              value={form.assistantName}
              onChange={(e) => setForm({ ...form, assistantName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">আপনার কাস্টম ডোমেইন</span>
            <input
              type="text"
              placeholder="ai.yourdomain.com"
              value={form.customDomain}
              onChange={(e) => setForm({ ...form, customDomain: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </label>
        </div>

        {/* Free Gemini API Key */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <KeyRound className="w-4 h-4" />
              ফ্রি Gemini API Key (Google AI Studio)
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
            >
              ফ্রি কী নিন
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="password"
              value={form.geminiApiKey}
              onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
              placeholder="AIzaSy... (সম্পূর্ণ ফ্রি টিয়ার আছে)"
              className="sm:col-span-2 px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
            <select
              value={form.geminiModel}
              onChange={(e) => setForm({ ...form, geminiModel: e.target.value })}
              className="px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
            >
              <option value="gemini-4-hydrogen">gemini-4-hydrogen (রেকমেন্ডেড)</option>
              <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (দ্রুততম)</option>
              <option value="gemini-4-argon">gemini-4-argon (রিজনিং)</option>
            </select>
          </div>
        </div>

        {/* Optional Free Backend for Live IMAP Email & FB Page */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <Server className="w-4 h-4" />
              ঐচ্ছিক ব্যাকএন্ড URL (লাইভ Gmail/IMAP ও Facebook Page সিঙ্কের জন্য)
            </div>
            <button
              type="button"
              onClick={testBackend}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-sky-300 hover:bg-slate-700 cursor-pointer"
            >
              কানেকশন টেস্ট
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="url"
              value={form.backendUrl}
              onChange={(e) => setForm({ ...form, backendUrl: e.target.value })}
              placeholder="http://localhost:8000 অথবা https://your-api.onrender.com"
              className="px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
            <input
              type="password"
              value={form.backendToken}
              onChange={(e) => setForm({ ...form, backendToken: e.target.value })}
              placeholder="Bearer Token (যদি BACKEND_API_TOKEN দিয়ে থাকেন)"
              className="px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
          </div>
          {backendStatus && <p className="text-xs text-emerald-300">{backendStatus}</p>}
        </div>

        {/* Proactive Timer, Cooldown & PIN */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">ফিডব্যাক চেক-ইন (মিনিট)</span>
            <input
              type="number"
              min={5}
              max={180}
              value={form.checkinIntervalMinutes}
              onChange={(e) => setForm({ ...form, checkinIntervalMinutes: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">সালাম কুলডাউন (মিনিট)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={form.greetingCooldownMinutes}
              onChange={(e) =>
                setForm({ ...form, greetingCooldownMinutes: Number(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400">ভয়েস গতি ({form.voiceRate}x)</span>
            <input
              type="range"
              min={0.8}
              max={1.3}
              step={0.05}
              value={form.voiceRate}
              onChange={(e) => setForm({ ...form, voiceRate: Number(e.target.value) })}
              className="w-full mt-2 accent-emerald-500"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-slate-400 inline-flex items-center gap-1">
              <Lock className="w-3 h-3" /> স্ক্রিন PIN লক (ঐচ্ছিক)
            </span>
            <input
              type="password"
              maxLength={6}
              placeholder="যেমন: 1234"
              value={form.pinCode}
              onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
          </label>
        </div>
      </form>

      {/* Free Custom Domain Guide */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Globe className="w-4 h-4 text-emerald-400" />
          আপনার নিজস্ব ডোমেইনে ১০০% ফ্রি সেটআপ (GitHub Pages)
        </div>
        <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
          <li>
            আপনার ডোমেইন প্যানেলের DNS-এ একটি <code className="text-emerald-300">CNAME</code>{" "}
            রেকর্ড যোগ করুন: Host = <code className="text-emerald-300">ai</code> (অথবা আপনার পছন্দের
            সাবডোমেইন), Value = <code className="text-emerald-300">oliahad2820.github.io</code>
          </li>
          <li>
            GitHub রেপোতে গিয়ে <b>Settings → Pages → Custom domain</b> বক্সে{" "}
            <code className="text-emerald-300">{form.customDomain || "ai.yourdomain.com"}</code>{" "}
            লিখে Save করুন এবং <b>Enforce HTTPS</b> টিক দিন।
          </li>
          <li>
            GitHub রেপোতে <b>Settings → Secrets and variables → Actions → Variables</b>-এ{" "}
            <code className="text-emerald-300">CUSTOM_DOMAIN</code> ভ্যারিয়েবল সেট করলে প্রতি
            আপডেটেই অটোমেটিক আপনার ডোমেইনে ডিপ্লয় হবে!
          </li>
        </ol>

        <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            ডেটা ব্যাকআপ (JSON)
          </button>
          <button
            type="button"
            onClick={onClearDemo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            নমুনা ডেটা মুছে নতুন করে শুরু
          </button>
        </div>
      </div>
    </div>
  );
};
