"use client";

import { useEffect, useState } from "react";
import { Search, Download, Copy, Mic, MicOff, Check, MessageSquare } from "lucide-react";
import { getTranscript, getProductRequests, getTranscriptCsvUrl } from "@/lib/api";
import type { TranscriptLine, ProductRequest } from "@/lib/types";
import { formatTimestamp, getLanguageLabel } from "@/lib/utils";

interface TranscriptTabProps {
  sessionId: number | null;
  liveTranscript?: TranscriptLine[];  // real-time lines from useLiveCamera
  isMicActive?: boolean;
}

export default function TranscriptTab({
  sessionId,
  liveTranscript,
  isMicActive,
}: TranscriptTabProps) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [products, setProducts] = useState<ProductRequest[]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Merge live transcript (from Web Speech) with stored transcript (from DB)
  const mergedTranscript: TranscriptLine[] = (() => {
    if (!liveTranscript || liveTranscript.length === 0) return transcript;
    // Deduplicate by id; live segments may overlap with stored ones after page refresh
    const ids = new Set(transcript.map((t) => t.id));
    const newLive = liveTranscript.filter((t) => !ids.has(t.id));
    return [...transcript, ...newLive].sort((a, b) => a.start_time - b.start_time);
  })();

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    Promise.all([
      getTranscript(sessionId),
      getProductRequests(sessionId),
    ])
      .then(([t, p]) => {
        setTranscript(t);
        setProducts(p);
      })
      .catch(() => {
        setTranscript([]);
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const filtered = search
    ? mergedTranscript.filter((t) => t.text.toLowerCase().includes(search.toLowerCase()))
    : mergedTranscript;

  function handleCopy() {
    const text = mergedTranscript
      .map((t) => `[${formatTimestamp(t.start_time)}] ${t.speaker}: ${t.text}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasData = mergedTranscript.length > 0;
  const hasProducts = products.length > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
      {/* Transcript Panel */}
      <div>
        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={13}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-muted)" }}
            />
            <input
              type="text"
              placeholder="Search transcript…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px 7px 30px",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>

          {/* Live Mic Indicator */}
          {isMicActive !== undefined && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 8,
                background: isMicActive ? "#ECFDF5" : "#F9FAFB",
                border: `1px solid ${isMicActive ? "#6EE7B7" : "var(--color-border)"}`,
                fontSize: 11,
                color: isMicActive ? "#059669" : "var(--color-muted)",
                fontWeight: 500,
              }}
            >
              {isMicActive ? (
                <>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#10B981",
                      display: "inline-block",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  <Mic size={11} />
                  Listening
                </>
              ) : (
                <>
                  <MicOff size={11} />
                  Mic off
                </>
              )}
            </div>
          )}

          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={handleCopy} disabled={!hasData}>
            {copied ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {sessionId && (
            <a
              href={getTranscriptCsvUrl(sessionId)}
              target="_blank"
              rel="noopener"
              className="btn-ghost"
              style={{ fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <Download size={13} />
              CSV
            </a>
          )}
        </div>

        {/* Lines */}
        <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ padding: "10px 12px", display: "flex", gap: 10 }}>
                  <div className="skeleton" style={{ width: 50, height: 12 }} />
                  <div className="skeleton" style={{ flex: 1, height: 12 }} />
                </div>
              ))
            : !hasData
            ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "32px 16px",
                    gap: 8,
                    color: "var(--color-muted)",
                  }}
                >
                  <MessageSquare size={28} style={{ opacity: 0.3 }} />
                  <div style={{ fontSize: 13, fontWeight: 500 }}>No transcript yet</div>
                  <div style={{ fontSize: 11, textAlign: "center", maxWidth: 220 }}>
                    {isMicActive
                      ? "Speak near the microphone — recognized speech will appear here in real time."
                      : sessionId
                      ? "Upload a video or start the live camera to generate a transcript."
                      : "Start the live camera to begin transcription."}
                  </div>
                </div>
              )
            : filtered.map((line) => (
                <div
                  key={line.id}
                  className="fade-in"
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: line.speaker === "Customer" ? "#F9FAFB" : "#fff",
                    border: "1px solid var(--color-border)",
                    alignItems: "flex-start",
                  }}
                >
                  {/* Timestamp */}
                  <span style={{ fontSize: 10, color: "var(--color-muted)", minWidth: 44, marginTop: 2, fontFamily: "monospace" }}>
                    {formatTimestamp(line.start_time)}
                  </span>
                  {/* Speaker */}
                  <span
                    className={`badge ${line.speaker === "Customer" ? "badge-info" : "badge-muted"}`}
                    style={{ minWidth: 72, justifyContent: "center", flexShrink: 0 }}
                  >
                    {line.speaker}
                  </span>
                  {/* Text */}
                  <span style={{ fontSize: 13, flex: 1, lineHeight: 1.5 }}>{line.text}</span>
                  {/* Language */}
                  <span style={{ fontSize: 10, color: "var(--color-muted)", flexShrink: 0 }}>
                    {line.language?.toUpperCase()}
                  </span>
                </div>
              ))}
        </div>
      </div>

      {/* Product Extractions */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Mic size={14} color="var(--color-accent)" />
          Detected Products
          {hasProducts && (
            <span
              style={{
                marginLeft: "auto",
                background: "var(--color-accent)",
                color: "#fff",
                borderRadius: 10,
                padding: "1px 7px",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {products.length}
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!hasProducts ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 12px",
                gap: 6,
                color: "var(--color-muted)",
                background: "#F9FAFB",
                border: "1px dashed var(--color-border)",
                borderRadius: 10,
              }}
            >
              <Mic size={20} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 12 }}>No products detected yet</div>
            </div>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "#F9FAFB",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.product_name}</span>
                  <span
                    className={`badge ${p.status === "unavailable" ? "badge-danger" : "badge-success"}`}
                  >
                    {p.status === "unavailable" ? "Unavailable" : "Detected"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--color-muted)" }}>
                  <span>Qty: <b style={{ color: "var(--color-text)" }}>{p.quantity}</b></span>
                  <span>·</span>
                  <span>Lang: <b style={{ color: "var(--color-text)" }}>{getLanguageLabel(p.language ?? "")}</b></span>
                  {p.customer_track_id && (
                    <>
                      <span>·</span>
                      <span>Customer #{p.customer_track_id}</span>
                    </>
                  )}
                </div>
                {p.confidence !== null && (
                  <div style={{ marginTop: 6 }}>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${(p.confidence) * 100}%` }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 3 }}>
                      Confidence: {((p.confidence) * 100).toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
