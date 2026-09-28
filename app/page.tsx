"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Message = { role: "user" | "assistant"; content: string };

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi 👋 I’m the Northstar Dental receptionist. How can I help?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<{ name: string; slug: string }[]>([]);
  const [businessSlug, setBusinessSlug] = useState("northstar-dental");

  useEffect(() => {
    fetch("/api/businesses")
      .then((response) => response.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => {});
  }, []);

  async function sendMessage() {
    const value = input.trim();
    if (!value || loading) return;

    const next = [...messages, { role: "user" as const, content: value }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, conversationId, businessSlug })
      });
      const data = await response.json();
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((current) => [...current, { role: "assistant", content: data.message ?? "Something went wrong." }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "I could not reach the agent service." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="chat">
        <h1>Agent Simulator</h1>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <p className="muted">Internal test channel</p>
          <select
            value={businessSlug}
            onChange={(e) => {
              setBusinessSlug(e.target.value);
              setConversationId(null);
              setMessages([{ role: "assistant", content: "Hi 👋 How can I help?" }]);
            }}
          >
            {businesses.map((business) => (
              <option key={business.slug} value={business.slug}>{business.name}</option>
            ))}
          </select>
        </div>
        <div className="messages">
          {messages.map((message, index) => (
            <div className={`bubble ${message.role}`} key={index}>{message.content}</div>
          ))}
          {loading && <div className="bubble assistant">Thinking…</div>}
        </div>
        <div className="chatbar">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask: What time do you close on Friday?"
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </AppShell>
  );
}
