"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Layers,
  Radio,
  AlertCircle,
  Loader2,
} from "lucide-react";
import BoundingBoxCanvas from "./BoundingBoxCanvas";
import type { LiveCameraState, LiveCameraControls } from "@/lib/useLiveCamera";

interface VideoPanelProps {
  cameraState: LiveCameraState;
  cameraControls: LiveCameraControls;
  setVideoEl: (el: HTMLVideoElement | null) => void;
}

export default function VideoPanel({
  cameraState,
  cameraControls,
  setVideoEl,
}: VideoPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });

  // Wire <video> element into the hook's capture loop
  function handleVideoRef(el: HTMLVideoElement | null) {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    setVideoEl(el);
  }

  // Assign MediaStream to the <video> element whenever it changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (cameraState.stream) {
      video.srcObject = cameraState.stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [cameraState.stream]);

  // Track video element size for the bounding box overlay
  useEffect(() => {
    if (!videoRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setVideoSize({ width: e.contentRect.width, height: e.contentRect.height });
    });
    obs.observe(videoRef.current);
    return () => obs.disconnect();
  }, []);

  async function handleToggle() {
    if (cameraState.isLive) {
      await cameraControls.stop();
    } else {
      await cameraControls.start();
    }
  }

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Camera size={15} color="var(--color-accent)" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Live Feed</span>

          {cameraState.isLive && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 8px",
                borderRadius: 12,
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontSize: 11,
                fontWeight: 700,
                color: "#ef4444",
                letterSpacing: "0.04em",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#ef4444",
                  animation: "livePulse 1.2s ease infinite",
                  display: "inline-block",
                }}
              />
              LIVE
            </span>
          )}

          {cameraState.isStarting && (
            <span
              className="badge badge-info"
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <Loader2
                size={10}
                style={{ animation: "spin 0.8s linear infinite" }}
              />
              Starting…
            </span>
          )}

          {cameraState.sessionId !== null && (
            <span className="badge badge-muted" style={{ fontSize: 11 }}>
              Session #{cameraState.sessionId}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {cameraState.isLive && (
            <button
              className="btn-ghost"
              style={{ padding: "5px 10px", fontSize: 12, gap: 4 }}
              onClick={() => setShowBoxes((v) => !v)}
            >
              <Layers size={13} />
              {showBoxes ? "Hide" : "Show"} Detections
            </button>
          )}

          <button
            className={cameraState.isLive ? "btn-ghost" : "btn-primary"}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              gap: 5,
              ...(cameraState.isLive
                ? { border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }
                : {}),
            }}
            onClick={handleToggle}
            disabled={cameraState.isStarting}
          >
            {cameraState.isLive ? (
              <>
                <CameraOff size={13} /> Stop Camera
              </>
            ) : (
              <>
                <Radio size={13} /> Start Camera
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Video / Placeholder ────────────────────────────────── */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          background: "#0F172A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Live video element — always mounted, hidden when no stream */}
        <video
          ref={handleVideoRef}
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: cameraState.isLive ? "block" : "none",
          }}
        />

        {/* Bounding box overlay */}
        {cameraState.isLive && showBoxes && videoSize.width > 0 && (
          <BoundingBoxCanvas
            detections={cameraState.detections}
            width={videoSize.width}
            height={videoSize.height}
          />
        )}

        {/* Frame counter badge */}
        {cameraState.isLive && (
          <div
            style={{
              position: "absolute",
              bottom: 10,
              right: 12,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
              borderRadius: 6,
              padding: "3px 8px",
              fontSize: 11,
              color: "rgba(255,255,255,0.7)",
              fontFamily: "monospace",
            }}
          >
            {cameraState.frameCount} frames &middot;{" "}
            {cameraState.detections.length} detections
          </div>
        )}

        {/* Idle / error state */}
        {!cameraState.isLive && !cameraState.isStarting && (
          <IdleState
            error={cameraState.error}
            onStart={cameraControls.start}
          />
        )}

        {/* Starting spinner */}
        {cameraState.isStarting && <StartingState />}
      </div>

      <style jsx>{`
        @keyframes livePulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(0.85);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

// ── Idle State ────────────────────────────────────────────────────────

function IdleState({
  error,
  onStart,
}: {
  error: string | null;
  onStart: () => void;
}) {
  return (
    <div
      style={{
        width: "90%",
        maxWidth: 460,
        padding: "48px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        textAlign: "center",
        border: "2px dashed rgba(255,255,255,0.12)",
        borderRadius: 20,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      {error ? (
        <>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(239,68,68,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertCircle size={26} color="#ef4444" />
          </div>
          <div>
            <div
              style={{ color: "#f87171", fontWeight: 600, fontSize: 15 }}
            >
              Camera Error
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                marginTop: 6,
                lineHeight: 1.5,
                maxWidth: 320,
              }}
            >
              {error}
            </div>
          </div>
          <button
            className="btn-primary"
            style={{ padding: "8px 20px", fontSize: 13, gap: 6 }}
            onClick={onStart}
          >
            <Camera size={14} /> Try Again
          </button>
        </>
      ) : (
        <>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(99,102,241,0.15))",
              border: "1px solid rgba(99,102,241,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 30px rgba(37,99,235,0.2)",
            }}
          >
            <Camera size={30} color="rgba(99,102,241,0.9)" />
          </div>

          <div>
            <div
              style={{
                color: "rgba(255,255,255,0.85)",
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Live Camera Feed
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.38)",
                fontSize: 12,
                marginTop: 6,
                lineHeight: 1.6,
              }}
            >
              Click{" "}
              <strong style={{ color: "rgba(255,255,255,0.55)" }}>
                Start Camera
              </strong>{" "}
              to begin real-time YOLO detection
              <br />
              on your webcam or CCTV feed.
            </div>
          </div>

          <button
            className="btn-primary"
            style={{
              padding: "9px 22px",
              fontSize: 13,
              gap: 7,
              background: "linear-gradient(135deg, #2563eb, #6366f1)",
              boxShadow: "0 4px 20px rgba(37,99,235,0.35)",
            }}
            onClick={onStart}
          >
            <Radio size={14} /> Start Camera
          </button>

          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
            Requires camera permission · No video is stored on disk
          </div>
        </>
      )}
    </div>
  );
}

// ── Starting State ────────────────────────────────────────────────────

function StartingState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          border: "3px solid rgba(37,99,235,0.25)",
          borderTopColor: "#2563EB",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div
        style={{
          color: "rgba(255,255,255,0.7)",
          fontWeight: 600,
          fontSize: 15,
        }}
      >
        Starting camera…
      </div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
        Requesting permission &amp; connecting to AI pipeline
      </div>
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
