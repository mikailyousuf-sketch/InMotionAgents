"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";

const catalog = [
  {
    provider: "whatsapp",
    name: "WhatsApp Business",
    description: "Connect Meta WhatsApp Business Platform for real inbound and outbound customer messages.",
    fields: [
      { key: "phone_number_id", label: "Phone number ID" },
      { key: "whatsapp_business_account_id", label: "WhatsApp Business Account ID" }
    ]
  },
  {
    provider: "voice",
    name: "Phone / Voice",
    description: "Connect your business phone line so the same receptionist can answer calls, summarize them and hand over when needed.",
    fields: [
      { key: "phone_number", label: "Business phone number" },
      { key: "provider_name", label: "Telephony provider" }
    ]
  },
  {
    provider: "inmotion_booking",
    name: "InMotion Booking",
    description: "Use the native InMotion scheduling engine as the booking source of truth.",
    fields: []
  },
  {
    provider: "google_calendar",
    name: "Google Calendar",
    description: "External booking adapter placeholder for Google Calendar.",
    fields: [{ key: "calendar_id", label: "Calendar ID" }]
  },
  {
    provider: "outlook",
    name: "Outlook Calendar",
    description: "External booking adapter placeholder for Microsoft Outlook.",
    fields: [{ key: "calendar_id", label: "Calendar ID" }]
  },
  {
    provider: "playtomic",
    name: "Playtomic",
    description: "Future Playtomic booking adapter for padel and racket-sport businesses.",
    fields: [{ key: "external_business_id", label: "External business ID" }]
  },
  {
    provider: "custom_api",
    name: "Custom API",
    description: "Connect a business-owned REST API through the standard InMotion adapter layer.",
    fields: [{ key: "base_url", label: "Base URL" }]
  }
];

export default function IntegrationsPage() {
  const [businessId, setBusinessId] = useState("");
  const [role, setRole] = useState("");
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<string,string>>>({});
  const [status, setStatus] = useState<Record<string,string>>({});

  useEffect(() => { load(); }, []);

  async function load() {
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
  }

  const byProvider = useMemo(() => {
    const map: Record<string, any> = {};
    for (const integration of integrations) map[integration.provider] = integration;
    return map;
  }, [integrations]);

  async function save(provider: string, nextStatus: "connected" | "setup_required" | "disconnected") {
    setStatus(current => ({ ...current, [provider]: "Saving..." }));

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
      <h1>Integrations</h1>
      <p className="muted">Connect messaging, booking and external business systems.</p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", marginTop: 24 }}>
        {catalog.map((item) => {
          const existing = byProvider[item.provider];
          const currentStatus = existing?.status || "disconnected";

          return (
            <div className="card" key={item.provider}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{item.name}</h3>
                  <p className="muted">{item.description}</p>
                </div>
                <span className="integration-status">{currentStatus}</span>
              </div>

              <div className="form-grid">
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

                {editable && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => save(item.provider, "setup_required")}>Save setup</button>
                    <button onClick={() => save(item.provider, "connected")}>Mark connected</button>
                    {existing && <button className="link-button" onClick={() => save(item.provider, "disconnected")}>Disconnect</button>}
                  </div>
                )}

                {status[item.provider] && <p className="muted">{status[item.provider]}</p>}

                {item.provider === "whatsapp" && (
                  <div style={{ marginTop: 8 }}>
                    <a href="/integrations/whatsapp" className="link-button">
                      Connect existing WhatsApp Business number →
                    </a>
                    <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                      Recommended: use Meta Embedded Signup to keep the WhatsApp Business app and connect InMotion through the official coexistence flow.
                    </p>
                  </div>
                )}

                {item.provider === "voice" && (
                  <p className="muted" style={{ fontSize: 12 }}>
                    The Calls workspace is ready. Live answering and transfers will be connected when we choose the production voice provider.
                  </p>
                )}

                {["google_calendar","outlook","playtomic"].includes(item.provider) && (
                  <p className="muted" style={{ fontSize: 12 }}>
                    Adapter UI is ready; OAuth/API connection logic will be added when we implement that provider.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
