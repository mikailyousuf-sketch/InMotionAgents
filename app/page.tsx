"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  CircleDot,
  Eraser,
  FlaskConical,
  MessageSquareText,
  Play,
  RotateCcw,
  Sparkles,
  UserRound
} from "lucide-react";
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

  const businessName = useMemo(
    () => businesses.find((business) => business.slug === businessSlug)?.name || "Northstar Dental",
    [businesses, businessSlug]
  );

  async function sendMessage(valueOverride?: string) {
    const value = (valueOverride ?? input).trim();
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
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.message ?? "Something went wrong." }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "I could not reach the agent service." }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetRun() {
    setConversationId(null);
    setInput("");
    setMessages([{ role: "assistant", content: "Hi 👋 How can I help?" }]);
  }

  const scenarios = [
    "What time do you close on Friday?",
    "I need to move my booking to tomorrow.",
    "Can I get a refund?",
    "I want to book the earliest available appointment."
  ];

  const userTurns = messages.filter((message) => message.role === "user").length;
  const agentTurns = messages.filter((message) => message.role === "assistant").length;

  return (
    <AppShell>
      <div className="agent-lab-page">
        <header className="agent-lab-head">
          <div>
            <div className="eyebrow">Agent Lab</div>
            <h1>Test behaviour, not just replies.</h1>
            <p>Run realistic customer scenarios and watch how the agent responds turn by turn.</p>
          </div>

          <div className="agent-lab-live">
            <span className="status-orb" />
            Simulation ready
          </div>
        </header>

        <section className="agent-lab-toolbar glass-surface">
          <div className="agent-lab-business">
            <span><Building2 size={14} /> Business</span>
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

          <div className="agent-lab-session">
            <div>
              <span>Session</span>
              <strong>{conversationId ? conversationId.slice(0, 8) : "New run"}</strong>
            </div>
            <div>
              <span>Turns</span>
              <strong>{userTurns + agentTurns}</strong>
            </div>
            <div>
              <span>State</span>
              <strong>{loading ? "Thinking" : "Ready"}</strong>
            </div>
          </div>

          <button className="agent-lab-reset" onClick={resetRun}>
            <RotateCcw size={13} /> Reset run
          </button>
        </section>

        <div className="agent-lab-layout">
          <section className="agent-lab-console glass-surface">
            <div className="agent-lab-console-head">
              <div>
                <span>Scenario runner</span>
                <h2>{businessName}</h2>
              </div>
              <div className={`agent-lab-state ${loading ? "thinking" : ""}`}>
                <CircleDot size={12} />
                {loading ? "Agent processing" : "Awaiting customer"}
              </div>
            </div>

            <div className="agent-run-timeline">
              {messages.map((message, index) => (
                <article
                  className={`agent-run-event ${message.role === "user" ? "customer" : "agent"}`}
                  key={index}
                >
                  <div className="agent-run-rail">
                    <span>
                      {message.role === "user"
                        ? <UserRound size={14} />
                        : <Bot size={14} />}
                    </span>
                    {index < messages.length - 1 && <i />}
                  </div>

                  <div className="agent-run-content">
                    <div className="agent-run-meta">
                      <strong>{message.role === "user" ? "Customer" : "InMotion Agent"}</strong>
                      <span>Turn {index + 1}</span>
                    </div>
                    <p>{message.content}</p>
                  </div>
                </article>
              ))}

              {loading && (
                <article className="agent-run-event agent thinking-event">
                  <div className="agent-run-rail">
                    <span><Sparkles size={14} /></span>
                  </div>
                  <div className="agent-run-content">
                    <div className="agent-run-meta">
                      <strong>InMotion Agent</strong>
                      <span>Processing</span>
                    </div>
                    <div className="agent-thinking-bars"><i/><i/><i/></div>
                  </div>
                </article>
              )}
            </div>

            <div className="agent-lab-composer">
              <div className="agent-lab-input-wrap">
                <MessageSquareText size={16} />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) sendMessage();
                  }}
                  placeholder="Type the next customer message…"
                />
              </div>
              <button onClick={() => sendMessage()} disabled={!input.trim() || loading}>
                <Play size={14} /> Run turn
              </button>
            </div>
          </section>

          <aside className="agent-lab-inspector">
            <section className="agent-inspector-card glass-surface">
              <div className="agent-inspector-head">
                <Activity size={15} />
                <strong>Run health</strong>
              </div>

              <div className="agent-inspector-health">
                <div>
                  <span>Agent service</span>
                  <strong><CheckCircle2 size={12}/> Online</strong>
                </div>
                <div>
                  <span>Conversation</span>
                  <strong>{conversationId ? "Active" : "Not started"}</strong>
                </div>
                <div>
                  <span>Customer turns</span>
                  <strong>{userTurns}</strong>
                </div>
                <div>
                  <span>Agent turns</span>
                  <strong>{agentTurns}</strong>
                </div>
              </div>
            </section>

            <section className="agent-inspector-card glass-surface">
              <div className="agent-inspector-head">
                <FlaskConical size={15} />
                <strong>Scenario presets</strong>
              </div>
              <div className="agent-scenario-list">
                {scenarios.map((scenario) => (
                  <button key={scenario} onClick={() => sendMessage(scenario)} disabled={loading}>
                    <span>{scenario}</span>
                    <ArrowRight size={12} />
                  </button>
                ))}
              </div>
            </section>

            <section className="agent-inspector-card quiet">
              <div className="agent-inspector-head">
                <Eraser size={14} />
                <strong>Testing note</strong>
              </div>
              <p>This is an internal simulation channel. It runs the real agent logic without sending anything to WhatsApp.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
