"use client";

import { useState, useRef } from "react";
import { Send, Bot, Loader2, Sparkles } from "lucide-react";
import { queryAI } from "@/lib/api";

interface AIQueryBoxProps {
  sessionId: number | null;
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "Why were sales low today?",
  "What should I restock urgently?",
  "When is the busiest hour?",
  "Which customers left without buying?",
];

export default function AIQueryBox({ sessionId }: AIQueryBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function sendQuery(query: string) {
    if (!query.trim() || loading) return;
    const q = query.trim();
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const res = await queryAI(q, sessionId ?? undefined);
      setMessages((prev) => [...prev, { role: "assistant", text: res.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Could not reach AI service. Check that the backend is running." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="card"
      style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Sparkles size={14} color="var(--color-accent)" />
        <span style={{ fontWeight: 600, fontSize: 13 }}>Ask StoreSense AI</span>
      </div>

      {/* Suggestions */}
      {messages.length === 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="btn-ghost"
              style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6 }}
              onClick={() => sendQuery(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div
          style={{
            maxHeight: 200,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className="fade-in"
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.55,
                background: m.role === "user" ? "#EFF6FF" : "#F9FAFB",
                color: m.role === "user" ? "#1e40af" : "var(--color-text)",
                border: `1px solid ${m.role === "user" ? "#BFDBFE" : "var(--color-border)"}`,
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "95%",
              }}
            >
              {m.role === "assistant" && (
                <div style={{ display: "flex", gap: 4, marginBottom: 4, alignItems: "center" }}>
                  <Bot size={11} color="var(--color-accent)" />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-muted)" }}>AI</span>
                </div>
              )}
              {m.text}
            </div>
          ))}
          {loading && (
            <div
              className="fade-in"
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 12,
                background: "#F9FAFB",
                border: "1px solid var(--color-border)",
                display: "flex",
                gap: 6,
                alignItems: "center",
                color: "var(--color-muted)",
              }}
            >
              <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />
              Thinking…
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask a business question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendQuery(input)}
          style={{
            flex: 1,
            padding: "7px 10px",
            fontSize: 12,
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            outline: "none",
            fontFamily: "inherit",
            color: "var(--color-text)",
          }}
        />
        <button
          className="btn-primary"
          style={{ padding: "7px 12px" }}
          onClick={() => sendQuery(input)}
          disabled={loading || !input.trim()}
        >
          {loading ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Send size={13} />}
        </button>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
