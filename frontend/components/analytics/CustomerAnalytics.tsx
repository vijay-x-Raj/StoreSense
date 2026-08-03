"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import type { VideoAnalytics } from "@/lib/types";
import { Users, Clock, TrendingUp, UserCheck, Video } from "lucide-react";

const CUSTOM_TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  padding: "8px 12px",
};

// Empty hourly data template (real zeros)
const EMPTY_BY_HOUR = Array.from({ length: 14 }, (_, i) => ({
  hour: `${String(8 + i).padStart(2, "0")}:00`,
  customers: 0,
}));

function EmptyState() {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "48px 24px",
        background: "#F9FAFB",
        border: "1.5px dashed var(--color-border)",
        borderRadius: 12,
        color: "var(--color-muted)",
      }}
    >
      <Video size={32} style={{ opacity: 0.3 }} />
      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>No visitor data yet</div>
      <div style={{ fontSize: 12, textAlign: "center", maxWidth: 280 }}>
        Start the live camera or upload a video to begin tracking customers and dwell times.
      </div>
    </div>
  );
}

export default function CustomerAnalytics({ analytics }: { analytics: VideoAnalytics | null }) {
  // Show full empty state if no analytics loaded at all
  if (!analytics) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <EmptyState />
      </div>
    );
  }

  const data = analytics.customers_by_hour.length > 0 ? analytics.customers_by_hour : EMPTY_BY_HOUR;
  const total = analytics.total_customers;
  const current = analytics.current_customers;
  const dwell = analytics.avg_dwell_time_seconds;
  const queue = analytics.queue_length;

  const dwellMin = Math.floor(dwell / 60);
  const dwellSec = Math.floor(dwell % 60);
  const hasVisitors = total > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* Visitors per Hour Chart */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Visitors per Hour</div>
        {!hasVisitors ? (
          <div
            style={{
              height: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#F9FAFB",
              borderRadius: 10,
              color: "var(--color-muted)",
              fontSize: 12,
              border: "1px solid var(--color-border)",
            }}
          >
            No visitors tracked yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={CUSTOM_TOOLTIP_STYLE}
                cursor={{ fill: "#F9FAFB" }}
              />
              <Bar
                dataKey="customers"
                fill="#2563EB"
                radius={[4, 4, 0, 0]}
                name="Customers"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Customer Trend */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Cumulative Footfall</div>
        {!hasVisitors ? (
          <div
            style={{
              height: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#F9FAFB",
              borderRadius: 10,
              color: "var(--color-muted)",
              fontSize: 12,
              border: "1px solid var(--color-border)",
            }}
          >
            Footfall chart will appear once visitors are tracked
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={data.map((d, i) => ({
                ...d,
                cumulative: data.slice(0, i + 1).reduce((s, x) => s + x.customers, 0),
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip contentStyle={CUSTOM_TOOLTIP_STYLE} />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#2563EB"
                strokeWidth={2}
                dot={false}
                name="Total"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats Row */}
      <div
        style={{
          gridColumn: "1 / -1",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        {[
          {
            icon: <Users size={15} />,
            label: "Total Visitors",
            value: total.toString(),
          },
          {
            icon: <UserCheck size={15} />,
            label: "Currently In Store",
            value: current.toString(),
          },
          {
            icon: <Clock size={15} />,
            label: "Avg. Dwell Time",
            value: dwell > 0 ? `${dwellMin}m ${dwellSec}s` : "—",
          },
          {
            icon: <TrendingUp size={15} />,
            label: "Queue Length",
            value: queue.toString(),
            warn: queue > 5,
          },
        ].map(({ icon, label, value, warn }) => (
          <div
            key={label}
            style={{
              background: "#F9FAFB",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center", color: warn ? "#EF4444" : "var(--color-accent)", marginBottom: 6 }}>
              {icon}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: warn ? "#EF4444" : "var(--color-text)" }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
