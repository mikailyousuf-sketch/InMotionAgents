"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  MessageCircle,
  Phone,
  RadioTower,
  Settings2,
  ShieldCheck
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

const catalog = [
  {
    provider: "whatsapp",
    name: "WhatsApp Business",
    short: "WA",
    category: "Messaging",
    description: "Connect the WhatsApp number your customers already use.",
    icon: MessageCircle,
    href: "/integrations/whatsapp",
    fields: []
  },
  {
    provider: "voice",
    name: "Phone / Voice",
    short: "VO",
    category: "Calls",
    description: "Answer calls, summarize them and hand over when needed.",
    icon: Phone,
    fields: [
      { key: "phone_number", label: "Business phone number" },
      { key: "provider_name", label: "Telephony provider" }
    ]
  },
  {
    provider: "inmotion_booking",
    name: "InMotion Booking",
    short: "IM",
    category: "Scheduling",
    description: "Native InMotion availability and booking engine.",
    icon: CalendarDays,
    fields: []
  },
  {
    provider: "google_calendar",
    name: "Google Calendar",
    short: "G",
    category: "Calendar",
    description: "Sync business availability with Google Calendar.",
    icon: CalendarDays,
    fields: [{ key: "calendar_id", label: "Calendar ID" }]
  },
  {
    provider: "outlook",
    name: "Outlook Calendar",
    short: "O",
    category: "Calendar",
    description: "Connect Microsoft Outlook scheduling.",
    icon: CalendarDays,
    fields: [{ key: "calendar_id", label: "Calendar ID" }]
  },
  {
    provider: "playtomic",
    name: "Playtomic",
    short: "P",
    category: "Sports",
    description: "Court availability and booking integration.",
    icon: RadioTower,
    fields: [{ key: "external_business_id", label: "External business ID" }]
  },
  {
    provider: "custom_api",
    name: "Custom API",
    short: "API",
    category: "Developer",
    description: "Connect a business-owned REST API.",
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [whatsappHealth, setWhatsappHealth] = useState<any>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const current = await fetch("/api/workspace/current").then(r => r.json());
      const id = current.business?.id;
      if (!id) return;

      setBusinessId(id);

      const [data, wa] = await Promise.all([
        fetch(`/api/integrations?businessId=${id}`, { cache: "no-store" }).then(r => r.json()),
        fetch(`/api/integrations/whatsapp/status?businessId=${id}`, { cache: "no-store" })
          .then(r => r.json())
          .catch(() => null)
      ]);

      setRole(data.role || "");
      setIntegrations(data.integrations ?? []);
      setWhatsappHealth(wa);

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

  const connectedItems = useMemo(() => {
    return catalog.filter(item => {
      if (item.provider === "whatsapp") return whatsappHealth?.state === "connected";
      return byProvider[item.provider]?.status === "connected";
    });
  }, [byProvider, whatsappHealth]);

  function healthFor(provider: string) {
    if (provider === "whatsapp") {
      if (whatsappHealth?.state === "connected") return { label: "Healthy", kind: "healthy" };
      if (byProvider.whatsapp?.status === "connected" || whatsappHealth?.state === "needs_reconnection") {
        return { label: "Needs attention", kind: "warning" };
      }
      return { label: "Not connected", kind: "idle" };
    }

    const connection = byProvider[provider];
    if (connection?.status === "connected") return { label: "Healthy", kind: "healthy" };
    if (connection?.status === "setup_required") return { label: "Setup needed", kind: "warning" };
    return { label: "Not connected", kind: "idle" };
  }

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

    if (response.ok) await load();
  }

  const editable = ["owner","admin"].includes(role);

  return (
    <AppShell>
      <div className="connections-hub">
        <header className="connections-hub-header">
          <div>
            <div className="eyebrow">Business connections</div>
            <h1>Connections</h1>
            <p>Plug InMotion into the tools your business already uses.</p>
          </div>
        </header>

        <section className="connected-overview">
          <div className="connected-overview-head">
            <div>
              <span className="section-kicker">Live connections</span>
              <h2>Currently connected</h2>
            </div>
            <span className="connected-count">{connectedItems.length} active</span>
          </div>

          {loading ? (
            <div className="connected-health-grid">
              <div className="health-skeleton" />
              <div className="health-skeleton" />
            </div>
          ) : connectedItems.length === 0 ? (
            <div className="connected-empty">
              <ShieldCheck size={18} />
              <div>
                <strong>No live connections yet</strong>
                <span>Choose an app below to connect your first service.</span>
              </div>
            </div>
          ) : (
            <div className="connected-health-grid">
              {connectedItems.map(item => {
                const health = healthFor(item.provider);
                return (
                  <button
                    key={item.provider}
                    className="health-card"
                    onClick={() => setExpanded(item.provider)}
                  >
                    <div className="app-logo compact">{item.short}</div>
                    <div className="health-card-copy">
                      <strong>{item.name}</strong>
                      <span>{item.category}</span>
                    </div>
                    <div className={`health-badge ${health.kind}`}>
                      <i />
                      {health.label}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="app-library">
          <div className="app-library-head">
            <div>
              <span className="section-kicker">App library</span>
              <h2>Connect an app</h2>
            </div>
            <p>Click an icon to open its setup.</p>
          </div>

          <div className="app-icon-grid">
            {catalog.map(item => {
              const health = healthFor(item.provider);
              const isOpen = expanded === item.provider;

              return (
                <button
                  key={item.provider}
                  className={`app-launcher ${isOpen ? "open" : ""}`}
                  onClick={() => setExpanded(isOpen ? null : item.provider)}
                  aria-expanded={isOpen}
                >
                  <div className="app-logo">{item.short}</div>
                  <strong>{item.name}</strong>
                  <span>{item.category}</span>
                  <div className={`app-mini-health ${health.kind}`}><i /></div>
                </button>
              );
            })}
          </div>

          {expanded && (() => {
            const item = catalog.find(entry => entry.provider === expanded)!;
            const existing = byProvider[item.provider];
            const connected = item.provider === "whatsapp"
              ? whatsappHealth?.state === "connected"
              : existing?.status === "connected";
            const health = healthFor(item.provider);
            const Icon = item.icon;

            return (
              <div className="app-expand-panel glass-surface">
                <div className="app-expand-head">
                  <div className="app-expand-identity">
                    <div className="app-logo large">{item.short}</div>
                    <div>
                      <span>{item.category}</span>
                      <h2>{item.name}</h2>
                      <p>{item.description}</p>
                    </div>
                  </div>

                  <button className="app-collapse" onClick={() => setExpanded(null)}>
                    <ChevronUp size={16} />
                  </button>
                </div>

                <div className="app-expand-meta">
                  <div>
                    <span>Status</span>
                    <strong className={`health-text ${health.kind}`}>
                      <i /> {health.label}
                    </strong>
                  </div>
                  <div>
                    <span>Connection</span>
                    <strong>{connected ? "Active" : "Available"}</strong>
                  </div>
                  <div>
                    <span>Type</span>
                    <strong>{item.category}</strong>
                  </div>
                </div>

                {item.fields.length > 0 && (
                  <div className="app-expand-fields">
                    {item.fields.map(field => (
                      <label key={field.key}>
                        <span>{field.label}</span>
                        <input
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
                      </label>
                    ))}
                  </div>
                )}

                <div className="app-expand-actions">
                  {item.provider === "whatsapp" ? (
                    <a href="/integrations/whatsapp" className="connection-primary">
                      {connected ? "Manage WhatsApp" : "Connect WhatsApp"}
                      <ArrowUpRight size={13} />
                    </a>
                  ) : editable ? (
                    <>
                      <button onClick={() => save(item.provider, connected ? "setup_required" : "connected")}>
                        {connected ? "Edit setup" : "Connect"}
                      </button>
                      {existing && (
                        <button
                          className="connection-secondary"
                          onClick={() => save(item.provider, "disconnected")}
                        >
                          Disconnect
                        </button>
                      )}
                    </>
                  ) : null}

                  {status[item.provider] && (
                    <span className="app-action-status">
                      <Settings2 size={12} /> {status[item.provider]}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      </div>
    </AppShell>
  );
}
