export function speakBengali(text: string, enabled: boolean, rate = 1.0): void {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "bn-BD";
    utterance.rate = Math.min(1.4, Math.max(0.7, rate));
    const voices = window.speechSynthesis.getVoices();
    const bnVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith("bn-bd")) ||
      voices.find((v) => v.lang.toLowerCase().startsWith("bn"));
    if (bnVoice) {
      utterance.voice = bnVoice;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // Gracefully skip if speech synthesis is blocked before user gesture
  }
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
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
