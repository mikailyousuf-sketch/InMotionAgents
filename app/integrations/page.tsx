"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Cable,
  CheckCircle2,
  Code2,
  MessageCircle,
  Phone,
  RadioTower,
  Settings2
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

const catalog = [
  {
    provider: "whatsapp",
    name: "WhatsApp Business",
    eyebrow: "Messaging",
    description: "Connect an existing WhatsApp Business number to your InMotion receptionist.",
    icon: MessageCircle,
    actionLabel: "Open WhatsApp setup",
    href: "/integrations/whatsapp",
    fields: []
  },
  {
    provider: "voice",
    name: "Phone / Voice",
    eyebrow: "Calls",
    description: "Let the same receptionist answer calls, summarize conversations and hand over when needed.",
    icon: Phone,
    fields: [
      { key: "phone_number", label: "Business phone number" },
      { key: "provider_name", label: "Telephony provider" }
    ]
  },
  {
    provider: "inmotion_booking",
    name: "InMotion Booking",
    eyebrow: "Scheduling",
    description: "Use the built-in scheduling engine as the source of truth for availability and bookings.",
    icon: CalendarDays,
    fields: []
  },
  {
    provider: "google_calendar",
    name: "Google Calendar",
    eyebrow: "Calendar",
    description: "Sync availability and bookings with a connected Google Calendar.",
    icon: CalendarDays,
    fields: [{ key: "calendar_id", label: "Calendar ID" }]
  },
  {
    provider: "outlook",
    name: "Outlook Calendar",
    eyebrow: "Calendar",
    description: "Connect a Microsoft calendar to the InMotion booking adapter.",
    icon: CalendarDays,
    fields: [{ key: "calendar_id", label: "Calendar ID" }]
  },
  {
    provider: "playtomic",
    name: "Playtomic",
    eyebrow: "Sports",
    description: "Connect court availability and bookings for padel and racket-sport businesses.",
    icon: RadioTower,
    fields: [{ key: "external_business_id", label: "External business ID" }]
  },
  {
    provider: "custom_api",
    name: "Custom API",
    eyebrow: "Developer",
    description: "Connect a business-owned REST API through the standard InMotion adapter layer.",
    icon: Code2,
    fields: [{ key: "base_url", label: "Base URL" }]
  }
];

export default function IntegrationsPage() {
  const [businessId, setBusinessId] = useState("");
  const [role, setRole] = useState("");
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<string,string>>>({});
  const [status, setStatus] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const current = await fetch("/api/workspace/current").then(r => r.json());
      const id = current.business?.id;
      if (!id) return;

      setBusinessId(id);

      const data = await fetch(`/api/integrations?businessId=${id}`).then(r => r.json());
      setRole(data.role || "");
      setIntegrations(data.integrations ?? []);

      const nextDrafts: Record<string, Record<string,string>> = {};
      for (const integration of data.integrations ?? []) {
        nextDrafts[integration.provider] = integration.config ?? {};
      }
      setDrafts(nextDrafts);
    } finally {
      setLoading(false);
    }
  }

  const byProvider = useMemo(() => {
    const map: Record<string, any> = {};
    for (const integration of integrations) map[integration.provider] = integration;
    return map;
  }, [integrations]);

  async function save(provider: string, nextStatus: "connected" | "setup_required" | "disconnected") {
    setStatus(current => ({ ...current, [provider]: "Saving…" }));

    const response = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        provider,
        status: nextStatus,
        config: drafts[provider] ?? {}
      })
    });

    const data = await response.json();

    setStatus(current => ({
      ...current,
      [provider]: response.ok ? "Saved" : data.error || "Could not save"
    }));

    if (response.ok) load();
  }

  const editable = ["owner","admin"].includes(role);

  return (
    <AppShell>
      <div className="connections-page">
        <header className="connections-header">
          <div>
            <div className="eyebrow">Business connections</div>
            <h1>Connections</h1>
            <p>Give your receptionist access to the channels and systems your business already uses.</p>
          </div>
          <div className="connections-head-chip glass-chip">
            <Cable size={14} />
            <span>{integrations.filter(item => item.status === "connected").length} connected</span>
          </div>
        </header>

        <section className="connections-grid">
          {catalog.map((item) => {
            const existing = byProvider[item.provider];
            const currentStatus = existing?.status || "disconnected";
            const Icon = item.icon;
            const connected = currentStatus === "connected";

            return (
              <article className="connection-tile glass-surface" key={item.provider}>
                <div className="connection-tile-top">
                  <div className="connection-icon"><Icon size={19} strokeWidth={1.7} /></div>
                  <div className={`connection-state ${connected ? "connected" : ""}`}>
                    <span />
                    {connected ? "Connected" : currentStatus === "setup_required" ? "Setup needed" : "Not connected"}
                  </div>
                </div>

                <div className="connection-copy">
                  <span>{item.eyebrow}</span>
                  <h2>{item.name}</h2>
                  <p>{item.description}</p>
                </div>

                {loading ? (
                  <div className="connection-skeleton" aria-hidden="true">
                    <i /><i />
                  </div>
                ) : (
                  <>
                    {item.fields.length > 0 && (
                      <div className="connection-fields">
                        {item.fields.map((field) => (
                          <input
                            key={field.key}
                            disabled={!editable}
                            placeholder={field.label}
                            value={drafts[item.provider]?.[field.key] || ""}
                            onChange={(e) =>
                              setDrafts(current => ({
                                ...current,
                                [item.provider]: {
                                  ...(current[item.provider] ?? {}),
                                  [field.key]: e.target.value
                                }
                              }))
                            }
                          />
                        ))}
                      </div>
                    )}

                    <div className="connection-actions">
                      {item.provider === "whatsapp" ? (
                        <a href={item.href} className="connection-primary">
                          {connected ? "Manage WhatsApp" : item.actionLabel}
                          <ArrowUpRight size={13} />
                        </a>
                      ) : editable ? (
                        <>
                          <button onClick={() => save(item.provider, connected ? "setup_required" : "connected")}>
                            {connected ? "Edit setup" : "Connect"}
                          </button>
                          {existing && (
                            <button className="connection-secondary" onClick={() => save(item.provider, "disconnected")}>
                              Disconnect
                            </button>
                          )}
                        </>
                      ) : null}
                    </div>
                  </>
                )}

                {status[item.provider] && (
                  <div className="connection-inline-status">
                    <Settings2 size={12} />
                    {status[item.provider]}
                  </div>
                )}

                {connected && (
                  <div className="connection-confirmation">
                    <CheckCircle2 size={13} />
                    Ready for your receptionist
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
