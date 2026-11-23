import React, { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, ScanFace, Sparkles, UserCheck, Compass } from "lucide-react";
import { storage } from "../lib/storage";

interface CameraPresenceProps {
  ownerName: string;
  cooldownMinutes: number;
  faceEnrolledAt: string;
  onFaceEnrolled: (timestamp: string) => void;
  onArrival: (position: string) => void;
  lastGreeting: string;
}

type TrackPosition = "বামে" | "মাঝে" | "ডানে" | "খোঁজা হচ্ছে";

function computeSignature(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): { signature: number[]; presenceScore: number; centerXRatio: number } {
  const frame = ctx.getImageData(0, 0, w, h).data;
  const bins = new Array<number>(12).fill(0);
  let skinPixels = 0;
  let weightedX = 0;
  let totalPixels = 0;

  for (let y = Math.floor(h * 0.15); y < Math.floor(h * 0.85); y += 2) {
    for (let x = Math.floor(w * 0.15); x < Math.floor(w * 0.85); x += 2) {
      const idx = (y * w + x) * 4;
      const r = frame[idx];
      const g = frame[idx + 1];
      const b = frame[idx + 2];
      totalPixels++;

      // Broad illumination-tolerant skin-tone heuristic for local presence tracking
      const isSkin =
        r > 70 &&
        g > 35 &&
        b > 20 &&
        r > g &&
        r > b &&
        Math.abs(r - g) > 12 &&
        r - b > 15;
      if (isSkin) {
        skinPixels++;
        weightedX += x;
        bins[Math.min(3, Math.floor(r / 64))] += 1;
        bins[4 + Math.min(3, Math.floor(g / 64))] += 1;
        bins[8 + Math.min(3, Math.floor(b / 64))] += 1;
      }
    }
  }

  const presenceScore = totalPixels > 0 ? skinPixels / totalPixels : 0;
  const centerXRatio = skinPixels > 0 ? weightedX / skinPixels / w : 0.5;
  const norm = Math.max(1, skinPixels);
  return {
    signature: bins.map((v) => Number((v / norm).toFixed(4))),
    presenceScore,
    centerXRatio,
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export const CameraPresence: React.FC<CameraPresenceProps> = ({
  ownerName,
  cooldownMinutes,
  faceEnrolledAt,
  onFaceEnrolled,
  onArrival,
  lastGreeting,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastGreetedAtRef = useRef<number>(0);
  const wasPresentRef = useRef<boolean>(false);
  const savedSigRef = useRef<number[] | null>(storage.loadFaceSignature());

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [present, setPresent] = useState(false);
  const [recognized, setRecognized] = useState(false);
  const [trackPos, setTrackPos] = useState<TrackPosition>("খোঁজা হচ্ছে");
  const [boxCoords, setBoxCoords] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null
  );

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
    setPresent(false);
    setRecognized(false);
    setTrackPos("খোঁজা হচ্ছে");
    setBoxCoords(null);
    wasPresentRef.current = false;
  };

  const startCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("এই ব্রাউজারে ক্যামেরা সাপোর্ট নেই বা HTTPS চালু নেই।");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 320, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch {
      setCameraError(
        "ক্যামেরা পারমিশন পাওয়া যায়নি। ব্রাউজারে Camera Allow করুন এবং HTTPS ডোমেইনে ওপেন করুন।"
      );
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraOn) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NativeFaceDetector = (window as any).FaceDetector;
    const detector = NativeFaceDetector ? new NativeFaceDetector({ fastMode: true, maxDetectedFaces: 1 }) : null;

    const timer = window.setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const w = 160;
      const h = 120;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);

      let detected = false;
      let centerXRatio = 0.5;
      let nextBox: { x: number; y: number; w: number; h: number } | null = null;

      if (detector) {
        try {
          const faces = await detector.detect(video);
          if (faces.length > 0) {
            const bb = faces[0].boundingBox;
            detected = true;
            centerXRatio = (bb.x + bb.width / 2) / (video.videoWidth || 480);
            nextBox = {
              x: (bb.x / (video.videoWidth || 480)) * 100,
              y: (bb.y / (video.videoHeight || 320)) * 100,
              w: (bb.width / (video.videoWidth || 480)) * 100,
              h: (bb.height / (video.videoHeight || 320)) * 100,
            };
          }
        } catch {
          // Fall back to pixel analyzer below
        }
      }

      const { signature, presenceScore, centerXRatio: skinX } = computeSignature(ctx, w, h);
      if (!detected && presenceScore > 0.065) {
        detected = true;
        centerXRatio = skinX;
        nextBox = {
          x: Math.max(10, Math.min(62, skinX * 100 - 15)),
          y: 18,
          w: 30,
          h: 52,
        };
      }

      setPresent(detected);
      setBoxCoords(nextBox);

      if (detected) {
        // Mirrored webcam: right in pixel coords feels like left to user
        const pos: TrackPosition =
          centerXRatio < 0.38 ? "ডানে" : centerXRatio > 0.62 ? "বামে" : "মাঝে";
        setTrackPos(pos);

        const enrolled = savedSigRef.current;
        const sim = enrolled ? cosineSimilarity(signature, enrolled) : 1;
        const isMatch = sim >= 0.82;
        setRecognized(Boolean(enrolled && isMatch));

        const now = Date.now();
        const cooldownMs = Math.max(1, cooldownMinutes) * 60 * 1000;
        if (!wasPresentRef.current && now - lastGreetedAtRef.current >= cooldownMs && isMatch) {
          lastGreetedAtRef.current = now;
          onArrival(pos);
        }
        wasPresentRef.current = true;
      } else {
        setTrackPos("খোঁজা হচ্ছে");
        setRecognized(false);
        wasPresentRef.current = false;
      }
    }, 900);

    return () => window.clearInterval(timer);
  }, [cameraOn, cooldownMinutes, onArrival]);

  const handleEnrollFace = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraOn) {
      setCameraError("চেহারা সেভ করতে আগে ক্যামেরা চালু করুন।");
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = 160;
    canvas.height = 120;
    ctx.drawImage(video, 0, 0, 160, 120);
    const { signature } = computeSignature(ctx, 160, 120);
    storage.saveFaceSignature(signature);
    savedSigRef.current = signature;
    onFaceEnrolled(new Date().toISOString());
    setRecognized(true);
  };

  return (
    <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
            <ScanFace className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">ক্যামেরা ফলো ও অটো-সালাম</h2>
            <p className="text-xs text-slate-400">অন-ডিভাইস ভিশন (ভিডিও কখনো সার্ভারে যায় না)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onArrival("মাঝে")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 cursor-pointer transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            আগমন সালাম টেস্ট
          </button>
          <button
            type="button"
            onClick={cameraOn ? stopCamera : startCamera}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition ${
              cameraOn
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            }`}
          >
            {cameraOn ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
            {cameraOn ? "ক্যামেরা বন্ধ" : "ক্যামেরা চালু করুন"}
          </button>
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="relative overflow-hidden rounded-xl bg-slate-950 border border-slate-800 aspect-[16/9] max-h-60 flex items-center justify-center">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`w-full h-full object-cover scale-x-[-1] ${cameraOn ? "block" : "hidden"}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!cameraOn && (
          <div className="text-center px-6 space-y-2">
            <Camera className="w-9 h-9 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">
              ক্যামেরা চালু করলে আপনি ডেস্কের সামনে আসলেই অ্যাসিস্ট্যান্ট আপনাকে চিনে বাংলায়
              <span className="text-emerald-400 font-medium"> "আসসালামু আলাইকুম" </span>
              বলে আজকের কাজের ব্রিফ শোনাবে।
            </p>
          </div>
        )}

        {/* Live Tracking Overlay */}
        {cameraOn && boxCoords && (
          <div
            className="absolute border-2 border-emerald-400 rounded-xl pointer-events-none transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
            style={{
              left: `${100 - boxCoords.x - boxCoords.w}%`,
              top: `${boxCoords.y}%`,
              width: `${boxCoords.w}%`,
              height: `${boxCoords.h}%`,
            }}
          >
            <span className="absolute -top-6 left-0 px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-500 text-slate-950 whitespace-nowrap">
              {recognized ? `${ownerName} (শনাক্ত)` : "উপস্থিতি শনাক্ত"}
            </span>
          </div>
        )}

        {cameraOn && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs">
            <span
              className={`px-2 py-1 rounded-md backdrop-blur-md font-medium ${
                present
                  ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/30"
                  : "bg-slate-900/75 text-slate-300 border border-slate-700"
              }`}
            >
              {present ? "● আপনি সামনে আছেন" : "○ উপস্থিতির অপেক্ষায়"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/75 text-sky-300 border border-slate-700 backdrop-blur-md">
              <Compass className="w-3.5 h-3.5" />
              ফলো দিক: {trackPos}
            </span>
          </div>
        )}
      </div>

      {cameraError && (
        <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {cameraError}
        </div>
      )}

      {/* Face Enrollment + Latest Greeting */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={handleEnrollFace}
          disabled={!cameraOn}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-45 border border-slate-700 cursor-pointer"
        >
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          {faceEnrolledAt ? "আমার চেহারা আপডেট করুন" : "আমার চেহারা চেনান (Local)"}
        </button>
        <span className="text-xs text-slate-400">
          কুলডাউন: {cooldownMinutes} মিনিট পর পুনরায় সালাম
        </span>
      </div>

      {lastGreeting && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-100 leading-relaxed">
          <span className="font-semibold text-emerald-400 block mb-0.5">সর্বশেষ সালাম ও ব্রিফিং:</span>
          {lastGreeting}
        </div>
      )}
    </div>
  );
};
