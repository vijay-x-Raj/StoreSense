"""
StoreSense AI — FastAPI Backend
Entry point: mounts all routers, configures CORS, starts DB.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.db.database import engine, Base
from app.api import video, audio, inventory, sales, ai, reports, camera


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all DB tables on startup
    Base.metadata.create_all(bind=engine)
    # Ensure upload dirs exist
    os.makedirs("uploads/videos", exist_ok=True)
    os.makedirs("uploads/csv", exist_ok=True)
    os.makedirs("exports", exist_ok=True)
    yield


app = FastAPI(
    title="StoreSense AI API",
    description="Multimodal retail intelligence backend",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow Next.js dev server
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static files (serve uploaded videos so frontend can play them)
# ---------------------------------------------------------------------------
os.makedirs("uploads/videos", exist_ok=True)
os.makedirs("uploads/csv", exist_ok=True)
os.makedirs("exports", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/exports", StaticFiles(directory="exports"), name="exports")

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(video.router, prefix="/api/video", tags=["Video"])
app.include_router(camera.router, prefix="/api/camera", tags=["Camera"])
app.include_router(audio.router, prefix="/api/audio", tags=["Audio"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
app.include_router(sales.router, prefix="/api/sales", tags=["Sales"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "StoreSense AI"}
