"""
Inventory service — CSV parsing, stock management, alert generation.
"""

import pandas as pd
import io
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.models import InventoryItem


# ---------------------------------------------------------------------------
# CSV Upload
# ---------------------------------------------------------------------------

REQUIRED_COLUMNS = {"product_name", "current_stock", "price", "reorder_level"}
OPTIONAL_COLUMNS = {"category", "supplier"}


def parse_inventory_csv(content: bytes) -> pd.DataFrame:
    """Parse inventory CSV bytes into a clean DataFrame."""
    df = pd.read_csv(io.BytesIO(content))
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")
    df["current_stock"] = pd.to_numeric(df["current_stock"], errors="coerce").fillna(0)
    df["price"] = pd.to_numeric(df["price"], errors="coerce").fillna(0)
    df["reorder_level"] = pd.to_numeric(df["reorder_level"], errors="coerce").fillna(0)
    df["category"] = df.get("category", pd.Series(["General"] * len(df))).fillna("General")
    df["supplier"] = df.get("supplier", pd.Series(["Unknown"] * len(df))).fillna("Unknown")
    df["product_name"] = df["product_name"].str.strip()
    return df


def upsert_inventory(df: pd.DataFrame, db: Session) -> int:
    """Upsert inventory rows. Returns count of upserted rows."""
    count = 0
    for _, row in df.iterrows():
        existing = (
            db.query(InventoryItem)
            .filter(InventoryItem.product_name == row["product_name"])
            .first()
        )
        if existing:
            existing.current_stock = row["current_stock"]
            existing.price = row["price"]
            existing.reorder_level = row["reorder_level"]
            existing.category = row["category"]
            existing.supplier = row["supplier"]
        else:
            item = InventoryItem(
                product_name=row["product_name"],
                current_stock=row["current_stock"],
                price=row["price"],
                reorder_level=row["reorder_level"],
                category=row["category"],
                supplier=row["supplier"],
            )
            db.add(item)
        count += 1
    db.commit()
    return count


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

def get_inventory_alerts(db: Session) -> List[Dict[str, Any]]:
    """Return low-stock and out-of-stock alerts."""
    items = db.query(InventoryItem).all()
    alerts = []
    for item in items:
        if item.current_stock <= 0:
            alerts.append({
                "product_name": item.product_name,
                "current_stock": item.current_stock,
                "reorder_level": item.reorder_level,
                "alert_type": "out_of_stock",
            })
        elif item.current_stock <= item.reorder_level:
            alerts.append({
                "product_name": item.product_name,
                "current_stock": item.current_stock,
                "reorder_level": item.reorder_level,
                "alert_type": "low_stock",
            })
    return sorted(alerts, key=lambda x: x["current_stock"])


def deduct_stock(product_name: str, quantity: float, db: Session) -> bool:
    """Reduce stock for a product. Returns True on success."""
    item = (
        db.query(InventoryItem)
        .filter(InventoryItem.product_name.ilike(f"%{product_name}%"))
        .first()
    )
    if not item:
        return False
    item.current_stock = max(0, item.current_stock - quantity)
    db.commit()
    return True


def get_inventory_summary(db: Session) -> Dict[str, Any]:
    """Compute summary stats for inventory."""
    items = db.query(InventoryItem).all()
    if not items:
        return _mock_inventory_summary()
    alerts = get_inventory_alerts(db)
    low = sum(1 for a in alerts if a["alert_type"] == "low_stock")
    out = sum(1 for a in alerts if a["alert_type"] == "out_of_stock")
    return {
        "total_items": len(items),
        "low_stock_count": low,
        "out_of_stock_count": out,
        "alerts": alerts,
        "items": [
            {
                "id": i.id,
                "product_name": i.product_name,
                "current_stock": i.current_stock,
                "price": i.price,
                "reorder_level": i.reorder_level,
                "category": i.category,
                "supplier": i.supplier,
            }
            for i in items
        ],
    }


def _mock_inventory_summary() -> Dict[str, Any]:
    """Return mock data when no inventory uploaded yet."""
    items = [
        {"id": 1,  "product_name": "Amul Milk 500ml",   "current_stock": 12,  "price": 28,  "reorder_level": 20, "category": "Dairy",      "supplier": "Amul"},
        {"id": 2,  "product_name": "Coca Cola 250ml",   "current_stock": 45,  "price": 20,  "reorder_level": 30, "category": "Beverages",   "supplier": "Coca Cola India"},
        {"id": 3,  "product_name": "Lays Chips",        "current_stock": 8,   "price": 20,  "reorder_level": 15, "category": "Snacks",      "supplier": "PepsiCo"},
        {"id": 4,  "product_name": "Maggi Noodles",     "current_stock": 30,  "price": 14,  "reorder_level": 25, "category": "Instant Food","supplier": "Nestle"},
        {"id": 5,  "product_name": "Parle-G Biscuit",   "current_stock": 0,   "price": 10,  "reorder_level": 20, "category": "Snacks",      "supplier": "Parle"},
        {"id": 6,  "product_name": "Tata Salt 1kg",     "current_stock": 22,  "price": 22,  "reorder_level": 10, "category": "Grocery",     "supplier": "Tata"},
        {"id": 7,  "product_name": "Amul Butter 100g",  "current_stock": 5,   "price": 55,  "reorder_level": 10, "category": "Dairy",       "supplier": "Amul"},
        {"id": 8,  "product_name": "Surf Excel 500g",   "current_stock": 18,  "price": 85,  "reorder_level": 10, "category": "Household",   "supplier": "Hindustan Unilever"},
    ]
    alerts = [
        {"product_name": "Parle-G Biscuit", "current_stock": 0,  "reorder_level": 20, "alert_type": "out_of_stock"},
        {"product_name": "Amul Milk 500ml", "current_stock": 12, "reorder_level": 20, "alert_type": "low_stock"},
        {"product_name": "Lays Chips",      "current_stock": 8,  "reorder_level": 15, "alert_type": "low_stock"},
        {"product_name": "Amul Butter 100g","current_stock": 5,  "reorder_level": 10, "alert_type": "low_stock"},
    ]
    return {
        "total_items": len(items),
        "low_stock_count": 3,
        "out_of_stock_count": 1,
        "alerts": alerts,
        "items": items,
    }
