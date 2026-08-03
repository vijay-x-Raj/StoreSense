"""
Sales API routes.
"""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.db.database import get_db
from app.schemas.schemas import SalesSummary
from app.services.sales_service import parse_sales_csv, upsert_sales, get_sales_summary

router = APIRouter()


@router.post("/upload")
async def upload_sales(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload sales CSV and persist records."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only .csv files are accepted")
    content = await file.read()
    try:
        df = parse_sales_csv(content)
        count = upsert_sales(df, db)
        return {"message": f"Successfully imported {count} sales records"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/summary", response_model=SalesSummary)
def get_summary(
    target_date: Optional[date] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Get sales analytics summary, optionally filtered by date."""
    data = get_sales_summary(db, target_date)
    return SalesSummary(**data)
