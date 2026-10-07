"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Link2,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export default function OutlookConnectPage() {
  const [businessId, setBusinessId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("Checking Outlook…");
  const [connected, setConnected] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [calendars, setCalendars] = useState<any[]>([]);
  const [calendarStatus, setCalendarStatus] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const current = await fetch("/api/workspace/current").then(r => r.json());
        const id = current.business?.id;
        if (!id) {
          setStatus("No workspace selected.");
          return;
        }

        setBusinessId(id);
        const live = await fetch(`/api/integrations/outlook/status?businessId=${id}`, {
          cache: "no-store"
        }).then(r => r.json());

        setRole(live.role || "");
        if (live.state === "connected") {
          setConnected(live.meta);
          setStatus("Outlook Calendar is connected and ready.");
          const list = await fetch(`/api/integrations/outlook/calendars?businessId=${id}`, {
            cache: "no-store"
          }).then(r => r.json()).catch(() => ({ calendars: [] }));
          setCalendars(list.calendars || []);
        } else {
          setConnected(null);
          setStatus(live.reason || "Connect Outlook so InMotion can see busy times and create appointments.");
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get("connected") === "1") {
          setStatus("Outlook Calendar connected successfully.");
        } else if (params.get("error")) {
          setStatus("Microsoft connection did not finish. Try connecting again.");
        }
      } catch {
        setStatus("Could not check the Outlook connection.");
      } finally {
        setChecking(false);
      }
    }

    load();
  }, []);

  async function selectCalendar(calendarId: string) {
    if (!businessId || !calendarId || busy) return;
    setBusy(true);
    setCalendarStatus("Switching calendar…");

    const response = await fetch("/api/integrations/outlook/calendars", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, calendarId })
    });
    const data = await response.json();

    if (response.ok) {
      setConnected((current: any) => ({
        ...(current || {}),
        calendar_id: data.calendar.id,
        calendar_name: data.calendar.name
      }));
      setCalendarStatus("Calendar updated.");
    } else {
      setCalendarStatus(data.error || "Could not switch calendar.");
    }

    setBusy(false);
  }

  async function disconnect() {
    if (!businessId || busy) return;
    setBusy(true);
    setStatus("Disconnecting Outlook…");

    const response = await fetch(
      `/api/integrations/outlook/status?businessId=${businessId}`,
      { method: "DELETE" }
    );
    const data = await response.json();

    if (response.ok) {
      setConnected(null);
      setStatus("Outlook disconnected. InMotion Booking is active again.");
    } else {
      setStatus(data.error || "Could not disconnect Outlook.");
    }

    setBusy(false);
  }

  const editable = ["owner", "admin"].includes(role);
  const connectHref = businessId
    ? `/api/integrations/outlook/connect?businessId=${encodeURIComponent(businessId)}`
    : "#";

  return (
    <AppShell>
      <div className="whatsapp-connect-page">
        <a href="/integrations" className="whatsapp-back">
          <ArrowLeft size={14} /> Connections
        </a>

        <header className="whatsapp-connect-header">
          <div>
            <div className="eyebrow">Calendar connection</div>
            <h1>Outlook Calendar</h1>
            <p>
              Connect Microsoft 365 or Outlook. InMotion keeps your booking rules,
              checks the calendar for busy times and adds confirmed appointments automatically.
            </p>
          </div>

          <div className={`whatsapp-status-pill ${connected ? "connected" : ""}`}>
            <span />
            {checking ? "Checking" : connected ? "Connected" : "Not connected"}
          </div>
        </header>

        <div className="whatsapp-connect-layout">
          <section className="whatsapp-primary-panel glass-surface">
            <div className="whatsapp-panel-icon">
              <CalendarDays size={22} strokeWidth={1.7} />
            </div>

            <div className="whatsapp-primary-copy">
              <span>Microsoft Graph</span>
              <h2>{connected ? "Your calendar is live" : "Connect your work calendar"}</h2>
              <p>
                {connected
                  ? "Your receptionist now checks Outlook before offering times and mirrors new InMotion bookings into this calendar."
                  : "Sign in with Microsoft once. InMotion only asks for the calendar access needed to manage appointments."}
              </p>
            </div>

            {connected ? (
              <>
              <div className="whatsapp-connected-details">
                <div>
                  <span>Microsoft account</span>
                  <strong>{connected.account_name || "Microsoft account"}</strong>
                </div>
                <div>
                  <span>Email</span>
                  <strong>{connected.account_email || "Connected account"}</strong>
                </div>
                <div>
                  <span>Calendar</span>
                  <strong>{connected.calendar_name || "Calendar"}</strong>
                </div>
                <div>
                  <span>Booking engine</span>
                  <strong><CheckCircle2 size={13} /> Outlook + InMotion</strong>
                </div>
              </div>

              {calendars.length > 0 && (
                <div className="app-expand-fields" style={{ marginTop: 18 }}>
                  <label>
                    <span>Calendar InMotion should use</span>
                    <select
                      value={connected.calendar_id || ""}
                      onChange={(event) => selectCalendar(event.target.value)}
                      disabled={!editable || busy}
                    >
                      {calendars.filter(calendar => calendar.canEdit).map(calendar => (
                        <option key={calendar.id} value={calendar.id}>
                          {calendar.name}{calendar.isDefault ? " · Default" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {calendarStatus && <span className="app-action-status">{calendarStatus}</span>}
                </div>
              )}
              </>
            ) : (
              <div className="whatsapp-steps">
                <div>
                  <span>1</span>
                  <div><strong>Sign in with Microsoft</strong><small>Choose the account that owns the business calendar.</small></div>
                </div>
                <div>
                  <span>2</span>
                  <div><strong>Allow calendar access</strong><small>Microsoft handles the secure authorization screen.</small></div>
                </div>
                <div>
                  <span>3</span>
                  <div><strong>Start booking</strong><small>Busy times are blocked and new appointments are added automatically.</small></div>
                </div>
              </div>
            )}

            <div className="whatsapp-action-row">
              {connected ? (
                <>
                  <button className="whatsapp-connect-button" disabled>
                    <Check size={15} /> Outlook connected
                  </button>
                  {editable && (
                    <button
                      type="button"
                      className="connection-secondary"
                      onClick={disconnect}
                      disabled={busy}
                    >
                      Disconnect
                    </button>
                  )}
                </>
              ) : (
                <a
                  className="whatsapp-connect-button"
                  href={editable && businessId ? connectHref : undefined}
                  aria-disabled={!editable || !businessId}
                >
                  <Link2 size={15} /> Connect Microsoft
                </a>
              )}
            </div>

            {status && (
              <div className={`whatsapp-status-message ${connected ? "success" : ""}`}>
                <Sparkles size={13} />
                <span>{status}</span>
              </div>
            )}
          </section>

          <aside className="whatsapp-side-stack">
            <section className="whatsapp-side-panel glass-surface">
              <div className="whatsapp-side-heading"><CalendarDays size={16} /><strong>One calendar, two jobs</strong></div>
              <p>Outlook blocks real-world busy times. InMotion still controls services, hours, resources and booking rules.</p>
            </section>

            <section className="whatsapp-side-panel glass-surface">
              <div className="whatsapp-side-heading"><ShieldCheck size={16} /><strong>Secure OAuth</strong></div>
              <p>Your Microsoft password never enters InMotion. Access tokens are encrypted server-side and refreshed automatically.</p>
            </section>

            <section className="whatsapp-side-panel quiet">
              <span>First version</span>
              <p>We connect one primary calendar per business. Staff-specific calendar mapping can be added without changing the booking engine.</p>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
