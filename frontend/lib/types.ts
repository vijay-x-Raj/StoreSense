// Shared TypeScript types for StoreSense AI frontend

export interface VideoSession {
  id: number;
  filename: string;
  original_filename: string;
  status: "uploaded" | "processing" | "done" | "error";
  duration_seconds: number | null;
  fps: number | null;
  total_frames: number | null;
  processed_frames: number;
  error_message: string | null;
  created_at: string;
}

export interface Detection {
  id: number;
  frame_number: number;
  timestamp_seconds: number;
  label: "customer" | "employee" | "shelf" | "cash_counter" | "product" | string;
  track_id: number | null;
  confidence: number;
  bbox_x1: number;
  bbox_y1: number;
  bbox_x2: number;
  bbox_y2: number;
}

export interface VideoAnalytics {
  total_customers: number;
  current_customers: number;
  avg_dwell_time_seconds: number;
  peak_hour: string | null;
  queue_length: number;
  customers_by_hour: Array<{ hour: string; customers: number }>;
}

// ── Transcript ──────────────────────────────────────────────────────

export interface TranscriptLine {
  id: number;
  start_time: number;
  end_time: number;
  speaker: "Customer" | "Shopkeeper" | "Unknown" | string;
  text: string;
  language: "hi" | "en" | "hinglish" | "unknown" | string;
  confidence: number | null;
}

export interface ProductRequest {
  id: number;
  customer_track_id: number | null;
  product_name: string;
  quantity: number;
  language: string | null;
  confidence: number | null;
  status: "detected" | "fulfilled" | "unavailable";
}

// ── Inventory ───────────────────────────────────────────────────────

export interface InventoryItem {
  id: number;
  product_name: string;
  current_stock: number;
  price: number;
  reorder_level: number;
  category: string | null;
  supplier: string | null;
}

export interface InventoryAlert {
  product_name: string;
  current_stock: number;
  reorder_level: number;
  alert_type: "low_stock" | "out_of_stock";
}

export interface InventorySummary {
  total_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  alerts: InventoryAlert[];
  items: InventoryItem[];
}

// ── Sales ───────────────────────────────────────────────────────────

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export interface SalesSummary {
  today_revenue: number;
  total_items_sold: number;
  avg_basket_size: number;
  top_products: TopProduct[];
  revenue_by_hour: Array<{ hour: string; revenue: number }>;
  conversion_rate: number | null;
}

// ── AI ──────────────────────────────────────────────────────────────

export interface AIQueryResponse {
  query: string;
  response: string;
  context_used: string[];
}

export interface AIDailySummary {
  summary: string;
  key_metrics: {
    total_customers: number;
    revenue: number;
    conversion_rate: number;
    peak_hour: string;
    low_stock_items: number;
  };
  recommendations: string[];
  alerts: string[];
  generated_at: string;
}

// ── UI State ────────────────────────────────────────────────────────

export type UploadStatus = "idle" | "uploading" | "processing" | "live" | "done" | "error";

export interface UploadState {
  status: UploadStatus;
  progress: number;
  sessionId: number | null;
  filename: string | null;
  error: string | null;
}

export interface LiveSession {
  session_id: number;
  status: string;
}
