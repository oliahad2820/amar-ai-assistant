import { GoogleGenAI } from "@google/genai";
import type {
  AssistantSettings,
  EmailItem,
  EmailUrgency,
  FacebookEventItem,
  TaskItem,
} from "../types";

function buildSystemInstruction(settings: AssistantSettings): string {
  return `তুমি '${settings.assistantName}', ${settings.ownerName}-এর ব্যক্তিগত এআই অ্যাসিস্ট্যান্ট।
- সবসময় মার্জিত, আন্তরিক এবং সংক্ষিপ্ত বাংলায় উত্তর দাও।
- আগমনের সময় 'আসসালামু আলাইকুম' বলে স্বাগত জানাও।
- অফিসের কাজের ক্রম (কোনটার পর কোনটা), ইমেইল সামারি, এবং ফেসবুকের লাইক/কমেন্ট স্পষ্টভাবে জানাও।
- কোনো ইমেইল বা ফেসবুক রিপ্লাই নিজে পাঠাবে না—আগে ড্রাফট দিয়ে অনুমতি চাইবে।`;
}

function buildContextPrompt(
  tasks: TaskItem[],
  emails: EmailItem[],
  fbEvents: FacebookEventItem[]
): string {
  const pending = tasks.filter((t) => t.status !== "done");
  const unreadEmails = emails.filter((e) => !e.is_read);
  const unreadFb = fbEvents.filter((f) => !f.is_read);

  return [
    `বাকি কাজ (${pending.length}টি): ${
      pending
        .slice(0, 6)
        .map((t) => `${t.title} [${t.scheduled_start || t.priority}]`)
        .join(" | ") || "নেই"
    }`,
    `না পড়া ইমেইল (${unreadEmails.length}টি): ${
      unreadEmails
        .slice(0, 5)
        .map((e) => `${e.sender}: ${e.subject}`)
        .join(" | ") || "নেই"
    }`,
    `ফেসবুক আপডেট (${unreadFb.length}টি): ${
      unreadFb
        .slice(0, 5)
        .map((f) => `${f.actor_name} (${f.event_type}): ${f.content.slice(0, 60)}`)
        .join(" | ") || "নেই"
    }`,
  ].join("\n");
}

async function callOllamaDirect(
  settings: AssistantSettings,
  prompt: string
): Promise<string | null> {
  const url = settings.ollamaUrl.trim();
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${url.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.ollamaModel || "qwen2.5:7b",
        stream: false,
        messages: [
          { role: "system", content: buildSystemInstruction(settings) },
          { role: "user", content: prompt },
        ],
      }),
    });
    window.clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function callGeminiDirect(
  settings: AssistantSettings,
  prompt: string
): Promise<string | null> {
  const key = settings.geminiApiKey.trim();
  if (!key) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const interaction = await ai.interactions.create({
      model: settings.geminiModel || "gemini-4-hydrogen",
      input: prompt,
      system_instruction: buildSystemInstruction(settings),
    });
    return interaction.output_text?.trim() || null;
  } catch (err) {
    console.warn("Direct Gemini API call failed, trying next free provider:", err);
    return null;
  }
}

async function callOpenAICompatDirect(
  settings: AssistantSettings,
  prompt: string
): Promise<string | null> {
  const url = settings.openaiCompatUrl.trim();
  const key = settings.openaiCompatKey.trim();
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: settings.openaiCompatModel || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: buildSystemInstruction(settings) },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function callProviderChain(
  settings: AssistantSettings,
  prompt: string
): Promise<{ text: string; source: "ollama" | "gemini" | "openai_compat" } | null> {
  const mode = settings.aiProviderMode || "auto";
  const order: Array<"ollama" | "gemini" | "openai_compat"> =
    mode === "ollama"
      ? ["ollama"]
      : mode === "gemini"
      ? ["gemini"]
      : mode === "openai_compat"
      ? ["openai_compat"]
      : ["ollama", "gemini", "openai_compat"];

  for (const provider of order) {
    if (provider === "ollama") {
      const text = await callOllamaDirect(settings, prompt);
      if (text) return { text, source: "ollama" };
    } else if (provider === "gemini") {
      const text = await callGeminiDirect(settings, prompt);
      if (text) return { text, source: "gemini" };
    } else if (provider === "openai_compat") {
      const text = await callOpenAICompatDirect(settings, prompt);
      if (text) return { text, source: "openai_compat" };
    }
  }
  return null;
}

export async function generateArrivalGreeting(
  settings: AssistantSettings,
  tasks: TaskItem[],
  emails: EmailItem[],
  fbEvents: FacebookEventItem[],
  activeBackendUrl = ""
): Promise<string> {
  const backend = (activeBackendUrl || settings.backendUrl || "").trim();
  if (backend) {
    try {
      const res = await fetch(`${backend.replace(/\/$/, "")}/api/presence/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.backendToken ? { Authorization: `Bearer ${settings.backendToken}` } : {}),
        },
        body: JSON.stringify({
          event_type: "arrived",
          face_position: "center",
          owner_name: settings.ownerName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.greeting_text) return data.greeting_text;
      }
    } catch {
      // Fall through cleanly
    }
  }

  const pending = tasks.filter((t) => t.status !== "done");
  const unreadEmails = emails.filter((e) => !e.is_read);
  const unreadFb = fbEvents.filter((f) => !f.is_read);

  const aiResult = await callProviderChain(
    settings,
    `${settings.ownerName} এইমাত্র ক্যামেরার সামনে এসেছেন। ২-৩ বাক্যে আন্তরিক বাংলায় 'আসসালামু আলাইকুম' বলে স্বাগত জানাও এবং আজকের মূল অবস্থা সংক্ষেপে বলো:\n${buildContextPrompt(
      tasks,
      emails,
      fbEvents
    )}`
  );
  if (aiResult) return aiResult.text;

  const parts = [`আসসালামু আলাইকুম ${settings.ownerName}! আপনাকে আবার দেখে ভালো লাগলো।`];
  if (pending.length > 0) {
    parts.push(
      `আজ আপনার ${pending.length}টি অফিসের কাজ বাকি আছে—প্রথমে "${pending[0].title}" দিয়ে শুরু করলে সবচেয়ে ভালো হবে।`
    );
  } else {
    parts.push("আজকের সব অফিসের কাজ দারুণভাবে শেষ হয়ে গেছে!");
  }
  if (unreadEmails.length > 0 || unreadFb.length > 0) {
    parts.push(
      `এছাড়া ${unreadEmails.length}টি নতুন ইমেইল এবং ${unreadFb.length}টি ফেসবুক আপডেট এসেছে।`
    );
  }
  return parts.join(" ");
}

export async function askAssistant(
  message: string,
  settings: AssistantSettings,
  tasks: TaskItem[],
  emails: EmailItem[],
  fbEvents: FacebookEventItem[],
  activeBackendUrl = ""
): Promise<{ reply: string; source: "backend" | "ollama" | "gemini" | "openai_compat" | "local" }> {
  const backend = (activeBackendUrl || settings.backendUrl || "").trim();
  if (backend) {
    try {
      const res = await fetch(`${backend.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.backendToken ? { Authorization: `Bearer ${settings.backendToken}` } : {}),
        },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.reply) return { reply: data.reply, source: "backend" };
      }
    } catch {
      // Fallback gracefully
    }
  }

  const aiResult = await callProviderChain(
    settings,
    `বর্তমান ড্যাশবোর্ড তথ্য:\n${buildContextPrompt(
      tasks,
      emails,
      fbEvents
    )}\n\nব্যবহারকারীর প্রশ্ন: ${message}`
  );
  if (aiResult) return { reply: aiResult.text, source: aiResult.source };

  const m = message.toLowerCase();
  const pending = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const unreadEmails = emails.filter((e) => !e.is_read);
  const unreadFb = fbEvents.filter((f) => !f.is_read);

  if (/(ইমেইল|মেইল|email|mail)/.test(m)) {
    if (emails.length === 0) {
      return {
        reply: "এখন কোনো ইমেইল জমা নেই। ইমেইল ট্যাব থেকে নতুন ইমেইল টেস্ট করুন অথবা ব্যাকএন্ডে Gmail/IMAP কানেক্ট করুন।",
        source: "local",
      };
    }
    const list = emails
      .slice(0, 3)
      .map((e, i) => `${i + 1}. ${e.sender} — ${e.subject}: ${e.summary_bn}`)
      .join("\n");
    return {
      reply: `মোট ${unreadEmails.length}টি না পড়া ইমেইল রয়েছে:\n${list}`,
      source: "local",
    };
  }

  if (/(ফেসবুক|কমেন্ট|লাইক|facebook|fb)/.test(m)) {
    if (fbEvents.length === 0) {
      return {
        reply: "ফেসবুকে এখন কোনো নতুন লাইক বা কমেন্ট নেই।",
        source: "local",
      };
    }
    const list = fbEvents
      .slice(0, 3)
      .map((f, i) => `${i + 1}. ${f.actor_name} (${f.event_type === "comment" ? "কমেন্ট" : "লাইক"}): ${f.content}`)
      .join("\n");
    return {
      reply: `ফেসবুকে ${unreadFb.length}টি নতুন নোটিফিকেশন আছে:\n${list}`,
      source: "local",
    };
  }

  if (/(প্ল্যান|কাজ|অফিস|রুটিন|প্রগ্রেস|task|plan)/.test(m)) {
    if (pending.length === 0) {
      return {
        reply: `অভিনন্দন! আপনার সব কাজ (${done.length}টি) শেষ হয়ে গেছে। নতুন কোনো অফিস কাজ যোগ করবেন?`,
        source: "local",
      };
    }
    const list = pending
      .slice(0, 5)
      .map(
        (t, i) =>
          `${i + 1}. ${t.title}${t.scheduled_start ? ` (${t.scheduled_start}–${t.scheduled_end})` : ""}`
      )
      .join("\n");
    return {
      reply: `আজ আপনার ${pending.length}টি কাজ বাকি (সম্পন্ন ${done.length}টি)। কাজের ক্রম:\n${list}`,
      source: "local",
    };
  }

  return {
    reply: `আসসালামু আলাইকুম ${settings.ownerName}! আপনার ${pending.length}টি বাকি কাজ, ${unreadEmails.length}টি নতুন ইমেইল ও ${unreadFb.length}টি ফেসবুক আপডেট আমি ট্র্যাক করছি। আনলিমিটেড ফ্রি AI চালু করতে সেটিংস থেকে লোকাল Ollama অথবা ফ্রি Gemini/Groq API Key যুক্ত করুন।`,
    source: "local",
  };
}

export async function analyzeEmailLocalOrAI(
  sender: string,
  subject: string,
  body: string,
  settings: AssistantSettings
): Promise<{ urgency: EmailUrgency; summary_bn: string; draft_reply: string }> {
  const aiResult = await callProviderChain(
    settings,
    `নিচের ইমেইলটি ১ বাক্যে বাংলায় সারাংশ করো এবং একটি ছোট ভদ্র রিপ্লাই ড্রাফট দাও। JSON ফরম্যাটে উত্তর দাও: {"urgency":"urgent|action_required|fyi","summary_bn":"...","draft_reply":"..."}\nপ্রেরক: ${sender}\nবিষয়: ${subject}\nবিবরণ: ${body.slice(0, 1200)}`
  );
  if (aiResult) {
    try {
      const cleaned = aiResult.text.replace(/^```json\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.summary_bn) {
        return {
          urgency: (["urgent", "action_required", "fyi"].includes(parsed.urgency)
            ? parsed.urgency
            : "fyi") as EmailUrgency,
          summary_bn: parsed.summary_bn,
          draft_reply: parsed.draft_reply || "",
        };
      }
    } catch {
      // Fallback
    }
  }

  const text = `${subject} ${body}`.toLowerCase();
  const urgency: EmailUrgency = /(urgent|asap|deadline|জরুরি|invoice|payment)/.test(text)
    ? "urgent"
    : /(please|meeting|review|confirm|reply|অফিস|মিটিং)/.test(text)
    ? "action_required"
    : "fyi";

  return {
    urgency,
    summary_bn: `${sender} থেকে "${subject}" বিষয়ে নতুন ইমেইল এসেছে।`,
    draft_reply: `আসসালামু আলাইকুম,\n\nআপনার "${subject}" ইমেইলটি পেয়েছি। বিষয়টি দেখে শীঘ্রই আপডেট জানাচ্ছি।\n\nধন্যবাদ।`,
  };
}
