"""
Pydantic schemas for StoreSense AI API — request bodies and response models.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime


# ---------------------------------------------------------------------------
# Video
# ---------------------------------------------------------------------------

class VideoSessionOut(BaseModel):
    id: int
    filename: str
    original_filename: str
    status: str
    duration_seconds: Optional[float]
    fps: Optional[float]
    total_frames: Optional[int]
    processed_frames: int
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class DetectionOut(BaseModel):
    id: int
    frame_number: int
    timestamp_seconds: float
    label: str
    track_id: Optional[int]
    confidence: float
    bbox_x1: float
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float

    class Config:
        from_attributes = True


class CustomerOut(BaseModel):
    id: int
    track_id: int
    first_seen_time: Optional[float]
    last_seen_time: Optional[float]
    dwell_time_seconds: Optional[float]
    entry_zone: Optional[str]
    exit_zone: Optional[str]
    made_purchase: bool

    class Config:
        from_attributes = True


class VideoAnalyticsSummary(BaseModel):
    total_customers: int
    current_customers: int
    avg_dwell_time_seconds: float
    peak_hour: Optional[str]
    queue_length: int
    customers_by_hour: List[Dict[str, Any]]


# ---------------------------------------------------------------------------
# Transcript
# ---------------------------------------------------------------------------

class TranscriptOut(BaseModel):
    id: int
    start_time: float
    end_time: float
    speaker: Optional[str]
    text: str
    language: Optional[str]
    confidence: Optional[float]

    class Config:
        from_attributes = True


class ProductRequestOut(BaseModel):
    id: int
    customer_track_id: Optional[int]
    product_name: str
    quantity: float
    language: Optional[str]
    confidence: Optional[float]
    status: str

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

class InventoryItemOut(BaseModel):
    id: int
    product_name: str
    current_stock: float
    price: float
    reorder_level: float
    category: Optional[str]
    supplier: Optional[str]
    last_updated: Optional[datetime]

    class Config:
        from_attributes = True


class InventoryAlert(BaseModel):
    product_name: str
    current_stock: float
    reorder_level: float
    alert_type: str   # low_stock | out_of_stock


class InventorySummary(BaseModel):
    total_items: int
    low_stock_count: int
    out_of_stock_count: int
    alerts: List[InventoryAlert]
    items: List[InventoryItemOut]


# ---------------------------------------------------------------------------
# Sales
# ---------------------------------------------------------------------------

class SaleRecordOut(BaseModel):
    id: int
    timestamp: datetime
    product_name: str
    quantity: float
    price: float
    total: float
    customer_id: Optional[str]

    class Config:
        from_attributes = True


class SalesSummary(BaseModel):
    today_revenue: float
    total_items_sold: float
    avg_basket_size: float
    top_products: List[Dict[str, Any]]
    revenue_by_hour: List[Dict[str, Any]]
    conversion_rate: Optional[float]


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------

class AIQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    session_id: Optional[int] = None


class AIQueryResponse(BaseModel):
    query: str
    response: str
    context_used: List[str]


class AIDailySummary(BaseModel):
    summary: str
    key_metrics: Dict[str, Any]
    recommendations: List[str]
    alerts: List[str]
    generated_at: datetime
