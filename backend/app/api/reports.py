"""
Reports API — export as PDF/CSV.
"""

import io
import csv
import os
from fastapi import APIRouter, Depends, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Transcript, SaleRecord, InventoryItem

router = APIRouter()


@router.get("/transcript/csv/{session_id}")
def export_transcript_csv(session_id: int, db: Session = Depends(get_db)):
    """Export transcript as CSV."""
    lines = (
        db.query(Transcript)
        .filter(Transcript.session_id == session_id)
        .order_by(Transcript.start_time)
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Speaker", "Text", "Language", "Confidence"])
    for t in lines:
        mins = int(t.start_time // 60)
        secs = int(t.start_time % 60)
        writer.writerow([
            f"{mins:02d}:{secs:02d}",
            t.speaker,
            t.text,
            t.language,
            f"{t.confidence:.2f}" if t.confidence else "",
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=transcript_{session_id}.csv"},
    )


@router.get("/sales/csv")
def export_sales_csv(db: Session = Depends(get_db)):
    """Export all sales records as CSV."""
    records = db.query(SaleRecord).order_by(SaleRecord.timestamp.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "Product", "Quantity", "Price", "Total", "Customer ID"])
    for r in records:
        writer.writerow([r.timestamp, r.product_name, r.quantity, r.price, r.total, r.customer_id])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sales_report.csv"},
    )


@router.get("/inventory/csv")
def export_inventory_csv(db: Session = Depends(get_db)):
    """Export inventory as CSV."""
    items = db.query(InventoryItem).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Product", "Stock", "Price", "Reorder Level", "Category", "Supplier"])
    for i in items:
        writer.writerow([i.product_name, i.current_stock, i.price, i.reorder_level, i.category, i.supplier])
    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventory_report.csv"},
    )
