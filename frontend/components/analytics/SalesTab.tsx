"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import type { SalesSummary } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { IndianRupee, ShoppingCart, TrendingUp, Percent, UploadCloud } from "lucide-react";

const PIE_COLORS = ["#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE", "#DBEAFE"];

const TOOLTIP_STYLE = {
  background: "#fff",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  padding: "8px 12px",
};

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
      <UploadCloud size={32} style={{ opacity: 0.3 }} />
      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>No sales data yet</div>
      <div style={{ fontSize: 12, textAlign: "center", maxWidth: 280 }}>
        Upload a sales CSV using the toolbar above to see revenue charts, top products, and conversion metrics.
      </div>
    </div>
  );
}

export default function SalesTab({ sales }: { sales: SalesSummary | null }) {
  // If no data loaded at all, show empty state
  if (!sales) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <EmptyState />
      </div>
    );
  }

  const d = sales;
  const hasRevenue = d.today_revenue > 0;
  const hasProducts = d.top_products.length > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {/* KPI Row */}
      <div
        style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}
      >
        {[
          {
            icon: <IndianRupee size={14} />,
            label: "Today's Revenue",
            value: hasRevenue ? formatCurrency(d.today_revenue) : "₹0.00",
            accent: hasRevenue,
          },
          {
            icon: <ShoppingCart size={14} />,
            label: "Items Sold",
            value: d.total_items_sold.toString(),
          },
          {
            icon: <TrendingUp size={14} />,
            label: "Avg Basket Size",
            value: d.avg_basket_size > 0 ? formatCurrency(d.avg_basket_size) : "—",
          },
          {
            icon: <Percent size={14} />,
            label: "Conversion Rate",
            value: d.conversion_rate != null ? `${d.conversion_rate}%` : "—",
            warn: d.conversion_rate != null && d.conversion_rate < 60,
          },
        ].map(({ icon, label, value, accent, warn }) => (
          <div
            key={label}
            style={{
              background: accent ? "var(--color-accent)" : "#F9FAFB",
              border: `1px solid ${accent ? "var(--color-accent)" : "var(--color-border)"}`,
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div style={{ color: accent ? "rgba(255,255,255,0.7)" : warn ? "#EF4444" : "var(--color-accent)", marginBottom: 4 }}>
              {icon}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: accent ? "#fff" : warn ? "#EF4444" : "var(--color-text)" }}>{value}</div>
            <div style={{ fontSize: 11, color: accent ? "rgba(255,255,255,0.7)" : "var(--color-muted)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Revenue by Hour */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Revenue by Hour</div>
        {!hasRevenue ? (
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
            No revenue recorded today
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.revenue_by_hour} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={36}
                tickFormatter={(v) => `₹${v}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(Number(v ?? 0))} />
              <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Products Pie */}
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Product Revenue Share</div>
        {!hasProducts ? (
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
            No products sold today
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={d.top_products}
                dataKey="revenue"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
              >
                {d.top_products.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCurrency(Number(v ?? 0))} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(val) => <span style={{ fontSize: 11, color: "var(--color-text)" }}>{val}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Products Table */}
      {hasProducts && (
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Top Products</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
                <th>Revenue Share</th>
              </tr>
            </thead>
            <tbody>
              {d.top_products.map((p, i) => {
                const total = d.top_products.reduce((s, x) => s + x.revenue, 0);
                const pct = total > 0 ? (p.revenue / total) * 100 : 0;
                return (
                  <tr key={p.name}>
                    <td style={{ color: "var(--color-muted)", fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>{p.quantity}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(p.revenue)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="progress-bar" style={{ flex: 1, maxWidth: 80 }}>
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--color-muted)", minWidth: 32 }}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
