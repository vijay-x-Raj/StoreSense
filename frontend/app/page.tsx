"use client";

import { useState, useCallback, useRef } from "react";
import Navbar from "@/components/layout/Navbar";
import VideoPanel from "@/components/video/VideoPanel";
import InsightsPanel from "@/components/insights/InsightsPanel";
import AnalyticsTabs from "@/components/analytics/AnalyticsTabs";
import { useLiveCamera } from "@/lib/useLiveCamera";
import type { VideoAnalytics, InventorySummary, SalesSummary } from "@/lib/types";

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<VideoAnalytics | null>(null);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [activeTab, setActiveTab] = useState("customers");

  // Live camera state is lifted here so Navbar and VideoPanel share it
  const [cameraState, cameraControls, setVideoEl] = useLiveCamera(
    useCallback((a: VideoAnalytics) => setAnalytics(a), [])
  );

  const handleInventoryLoaded = useCallback((data: InventorySummary) => {
    setInventory(data);
  }, []);

  const handleSalesLoaded = useCallback((data: SalesSummary) => {
    setSales(data);
  }, []);

  const processingStatus = cameraState.isLive
    ? "live"
    : cameraState.isStarting
    ? "processing"
    : "idle";

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      {/* Top Navbar */}
      <Navbar
        isLive={cameraState.isLive}
        isStarting={cameraState.isStarting}
        sessionId={cameraState.sessionId}
        frameCount={cameraState.frameCount}
        onStartCamera={cameraControls.start}
        onStopCamera={cameraControls.stop}
        onInventoryLoaded={handleInventoryLoaded}
        onSalesLoaded={handleSalesLoaded}
      />

      {/* Main Layout: Video | Sidebar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "16px",
          padding: "16px",
          height: "calc(100vh - 57px - 56px)",
          maxHeight: "calc(100vh - 113px)",
        }}
      >
        {/* Left: Live Camera Panel */}
        <VideoPanel
          cameraState={cameraState}
          cameraControls={cameraControls}
          setVideoEl={setVideoEl}
        />

        {/* Right: Insights Sidebar */}
        <InsightsPanel
          analytics={analytics}
          inventory={inventory}
          sales={sales}
          sessionId={cameraState.sessionId}
          processingStatus={processingStatus as "idle" | "uploading" | "processing" | "live" | "done" | "error"}
        />
      </div>

      {/* Bottom: Analytics Tabs */}
      <div style={{ padding: "0 16px 16px" }}>
        <AnalyticsTabs
          sessionId={cameraState.sessionId}
          analytics={analytics}
          inventory={inventory}
          sales={sales}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          liveTranscript={cameraState.transcript}
          isMicActive={cameraState.isMicActive}
        />
      </div>
    </div>
  );
}
