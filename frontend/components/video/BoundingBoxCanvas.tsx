"use client";

import { useEffect, useRef } from "react";
import type { Detection } from "@/lib/types";
import { getLabelColor } from "@/lib/utils";

interface BoundingBoxCanvasProps {
  detections: Detection[];
  width: number;
  height: number;
}

export default function BoundingBoxCanvas({ detections, width, height }: BoundingBoxCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    for (const det of detections) {
      const x1 = det.bbox_x1;
      const y1 = det.bbox_y1;
      const w = det.bbox_x2 - det.bbox_x1;
      const h = det.bbox_y2 - det.bbox_y1;
      const color = getLabelColor(det.label);

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, w, h);

      // Corner accents for premium look
      const cs = 12;
      ctx.lineWidth = 3;
      // Top-left
      ctx.beginPath(); ctx.moveTo(x1, y1 + cs); ctx.lineTo(x1, y1); ctx.lineTo(x1 + cs, y1); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(x1 + w - cs, y1); ctx.lineTo(x1 + w, y1); ctx.lineTo(x1 + w, y1 + cs); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(x1, y1 + h - cs); ctx.lineTo(x1, y1 + h); ctx.lineTo(x1 + cs, y1 + h); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(x1 + w - cs, y1 + h); ctx.lineTo(x1 + w, y1 + h); ctx.lineTo(x1 + w, y1 + h - cs); ctx.stroke();

      // Label
      const label = det.track_id
        ? `${det.label} #${det.track_id} (${Math.round(det.confidence * 100)}%)`
        : `${det.label} (${Math.round(det.confidence * 100)}%)`;

      ctx.font = "11px Inter, sans-serif";
      const textWidth = ctx.measureText(label).width;
      const labelH = 18;
      const labelY = y1 > labelH + 4 ? y1 - 4 : y1 + h + 4;

      ctx.fillStyle = color;
      ctx.fillRect(x1, labelY - labelH + 4, textWidth + 8, labelH);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, x1 + 4, labelY);
    }
  }, [detections, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    />
  );
}
