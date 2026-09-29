"use client";

import { useEffect, useRef, useState } from "react";

export default function ConversationDetailClient({ conversationId }: { conversationId: string }) {
  const [status, setStatus] = useState("loading");
  const [channel, setChannel] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [handoverSummary, setHandoverSummary] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function refresh() {
    const [conversationResponse, notesResponse] = await Promise.all([
      fetch(`/api/conversations/${conversationId}`),
      fetch(`/api/conversations/notes?conversationId=${conversationId}`)
    ]);

    const data = await conversationResponse.json();
    const notesData = await notesResponse.json();

    setStatus(data.conversation?.status ?? "unknown");
    setChannel(data.conversation?.channel ?? "");
    setAssignedUserId(data.conversation?.assigned_user_id ?? "");
    setMessages(data.messages ?? []);
    setCustomer(data.customer ?? null);
    setBookings(data.bookings ?? []);
    setTeam(data.team ?? []);
    setNotes(notesData.notes ?? []);
    setHandoverSummary(data.handoverSummary ?? null);

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

  async function assign(userId: string) {
    setAssignedUserId(userId);

    const response = await fetch("/api/conversations/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId,
        assignedUserId: userId || null
      })
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Could not assign conversation");
      await refresh();
    }
  }

  async function addNote() {
    const body = note.trim();
    if (!body) return;

    const response = await fetch("/api/conversations/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, body })
    });

    if (response.ok) {
      setNote("");
      refresh();
    }
  }

  return (
    <div className="receptionist-workspace">
      <section>
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div className="muted">Status</div>
              <strong>{status}</strong>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Channel: {channel || "unknown"}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={assignedUserId} onChange={(e) => assign(e.target.value)}>
                <option value="">Unassigned</option>
                {team.map((member: any) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.full_name} · {member.role}
                  </option>
                ))}
              </select>

              {status !== "human" && status !== "closed" && <button onClick={() => act("takeover")}>Take over</button>}
              {status === "human" && <button onClick={() => act("return_to_ai")}>Return to AI</button>}
              {status !== "closed" && <button className="link-button" onClick={() => act("close")}>Close</button>}
            </div>
          </div>
        </div>

        {status === "human" && handoverSummary && (
          <div className="card handover-summary-card" style={{ marginTop: 16 }}>
            <div className="eyebrow">AI handover summary</div>
            <h3 style={{ marginTop: 0 }}>What staff need to know</h3>
            <div className="handover-summary-grid">
              <div><span>Customer wants</span><strong>{handoverSummary.customer_request || "Human assistance"}</strong></div>
              <div><span>AI already did</span><strong>{handoverSummary.ai_actions || "Reviewed the conversation"}</strong></div>
              <div><span>Blocker</span><strong>{handoverSummary.blocker || handoverSummary.reason || "Human judgment required"}</strong></div>
              <div><span>Next action</span><strong>{handoverSummary.suggested_next_action || "Review and reply to the customer"}</strong></div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Conversation</h3>

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

              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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

      <aside className="receptionist-sidebar">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Customer</h3>
          {customer ? (
            <div className="context-list">
              <div><span className="muted">Name</span><strong>{customer.full_name || "Unknown"}</strong></div>
              <div><span className="muted">Phone</span><strong>{customer.phone || "—"}</strong></div>
              <div><span className="muted">Email</span><strong>{customer.email || "—"}</strong></div>
              <div><span className="muted">Lead status</span><strong>{customer.lead_status || "new"}</strong></div>
              <div><span className="muted">Source</span><strong>{customer.source || channel || "—"}</strong></div>
            </div>
          ) : (
            <p className="muted">No customer linked yet.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Bookings</h3>
          {bookings.length === 0 ? (
            <p className="muted">No bookings yet.</p>
          ) : bookings.map((booking: any) => {
            const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
            const resource = Array.isArray(booking.resources) ? booking.resources[0] : booking.resources;

            return (
              <div className="context-booking" key={booking.id}>
                <strong>{service?.name || "Booking"}</strong>
                <div className="muted">{new Date(booking.starts_at).toLocaleString("en-ZA")}</div>
                <div className="muted">{resource?.name || "Unassigned"} · {booking.status}</div>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Internal notes</h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for your team…"
          />
          <button style={{ marginTop: 8 }} onClick={addNote} disabled={!note.trim()}>
            Add note
          </button>

          <div style={{ marginTop: 14 }}>
            {notes.length === 0 ? (
              <p className="muted">No internal notes.</p>
            ) : notes.map((item: any) => (
              <div className="internal-note" key={item.id}>
                <div>{item.body}</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
                  {item.author_name} · {new Date(item.created_at).toLocaleString("en-ZA")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
