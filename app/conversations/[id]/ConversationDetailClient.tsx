"use client";

import { useEffect, useRef, useState } from "react";

export default function ConversationDetailClient({ conversationId }: { conversationId: string }) {
  const [status, setStatus] = useState("loading");
  const [channel, setChannel] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function refresh() {
    const response = await fetch(`/api/conversations/${conversationId}`);
    const data = await response.json();
    setStatus(data.conversation?.status ?? "unknown");
    setChannel(data.conversation?.channel ?? "");
    setMessages(data.messages ?? []);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 20);
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [conversationId]);

  async function act(action: "takeover" | "return_to_ai" | "close") {
    await fetch("/api/handover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, action })
    });
    refresh();
  }

  async function sendReply() {
    const text = message.trim();
    if (!text || sending) return;

    setSending(true);
    setError("");

    const response = await fetch("/api/conversations/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, message: text })
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not send reply");
      setSending(false);
      return;
    }

    setMessage("");
    setSending(false);
    await refresh();
  }

  return (
    <div className="inbox-layout">
      <section>
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div className="muted">Status</div>
              <strong>{status}</strong>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Channel: {channel || "unknown"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {status !== "human" && status !== "closed" && <button onClick={() => act("takeover")}>Take over</button>}
              {status === "human" && <button onClick={() => act("return_to_ai")}>Return to AI</button>}
              {status !== "closed" && <button className="link-button" onClick={() => act("close")}>Close</button>}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Messages</h3>

          <div className="thread">
            {messages.length === 0 ? <p className="muted">No messages yet.</p> : messages.map((item) => (
              <div
                key={item.id}
                className={`thread-message ${item.sender_type === "customer" ? "incoming" : "outgoing"}`}
              >
                <div className="thread-sender">
                  {item.sender_type === "human" ? "Staff" : item.sender_type}
                </div>
                <div>{item.content}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
                  {new Date(item.created_at).toLocaleString("en-ZA")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {status !== "closed" && (
            <div className="staff-composer">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder={channel === "whatsapp" ? "Reply to customer on WhatsApp…" : "Reply as staff…"}
              />
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  Enter to send · Shift+Enter for new line
                </span>
                <button onClick={sendReply} disabled={sending || !message.trim()}>
                  {sending ? "Sending…" : "Send as staff"}
                </button>
              </div>
              {error && <p className="muted">{error}</p>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
