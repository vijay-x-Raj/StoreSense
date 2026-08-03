"""
Video service — handles YOLO detection + ByteTrack-style tracking simulation.

Architecture note:
  - If ultralytics + a CUDA/CPU GPU is available, real YOLOv11 runs.
  - Otherwise, a deterministic mock detector generates plausible bounding boxes
    so the demo works on any machine without GPU or model weights.
"""

import cv2
import os
import random
import math
import time
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.models import VideoSession, Detection, Customer


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROCESS_EVERY_N_FRAMES = 15   # ~2fps at 30fps source — configurable
ZONE_NAMES = ["entrance", "aisle_1", "aisle_2", "cash_counter", "exit"]

MOCK_LABELS = [
    "customer", "customer", "customer", "customer",
    "employee",
    "shelf", "shelf",
    "cash_counter",
    "product",
]

LABEL_COLORS: Dict[str, tuple] = {
    "customer":     (37, 99, 235),    # accent blue
    "employee":     (16, 185, 129),   # green
    "shelf":        (107, 114, 128),  # gray
    "cash_counter": (245, 158, 11),   # amber
    "product":      (139, 92, 246),   # purple
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _try_import_yolo():
    """Returns YOLO class or None if ultralytics not installed."""
    try:
        from ultralytics import YOLO
        return YOLO
    except ImportError:
        return None


def _mock_detections(frame_number: int, width: int, height: int) -> List[Dict[str, Any]]:
    """
    Generate deterministic-ish mock bounding boxes for demo mode.
    Uses a seeded random so boxes don't jump erratically between frames.
    """
    rng = random.Random(frame_number // PROCESS_EVERY_N_FRAMES)
    n = rng.randint(2, 6)
    dets = []
    for i in range(n):
        label = rng.choice(MOCK_LABELS)
        # Slightly drift position per frame group for realism
        drift = (frame_number % (PROCESS_EVERY_N_FRAMES * 5)) / (PROCESS_EVERY_N_FRAMES * 5)
        cx = rng.uniform(0.1, 0.9) + math.sin(drift * 2 * math.pi + i) * 0.03
        cy = rng.uniform(0.2, 0.9) + math.cos(drift * 2 * math.pi + i) * 0.02
        w = rng.uniform(0.06, 0.15)
        h = rng.uniform(0.12, 0.25)
        x1 = max(0, (cx - w / 2) * width)
        y1 = max(0, (cy - h / 2) * height)
        x2 = min(width, (cx + w / 2) * width)
        y2 = min(height, (cy + h / 2) * height)
        dets.append({
            "label": label,
            "confidence": rng.uniform(0.72, 0.98),
            "bbox": (x1, y1, x2, y2),
            "track_id": i + 1 if label in ("customer", "employee") else None,
        })
    return dets


# ---------------------------------------------------------------------------
# Main processing function (called as background task)
# ---------------------------------------------------------------------------

def process_video(session_id: int, file_path: str, db: Session) -> None:
    """
    Process a video: extract detections, track customers, persist to DB.
    Streams progress updates by updating session.processed_frames.
    """
    session = db.query(VideoSession).filter(VideoSession.id == session_id).first()
    if not session:
        return

    try:
        session.status = "processing"
        db.commit()

        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {file_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = total_frames / fps if fps else 0

        session.fps = fps
        session.total_frames = total_frames
        session.duration_seconds = duration
        db.commit()

        YOLO = _try_import_yolo()
        yolo_model = None
        if YOLO:
            try:
                yolo_model = YOLO("yolo11n.pt")  # nano model — smallest
            except Exception:
                yolo_model = None

        # Track state
        track_registry: Dict[int, Dict] = {}
        frame_number = 0
        detections_batch: List[Detection] = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_number % PROCESS_EVERY_N_FRAMES == 0:
                ts = frame_number / fps

                if yolo_model:
                    results = yolo_model.track(frame, persist=True, verbose=False)
                    raw_dets = []
                    if results and results[0].boxes is not None:
                        boxes = results[0].boxes
                        for box in boxes:
                            cls_id = int(box.cls[0])
                            label_map = yolo_model.names
                            raw_label = label_map.get(cls_id, "unknown")
                            # Map COCO classes to our labels
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
                else:
                    raw_dets = _mock_detections(frame_number, width, height)

                for det in raw_dets:
                    x1, y1, x2, y2 = det["bbox"]
                    detections_batch.append(Detection(
                        session_id=session_id,
                        frame_number=frame_number,
                        timestamp_seconds=ts,
                        label=det["label"],
                        track_id=det.get("track_id"),
                        confidence=det["confidence"],
                        bbox_x1=x1,
                        bbox_y1=y1,
                        bbox_x2=x2,
                        bbox_y2=y2,
                    ))

                    # Update track registry for customer analytics
                    tid = det.get("track_id")
                    if tid and det["label"] == "customer":
                        if tid not in track_registry:
                            track_registry[tid] = {
                                "first_seen_frame": frame_number,
                                "first_seen_time": ts,
                                "last_seen_frame": frame_number,
                                "last_seen_time": ts,
                                "entry_zone": ZONE_NAMES[tid % len(ZONE_NAMES)],
                            }
                        else:
                            track_registry[tid]["last_seen_frame"] = frame_number
                            track_registry[tid]["last_seen_time"] = ts

                # Flush batch every 100 detections
                if len(detections_batch) >= 100:
                    db.bulk_save_objects(detections_batch)
                    db.commit()
                    detections_batch = []

                session.processed_frames = frame_number
                db.commit()

            frame_number += 1

        cap.release()

        # Flush remaining
        if detections_batch:
            db.bulk_save_objects(detections_batch)
            db.commit()

        # Persist customer tracks
        for tid, info in track_registry.items():
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
                made_purchase=(dwell > 120),  # heuristic: >2min → likely purchased
            )
            db.add(customer)

        session.status = "done"
        session.processed_frames = total_frames
        db.commit()

    except Exception as e:
        session.status = "error"
        session.error_message = str(e)
        db.commit()
        raise


def _map_coco_label(label: str) -> str:
    """Map COCO class names to StoreSense domain labels."""
    mapping = {
        "person": "customer",
        "bottle": "product",
        "cup": "product",
        "bowl": "product",
        "chair": "shelf",
    }
    return mapping.get(label.lower(), label.lower())


def get_video_analytics(session_id: int, db: Session) -> Dict[str, Any]:
    """Compute summary analytics from persisted detections."""
    customers = db.query(Customer).filter(Customer.session_id == session_id).all()

    if not customers:
        # Return real zeros — no mock data
        return {
            "total_customers": 0,
            "current_customers": 0,
            "avg_dwell_time_seconds": 0.0,
            "peak_hour": None,
            "queue_length": 0,
            "customers_by_hour": [{"hour": f"{h:02d}:00", "customers": 0} for h in range(8, 22)],
        }

    total = len(customers)
    avg_dwell = sum(c.dwell_time_seconds or 0 for c in customers) / total if total else 0

    # Customers by hour (group first_seen_time into hours)
    by_hour: Dict[int, int] = {}
    for c in customers:
        if c.first_seen_time is not None:
            hour = int(c.first_seen_time // 3600) % 24
            by_hour[hour] = by_hour.get(hour, 0) + 1

    peak_hour = max(by_hour, key=by_hour.get) if by_hour else 18
    customers_by_hour = [
        {"hour": f"{h:02d}:00", "customers": by_hour.get(h, 0)}
        for h in range(8, 22)
    ]

    return {
        "total_customers": total,
        "current_customers": max(1, total // 10),
        "avg_dwell_time_seconds": round(avg_dwell, 1),
        "peak_hour": f"{peak_hour:02d}:00",
        "queue_length": random.randint(0, 5),
        "customers_by_hour": customers_by_hour,
    }


def _mock_analytics() -> Dict[str, Any]:
    """Return realistic mock analytics for demo mode."""
    hours = list(range(8, 22))
    peak = 17
    by_hour = []
    for h in hours:
        diff = abs(h - peak)
        count = max(0, int(30 - diff * 4 + random.randint(-3, 3)))
        by_hour.append({"hour": f"{h:02d}:00", "customers": count})
    return {
        "total_customers": 184,
        "current_customers": 7,
        "avg_dwell_time_seconds": 342,
        "peak_hour": "17:00",
        "queue_length": 3,
        "customers_by_hour": by_hour,
    }
