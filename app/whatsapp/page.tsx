"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Row = { role: "customer" | "agent"; text: string };

export default function WhatsAppTestPage() {
  const [phone, setPhone] = useState("27820000000");
  const [name, setName] = useState("Mikail");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [businesses, setBusinesses] = useState<{ name: string; slug: string }[]>([]);
  const [businessSlug, setBusinessSlug] = useState("northstar-dental");

  useEffect(() => {
    fetch("/api/businesses")
      .then((response) => response.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => {});
  }, []);

  async function send() {
    const text = message.trim();
    if (!text || loading) return;

    setRows((current) => [...current, { role: "customer", text }]);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: phone,
          name,
          message: text,
          businessSlug
        })
      });

      const data = await response.json();

      setRows((current) => [
        ...current,
        {
          role: "agent",
          text: data.message || data.error || "No response"
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1>WhatsApp Transport Test</h1>
      <p className="muted">
        Simulates a WhatsApp customer using a real phone number identity without requiring Meta yet.
      </p>

      <div className="grid" style={{ gridTemplateColumns: "220px 1fr", marginTop: 24 }}>
        <div className="card">
          <label className="muted">Workspace</label>
          <select
            value={businessSlug}
            onChange={(e) => {
              setBusinessSlug(e.target.value);
              setRows([]);
            }}
            style={{ width: "100%", margin: "8px 0 16px", padding: 10 }}
          >
            {businesses.map((business) => (
              <option key={business.slug} value={business.slug}>{business.name}</option>
            ))}
          </select>

          <label className="muted">WhatsApp number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: "100%", margin: "8px 0 16px", padding: 10 }}
          />

          <label className="muted">Profile name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", marginTop: 8, padding: 10 }}
          />
        </div>

        <div className="card">
          <div style={{ minHeight: 320 }}>
            {rows.length === 0 ? (
              <p className="muted">Send a message to begin a WhatsApp-channel conversation.</p>
            ) : (
              rows.map((row, index) => (
                <div
                  key={index}
                  className={`bubble ${row.role === "customer" ? "user" : "assistant"}`}
                  style={{ margin: "10px 0", marginLeft: row.role === "customer" ? "auto" : 0 }}
                >
                  {row.text}
                </div>
              ))
            )}
          </div>

          <div className="chatbar">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a WhatsApp message..."
            />
            <button onClick={send}>{loading ? "..." : "Send"}</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
