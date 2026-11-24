export type Priority = "urgent" | "high" | "normal" | "low";
export type TaskStatus = "pending" | "in_progress" | "done";
export type EmailUrgency = "urgent" | "action_required" | "fyi";
export type FacebookEventType = "comment" | "like" | "mention" | "message" | "notification";
export type AIProviderMode = "auto" | "ollama" | "gemini" | "openai_compat";
export type TTSEngineMode = "auto" | "neural_backend" | "gemini_tts" | "browser";

export interface TaskItem {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  estimated_minutes: number;
  status: TaskStatus;
  depends_on_id: number | null;
  scheduled_start: string;
  scheduled_end: string;
  order_index: number;
  rationale_bn: string;
  created_at: string;
}

export interface EmailItem {
  id: number;
  sender: string;
  subject: string;
  snippet: string;
  body: string;
  urgency: EmailUrgency;
  summary_bn: string;
  draft_reply: string;
  is_read: boolean;
  extracted_task_id?: number | null;
  received_at: string;
}

export interface FacebookEventItem {
  id: number;
  source: "page_api" | "email_alert" | "manual";
  event_type: FacebookEventType;
  actor_name: string;
  post_title: string;
  content: string;
  url: string;
  suggested_reply: string;
  is_read: boolean;
  created_at: string;
}

export interface CheckinRecord {
  id: number;
  status: "on_track" | "slightly_behind" | "off_track";
  completion_rate: number;
  summary_bn: string;
  recommendation_bn: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface AssistantSettings {
  ownerName: string;
  assistantName: string;
  customDomain: string;

  // Unlimited Free Multi-Provider AI
  aiProviderMode: AIProviderMode;
  ollamaUrl: string;
  ollamaModel: string;
  geminiApiKey: string;
  geminiModel: string;
  openaiCompatUrl: string;
  openaiCompatKey: string;
  openaiCompatModel: string;

  // Backend & Neural Female Voice
  backendUrl: string;
  backendToken: string;
  voiceEnabled: boolean;
  voiceRate: number;
  ttsEngine: TTSEngineMode;
  ttsVoice: string;

  checkinIntervalMinutes: number;
  greetingCooldownMinutes: number;
  pinCode: string;
  faceProfileName: string;
  faceEnrolledAt: string;
}
