import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StoreSense AI — Retail Intelligence Dashboard",
  description:
    "AI-powered multimodal retail assistant for Kirana stores. Analyze CCTV video, customer conversations, inventory, and sales in real time.",
  keywords: ["retail AI", "kirana store", "CCTV analytics", "inventory management", "sales analytics"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
