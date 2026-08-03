"use client";

import { useState } from "react";
import {
  Store,
  Upload,
  FileSpreadsheet,
  Camera,
  CameraOff,
  Radio,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import {
  uploadInventory,
  getInventory,
  uploadSales,
  getSalesSummary,
} from "@/lib/api";
import type { InventorySummary, SalesSummary } from "@/lib/types";
import { useRef } from "react";

interface NavbarProps {
  isLive: boolean;
  isStarting: boolean;
  sessionId: number | null;
  frameCount: number;
  onStartCamera: () => void;
  onStopCamera: () => void;
  onInventoryLoaded: (data: InventorySummary) => void;
  onSalesLoaded: (data: SalesSummary) => void;
}

export default function Navbar({
  isLive,
  isStarting,
  sessionId,
  frameCount,
  onStartCamera,
  onStopCamera,
  onInventoryLoaded,
  onSalesLoaded,
}: NavbarProps) {
  const inventoryInputRef = useRef<HTMLInputElement>(null);
  const salesInputRef = useRef<HTMLInputElement>(null);

  const today = format(new Date(), "EEEE, dd MMM yyyy");

  // ── Inventory Upload ──────────────────────────────────────────────
  async function handleInventoryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadInventory(file);
      const data = await getInventory();
      onInventoryLoaded(data);
    } catch (err) {
      console.error("Inventory upload failed", err);
    }
    e.target.value = "";
  }

  // ── Sales Upload ──────────────────────────────────────────────────
  async function handleSalesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadSales(file);
      const data = await getSalesSummary();
      onSalesLoaded(data);
    } catch (err) {
      console.error("Sales upload failed", err);
    }
    e.target.value = "";
  }

  return (
    <nav
      style={{
        height: 57,
        borderBottom: "1px solid var(--color-border)",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: "var(--color-primary)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Store size={17} color="#fff" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-primary)", lineHeight: 1.2 }}>
            StoreSense AI
          </div>
          <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1 }}>
            Retail Intelligence
          </div>
        </div>
      </div>

      {/* Date */}
      <div style={{ fontSize: 13, color: "var(--color-muted)", fontWeight: 500 }}>
        {today}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Live status indicator */}
        {isLive && (
          <div
            className="fade-in"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 8,
              fontSize: 12,
              color: "#dc2626",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: "#ef4444",
                borderRadius: "50%",
                display: "inline-block",
                animation: "livePulse 1.2s ease infinite",
              }}
            />
            LIVE · {frameCount} frames
            {sessionId && (
              <span style={{ opacity: 0.6, fontWeight: 400 }}>
                &nbsp;· Session #{sessionId}
              </span>
            )}
          </div>
        )}

        {isStarting && !isLive && (
          <div
            className="fade-in"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px",
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: 8,
              fontSize: 12,
              color: "#1e40af",
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: "#2563EB",
                borderRadius: "50%",
                display: "inline-block",
                animation: "pulse 1s ease infinite",
              }}
            />
            Starting camera…
          </div>
        )}

        {/* Camera toggle button */}
        {isLive ? (
          <button
            className="btn-ghost"
            onClick={onStopCamera}
            style={{
              fontSize: 13,
              gap: 5,
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#dc2626",
            }}
          >
            <CameraOff size={14} />
            Stop Camera
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={onStartCamera}
            disabled={isStarting}
            style={{ fontSize: 13, gap: 5 }}
          >
            <Radio size={14} />
            {isStarting ? "Starting…" : "Start Camera"}
          </button>
        )}

        {/* Upload Inventory */}
        <input
          ref={inventoryInputRef}
          type="file"
          accept=".csv"
          onChange={handleInventoryUpload}
          style={{ display: "none" }}
          id="inventory-upload"
        />
        <button
          className="btn-ghost"
          onClick={() => inventoryInputRef.current?.click()}
          style={{ fontSize: 13 }}
        >
          <FileSpreadsheet size={14} />
          Inventory CSV
        </button>

        {/* Upload Sales */}
        <input
          ref={salesInputRef}
          type="file"
          accept=".csv"
          onChange={handleSalesUpload}
          style={{ display: "none" }}
          id="sales-upload"
        />
        <button
          className="btn-ghost"
          onClick={() => salesInputRef.current?.click()}
          style={{ fontSize: 13 }}
        >
          <Upload size={14} />
          Sales CSV
        </button>

        {/* Settings */}
        <button className="btn-ghost" style={{ padding: "7px 10px" }} title="Settings">
          <Settings size={15} />
        </button>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </nav>
  );
}
