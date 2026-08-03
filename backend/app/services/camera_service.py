"""
Camera service — processes individual JPEG frames from a live webcam/CCTV feed.

Architecture:
  - Accepts raw JPEG bytes (captured by the browser every ~500 ms).
  - Runs YOLO (if available) or the deterministic mock detector.
  - Maintains per-session track registry in memory so dwell-time analytics
    accumulate across frames without a video file on disk.
  - Persists Detection rows to the DB so the existing analytics queries work.
"""

import cv2
import numpy as np
import math
import random
import time
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.models import Detection, Customer, VideoSession
from app.services.video_service import _try_import_yolo, _map_coco_label, MOCK_LABELS, ZONE_NAMES

# In-memory track registry: session_id → { track_id → {...} }
_track_registries: Dict[int, Dict[int, Dict]] = {}
# Frame counter per session
_frame_counters: Dict[int, int] = {}
# Wall-clock start time per session (for dwell calculation)
_session_starts: Dict[int, float] = {}

YOLO = _try_import_yolo()
_yolo_model = None


def _get_yolo():
    """Lazy-load YOLO model once."""
    global _yolo_model
    if YOLO and _yolo_model is None:
        try:
            _yolo_model = YOLO("yolo11n.pt")
        except Exception:
            _yolo_model = None
    return _yolo_model


def _mock_frame_detections(frame_number: int, width: int, height: int) -> List[Dict[str, Any]]:
    """
    Deterministic mock detections for a single frame (reused from video_service pattern).
    Uses the same seed strategy so boxes drift smoothly.
    """
    rng = random.Random(frame_number // 3)
    n = rng.randint(2, 5)
    dets = []
    for i in range(n):
        label = rng.choice(MOCK_LABELS)
        drift = (frame_number % 15) / 15.0
        cx = rng.uniform(0.1, 0.9) + math.sin(drift * 2 * math.pi + i) * 0.03
        cy = rng.uniform(0.2, 0.9) + math.cos(drift * 2 * math.pi + i) * 0.02
        w = rng.uniform(0.06, 0.15)
        h = rng.uniform(0.12, 0.25)
        x1 = max(0.0, (cx - w / 2) * width)
        y1 = max(0.0, (cy - h / 2) * height)
        x2 = min(float(width), (cx + w / 2) * width)
        y2 = min(float(height), (cy + h / 2) * height)
        dets.append({
            "label": label,
            "confidence": rng.uniform(0.72, 0.98),
            "bbox": (x1, y1, x2, y2),
            "track_id": i + 1 if label in ("customer", "employee") else None,
        })
    return dets


def start_session(session_id: int) -> None:
    """Initialise in-memory state for a new live session."""
    _track_registries[session_id] = {}
    _frame_counters[session_id] = 0
    _session_starts[session_id] = time.time()


def stop_session(session_id: int, db: Session) -> None:
    """Flush final customer rows to DB and clean up memory."""
    registry = _track_registries.pop(session_id, {})
    _frame_counters.pop(session_id, None)
    _session_starts.pop(session_id, None)

    for tid, info in registry.items():
        dwell = info["last_seen_time"] - info["first_seen_time"]
        customer = Customer(
            session_id=session_id,
            track_id=tid,
            first_seen_frame=info["first_seen_frame"],
            last_seen_frame=info["last_seen_frame"],
            first_seen_time=info["first_seen_time"],
            last_seen_time=info["last_seen_time"],
            dwell_time_seconds=dwell,
            entry_zone=info.get("entry_zone"),
            exit_zone=ZONE_NAMES[(tid + 2) % len(ZONE_NAMES)],
            made_purchase=(dwell > 120),
        )
        db.add(customer)

    session = db.query(VideoSession).filter(VideoSession.id == session_id).first()
    if session:
        session.status = "done"
    db.commit()


def process_frame(
    session_id: int,
    frame_bytes: bytes,
    db: Session,
) -> List[Dict[str, Any]]:
    """
    Decode a JPEG frame, run detection, persist results, return detection list.

    Returns a list of dicts matching the DetectionOut schema so the API layer
    can return them directly without a DB round-trip.
    """
    # Decode JPEG → numpy array
    nparr = np.frombuffer(frame_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is None:
        return []

    height, width = frame.shape[:2]
    frame_number = _frame_counters.get(session_id, 0)
    ts = time.time() - _session_starts.get(session_id, time.time())

    yolo_model = _get_yolo()
    if yolo_model:
        try:
            results = yolo_model.track(frame, persist=True, verbose=False)
            raw_dets: List[Dict[str, Any]] = []
            if results and results[0].boxes is not None:
                boxes = results[0].boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    raw_label = yolo_model.names.get(cls_id, "unknown")
                    label = _map_coco_label(raw_label)
                    conf = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    tid = int(box.id[0]) if box.id is not None else None
                    raw_dets.append({
                        "label": label,
                        "confidence": conf,
                        "bbox": (x1, y1, x2, y2),
                        "track_id": tid,
                    })
        except Exception:
            raw_dets = _mock_frame_detections(frame_number, width, height)
    else:
        raw_dets = _mock_frame_detections(frame_number, width, height)

    # Persist detections + update track registry
    registry = _track_registries.setdefault(session_id, {})
    result_list: List[Dict[str, Any]] = []
    db_detections = []

    for i, det in enumerate(raw_dets):
        x1, y1, x2, y2 = det["bbox"]
        tid = det.get("track_id")

        db_detections.append(Detection(
            session_id=session_id,
            frame_number=frame_number,
            timestamp_seconds=ts,
            label=det["label"],
            track_id=tid,
            confidence=det["confidence"],
            bbox_x1=x1,
            bbox_y1=y1,
            bbox_x2=x2,
            bbox_y2=y2,
        ))

        # Update customer track registry
        if tid and det["label"] == "customer":
            if tid not in registry:
                registry[tid] = {
                    "first_seen_frame": frame_number,
                    "first_seen_time": ts,
                    "last_seen_frame": frame_number,
                    "last_seen_time": ts,
                    "entry_zone": ZONE_NAMES[tid % len(ZONE_NAMES)],
                }
            else:
                registry[tid]["last_seen_frame"] = frame_number
                registry[tid]["last_seen_time"] = ts

        result_list.append({
            "id": i,
            "frame_number": frame_number,
            "timestamp_seconds": ts,
            "label": det["label"],
            "track_id": tid,
            "confidence": det["confidence"],
            "bbox_x1": x1,
            "bbox_y1": y1,
            "bbox_x2": x2,
            "bbox_y2": y2,
        })

    if db_detections:
        db.bulk_save_objects(db_detections)
        db.commit()

    _frame_counters[session_id] = frame_number + 1
    return result_list


def get_live_analytics(session_id: int) -> Dict:
    """
    Return real-time analytics derived from in-memory track registry
    (no DB query needed during a live session).
    """
    registry = _track_registries.get(session_id, {})
    now_ts = time.time() - _session_starts.get(session_id, time.time())

    total = len(registry)
    # "Current" customers = those seen in last 10 s
    current = sum(
        1 for info in registry.values()
        if now_ts - info["last_seen_time"] < 10
    )
    avg_dwell = (
        sum(
            info["last_seen_time"] - info["first_seen_time"]
            for info in registry.values()
        ) / total
        if total else 0
    )

    return {
        "total_customers": total,
        "current_customers": current,
        "avg_dwell_time_seconds": round(avg_dwell, 1),
        "peak_hour": None,
        "queue_length": max(0, current - 2),
        "customers_by_hour": [],
    }
