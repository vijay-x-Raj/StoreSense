"use client";

import CustomerAnalytics from "./CustomerAnalytics";
import InventoryTab from "./InventoryTab";
import SalesTab from "./SalesTab";
import TranscriptTab from "./TranscriptTab";
import ReportsTab from "./ReportsTab";
import type { VideoAnalytics, InventorySummary, SalesSummary, TranscriptLine } from "@/lib/types";
import { Users, Package, TrendingUp, MessageSquare, Download } from "lucide-react";

const TABS = [
  { id: "customers",  label: "Customer Analytics", icon: Users },
  { id: "inventory",  label: "Inventory",           icon: Package },
  { id: "sales",      label: "Sales",               icon: TrendingUp },
  { id: "transcript", label: "Transcript",          icon: MessageSquare },
  { id: "reports",    label: "Reports",             icon: Download },
] as const;

type TabId = typeof TABS[number]["id"];

interface AnalyticsTabsProps {
  sessionId: number | null;
  analytics: VideoAnalytics | null;
  inventory: InventorySummary | null;
  sales: SalesSummary | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  liveTranscript?: TranscriptLine[];
  isMicActive?: boolean;
}

export default function AnalyticsTabs({
  sessionId,
  analytics,
  inventory,
  sales,
  activeTab,
  onTabChange,
  liveTranscript,
  isMicActive,
}: AnalyticsTabsProps) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Tab list */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-border)",
          overflowX: "auto",
          padding: "0 4px",
          gap: 0,
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            data-active={activeTab === id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "11px 16px",
              border: "none",
              borderBottom: activeTab === id ? "2px solid var(--color-accent)" : "2px solid transparent",
              background: "transparent",
              color: activeTab === id ? "var(--color-accent)" : "var(--color-muted)",
              fontWeight: activeTab === id ? 600 : 500,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
              fontFamily: "inherit",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 20, minHeight: 240 }}>
        {activeTab === "customers"  && <CustomerAnalytics analytics={analytics} />}
        {activeTab === "inventory"  && <InventoryTab inventory={inventory} />}
        {activeTab === "sales"      && <SalesTab sales={sales} />}
        {activeTab === "transcript" && (
          <TranscriptTab
            sessionId={sessionId}
            liveTranscript={liveTranscript}
            isMicActive={isMicActive}
          />
        )}
        {activeTab === "reports"    && <ReportsTab sessionId={sessionId} />}
      </div>
    </div>
  );
}
