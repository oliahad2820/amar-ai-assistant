import React, { useState } from "react";
import {
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  Globe,
  KeyRound,
  Lock,
  Server,
  Trash2,
  Volume2,
} from "lucide-react";
import { STUDIO_VOICE_OPTIONS, speakBengali } from "../lib/voice";
import type { AIProviderMode, AssistantSettings, TTSEngineMode } from "../types";

interface SettingsPanelProps {
  settings: AssistantSettings;
  activeBackendUrl: string;
  onSave: (next: AssistantSettings) => void;
  onClearDemo: () => void;
  onExportBackup: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  activeBackendUrl,
  onSave,
  onClearDemo,
  onExportBackup,
}) => {
  const [form, setForm] = useState<AssistantSettings>(settings);
  const [savedToast, setSavedToast] = useState(false);
  const [backendStatus, setBackendStatus] = useState<string>("");
  const [ollamaStatus, setOllamaStatus] = useState<string>("");
  const [voiceTestStatus, setVoiceTestStatus] = useState<string>("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const testVoice = async () => {
    setVoiceTestStatus("সুন্দর ফিমেল নিউরাল ভয়েস চালু হচ্ছে...");
    const used = await speakBengali(
      `আসসালামু আলাইকুম ${form.ownerName}! আমি আপনার ${form.assistantName}। আমার এই নতুন বাংলা ভয়েসটি কি আপনার ভালো লাগছে?`,
      { ...form, voiceEnabled: true },
      form.backendUrl.trim() || activeBackendUrl
    );
    setVoiceTestStatus(
      used === "neural_backend"
        ? "চালু হয়েছে: স্টুডিও বাংলা নিউরাল ভয়েস (১০০% ফ্রি ও আনলিমিটেড!)"
        : used === "gemini_tts"
        ? "চালু হয়েছে: Gemini 3.8 প্রিমিয়াম নিউরাল ভয়েস!"
        : "ব্রাউজার ভয়েস চলেছে — স্টুডিও নবনীতা ভয়েসের জন্য লোকাল ব্যাকএন্ড বা Gemini API Key চালু রাখুন।"
    );
  };

  const testBackend = async () => {
    const target = (form.backendUrl || activeBackendUrl).trim();
    if (!target) {
      setBackendStatus("ব্যাকএন্ড URL দিন (যেমন http://127.0.0.1:8000 অথবা আপনার Render/Tunnel URL)।");
      return;
    }
    setBackendStatus("চেক করা হচ্ছে...");
    try {
      const res = await fetch(`${target.replace(/\/$/, "")}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendStatus(
          `কানেক্টেড (${target})! নিউরাল ফিমেল ভয়েস: চালু, Ollama: ${
            data.ollama_reachable ? "চালু (আনলিমিটেড)" : "অফ"
          }, Gemini: ${data.gemini_configured ? "চালু" : "অফ"}, IMAP: ${
            data.imap_configured ? "চালু" : "অফ"
          }`
        );
      } else {
        setBackendStatus(`সার্ভার উত্তর দিয়েছে (${res.status}) — URL যাচাই করুন।`);
      }
    } catch {
      setBackendStatus("ব্যাকএন্ডে কানেক্ট করা যায়নি। ./start-local.sh বা সার্ভার চালু আছে কিনা দেখুন।");
    }
  };

  const testOllama = async () => {
    const target = form.ollamaUrl.trim();
    if (!target) return;
    setOllamaStatus("Ollama যাচাই করা হচ্ছে...");
    try {
      const res = await fetch(`${target.replace(/\/$/, "")}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const names = (data.models || []).map((m: { name: string }) => m.name).slice(0, 4);
        setOllamaStatus(
          names.length
            ? `Ollama চালু আছে! ইনস্টল করা মডেল: ${names.join(", ")}`
            : "Ollama চালু আছে, তবে এখনো কোনো মডেল ডাউনলোড করা নেই (ollama pull qwen2.5:7b চালান)।"
        );
      } else {
        setOllamaStatus("Ollama রেসপন্স দেয়নি।");
      }
    } catch {
      setOllamaStatus(
        "লোকাল Ollama পাওয়া যায়নি। Mac-এ চালান: brew install ollama && OLLAMA_ORIGINS='*' ollama serve"
      );
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white">ভয়েস, আনলিমিটেড ফ্রি AI ও সেটিংস</h2>
            <p className="text-xs text-slate-400">
              সব কী কেবল আপনার ব্রাউজারেই (localStorage) থাকে—গিটহাবে কখনো যায় না
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

        {/* STUDIO BENGALI FEMALE NEURAL VOICE */}
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Volume2 className="w-4 h-4" />
              স্টুডিও বাংলা ফিমেল নিউরাল ভয়েস (১০০% ফ্রি ও স্পষ্ট)
            </div>
            <button
              type="button"
              onClick={testVoice}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" />
              ভয়েস শুনে দেখুন
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="sm:col-span-2 space-y-1 text-xs">
              <span className="text-slate-300">বাংলা ভয়েস পছন্দ করুন</span>
              <select
                value={form.ttsVoice}
                onChange={(e) => setForm({ ...form, ttsVoice: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
              >
                {STUDIO_VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-300">ভয়েস ইঞ্জিন মোড</span>
              <select
                value={form.ttsEngine}
                onChange={(e) => setForm({ ...form, ttsEngine: e.target.value as TTSEngineMode })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
              >
                <option value="auto">অটো (নিউরাল ফিমেল → Gemini → ব্রাউজার)</option>
                <option value="neural_backend">নিউরাল ব্যাকএন্ড (নবনীতা ফ্রি)</option>
                <option value="gemini_tts">Gemini 3.8 Neural TTS</option>
                <option value="browser">ব্রাউজার ফিমেল ভয়েস</option>
              </select>
            </label>
          </div>
          {voiceTestStatus && <p className="text-xs text-emerald-200">{voiceTestStatus}</p>}
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

        {/* UNLIMITED FREE LOCAL AI (OLLAMA) + MULTI-PROVIDER FALLBACK */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
              <Cpu className="w-4 h-4" />
              ১০০% ফ্রি ও আনলিমিটেড AI (Ollama + অটো-ফলব্যাক রোটেটর)
            </div>
            <button
              type="button"
              onClick={testOllama}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-purple-300 hover:bg-slate-700 cursor-pointer"
            >
              Ollama টেস্ট
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1 text-xs">
              <span className="text-slate-400">AI প্রোভাইডার মোড</span>
              <select
                value={form.aiProviderMode}
                onChange={(e) =>
                  setForm({ ...form, aiProviderMode: e.target.value as AIProviderMode })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
              >
                <option value="auto">অটো ফ্রি রোটেটর (Ollama → Gemini → Groq)</option>
                <option value="ollama">শুধু Ollama (আনলিমিটেড লোকাল $০)</option>
                <option value="gemini">শুধু Gemini ফ্রি টিয়ার</option>
                <option value="openai_compat">শুধু Groq / OpenRouter ফ্রি</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-400">Ollama URL (নিজের ম্যাক/পিসি)</span>
              <input
                type="url"
                value={form.ollamaUrl}
                onChange={(e) => setForm({ ...form, ollamaUrl: e.target.value })}
                placeholder="http://127.0.0.1:11434"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-slate-400">Ollama মডেল (বাংলা সাপোর্ট)</span>
              <input
                type="text"
                value={form.ollamaModel}
                onChange={(e) => setForm({ ...form, ollamaModel: e.target.value })}
                placeholder="qwen2.5:7b বা gemma3:4b"
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
              />
            </label>
          </div>
          {ollamaStatus && <p className="text-xs text-purple-200">{ollamaStatus}</p>}
        </div>

        {/* Free Cloud API Keys (Gemini + Groq/OpenRouter Fallback) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <KeyRound className="w-3.5 h-3.5" />
                ফ্রি Gemini API Key (কোনো কার্ড ছাড়া)
              </span>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
              >
                ফ্রি কী <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={form.geminiApiKey}
              onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
              placeholder="AIzaSy... (ফ্রি টিয়ার)"
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
            <select
              value={form.geminiModel}
              onChange={(e) => setForm({ ...form, geminiModel: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
            >
              <option value="gemini-4-hydrogen">gemini-4-hydrogen (রেকমেন্ডেড)</option>
              <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (বেশি ফ্রি কোটা)</option>
              <option value="gemini-4-argon">gemini-4-argon (রিজনিং)</option>
            </select>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <KeyRound className="w-3.5 h-3.5" />
                ফ্রি ব্যাকআপ API (Groq / OpenRouter :free)
              </span>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
              >
                Groq ফ্রি <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="password"
              value={form.openaiCompatKey}
              onChange={(e) => setForm({ ...form, openaiCompatKey: e.target.value })}
              placeholder="gsk_... অথবা sk-or-..."
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="url"
                value={form.openaiCompatUrl}
                onChange={(e) => setForm({ ...form, openaiCompatUrl: e.target.value })}
                placeholder="https://api.groq.com/openai/v1"
                className="px-2.5 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
              />
              <input
                type="text"
                value={form.openaiCompatModel}
                onChange={(e) => setForm({ ...form, openaiCompatModel: e.target.value })}
                placeholder="llama-3.3-70b-versatile"
                className="px-2.5 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Backend URL */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
              <Server className="w-4 h-4" />
              ব্যাকএন্ড URL (নিউরাল ফিমেল ভয়েস, Gmail/IMAP ও Facebook সিঙ্ক)
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
              placeholder={
                activeBackendUrl
                  ? `অটো-ডিটেক্টেড: ${activeBackendUrl}`
                  : "http://127.0.0.1:8000 অথবা Cloudflare Tunnel / Render URL"
              }
              className="px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
            <input
              type="password"
              value={form.backendToken}
              onChange={(e) => setForm({ ...form, backendToken: e.target.value })}
              placeholder="Bearer Token (ঐচ্ছিক)"
              className="px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
          </div>
          {backendStatus && <p className="text-xs text-emerald-300">{backendStatus}</p>}
        </div>

        {/* Timers & PIN */}
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

      {/* Free Unlimited + Custom Domain Guide */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Globe className="w-4 h-4 text-emerald-400" />
          ১০০% ফ্রি আনলিমিটেড চালানোর উপায় ও ডোমেইন সেটআপ
        </div>
        <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
          <li>
            <b>আনলিমিটেড ফ্রি AI (কোনো লিমিট নেই):</b> আপনার Mac-এ{" "}
            <code className="text-emerald-300">brew install ollama && ollama pull qwen2.5:7b</code>{" "}
            চালিয়ে <code className="text-emerald-300">OLLAMA_ORIGINS="*" ollama serve</code> রান
            করুন—কোনো API Key বা ডলার ছাড়াই আনলিমিটেড বাংলা AI চলবে।
          </li>
          <li>
            <b>সুন্দর বাংলা ফিমেল নিউরাল ভয়েস (নবনীতা):</b> ব্যাকএন্ড চালু থাকলে (
            <code className="text-emerald-300">./start-local.sh</code>) অ্যাপটি অটোমেটিক{" "}
            <code className="text-emerald-300">bn-BD-NabanitaNeural</code> স্টুডিও ভয়েসে কথা বলবে।
          </li>
          <li>
            <b>মোবাইল থেকে ফ্রি অ্যাক্সেস (Cloudflare Tunnel):</b>{" "}
            <code className="text-emerald-300">
              cloudflared tunnel --url http://127.0.0.1:8000
            </code>{" "}
            দিয়ে $০ খরচে HTTPS লিংক বানিয়ে যেকোনো জায়গা থেকে চালাতে পারবেন।
          </li>
          <li>
            <b>কাস্টম ডোমেইন:</b> DNS-এ <code className="text-emerald-300">CNAME</code> (Host:{" "}
            <code className="text-emerald-300">ai</code> → Value:{" "}
            <code className="text-emerald-300">oliahad2820.github.io</code>) যোগ করে GitHub
            Settings → Pages-এ বসান।
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
