"""
Audio / Transcript API routes.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import Transcript, ProductRequest, VideoSession
from app.schemas.schemas import TranscriptOut, ProductRequestOut

router = APIRouter()


# ---------------------------------------------------------------------------
# Live-segment input schema
# ---------------------------------------------------------------------------

class LiveSegmentIn(BaseModel):
    text: str
    start_time: float
    end_time: float
    speaker: Optional[str] = "Customer"
    language: Optional[str] = "unknown"
    confidence: Optional[float] = 0.9


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/transcript/{session_id}")
def get_transcript(
    session_id: int,
    search: Optional[str] = Query(None, description="Search text in transcript"),
    db: Session = Depends(get_db),
):
    """Get full timestamped transcript for a session. Returns [] when none recorded yet."""
    q = db.query(Transcript).filter(Transcript.session_id == session_id)
    if search:
        q = q.filter(Transcript.text.ilike(f"%{search}%"))
    lines = q.order_by(Transcript.start_time).all()
    return [TranscriptOut.model_validate(t) for t in lines]


@router.get("/products/{session_id}")
def get_product_requests(session_id: int, db: Session = Depends(get_db)):
    """Get all product requests extracted from transcript. Returns [] when none detected yet."""
    products = (
        db.query(ProductRequest)
        .filter(ProductRequest.session_id == session_id)
        .order_by(ProductRequest.id)
        .all()
    )
    return [ProductRequestOut.model_validate(p) for p in products]


@router.post("/live-segment/{session_id}", status_code=201)
def post_live_segment(
    session_id: int,
    body: LiveSegmentIn,
    db: Session = Depends(get_db),
):
    """
    Persist a single speech-recognition segment captured by the browser.
    Extracts products, creates sale records, and updates inventory in real-time.
    """
    session = db.query(VideoSession).filter(VideoSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")

    t = Transcript(
        session_id=session_id,
        start_time=body.start_time,
        end_time=body.end_time,
        speaker=body.speaker or "Customer",
        text=body.text.strip(),
        language=body.language or "unknown",
        confidence=body.confidence,
    )
    db.add(t)
    db.commit()
    db.refresh(t)

    # Real-time Extraction and Sales Recording
    from app.services.audio_service import extract_products_from_transcript
    from app.models.models import SaleRecord, InventoryItem
    from datetime import datetime
    
    try:
        extracted = extract_products_from_transcript(
            session_id=session_id,
            segments=[{
                "text": body.text.strip(),
                "language": body.language,
                "confidence": body.confidence,
            }],
            db=db
        )
        
        for item in extracted:
            # Try to find price in inventory
            inv = db.query(InventoryItem).filter(
                InventoryItem.product_name.ilike(f"%{item['product_name']}%")
            ).first()
            
            price = inv.price if inv else 20.0  # fallback price
            quantity = item["quantity"]
            
            # Record sale
            sale = SaleRecord(
                timestamp=datetime.now(),
                product_name=item["product_name"],
                quantity=quantity,
                price=price,
                total=quantity * price,
                customer_id=f"live_{session_id}"
            )
            db.add(sale)
            
            # Deduct stock
            if inv:
                inv.current_stock = max(0, inv.current_stock - quantity)
                
        db.commit()
    except Exception as e:
        db.rollback()
        # Log error in production
        pass

    return TranscriptOut.model_validate(t)


@router.get("/live-transcript/{session_id}")
def get_live_transcript(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Get all transcript lines for a live session (real-time polling endpoint)."""
    lines = (
        db.query(Transcript)
        .filter(Transcript.session_id == session_id)
        .order_by(Transcript.start_time)
        .all()
    )
    return [TranscriptOut.model_validate(t) for t in lines]
