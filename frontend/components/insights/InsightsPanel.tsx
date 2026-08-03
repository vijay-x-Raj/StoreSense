"use client";

import { useEffect, useState } from "react";
import {
  Users, UserCheck, TrendingUp, IndianRupee,
  PackageOpen, AlertTriangle, Clock, Mic,
  BarChart2, Percent, ShoppingCart,
} from "lucide-react";
import { getInventory, getSalesSummary, getDailySummary } from "@/lib/api";
import type { VideoAnalytics, InventorySummary, SalesSummary, AIDailySummary, UploadStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import AIQueryBox from "@/components/ai/AIQueryBox";

interface InsightsPanelProps {
  analytics: VideoAnalytics | null;
  inventory: InventorySummary | null;
  sales: SalesSummary | null;
  sessionId: number | null;
  processingStatus: UploadStatus;
}

export default function InsightsPanel({
  analytics,
  inventory,
  sales,
  sessionId,
  processingStatus,
}: InsightsPanelProps) {
  const [localInventory, setLocalInventory] = useState<InventorySummary | null>(inventory);
  const [localSales, setLocalSales] = useState<SalesSummary | null>(sales);
  const [summary, setSummary] = useState<AIDailySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Auto-load demo data
  useEffect(() => {
    async function loadDefaults() {
      try {
        const [inv, s] = await Promise.all([getInventory(), getSalesSummary()]);
        setLocalInventory(inv);
        setLocalSales(s);
      } catch { /* backend not running — component shows skeletons */ }
    }
    loadDefaults();
  }, []);

  useEffect(() => { if (inventory) setLocalInventory(inventory); }, [inventory]);
  useEffect(() => { if (sales) setLocalSales(sales); }, [sales]);

  useEffect(() => {
    if (processingStatus !== "done") return;
    setLoadingSummary(true);
    getDailySummary(sessionId ?? undefined)
      .then(setSummary)
      .catch(() => { })
      .finally(() => setLoadingSummary(false));
  }, [processingStatus, sessionId]);

  const inv = localInventory;
  const sl = localSales;
  const an = analytics;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflowY: "auto",
        height: "100%",
      }}
    >
      {/* Metric Cards Grid */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: "var(--color-text)" }}>
          Today's Overview
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <MetricCard
            icon={<Users size={14} />}
            label="Total Customers"
            value={an ? an.total_customers.toString() : "184"}
            color="var(--color-accent)"
          />
          <MetricCard
            icon={<UserCheck size={14} />}
            label="In Store Now"
            value={an ? an.current_customers.toString() : "7"}
            color="#10B981"
          />
          <MetricCard
            icon={<IndianRupee size={14} />}
            label="Revenue"
            value={sl ? formatCurrency(sl.today_revenue) : "₹7,844"}
            color="var(--color-accent)"
          />
          <MetricCard
            icon={<Percent size={14} />}
            label="Conversion"
            value={sl ? `${sl.conversion_rate ?? 73.4}%` : "73.4%"}
            color="#10B981"
          />
          <MetricCard
            icon={<ShoppingCart size={14} />}
            label="Items Sold"
            value={sl ? sl.total_items_sold.toString() : "312"}
            color="var(--color-accent)"
          />
          <MetricCard
            icon={<Clock size={14} />}
            label="Avg. Dwell"
            value={an ? `${Math.round(an.avg_dwell_time_seconds / 60)}m` : "5m 42s"}
            color="#F59E0B"
          />
        </div>
      </div>

      {/* Queue + Peak */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <MetricCard
            icon={<BarChart2 size={14} />}
            label="Queue Length"
            value={an ? `${an.queue_length}` : "3"}
            color={an && an.queue_length > 5 ? "#EF4444" : "#F59E0B"}
          />
          <MetricCard
            icon={<TrendingUp size={14} />}
            label="Peak Hour"
            value={an?.peak_hour ?? "17:00"}
            color="var(--color-accent)"
          />
        </div>
      </div>

      {/* Inventory Alerts */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <AlertTriangle size={14} color="#F59E0B" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>Stock Alerts</span>
          {inv && (
            <span className="badge badge-warning" style={{ marginLeft: "auto" }}>
              {inv.low_stock_count + inv.out_of_stock_count} items
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(inv?.alerts ?? MOCK_ALERTS).slice(0, 4).map((alert) => (
            <div
              key={alert.product_name}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 10px",
                background: "#FAFAFA",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500 }}>{alert.product_name}</span>
              <span
                className={`badge ${alert.alert_type === "out_of_stock" ? "badge-danger" : "badge-warning"}`}
              >
                {alert.alert_type === "out_of_stock" ? "Out of stock" : `${alert.current_stock} left`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Products */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Top Sellers</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(sl?.top_products ?? MOCK_TOP_PRODUCTS).slice(0, 4).map((p, i) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: i === 0 ? "var(--color-accent)" : "var(--color-border)",
                  color: i === 0 ? "#fff" : "var(--color-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.name}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-muted)", flexShrink: 0 }}>
                {typeof (p as { revenue?: number }).revenue === "number"
                  ? formatCurrency((p as { revenue: number }).revenue)
                  : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Mic Status */}
      <div
        className="card"
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: processingStatus === "done" ? "#D1FAE5" : "#F3F4F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Mic size={15} color={processingStatus === "done" ? "#10B981" : "#9CA3AF"} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Audio Recognition</div>
          <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
            {processingStatus === "done" ? "Hindi + English · Hinglish supported" : "Waiting for video upload"}
          </div>
        </div>
        <span
          className={`badge ${processingStatus === "done" ? "badge-success" : "badge-muted"}`}
          style={{ marginLeft: "auto", flexShrink: 0 }}
        >
          {processingStatus === "done" ? "Active" : "Idle"}
        </span>
      </div>

      {/* AI Summary */}
      {loadingSummary && (
        <div className="card" style={{ padding: 16 }}>
          <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 12, width: "100%", marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 12, width: "80%" }} />
        </div>
      )}
      {summary && !loadingSummary && (
        <div className="card fade-in" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>AI Daily Report</div>
          <p style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {summary.summary}
          </p>
        </div>
      )}

      {/* AI Query Box */}
      <AIQueryBox sessionId={sessionId} />
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, color, marginBottom: 4 }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)" }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>{value}</div>
    </div>
  );
}

// ── Mock data for demo ────────────────────────────────────────────────

const MOCK_ALERTS = [
  { product_name: "Parle-G Biscuit", current_stock: 0, reorder_level: 20, alert_type: "out_of_stock" },
  { product_name: "Amul Milk 500ml", current_stock: 12, reorder_level: 20, alert_type: "low_stock" },
  { product_name: "Lays Chips", current_stock: 8, reorder_level: 15, alert_type: "low_stock" },
  { product_name: "Amul Butter 100g", current_stock: 5, reorder_level: 10, alert_type: "low_stock" },
];

const MOCK_TOP_PRODUCTS = [
  { name: "Amul Milk 500ml", quantity: 48, revenue: 1344 },
  { name: "Maggi Noodles", quantity: 55, revenue: 770 },
  { name: "Lays Chips", quantity: 40, revenue: 800 },
  { name: "Coca Cola 250ml", quantity: 36, revenue: 720 },
];
