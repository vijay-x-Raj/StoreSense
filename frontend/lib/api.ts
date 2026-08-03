// Typed API client for StoreSense AI backend

import type {
  VideoSession,
  Detection,
  VideoAnalytics,
  TranscriptLine,
  ProductRequest,
  InventorySummary,
  SalesSummary,
  AIQueryResponse,
  AIDailySummary,
  LiveSession,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Video ────────────────────────────────────────────────────────────

export async function uploadVideo(file: File): Promise<VideoSession> {
  const form = new FormData();
  form.append("file", file);
  return request<VideoSession>("/api/video/upload", { method: "POST", body: form });
}

export async function getVideoStatus(sessionId: number): Promise<VideoSession> {
  return request<VideoSession>(`/api/video/status/${sessionId}`);
}

export async function getVideoAnalytics(sessionId: number): Promise<VideoAnalytics> {
  return request<VideoAnalytics>(`/api/video/analytics/${sessionId}`);
}

export async function getDetections(sessionId: number, frame?: number): Promise<Detection[]> {
  const q = frame !== undefined ? `?frame=${frame}` : "";
  return request<Detection[]>(`/api/video/detections/${sessionId}${q}`);
}

export async function listSessions(): Promise<VideoSession[]> {
  return request<VideoSession[]>("/api/video/sessions");
}

// ── Camera (Live Feed) ───────────────────────────────────────────────

export async function startLiveSession(): Promise<LiveSession> {
  return request<LiveSession>("/api/camera/start", { method: "POST" });
}

export async function submitFrame(
  sessionId: number,
  blob: Blob
): Promise<{ detections: Detection[] }> {
  const form = new FormData();
  form.append("file", blob, "frame.jpg");
  return request<{ detections: Detection[] }>(`/api/camera/frame/${sessionId}`, {
    method: "POST",
    body: form,
  });
}

export async function stopLiveSession(sessionId: number): Promise<void> {
  await request<unknown>(`/api/camera/stop/${sessionId}`, { method: "POST" });
}

export async function getLiveCameraAnalytics(sessionId: number): Promise<VideoAnalytics> {
  return request<VideoAnalytics>(`/api/camera/analytics/${sessionId}`);
}

// ── Transcript ───────────────────────────────────────────────────────

export async function getTranscript(sessionId: number, search?: string): Promise<TranscriptLine[]> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<TranscriptLine[]>(`/api/audio/transcript/${sessionId}${q}`);
}

export async function getProductRequests(sessionId: number): Promise<ProductRequest[]> {
  return request<ProductRequest[]>(`/api/audio/products/${sessionId}`);
}

export interface LiveSegment {
  text: string;
  start_time: number;
  end_time: number;
  speaker?: string;
  language?: string;
  confidence?: number;
}

export async function postLiveTranscriptSegment(
  sessionId: number,
  segment: LiveSegment
): Promise<TranscriptLine> {
  return request<TranscriptLine>(`/api/audio/live-segment/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(segment),
  });
}

export async function getLiveTranscript(sessionId: number): Promise<TranscriptLine[]> {
  return request<TranscriptLine[]>(`/api/audio/live-transcript/${sessionId}`);
}

// ── Inventory ────────────────────────────────────────────────────────

export async function uploadInventory(file: File): Promise<{ message: string }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ message: string }>("/api/inventory/upload", { method: "POST", body: form });
}

export async function getInventory(): Promise<InventorySummary> {
  return request<InventorySummary>("/api/inventory/");
}

// ── Sales ─────────────────────────────────────────────────────────────

export async function uploadSales(file: File): Promise<{ message: string }> {
  const form = new FormData();
  form.append("file", file);
  return request<{ message: string }>("/api/sales/upload", { method: "POST", body: form });
}

export async function getSalesSummary(date?: string): Promise<SalesSummary> {
  const q = date ? `?target_date=${date}` : "";
  return request<SalesSummary>(`/api/sales/summary${q}`);
}

// ── AI ───────────────────────────────────────────────────────────────

export async function queryAI(query: string, sessionId?: number): Promise<AIQueryResponse> {
  return request<AIQueryResponse>("/api/ai/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, session_id: sessionId }),
  });
}

export async function getDailySummary(sessionId?: number): Promise<AIDailySummary> {
  const q = sessionId ? `?session_id=${sessionId}` : "";
  return request<AIDailySummary>(`/api/ai/summary${q}`);
}

// ── Reports ───────────────────────────────────────────────────────────

export function getTranscriptCsvUrl(sessionId: number): string {
  return `${BASE_URL}/api/reports/transcript/csv/${sessionId}`;
}

export function getSalesCsvUrl(): string {
  return `${BASE_URL}/api/reports/sales/csv`;
}

export function getInventoryCsvUrl(): string {
  return `${BASE_URL}/api/reports/inventory/csv`;
}
