import { Activity, CalendarCheck2, MessageSquareText, Send } from "lucide-react";
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
    supabase.from("usage_events").select("event_type,quantity,created_at").eq("business_id", business.id).gte("created_at", start),
    supabase.from("business_subscriptions").select("status,plans(name,code,limits)").eq("business_id", business.id).maybeSingle()
  ]);

  const totals = (events ?? []).reduce<Record<string, number>>((acc, event: any) => {
    acc[event.event_type] = (acc[event.event_type] ?? 0) + Number(event.quantity ?? 0);
    return acc;
  }, {});

  const cards = [
    {label:"Agent turns",value:totals.agent_turn ?? 0,icon:Activity},
    {label:"Inbound messages",value:totals.message_inbound ?? 0,icon:MessageSquareText},
    {label:"Outbound messages",value:totals.message_outbound ?? 0,icon:Send},
    {label:"Bookings created",value:totals.booking_created ?? 0,icon:CalendarCheck2}
  ];

  const plan:any=Array.isArray((subscription as any)?.plans)?(subscription as any)?.plans?.[0]:(subscription as any)?.plans;

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one"/>
      <div className="ambient-orb ambient-orb-two"/>
      <div className="ambient-grid"/>

      <div className="section-page command-page">
        <header className="section-header">
          <div>
            <div className="eyebrow">Usage</div>
            <h1>This month</h1>
            <p>{business.name} · usage across conversations, messaging and bookings.</p>
          </div>
          <div className="section-stat glass-chip">
            <Activity size={15}/>
            <span><strong>{plan?.name ?? "Development"}</strong> plan</span>
          </div>
        </header>

        <section className="usage-clean-grid">
          {cards.map(item=>{
            const Icon=item.icon;
            return (
              <div className="usage-clean-card glass-surface" key={item.label}>
                <span><Icon size={17} strokeWidth={1.7}/></span>
                <div>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </div>
              </div>
            );
          })}
        </section>

        <section className="section-panel glass-surface usage-plan-card">
          <div className="section-panel-head">
            <div>
              <h2>Subscription</h2>
              <p>Billing foundation and usage tracking.</p>
            </div>
          </div>
          <div className="usage-plan-body">
            <div><span>Plan</span><strong>{plan?.name ?? "Development"}</strong></div>
            <div><span>Status</span><strong>{subscription?.status ?? "trial"}</strong></div>
          </div>
          <p className="usage-note">Billing is not active yet. Usage is already being tracked so plan limits and overages can be attached later.</p>
        </section>
      </div>
    </AppShell>
  );
}
