import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [{ data: events }, { data: subscription }] = await Promise.all([
    supabase
      .from("usage_events")
      .select("event_type,quantity,created_at")
      .eq("business_id", business.id)
      .gte("created_at", start),
    supabase
      .from("business_subscriptions")
      .select("status,plans(name,code,limits)")
      .eq("business_id", business.id)
      .maybeSingle()
  ]);

  const totals = (events ?? []).reduce<Record<string, number>>((acc, event: any) => {
    acc[event.event_type] = (acc[event.event_type] ?? 0) + Number(event.quantity ?? 0);
    return acc;
  }, {});

  const cards = [
    ["Agent turns", totals.agent_turn ?? 0],
    ["Inbound messages", totals.message_inbound ?? 0],
    ["Outbound messages", totals.message_outbound ?? 0],
    ["Bookings created", totals.booking_created ?? 0]
  ];

  const plan: any = Array.isArray((subscription as any)?.plans)
    ? (subscription as any)?.plans?.[0]
    : (subscription as any)?.plans;

  return (
    <AppShell>
      <h1>Usage</h1>
      <p className="muted">{business.name} · current month</p>

      <div className="grid cols-4" style={{ marginTop: 24 }}>
        {cards.map(([label, value]) => (
          <div className="card" key={String(label)}>
            <div className="muted">{label}</div>
            <div className="kpi">{value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Subscription foundation</h3>
        <p><strong>{plan?.name ?? "Development"}</strong> · {subscription?.status ?? "trial"}</p>
        <p className="muted">
          Billing is not active yet. This page is already tracking the usage units we can later attach to plan limits and overages.
        </p>
      </div>
    </AppShell>
  );
}
