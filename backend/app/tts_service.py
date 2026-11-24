from __future__ import annotations

import base64
import logging
from typing import Any

import edge_tts

from .config import settings

logger = logging.getLogger(__name__)

NEURAL_VOICES: list[dict[str, str]] = [
    {
        "id": "bn-BD-NabanitaNeural",
        "label": "নবনীতা (বাংলাদেশী ফিমেল — স্পষ্ট ও মিষ্টি, ফ্রি)",
        "gender": "female",
        "engine": "edge",
    },
    {
        "id": "bn-IN-TanishaaNeural",
        "label": "তানিশা (বাংলা ফিমেল — প্রমিত, ফ্রি)",
        "gender": "female",
        "engine": "edge",
    },
    {
        "id": "bn-BD-PradeepNeural",
        "label": "প্রদীপ (বাংলাদেশী মেল — স্পষ্ট, ফ্রি)",
        "gender": "male",
        "engine": "edge",
    },
    {
        "id": "gemini:Kore",
        "label": "Gemini 3.8 Kore (প্রিমিয়াম ফিমেল নিউরাল)",
        "gender": "female",
        "engine": "gemini",
    },
    {
        "id": "gemini:Aoede",
        "label": "Gemini 3.8 Aoede (প্রিমিয়াম সফট ফিমেল)",
        "gender": "female",
        "engine": "gemini",
    },
]

ALLOWED_EDGE_VOICES = {v["id"] for v in NEURAL_VOICES if v["engine"] == "edge"}


def _rate_to_edge_str(rate: float) -> str:
    pct = int(round((rate - 1.0) * 100))
    pct = max(-35, min(35, pct))
    return f"{pct:+d}%"


async def synthesize_speech(
    text: str,
    voice: str = "bn-BD-NabanitaNeural",
    rate: float = 1.0,
) -> tuple[bytes, str]:
    """Synthesizes crystal-clear Bengali neural speech. Returns (audio_bytes, media_type)."""
    clean_text = text.strip()[:1200]
    if not clean_text:
        raise ValueError("বলার জন্য কোনো লেখা নেই।")

    # Optional Gemini 3.8 Flash-Lite TTS if explicitly selected & key configured
    if voice.startswith("gemini:") and settings.gemini_api_key:
        gemini_voice = voice.split(":", 1)[1] or "Kore"
        try:
            from google import genai

            client = genai.Client(
                api_key=settings.gemini_api_key,
                http_options={"api_version": "v1beta"},
            )
            interaction = client.interactions.create(
                model="gemini-3.8-flash-lite-tts",
                input=[
                    {
                        "type": "user_input",
                        "content": [
                            {
                                "type": "text",
                                "text": clean_text,
                                "annotations": [
                                    {
                                        "type": "speech_metadata",
                                        "style": "warm, clear, natural polite Bengali personal assistant",
                                    }
                                ],
                            }
                        ],
                    }
                ],
                response_format={"type": "audio"},
                generation_config={"speech_config": [{"voice": gemini_voice}]},
            )
            if interaction.output_audio and interaction.output_audio.data:
                raw = base64.b64decode(interaction.output_audio.data)
                mime = interaction.output_audio.mime_type or "audio/wav"
                return raw, mime
        except Exception as exc:  # pragma: no cover
            logger.warning("Gemini TTS failed, falling back to NabanitaNeural: %s", exc)

    # Free & Unlimited Studio-Quality Bengali Neural Voice (Microsoft Edge Neural TTS)
    edge_voice = voice if voice in ALLOWED_EDGE_VOICES else "bn-BD-NabanitaNeural"
    comm = edge_tts.Communicate(
        clean_text,
        voice=edge_voice,
        rate=_rate_to_edge_str(rate),
    )
    chunks: list[bytes] = []
    async for chunk in comm.stream():
        if chunk.get("type") == "audio" and chunk.get("data"):
            chunks.append(chunk["data"])

    if not chunks:
        raise RuntimeError("TTS অডিও তৈরি করা যায়নি।")

    return b"".join(chunks), "audio/mpeg"


def list_voices() -> list[dict[str, Any]]:
    return NEURAL_VOICES
