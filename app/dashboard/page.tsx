import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();

  const [
    { count: conversationCount },
    { count: leadCount },
    { count: bookingCount },
    { count: handoverCount }
  ] = await Promise.all([
    supabase.from("conversations").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }).in("lead_status", ["warm", "qualified"]),
    supabase.from("bookings").select("*", { count: "exact", head: true }).in("status", ["pending", "confirmed"]),
    supabase.from("conversations").select("*", { count: "exact", head: true }).eq("status", "human")
  ]);

  const cards = [
    ["Conversations", String(conversationCount ?? 0)],
    ["Active leads", String(leadCount ?? 0)],
    ["Bookings", String(bookingCount ?? 0)],
    ["Human handovers", String(handoverCount ?? 0)]
  ];

  return (
    <AppShell>
      <h1>Dashboard</h1>
      <p className="muted">Northstar Dental · Demo workspace</p>
      <div className="grid cols-4" style={{ marginTop: 24 }}>
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <div className="muted">{label}</div>
            <div className="kpi">{value}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Current milestone</h3>
        <p className="status"><span className="dot" /> AI + bookings + CRM + human handover working</p>
        <p className="muted">Next: automatic customer identity/lead updates and WhatsApp transport layer.</p>
      </div>
    </AppShell>
  );
}
