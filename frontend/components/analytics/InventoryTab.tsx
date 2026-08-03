"use client";

import type { InventorySummary } from "@/lib/types";
import { AlertTriangle, Package, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const MOCK: InventorySummary = {
  total_items: 8,
  low_stock_count: 3,
  out_of_stock_count: 1,
  alerts: [
    { product_name: "Parle-G Biscuit",  current_stock: 0,  reorder_level: 20, alert_type: "out_of_stock" },
    { product_name: "Amul Milk 500ml",  current_stock: 12, reorder_level: 20, alert_type: "low_stock" },
    { product_name: "Lays Chips",       current_stock: 8,  reorder_level: 15, alert_type: "low_stock" },
    { product_name: "Amul Butter 100g", current_stock: 5,  reorder_level: 10, alert_type: "low_stock" },
  ],
  items: [
    { id: 1, product_name: "Amul Milk 500ml",   current_stock: 12, price: 28,  reorder_level: 20, category: "Dairy",       supplier: "Amul" },
    { id: 2, product_name: "Coca Cola 250ml",   current_stock: 45, price: 20,  reorder_level: 30, category: "Beverages",   supplier: "Coca Cola India" },
    { id: 3, product_name: "Lays Chips",        current_stock: 8,  price: 20,  reorder_level: 15, category: "Snacks",      supplier: "PepsiCo" },
    { id: 4, product_name: "Maggi Noodles",     current_stock: 30, price: 14,  reorder_level: 25, category: "Instant Food",supplier: "Nestle" },
    { id: 5, product_name: "Parle-G Biscuit",   current_stock: 0,  price: 10,  reorder_level: 20, category: "Snacks",      supplier: "Parle" },
    { id: 6, product_name: "Tata Salt 1kg",     current_stock: 22, price: 22,  reorder_level: 10, category: "Grocery",     supplier: "Tata" },
    { id: 7, product_name: "Amul Butter 100g",  current_stock: 5,  price: 55,  reorder_level: 10, category: "Dairy",       supplier: "Amul" },
    { id: 8, product_name: "Surf Excel 500g",   current_stock: 18, price: 85,  reorder_level: 10, category: "Household",   supplier: "Hindustan Unilever" },
  ],
};

export default function InventoryTab({ inventory }: { inventory: InventorySummary | null }) {
  const data = inventory ?? MOCK;

  function getStockStatus(item: InventorySummary["items"][0]) {
    if (item.current_stock <= 0) return "out";
    if (item.current_stock <= item.reorder_level) return "low";
    return "ok";
  }

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <SummaryCard
          icon={<Package size={14} />}
          label="Total SKUs"
          value={data.total_items}
          color="var(--color-accent)"
        />
        <SummaryCard
          icon={<AlertTriangle size={14} />}
          label="Low Stock"
          value={data.low_stock_count}
          color="#F59E0B"
        />
        <SummaryCard
          icon={<AlertTriangle size={14} />}
          label="Out of Stock"
          value={data.out_of_stock_count}
          color="#EF4444"
        />
        <SummaryCard
          icon={<CheckCircle2 size={14} />}
          label="In Stock"
          value={data.total_items - data.low_stock_count - data.out_of_stock_count}
          color="#10B981"
        />
      </div>

      {/* Table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Reorder At</th>
            <th>Price</th>
            <th>Supplier</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => {
            const status = getStockStatus(item);
            const pct = item.reorder_level > 0
              ? Math.min(100, (item.current_stock / (item.reorder_level * 2)) * 100)
              : 100;
            return (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                <td>
                  <span className="badge badge-muted">{item.category}</span>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, minWidth: 24 }}>{item.current_stock}</span>
                    <div style={{ flex: 1, maxWidth: 80 }}>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: status === "out" ? "#EF4444" : status === "low" ? "#F59E0B" : "#10B981",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ color: "var(--color-muted)" }}>{item.reorder_level}</td>
                <td style={{ fontWeight: 500 }}>{formatCurrency(item.price)}</td>
                <td style={{ color: "var(--color-muted)" }}>{item.supplier}</td>
                <td>
                  {status === "out" && <span className="badge badge-danger">Out of Stock</span>}
                  {status === "low" && <span className="badge badge-warning">Low Stock</span>}
                  {status === "ok"  && <span className="badge badge-success">In Stock</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div
      style={{
        background: "#F9FAFB",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flex: 1,
      }}
    >
      <div style={{ color }}>{icon}</div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)" }}>{value}</div>
        <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{label}</div>
      </div>
    </div>
  );
}
