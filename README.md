# StoreSense AI

> **Multimodal retail intelligence for Kirana stores and small businesses in India.**

StoreSense AI turns a store's CCTV feed, microphone, and sales data into a real-time business dashboard — tracking customer footfall, analysing Hindi/English/Hinglish voice conversations at the counter, monitoring inventory stock levels, and surfacing AI-generated actionable insights, all from a single browser tab.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Environment Variables](#environment-variables)
   - [Run with Docker Compose](#run-with-docker-compose)
   - [Run Locally (Dev)](#run-locally-dev)
6. [Sample Data](#sample-data)
7. [Current Limitations & Known Issues](#current-limitations--known-issues)
8. [Roadmap](#roadmap)
9. [License](#license)

---

## Features

### Live Camera & Video Analysis
- **Live camera stream** directly in the browser (via `getUserMedia`)
- **Uploaded video** processing: drop an MP4/MKV and get instant analytics
- **YOLOv11** object detection (falls back to a deterministic mock detector when `ultralytics` / GPU is unavailable)
- **ByteTrack-style** customer tracking — unique track IDs, dwell times, entry/exit zones
- **Bounding-box overlay** rendered on a `<canvas>` on top of the live feed
- Detects labels: `customer`, `employee`, `shelf`, `cash_counter`, `product`

### Voice Transcript & Product Detection
- Audio extracted from uploaded video via `ffmpeg`, denoised with `afftdn`, then transcribed with **OpenAI Whisper** (auto-detects Hindi / English / Hinglish)
- Falls back to a realistic mock Kirana-store transcript when Whisper is not installed
- **Rule-based NLP** extracts product names, quantities, and prices from each transcript segment
- Live camera mode uses the **Web Speech API** for real-time microphone transcription — words appear as they are spoken

> **Known Issue:** In the current build the live-camera voice transcript does not yet stream into the analytics metrics in real time. Transcript lines from the Web Speech API accumulate in the Transcript tab but the InsightsPanel KPIs (revenue, items sold, etc.) do not yet re-compute as new voice segments arrive. A polling / WebSocket event loop is planned to close this gap.

### Analytics Dashboard
| Tab | Contents |
|---|---|
| **Customers** | Hourly footfall bar chart, dwell-time distribution, zone-traffic heatmap |
| **Inventory** | Stock levels, low-stock / out-of-stock alerts, reorder indicators |
| **Sales** | Revenue trends, top-selling products, conversion rate |
| **Transcript** | Timestamped speaker-labelled lines + detected product cards |
| **Reports** | Exportable CSV / PDF summary |

### AI Insights
- **AI Daily Report** — auto-generated after video processing; summarises footfall, revenue, stock alerts, and 2–3 actionable recommendations
- **AI Query Box** — ask free-form questions ("Why are sales low today?", "What should I restock?") and get context-grounded answers
- Powered by **GPT-4o** when `OPENAI_API_KEY` is set; falls back to deterministic rule-based responses otherwise

### Inventory & Sales
- Upload a **CSV** from the Navbar to seed inventory or sales data
- RESTful CRUD endpoints for inventory items and daily sales records
- Automatic low-stock / out-of-stock alerting

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (Next.js)                       │
│  VideoPanel ─── useLiveCamera (WebRTC + Web Speech API)      │
│  InsightsPanel ─── real-time KPIs + AI Query Box            │
│  AnalyticsTabs ─── Charts · Inventory · Sales · Transcript   │
└────────────────────────┬─────────────────────────────────────┘
                         │ REST (fetch / SSE)
┌────────────────────────▼─────────────────────────────────────┐
│                   FastAPI Backend (Python)                    │
│                                                              │
│  /api/video   ── upload · process (YOLOv11 / mock)           │
│  /api/camera  ── live-frame endpoint (JPEG → detections)     │
│  /api/audio   ── extract · denoise · Whisper transcription   │
│  /api/inventory  ── CSV import · CRUD · stock alerts         │
│  /api/sales      ── CSV import · summary · top products      │
│  /api/ai      ── GPT-4o query · daily summary generation     │
│  /api/reports ── CSV / PDF export                            │
└────────────────────────┬─────────────────────────────────────┘
                         │ SQLAlchemy ORM
┌────────────────────────▼─────────────────────────────────────┐
│           SQLite (dev)  /  PostgreSQL 16 (prod)              │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Vanilla CSS, Recharts, Lucide Icons |
| **Backend** | FastAPI, Python 3.11, Uvicorn, SQLAlchemy 2, Alembic |
| **Database** | SQLite (dev default) · PostgreSQL 16 (production) |
| **Computer Vision** | OpenCV, YOLOv11n (`ultralytics`) — mock mode if unavailable |
| **Speech Recognition** | OpenAI Whisper (`base` model) · Web Speech API (live) |
| **AI / LLM** | OpenAI GPT-4o (optional — rule-based fallback included) |
| **Audio Processing** | ffmpeg (`afftdn` noise-reduction filter) |
| **Containerisation** | Docker, Docker Compose |

---

## Project Structure

```
storeSense/
├── backend/
│   ├── main.py                  # FastAPI entry point
│   ├── requirements.txt
│   ├── Dockerfile
│   └── app/
│       ├── api/                 # Route handlers
│       │   ├── video.py         # Video upload & processing
│       │   ├── camera.py        # Live camera frames
│       │   ├── audio.py         # Audio transcription
│       │   ├── inventory.py     # Stock management
│       │   ├── sales.py         # Sales data
│       │   ├── ai.py            # AI queries & summaries
│       │   └── reports.py       # Export endpoints
│       ├── services/            # Business logic
│       │   ├── video_service.py    # YOLO detection + tracking
│       │   ├── audio_service.py    # Whisper + product NLP
│       │   ├── ai_service.py       # GPT-4o + rule-based AI
│       │   ├── inventory_service.py
│       │   └── sales_service.py
│       ├── models/              # SQLAlchemy ORM models
│       ├── schemas/             # Pydantic request/response schemas
│       └── db/                  # Database connection & session
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Main dashboard page
│   │   ├── layout.tsx
│   │   └── globals.css          # Design tokens + global styles
│   ├── components/
│   │   ├── layout/Navbar.tsx    # Top bar: camera controls, CSV upload
│   │   ├── video/
│   │   │   ├── VideoPanel.tsx       # Live feed + bounding boxes
│   │   │   └── BoundingBoxCanvas.tsx
│   │   ├── insights/InsightsPanel.tsx  # KPI sidebar
│   │   ├── analytics/
│   │   │   ├── AnalyticsTabs.tsx
│   │   │   ├── CustomerAnalytics.tsx
│   │   │   ├── InventoryTab.tsx
│   │   │   ├── SalesTab.tsx
│   │   │   ├── TranscriptTab.tsx
│   │   │   └── ReportsTab.tsx
│   │   └── ai/AIQueryBox.tsx
│   └── lib/
│       ├── api.ts               # Typed API client
│       ├── types.ts             # Shared TypeScript interfaces
│       ├── utils.ts             # Formatters & helpers
│       └── useLiveCamera.ts     # WebRTC + Web Speech hook
│
├── sample-data/
│   ├── inventory.csv            # Seed inventory (import via Navbar)
│   └── sales.csv                # Seed sales history
│
├── docker-compose.yml           # PostgreSQL + backend + frontend
└── .env.example                 # Environment variable reference
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Docker + Docker Compose | >= 24 |
| Node.js (local dev only) | >= 18 |
| Python (local dev only) | >= 3.11 |
| ffmpeg (audio features) | any recent |

### Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./storeSense.db` | SQLite (dev) or PostgreSQL connection string |
| `OPENAI_API_KEY` | *(empty)* | Optional. GPT-4o powers AI queries; rule-based fallback used if absent |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL as seen from the browser |

> The app is fully functional without an OpenAI key — all AI responses fall back to deterministic rule-based logic.

### Run with Docker Compose

```bash
# 1. Clone the repo
git clone <repo-url>
cd storeSense

# 2. Configure environment
cp .env.example .env
# (optional) add OPENAI_API_KEY=sk-... to .env

# 3. Start all services
docker compose up --build

# Frontend  → http://localhost:3000
# API docs  → http://localhost:8000/docs
```

### Run Locally (Dev)

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

**Optional: Real YOLO inference**
```bash
pip install ultralytics
# yolo11n.pt is bundled in backend/ — no extra download needed
```

**Optional: Real Whisper transcription**
```bash
pip install openai-whisper
# Also requires ffmpeg to be on PATH
```

---

## Sample Data

The `sample-data/` directory contains ready-to-import CSVs:

| File | Contents |
|---|---|
| `inventory.csv` | ~30 Kirana store SKUs (Amul, Maggi, Lays, Coca Cola, etc.) with stock levels and reorder thresholds |
| `sales.csv` | 90 days of daily sales history per product |

Import them from the **Navbar → Upload CSV** button (select "Inventory" or "Sales").

---

## Current Limitations & Known Issues

| Issue | Detail | Status |
|---|---|---|
| **Live transcript → metrics not real-time** | Live camera voice lines (Web Speech API) do not push updates into the InsightsPanel KPIs. Metrics only refresh after a full video upload + processing cycle. | 🔧 In progress |
| **YOLO runs in mock mode by default** | `ultralytics` is commented out of `requirements.txt` to keep the install light. Uncomment it and ensure a compatible PyTorch is present for real inference. | Optional |
| **Whisper disabled by default** | Same reason — uncomment `openai-whisper` in `requirements.txt`. Requires `ffmpeg` on PATH. | Optional |
| **Web Speech API browser support** | Chrome/Edge only. Firefox does not support the Web Speech API. | Browser limitation |
| **Single-store, single-session** | No multi-store or multi-tenant support yet. | Planned |

---

## Roadmap

- [ ] **Live metrics from voice** — pipe Web Speech API events through a WebSocket to update InsightsPanel KPIs in real time as customers speak
- [ ] **GPU-accelerated YOLO** — Docker image variant with CUDA support for production deployments
- [ ] **Whisper streaming** — chunk-based live transcription instead of post-upload batch processing
- [ ] **Hindi NLP** — replace keyword matching with a fine-tuned NER model for product extraction
- [ ] **Multi-camera support** — aggregate analytics across multiple RTSP/IP cameras
- [ ] **WhatsApp restock alerts** — push low-stock notifications to store owner via Twilio/WhatsApp API
- [ ] **Mobile PWA** — responsive layout + offline-capable dashboard for phone/tablet use
- [ ] **Multi-store / SaaS tier** — tenant isolation, per-store analytics, and a central admin panel

---

## License

MIT — see [LICENSE](LICENSE) for details.
