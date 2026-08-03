"""
Sales service — CSV upload, revenue analytics, conversion rate calculation.
"""

import pandas as pd
import io
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.models import SaleRecord, Customer


# ---------------------------------------------------------------------------
# CSV Parsing
# ---------------------------------------------------------------------------

REQUIRED_COLS = {"timestamp", "product_name", "quantity", "price"}


def parse_sales_csv(content: bytes) -> pd.DataFrame:
    df = pd.read_csv(io.BytesIO(content))
    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")
    missing = REQUIRED_COLS - set(df.columns)
    if missing:
        raise ValueError(f"Sales CSV missing columns: {missing}")
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"])
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce").fillna(1)
    df["price"] = pd.to_numeric(df["price"], errors="coerce").fillna(0)
    df["total"] = df["quantity"] * df["price"]
    df["customer_id"] = df.get("customer_id", pd.Series([""] * len(df))).fillna("").astype(str)
    return df


def upsert_sales(df: pd.DataFrame, db: Session) -> int:
    count = 0
    for _, row in df.iterrows():
        record = SaleRecord(
            timestamp=row["timestamp"].to_pydatetime(),
            product_name=row["product_name"].strip(),
            quantity=row["quantity"],
            price=row["price"],
            total=row["total"],
            customer_id=row["customer_id"] or None,
        )
        db.add(record)
        count += 1
    db.commit()
    return count


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

def get_sales_summary(db: Session, target_date: Optional[date] = None) -> Dict[str, Any]:
    """Compute comprehensive sales analytics."""
    if target_date is None:
        target_date = date.today()

    records = db.query(SaleRecord).all()

    if not records:
        # Return real zeros — no mock data
        return {
            "today_revenue": 0.0,
            "total_items_sold": 0,
            "avg_basket_size": 0.0,
            "top_products": [],
            "revenue_by_hour": [{"hour": f"{h:02d}:00", "revenue": 0.0} for h in range(8, 22)],
            "conversion_rate": None,
        }

    today_records = [
        r for r in records
        if r.timestamp and r.timestamp.date() == target_date
    ]

    today_revenue = sum(r.total for r in today_records)
    total_items = sum(r.quantity for r in today_records)
    # Total number of transactions (rows) for the day
    total_transactions = len(today_records)

    # Top products
    product_sales: Dict[str, float] = {}
    product_revenue: Dict[str, float] = {}
    for r in today_records:
        product_sales[r.product_name] = product_sales.get(r.product_name, 0) + r.quantity
        product_revenue[r.product_name] = product_revenue.get(r.product_name, 0) + r.total
    top_products = sorted(
        [{"name": k, "quantity": v, "revenue": product_revenue[k]} for k, v in product_sales.items()],
        key=lambda x: x["revenue"],
        reverse=True,
    )[:8]

    # Revenue by hour
    by_hour: Dict[int, float] = {}
    for r in today_records:
        if r.timestamp:
            h = r.timestamp.hour
            by_hour[h] = by_hour.get(h, 0) + r.total
    revenue_by_hour = [
        {"hour": f"{h:02d}:00", "revenue": round(by_hour.get(h, 0), 2)}
        for h in range(8, 22)
    ]

    # Conversion rate (customers who bought / total unique customers)
    unique_buyers = len({r.customer_id for r in today_records if r.customer_id})
    total_customers_today = db.query(Customer).count() or max(1, unique_buyers)
    conversion_rate = round((unique_buyers / total_customers_today) * 100, 1) if total_customers_today and unique_buyers else None

    # avg_basket_size: revenue per transaction (works even without customer_id column)
    avg_basket = round(today_revenue / total_transactions, 2) if total_transactions else 0.0

    return {
        "today_revenue": round(today_revenue, 2),
        "total_items_sold": round(total_items, 0),
        "avg_basket_size": avg_basket,
        "top_products": top_products,
        "revenue_by_hour": revenue_by_hour,
        "conversion_rate": conversion_rate,
    }


def _mock_sales_summary() -> Dict[str, Any]:
    """Realistic mock sales data for demo mode."""
    hours = list(range(8, 22))
    peak = 18
    revenue_by_hour = []
    for h in hours:
        diff = abs(h - peak)
        rev = max(0, round(800 - diff * 90 + (hash(h) % 100), 2))
        revenue_by_hour.append({"hour": f"{h:02d}:00", "revenue": rev})

    return {
        "today_revenue": 7843.50,
        "total_items_sold": 312,
        "avg_basket_size": 127.3,
        "top_products": [
            {"name": "Amul Milk 500ml",  "quantity": 48, "revenue": 1344},
            {"name": "Coca Cola 250ml",  "quantity": 36, "revenue": 720},
            {"name": "Maggi Noodles",    "quantity": 55, "revenue": 770},
            {"name": "Lays Chips",       "quantity": 40, "revenue": 800},
            {"name": "Parle-G Biscuit",  "quantity": 60, "revenue": 600},
            {"name": "Tata Salt 1kg",    "quantity": 20, "revenue": 440},
            {"name": "Amul Butter 100g", "quantity": 15, "revenue": 825},
            {"name": "Surf Excel 500g",  "quantity": 12, "revenue": 1020},
        ],
        "revenue_by_hour": revenue_by_hour,
        "conversion_rate": 73.4,
    }
