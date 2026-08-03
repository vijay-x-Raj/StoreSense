"use client";

import { Download, FileText, FileSpreadsheet, BarChart3 } from "lucide-react";
import { getSalesCsvUrl, getInventoryCsvUrl, getTranscriptCsvUrl } from "@/lib/api";

interface ReportsTabProps {
  sessionId: number | null;
}

const REPORT_ITEMS = (sessionId: number | null) => [
  {
    icon: <FileText size={18} />,
    title: "Transcript Report",
    desc: "Full timestamped transcript with speaker labels and language detection.",
    label: "CSV",
    url: sessionId ? getTranscriptCsvUrl(sessionId) : "#",
    disabled: !sessionId,
  },
  {
    icon: <FileSpreadsheet size={18} />,
    title: "Sales Report",
    desc: "All sales transactions with product, quantity, revenue, and timestamps.",
    label: "CSV",
    url: getSalesCsvUrl(),
    disabled: false,
  },
  {
    icon: <BarChart3 size={18} />,
    title: "Inventory Report",
    desc: "Current stock levels, reorder status, and supplier information.",
    label: "CSV",
    url: getInventoryCsvUrl(),
    disabled: false,
  },
];

export default function ReportsTab({ sessionId }: ReportsTabProps) {
  const items = REPORT_ITEMS(sessionId);

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Export Reports</div>
      <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 20 }}>
        Download store analytics data in CSV format for external reporting.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {items.map(({ icon, title, desc, label, url, disabled }) => (
          <div
            key={title}
            style={{
              background: "#F9FAFB",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <div style={{ color: "var(--color-accent)" }}>{icon}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.5 }}>{desc}</div>
            </div>
            {disabled ? (
              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>Upload video first</span>
            ) : (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{ textDecoration: "none", justifyContent: "center", fontSize: 12 }}
              >
                <Download size={13} />
                Download {label}
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Info */}
      <div
        className="alert-banner alert-banner-info"
        style={{ marginTop: 20 }}
      >
        <FileText size={14} />
        PDF export coming in v2. All data is computed in real time from your uploads.
      </div>
    </div>
  );
}
