import { GoogleGenAI } from "@google/genai";
import type { AssistantSettings } from "../types";

export interface VoiceOption {
  id: string;
  label: string;
  engine: "edge" | "gemini";
}

export const STUDIO_VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "bn-BD-NabanitaNeural",
    label: "নবনীতা — বাংলাদেশী ফিমেল নিউরাল (স্পষ্ট ও মিষ্টি, ১০০% ফ্রি)",
    engine: "edge",
  },
  {
    id: "bn-IN-TanishaaNeural",
    label: "তানিশা — বাংলা ফিমেল নিউরাল (প্রমিত, ১০০% ফ্রি)",
    engine: "edge",
  },
  {
    id: "bn-BD-PradeepNeural",
    label: "প্রদীপ — বাংলাদেশী মেল নিউরাল (স্পষ্ট, ১০০% ফ্রি)",
    engine: "edge",
  },
  {
    id: "gemini:Kore",
    label: "Gemini 3.8 Kore — প্রিমিয়াম ফিমেল নিউরাল (API Key সহ)",
    engine: "gemini",
  },
  {
    id: "gemini:Aoede",
    label: "Gemini 3.8 Aoede — প্রিমিয়াম সফট ফিমেল (API Key সহ)",
    engine: "gemini",
  },
];

let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;

export function stopSpeaking(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function playBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    stopSpeaking();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    activeAudio = audio;
    activeAudioUrl = url;
    audio.onended = () => {
      if (activeAudioUrl === url) {
        URL.revokeObjectURL(url);
        activeAudioUrl = null;
        activeAudio = null;
      }
      resolve();
    };
    audio.onerror = () => {
      if (activeAudioUrl === url) {
        URL.revokeObjectURL(url);
        activeAudioUrl = null;
        activeAudio = null;
      }
      reject(new Error("Audio playback error"));
    };
    audio.play().catch(reject);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function speakViaBackendNeural(
  text: string,
  backendUrl: string,
  backendToken: string,
  voice: string,
  rate: number
): Promise<boolean> {
  if (!backendUrl) return false;
  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(backendToken ? { Authorization: `Bearer ${backendToken}` } : {}),
      },
      body: JSON.stringify({ text: text.slice(0, 1200), voice, rate }),
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    if (blob.size < 200) return false;
    await playBlob(blob);
    return true;
  } catch {
    return false;
  }
}

async function speakViaGeminiTTS(
  text: string,
  apiKey: string,
  voiceSetting: string
): Promise<boolean> {
  if (!apiKey.trim()) return false;
  try {
    const geminiVoice = voiceSetting.startsWith("gemini:")
      ? voiceSetting.split(":")[1] || "Kore"
      : "Kore";
    const client = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: { apiVersion: "v1beta" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const interaction: any = await client.interactions.create({
      model: "gemini-3.8-flash-lite-tts",
      input: [
        {
          type: "user_input",
          content: [
            {
              type: "text",
              text: text.slice(0, 1000),
              annotations: [
                {
                  type: "speech_metadata",
                  style: "warm, clear, natural polite Bengali female assistant",
                },
              ],
            },
          ],
        },
      ],
      response_format: { type: "audio" },
      generation_config: {
        speech_config: [{ voice: geminiVoice }],
      },
    } as never);

    const audio = interaction?.output_audio;
    if (audio?.data) {
      const blob = base64ToBlob(audio.data, audio.mime_type || "audio/wav");
      await playBlob(blob);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function pickBestBrowserFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const bnVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("bn"));
  const pool = bnVoices.length > 0 ? bnVoices : voices;

  const preferredKeywords = [
    "nabanita",
    "tanishaa",
    "google বাংলা",
    "google bengali",
    "piya",
    "natural",
    "neural",
    "female",
    "woman",
  ];
  for (const kw of preferredKeywords) {
    const match = pool.find((v) => v.name.toLowerCase().includes(kw));
    if (match) return match;
  }
  return bnVoices[0] || null;
}

function speakViaBrowserFallback(text: string, rate: number): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    stopSpeaking();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "bn-BD";
    utterance.rate = Math.min(1.3, Math.max(0.75, rate));
    utterance.pitch = 1.08;
    const bestVoice = pickBestBrowserFemaleVoice();
    if (bestVoice) {
      utterance.voice = bestVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // Gracefully skip if blocked before user gesture
  }
}

export async function speakBengali(
  text: string,
  settings: AssistantSettings,
  activeBackendUrl = ""
): Promise<"neural_backend" | "gemini_tts" | "browser" | "muted"> {
  if (!settings.voiceEnabled || !text.trim()) return "muted";

  const engine = settings.ttsEngine || "auto";
  const voice = settings.ttsVoice || "bn-BD-NabanitaNeural";
  const rate = settings.voiceRate || 1.0;
  const backend = (activeBackendUrl || settings.backendUrl || "").trim();

  if ((engine === "auto" || engine === "neural_backend") && backend) {
    const ok = await speakViaBackendNeural(text, backend, settings.backendToken, voice, rate);
    if (ok) return "neural_backend";
  }

  if ((engine === "auto" || engine === "gemini_tts") && settings.geminiApiKey.trim()) {
    const ok = await speakViaGeminiTTS(text, settings.geminiApiKey, voice);
    if (ok) return "gemini_tts";
  }

  speakViaBrowserFallback(text, rate);
  return "browser";
}

export interface SpeechRecognitionController {
  start: () => void;
  stop: () => void;
  supported: boolean;
}

export function createBengaliRecognizer(
  onResult: (transcript: string) => void,
  onStateChange: (listening: boolean) => void
): SpeechRecognitionController {
  if (typeof window === "undefined") {
    return { start: () => {}, stop: () => {}, supported: false };
  }
  const SpeechRec =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

  if (!SpeechRec) {
    return { start: () => {}, stop: () => {}, supported: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognition = new (SpeechRec as any)();
  recognition.lang = "bn-BD";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => onStateChange(true);
  recognition.onend = () => onStateChange(false);
  recognition.onerror = () => onStateChange(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recognition.onresult = (event: any) => {
    const transcript = event?.results?.[0]?.[0]?.transcript?.trim();
    if (transcript) {
      onResult(transcript);
    }
  };

  return {
    supported: true,
    start: () => {
      try {
        recognition.start();
      } catch {
        onStateChange(false);
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        onStateChange(false);
      }
    },
  };
}
