"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CalendarDays,
  Check,
  CircleUserRound,
  Clock3,
  Mail,
  MessageSquareText,
  NotebookPen,
  Phone,
  Send,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  X
} from "lucide-react";

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
      body: JSON.stringify({ conversationId, assignedUserId: userId || null })
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

  const human = status === "human";
  const closed = status === "closed";

  return (
    <div className="conversation-workspace">
      <section className="conversation-main-column">
        <div className="conversation-toolbar glass-surface">
          <div className="conversation-identity">
            <div className="conversation-avatar"><CircleUserRound size={19} strokeWidth={1.7} /></div>
            <div>
              <strong>{customer?.full_name || customer?.phone || "Customer"}</strong>
              <span>{channel || "unknown"} conversation</span>
            </div>
          </div>

          <div className="conversation-controls">
            <div className={`conversation-status ${human ? "human" : status}`}>
              <span className="state-dot" />
              {human ? "Human handling" : closed ? "Closed" : "AI handling"}
            </div>

            <select className="conversation-assignee" value={assignedUserId} onChange={(e) => assign(e.target.value)}>
              <option value="">Unassigned</option>
              {team.map((member:any)=>(
                <option key={member.user_id} value={member.user_id}>
                  {member.full_name} · {member.role}
                </option>
              ))}
            </select>

            {!human && !closed && (
              <button className="conversation-action primary" onClick={()=>act("takeover")}>
                <UserRoundCheck size={14} /> Take over
              </button>
            )}
            {human && (
              <button className="conversation-action primary" onClick={()=>act("return_to_ai")}>
                <Bot size={14} /> Return to AI
              </button>
            )}
            {!closed && (
              <button className="conversation-action ghost" onClick={()=>act("close")}>
                <X size={14} /> Close
              </button>
            )}
          </div>
        </div>

        {human && handoverSummary && (
          <section className="handover-glass glass-surface">
            <div className="handover-title">
              <span><Sparkles size={15} /></span>
              <div>
                <strong>AI handover summary</strong>
                <p>Everything staff need before replying.</p>
              </div>
            </div>
            <div className="handover-grid">
              <div><span>Customer wants</span><strong>{handoverSummary.customer_request || "Human assistance"}</strong></div>
              <div><span>AI already did</span><strong>{handoverSummary.ai_actions || "Reviewed the conversation"}</strong></div>
              <div><span>Blocker</span><strong>{handoverSummary.blocker || handoverSummary.reason || "Human judgment required"}</strong></div>
              <div><span>Next action</span><strong>{handoverSummary.suggested_next_action || "Review and reply to the customer"}</strong></div>
            </div>
          </section>
        )}

        <section className="conversation-thread-panel glass-surface">
          <div className="conversation-thread-head">
            <div>
              <h2>Messages</h2>
              <p>Live transcript · updates every few seconds</p>
            </div>
            <span><MessageSquareText size={14} /> {messages.length}</span>
          </div>

          <div className="conversation-thread">
            {messages.length === 0 ? (
              <div className="conversation-thread-empty">
                <MessageSquareText size={20} strokeWidth={1.5} />
                <span>No messages yet.</span>
              </div>
            ) : messages.map((item:any)=>(
              <div key={item.id} className={`conversation-message ${item.sender_type === "customer" ? "incoming" : "outgoing"}`}>
                <div className="conversation-message-meta">
                  <strong>{item.sender_type === "human" ? "Staff" : item.sender_type === "assistant" ? "Receptionist" : "Customer"}</strong>
                  <span>{new Date(item.created_at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</span>
                </div>
                <div className="conversation-message-body">{item.content}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {!closed && (
            <div className="conversation-composer">
              <textarea
                value={message}
                onChange={(e)=>setMessage(e.target.value)}
                onKeyDown={(e)=>{
                  if(e.key === "Enter" && !e.shiftKey){
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder={channel === "whatsapp" ? "Reply to customer on WhatsApp…" : "Reply as staff…"}
              />
              <div className="conversation-composer-footer">
                <span>Enter to send · Shift+Enter for new line</span>
                <button onClick={sendReply} disabled={sending || !message.trim()}>
                  <Send size={14} /> {sending ? "Sending…" : "Send reply"}
                </button>
              </div>
              {error && <p className="conversation-error">{error}</p>}
            </div>
          )}
        </section>
      </section>

      <aside className="conversation-context-column">
        <section className="context-glass glass-surface">
          <div className="context-head">
            <UsersRound size={15} />
            <h3>Customer</h3>
          </div>

          {customer ? (
            <div className="context-details">
              <div><span><CircleUserRound size={13} /> Name</span><strong>{customer.full_name || "Unknown"}</strong></div>
              <div><span><Phone size={13} /> Phone</span><strong>{customer.phone || "—"}</strong></div>
              <div><span><Mail size={13} /> Email</span><strong>{customer.email || "—"}</strong></div>
              <div><span><UserRoundCheck size={13} /> Lead status</span><strong className="context-value-pill">{customer.lead_status || "new"}</strong></div>
            </div>
          ) : <p className="context-empty">No customer linked yet.</p>}
        </section>

        <section className="context-glass glass-surface">
          <div className="context-head">
            <CalendarDays size={15} />
            <h3>Bookings</h3>
          </div>
          {bookings.length === 0 ? (
            <p className="context-empty">No bookings yet.</p>
          ) : bookings.map((booking:any)=>{
            const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
            const resource = Array.isArray(booking.resources) ? booking.resources[0] : booking.resources;
            return (
              <div className="context-booking-card" key={booking.id}>
                <strong>{service?.name || "Booking"}</strong>
                <span><Clock3 size={12} /> {new Date(booking.starts_at).toLocaleString("en-ZA")}</span>
                <span>{resource?.name || "Unassigned"} · {booking.status}</span>
              </div>
            );
          })}
        </section>

        <section className="context-glass glass-surface">
          <div className="context-head">
            <NotebookPen size={15} />
            <h3>Internal notes</h3>
          </div>

          <div className="note-composer">
            <textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Add a private note for your team…" />
            <button onClick={addNote} disabled={!note.trim()}><Check size={13} /> Add note</button>
          </div>

          <div className="note-list">
            {notes.length === 0 ? (
              <p className="context-empty">No internal notes.</p>
            ) : notes.map((item:any)=>(
              <div className="context-note" key={item.id}>
                <p>{item.body}</p>
                <span>{item.author_name} · {new Date(item.created_at).toLocaleString("en-ZA")}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
