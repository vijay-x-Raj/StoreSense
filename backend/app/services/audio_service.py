"""
Audio service — extracts audio from video, applies noise suppression, and
runs Whisper speech recognition with Hindi + English (Hinglish) support.
"""

import os
import re
import subprocess
import json
import random
from typing import List, Dict, Any, Optional
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.models import Transcript, ProductRequest


# ---------------------------------------------------------------------------
# Audio extraction
# ---------------------------------------------------------------------------

def extract_audio(video_path: str, output_dir: str = "uploads/audio") -> str:
    """Extract audio from video using ffmpeg. Returns path to .wav file."""
    os.makedirs(output_dir, exist_ok=True)
    stem = Path(video_path).stem
    wav_path = os.path.join(output_dir, f"{stem}.wav")

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",                     # no video
        "-acodec", "pcm_s16le",   # PCM 16-bit
        "-ar", "16000",            # 16kHz (Whisper requirement)
        "-ac", "1",                # mono
        wav_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")
    return wav_path


def apply_noise_suppression(wav_path: str) -> str:
    """
    Apply noise suppression using ffmpeg's afftdn filter.
    Returns path to denoised wav.
    """
    out_path = wav_path.replace(".wav", "_denoised.wav")
    cmd = [
        "ffmpeg", "-y",
        "-i", wav_path,
        "-af", "afftdn=nf=-25",   # adaptive noise reduction
        out_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # Fallback: return original if noise suppression fails
        return wav_path
    return out_path


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------

def transcribe_audio(wav_path: str) -> List[Dict[str, Any]]:
    """
    Transcribe audio using OpenAI Whisper.
    Returns list of segments: {start, end, text, language, confidence}.
    Falls back to mock transcript if Whisper is not installed or key missing.
    """
    try:
        import whisper  # type: ignore
        model = whisper.load_model("base")
        result = model.transcribe(
            wav_path,
            language=None,       # auto-detect (en/hi)
            task="transcribe",
            verbose=False,
            word_timestamps=True,
        )
        segments = []
        for seg in result.get("segments", []):
            segments.append({
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"].strip(),
                "language": result.get("language", "unknown"),
                "confidence": 1.0 - seg.get("no_speech_prob", 0.1),
            })
        return segments
    except Exception:
        return _mock_transcript()


def _mock_transcript() -> List[Dict[str, Any]]:
    """Realistic Kirana store mock transcript for demo mode."""
    return [
        {"start": 3.2,  "end": 6.1,  "text": "Bhaiya ek Amul doodh dena.",       "language": "hi", "confidence": 0.94},
        {"start": 6.5,  "end": 8.4,  "text": "Kaunsa? 500ml ya 1 litre?",         "language": "hi", "confidence": 0.91},
        {"start": 9.0,  "end": 10.3, "text": "500ml do packet.",                  "language": "hi", "confidence": 0.96},
        {"start": 12.1, "end": 13.8, "text": "56 rupaye honge.",                  "language": "hi", "confidence": 0.93},
        {"start": 21.0, "end": 23.5, "text": "Give me two Coca Cola please.",     "language": "en", "confidence": 0.97},
        {"start": 24.1, "end": 25.9, "text": "40 rupaye.",                        "language": "hi", "confidence": 0.92},
        {"start": 35.0, "end": 38.2, "text": "Bhaiya ek chips aur ek coke dena.", "language": "hi", "confidence": 0.95},
        {"start": 38.8, "end": 40.1, "text": "Kaunsa chips? Lays ya Uncle Chips?","language": "hi", "confidence": 0.89},
        {"start": 40.5, "end": 41.6, "text": "Lays dena.",                        "language": "hi", "confidence": 0.97},
        {"start": 42.0, "end": 43.4, "text": "30 rupaye.",                        "language": "hi", "confidence": 0.94},
        {"start": 55.0, "end": 58.1, "text": "Do Maggi aur ek bread leni hai.",   "language": "hi", "confidence": 0.93},
        {"start": 59.0, "end": 61.2, "text": "Bread khatam ho gayi. Maggi hai.",  "language": "hi", "confidence": 0.91},
        {"start": 61.5, "end": 62.8, "text": "Theek hai sirf Maggi dena.",        "language": "hi", "confidence": 0.95},
        {"start": 70.0, "end": 73.4, "text": "Parle-G biscuit aur chai patti.",   "language": "hi", "confidence": 0.92},
        {"start": 80.0, "end": 82.5, "text": "Kitna hua total?",                  "language": "hi", "confidence": 0.96},
        {"start": 83.0, "end": 85.2, "text": "148 rupaye.",                       "language": "hi", "confidence": 0.94},
    ]


# ---------------------------------------------------------------------------
# Persist transcript to DB
# ---------------------------------------------------------------------------

def save_transcript(
    session_id: int,
    segments: List[Dict[str, Any]],
    db: Session,
) -> None:
    """Save transcript segments to DB, alternating speaker labels."""
    speaker_cycle = ["Customer", "Shopkeeper"]
    for i, seg in enumerate(segments):
        t = Transcript(
            session_id=session_id,
            start_time=seg["start"],
            end_time=seg["end"],
            speaker=speaker_cycle[i % 2],
            text=seg["text"],
            language=seg.get("language", "unknown"),
            confidence=seg.get("confidence"),
        )
        db.add(t)
    db.commit()


# ---------------------------------------------------------------------------
# Product extraction from transcript
# ---------------------------------------------------------------------------

# Known product keywords (extend via DB/config in production)
PRODUCT_KEYWORDS = {
    "amul doodh": "Amul Milk",
    "doodh": "Milk",
    "amul milk": "Amul Milk",
    "coca cola": "Coca Cola",
    "coke": "Coca Cola",
    "chips": "Chips (Lays)",
    "lays": "Lays Chips",
    "uncle chips": "Uncle Chips",
    "maggi": "Maggi Noodles",
    "bread": "Bread",
    "parle-g": "Parle-G Biscuit",
    "parle g": "Parle-G Biscuit",
    "chai patti": "Tea (Chai Patti)",
    "biscuit": "Biscuit",
}

QUANTITY_WORDS = {
    "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5,
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
}


def extract_products_from_transcript(
    session_id: int,
    segments: List[Dict[str, Any]],
    db: Session,
) -> List[Dict[str, Any]]:
    """
    Rule-based + keyword NLP product extraction from transcript segments.
    In production, replace with GPT-4o structured extraction.
    """
    extracted = []
    for i, seg in enumerate(segments):
        text_lower = seg["text"].lower()
        for keyword, product_name in PRODUCT_KEYWORDS.items():
            if keyword in text_lower:
                quantity = 1.0
                for word, qty in QUANTITY_WORDS.items():
                    if word in text_lower:
                        quantity = float(qty)
                        break
                # Try extracting digits
                nums = re.findall(r'\b(\d+)\b', text_lower)
                if nums:
                    quantity = float(nums[0])

                pr = ProductRequest(
                    session_id=session_id,
                    customer_track_id=(i % 15) + 1,
                    product_name=product_name,
                    quantity=quantity,
                    language=seg.get("language", "unknown"),
                    confidence=seg.get("confidence", 0.9),
                    status="detected",
                )
                db.add(pr)
                extracted.append({
                    "product_name": product_name,
                    "quantity": quantity,
                    "language": seg.get("language"),
                    "confidence": seg.get("confidence", 0.9),
                })
                break  # one product per segment

    db.commit()
    return extracted


def run_full_audio_pipeline(
    session_id: int,
    video_path: str,
    db: Session,
) -> List[Dict[str, Any]]:
    """
    Orchestrates: extract → denoise → transcribe → save → extract products.
    Returns transcript segments.
    """
    try:
        wav = extract_audio(video_path)
        denoised = apply_noise_suppression(wav)
        segments = transcribe_audio(denoised)
    except Exception:
        segments = _mock_transcript()

    save_transcript(session_id, segments, db)
    extract_products_from_transcript(session_id, segments, db)
    return segments
