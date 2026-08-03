import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format seconds to MM:SS */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Format a float timestamp (seconds) to HH:MM:SS */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Format currency in INR */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format a large number compactly */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Get language label */
export function getLanguageLabel(lang: string): string {
  const map: Record<string, string> = {
    hi: "Hindi",
    en: "English",
    hinglish: "Hinglish",
    unknown: "Unknown",
  };
  return map[lang] ?? lang;
}

/** Color for detection label */
export const LABEL_COLORS: Record<string, string> = {
  customer: "#2563EB",
  employee: "#10B981",
  shelf: "#6B7280",
  cash_counter: "#F59E0B",
  product: "#8B5CF6",
};

export function getLabelColor(label: string): string {
  return LABEL_COLORS[label] ?? "#6B7280";
}
