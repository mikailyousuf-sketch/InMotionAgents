"use client";

import { useEffect, useState } from "react";

export default function ConversationDetailClient({ conversationId }: { conversationId: string }) {
  const [status, setStatus] = useState("loading");
  const [messages, setMessages] = useState<any[]>([]);

  async function refresh() {
    const response = await fetch(`/api/conversations/${conversationId}`);
    const data = await response.json();
    setStatus(data.conversation?.status ?? "unknown");
    setMessages(data.messages ?? []);
  }

  useEffect(() => {
    refresh();
  }, [conversationId]);

  async function act(action: "takeover" | "return_to_ai" | "close") {
    await fetch("/api/handover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, action })
    });
    refresh();
  }

  return (
    <div>
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div className="muted">Status</div>
            <strong>{status}</strong>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {status !== "human" && status !== "closed" && <button onClick={() => act("takeover")}>Take over</button>}
            {status === "human" && <button onClick={() => act("return_to_ai")}>Return to AI</button>}
            {status !== "closed" && <button onClick={() => act("close")}>Close</button>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Messages</h3>
        {messages.length === 0 ? <p className="muted">No messages yet.</p> : messages.map((message) => (
          <div key={message.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <strong>{message.sender_type}</strong>
            <div style={{ marginTop: 4 }}>{message.content}</div>
            <div className="muted" style={{ fontSize: 12 }}>{new Date(message.created_at).toLocaleString("en-ZA")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
