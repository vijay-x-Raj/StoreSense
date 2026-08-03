"""
SQLAlchemy ORM models for StoreSense AI.
All timestamps are UTC. All monetary values in INR (paise stored as int optional).
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class VideoSession(Base):
    """Represents one uploaded/processed video file."""

    __tablename__ = "video_sessions"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    status = Column(String, default="uploaded")  # uploaded | processing | done | error
    duration_seconds = Column(Float, nullable=True)
    fps = Column(Float, nullable=True)
    total_frames = Column(Integer, nullable=True)
    processed_frames = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    customers = relationship("Customer", back_populates="session")
    detections = relationship("Detection", back_populates="session")
    transcripts = relationship("Transcript", back_populates="session")


class Customer(Base):
    """A unique customer tracked by ByteTrack across a session."""

    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("video_sessions.id"), nullable=False)
    track_id = Column(Integer, nullable=False)  # ByteTrack ID
    first_seen_frame = Column(Integer, nullable=True)
    last_seen_frame = Column(Integer, nullable=True)
    first_seen_time = Column(Float, nullable=True)   # seconds into video
    last_seen_time = Column(Float, nullable=True)
    dwell_time_seconds = Column(Float, nullable=True)
    entry_zone = Column(String, nullable=True)
    exit_zone = Column(String, nullable=True)
    made_purchase = Column(Boolean, default=False)

    session = relationship("VideoSession", back_populates="customers")


class Detection(Base):
    """One YOLO bounding-box detection in a single frame."""

    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("video_sessions.id"), nullable=False)
    frame_number = Column(Integer, nullable=False)
    timestamp_seconds = Column(Float, nullable=False)
    label = Column(String, nullable=False)      # customer, employee, shelf, cash_counter, …
    track_id = Column(Integer, nullable=True)   # ByteTrack ID (for trackable objects)
    confidence = Column(Float, nullable=False)
    bbox_x1 = Column(Float, nullable=False)
    bbox_y1 = Column(Float, nullable=False)
    bbox_x2 = Column(Float, nullable=False)
    bbox_y2 = Column(Float, nullable=False)

    session = relationship("VideoSession", back_populates="detections")


class Transcript(Base):
    """One line of the ASR transcript."""

    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("video_sessions.id"), nullable=False)
    start_time = Column(Float, nullable=False)   # seconds
    end_time = Column(Float, nullable=False)
    speaker = Column(String, nullable=True)      # Customer | Shopkeeper | Unknown
    text = Column(Text, nullable=False)
    language = Column(String, nullable=True)     # hi | en | hinglish
    confidence = Column(Float, nullable=True)

    session = relationship("VideoSession", back_populates="transcripts")
    products = relationship("ProductRequest", back_populates="transcript")


class ProductRequest(Base):
    """A product mentioned in a transcript segment."""

    __tablename__ = "products_requested"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("video_sessions.id"), nullable=False)
    transcript_id = Column(Integer, ForeignKey("transcripts.id"), nullable=True)
    customer_track_id = Column(Integer, nullable=True)
    product_name = Column(String, nullable=False)
    quantity = Column(Float, default=1.0)
    language = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    status = Column(String, default="detected")  # detected | fulfilled | unavailable

    transcript = relationship("Transcript", back_populates="products")


class InventoryItem(Base):
    """Current inventory state uploaded via CSV."""

    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String, unique=True, nullable=False, index=True)
    current_stock = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    reorder_level = Column(Float, nullable=False)
    category = Column(String, nullable=True)
    supplier = Column(String, nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SaleRecord(Base):
    """A single sales transaction row."""

    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    product_name = Column(String, nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    customer_id = Column(String, nullable=True)


class AIInsight(Base):
    """Cached AI-generated insights / daily summaries."""

    __tablename__ = "ai_insights"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("video_sessions.id"), nullable=True)
    insight_type = Column(String, nullable=False)  # daily_summary | query_response | alert
    query = Column(Text, nullable=True)
    response = Column(Text, nullable=False)
    context_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
