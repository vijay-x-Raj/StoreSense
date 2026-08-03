"""
AI API routes — query and daily summary.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.schemas import AIQueryRequest, AIQueryResponse, AIDailySummary
from app.services.ai_service import query_ai, generate_daily_summary
from datetime import datetime

router = APIRouter()


@router.post("/query", response_model=AIQueryResponse)
def ai_query(body: AIQueryRequest, db: Session = Depends(get_db)):
    """Answer a business question using multimodal context."""
    try:
        result = query_ai(body.query, body.session_id, db)
        return AIQueryResponse(**result)
    except Exception as e:
        raise HTTPException(500, f"AI query failed: {str(e)}")


@router.get("/summary")
def daily_summary(session_id: int = None, db: Session = Depends(get_db)):
    """Generate or retrieve today's AI business summary."""
    result = generate_daily_summary(session_id, db)
    return {
        **result,
        "generated_at": datetime.utcnow().isoformat(),
    }
