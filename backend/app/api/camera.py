"""
Camera API routes — live webcam/CCTV feed endpoints.

POST /api/camera/start                  → create a LiveSession, return session_id
POST /api/camera/frame/{session_id}     → submit JPEG frame, get back detections
GET  /api/camera/analytics/{session_id} → real-time analytics for the live session
POST /api/camera/stop/{session_id}      → end session, flush customer data to DB
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.models.models import VideoSession
from app.schemas.schemas import DetectionOut
from app.services import camera_service
from app.services.video_service import get_video_analytics

router = APIRouter()


@router.post("/start")
def start_camera_session(db: Session = Depends(get_db)):
    """Create a new LiveSession record and initialise in-memory tracking state."""
    session = VideoSession(
        filename="live_camera",
        original_filename="Live Camera Feed",
        file_path="",
        status="processing",
        fps=2.0,           # ~2 fps processing cadence
        total_frames=0,
        processed_frames=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    camera_service.start_session(session.id)

    return {"session_id": session.id, "status": "live"}


@router.post("/frame/{session_id}")
async def submit_frame(
    session_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Accept a JPEG frame blob from the browser.
    Run detection and return bounding boxes immediately.
    """
    session = db.query(VideoSession).filter(VideoSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    if session.status not in ("processing", "live"):
        raise HTTPException(400, "Session is not active")

    frame_bytes = await file.read()
    detections = camera_service.process_frame(session_id, frame_bytes, db)

    # Update processed_frames counter on session row
    session.processed_frames = (session.processed_frames or 0) + 1
    db.commit()

    return {"detections": detections}


@router.get("/analytics/{session_id}")
def get_camera_analytics(session_id: int, db: Session = Depends(get_db)):
    """
    Return real-time analytics.
    Uses in-memory registry when session is live; falls back to DB query when done.
    """
    session = db.query(VideoSession).filter(VideoSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")

    if session.status in ("processing", "live"):
        return camera_service.get_live_analytics(session_id)
    else:
        # Session ended — use the standard video analytics query
        return get_video_analytics(session_id, db)


@router.post("/stop/{session_id}")
def stop_camera_session(session_id: int, db: Session = Depends(get_db)):
    """Stop a live session, flush customer tracks to DB."""
    session = db.query(VideoSession).filter(VideoSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")

    camera_service.stop_session(session_id, db)
    db.refresh(session)

    return {"session_id": session_id, "status": session.status}
