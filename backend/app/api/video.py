"""
Video API routes — upload, processing status, analytics, SSE stream.
"""

import os
import uuid
import asyncio
from typing import Optional
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import VideoSession
from app.schemas.schemas import VideoSessionOut, VideoAnalyticsSummary, DetectionOut
from app.services.video_service import process_video, get_video_analytics
from app.services.audio_service import run_full_audio_pipeline

router = APIRouter()

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}
UPLOAD_DIR = "uploads/videos"


@router.post("/upload", response_model=VideoSessionOut)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a video file and start background processing."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported format. Allowed: {ALLOWED_EXTENSIONS}")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    session = VideoSession(
        filename=unique_name,
        original_filename=file.filename or unique_name,
        file_path=file_path,
        status="uploaded",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Start processing in background
    background_tasks.add_task(_run_full_pipeline, session.id, file_path)

    return session


def _run_full_pipeline(session_id: int, file_path: str):
    """Run video + audio pipeline in a separate DB session."""
    from app.db.database import SessionLocal
    db = SessionLocal()
    try:
        process_video(session_id, file_path, db)
        run_full_audio_pipeline(session_id, file_path, db)
    except Exception:
        pass
    finally:
        db.close()


@router.get("/status/{session_id}", response_model=VideoSessionOut)
def get_status(session_id: int, db: Session = Depends(get_db)):
    """Poll processing status of a video session."""
    session = db.query(VideoSession).filter(VideoSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.get("/analytics/{session_id}", response_model=VideoAnalyticsSummary)
def get_analytics(session_id: int, db: Session = Depends(get_db)):
    """Get computed video analytics for a session."""
    data = get_video_analytics(session_id, db)
    return VideoAnalyticsSummary(**data)


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    """List all video sessions."""
    sessions = db.query(VideoSession).order_by(VideoSession.created_at.desc()).limit(20).all()
    return [VideoSessionOut.model_validate(s) for s in sessions]


@router.get("/detections/{session_id}")
def get_detections(
    session_id: int,
    frame: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get bounding box detections for a specific frame or all frames."""
    from app.models.models import Detection
    q = db.query(Detection).filter(Detection.session_id == session_id)
    if frame is not None:
        q = q.filter(Detection.frame_number == frame)
    detections = q.order_by(Detection.frame_number).limit(500).all()
    return [DetectionOut.model_validate(d) for d in detections]


@router.get("/stream/{session_id}")
async def stream_progress(session_id: int, db: Session = Depends(get_db)):
    """Server-Sent Events stream for real-time processing progress."""
    async def event_generator():
        from app.db.database import SessionLocal
        for _ in range(60):  # max 60 seconds
            local_db = SessionLocal()
            try:
                session = local_db.query(VideoSession).filter(
                    VideoSession.id == session_id
                ).first()
                if session:
                    total = session.total_frames or 1
                    progress = min(100, int((session.processed_frames / total) * 100))
                    data = {
                        "status": session.status,
                        "progress": progress,
                        "processed_frames": session.processed_frames,
                        "total_frames": total,
                    }
                    import json
                    yield f"data: {json.dumps(data)}\n\n"
                    if session.status in ("done", "error"):
                        break
            finally:
                local_db.close()
            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
