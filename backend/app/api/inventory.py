"""
Inventory API routes.
"""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.schemas import InventorySummary
from app.services.inventory_service import (
    parse_inventory_csv,
    upsert_inventory,
    get_inventory_summary,
    get_inventory_alerts,
)

router = APIRouter()


@router.post("/upload")
async def upload_inventory(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload inventory CSV. Upserts rows into the inventory table."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only .csv files are accepted")
    content = await file.read()
    try:
        df = parse_inventory_csv(content)
        count = upsert_inventory(df, db)
        return {"message": f"Successfully imported {count} inventory items"}
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/", response_model=InventorySummary)
def get_inventory(db: Session = Depends(get_db)):
    """Get full inventory with alerts and summary."""
    data = get_inventory_summary(db)
    return InventorySummary(**data)


@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    """Get only low-stock and out-of-stock alerts."""
    return get_inventory_alerts(db)
