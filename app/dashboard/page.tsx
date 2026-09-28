import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const startOfDay = new Date();
  startOfDay.setHours(0,0,0,0);

  const [
    { count: todayConversations },
    { count: activeLeads },
    { count: todayBookings },
    { count: handovers },
    { count: unread },
    { data: whatsapp },
    { count: serviceCount },
    { count: hoursCount },
    { data: recentConversations }
  ] = await Promise.all([
    supabase.from("conversations").select("*",{count:"exact",head:true})
      .eq("business_id",business.id).gte("started_at",startOfDay.toISOString()),
    supabase.from("customers").select("*",{count:"exact",head:true})
      .eq("business_id",business.id).in("lead_status",["warm","qualified"]),
    supabase.from("bookings").select("*",{count:"exact",head:true})
      .eq("business_id",business.id).gte("starts_at",startOfDay.toISOString()),
    supabase.from("conversations").select("*",{count:"exact",head:true})
      .eq("business_id",business.id).eq("status","human"),
    supabase.from("conversations").select("*",{count:"exact",head:true})
      .eq("business_id",business.id).gt("unread_for_staff",0),
    supabase.from("integration_connections").select("status")
      .eq("business_id",business.id).eq("provider","whatsapp").maybeSingle(),
    supabase.from("services").select("*",{count:"exact",head:true})
      .eq("business_id",business.id).eq("active",true),
    supabase.from("business_hours").select("*",{count:"exact",head:true})
      .eq("business_id",business.id),
    supabase.from("conversations")
      .select("id,status,updated_at,unread_for_staff,customers(full_name,phone)")
      .eq("business_id",business.id)
      .order("updated_at",{ascending:false})
      .limit(5)
  ]);

  const needsSetup = [
    !serviceCount ? { label:"Add your services", href:"/settings" } : null,
    !hoursCount ? { label:"Set your opening hours", href:"/settings" } : null,
    whatsapp?.status !== "connected" ? { label:"Connect WhatsApp", href:"/integrations" } : null
  ].filter(Boolean) as {label:string;href:string}[];

  const attention = Number(handovers ?? 0) + Number(unread ?? 0);
  const receptionistReady = serviceCount && hoursCount;

  return (
    <AppShell>
      <div className="home-header">
        <div>
          <div className="eyebrow">Your AI receptionist</div>
          <h1>{business.name}</h1>
          <p className="muted">Everything that matters, without the admin clutter.</p>
        </div>
        <div className={`receptionist-health ${receptionistReady ? "online" : "setup"}`}>
          <span className="health-dot" />
          {receptionistReady ? "Receptionist ready" : "Finish setup"}
        </div>
      </div>

      {attention > 0 && (
        <Link href="/conversations" className="attention-banner">
          <div>
            <strong>{attention} item{attention === 1 ? "" : "s"} need attention</strong>
            <div className="muted">Open the inbox to handle waiting customers.</div>
          </div>
          <span>Open inbox →</span>
        </Link>
      )}

      <div className="home-metrics">
        <div className="metric-clean">
          <span>Conversations today</span>
          <strong>{todayConversations ?? 0}</strong>
        </div>
        <div className="metric-clean">
          <span>Bookings</span>
          <strong>{todayBookings ?? 0}</strong>
        </div>
        <div className="metric-clean">
          <span>Active leads</span>
          <strong>{activeLeads ?? 0}</strong>
        </div>
        <div className="metric-clean">
          <span>Human handovers</span>
          <strong>{handovers ?? 0}</strong>
        </div>
      </div>

      <div className="home-grid">
        <section className="card home-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent conversations</h2>
              <p className="muted">Your receptionist’s latest customer activity.</p>
            </div>
            <Link href="/conversations" className="text-link">View inbox</Link>
          </div>

          {(recentConversations ?? []).length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◌</div>
              <strong>No conversations yet</strong>
              <p className="muted">Customer conversations will appear here automatically.</p>
            </div>
          ) : (recentConversations ?? []).map((conversation:any) => {
            const customer = Array.isArray(conversation.customers)
              ? conversation.customers[0]
              : conversation.customers;

            return (
              <Link href={`/conversations/${conversation.id}`} key={conversation.id} className="conversation-preview">
                <div>
                  <strong>{customer?.full_name || customer?.phone || "Customer"}</strong>
                  <div className="muted">
                    {conversation.status === "human" ? "Needs human help" : "AI handling"}
                  </div>
                </div>
                <div className="preview-right">
                  {(conversation.unread_for_staff ?? 0) > 0 && (
                    <span className="unread-count">{conversation.unread_for_staff}</span>
                  )}
                  <span className="muted">{new Date(conversation.updated_at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</span>
                </div>
              </Link>
            );
          })}
        </section>

        <aside className="home-side">
          {needsSetup.length > 0 ? (
            <div className="card setup-card">
              <div className="setup-icon">✦</div>
              <h3>Finish setting up</h3>
              <p className="muted">A few things will make your receptionist fully operational.</p>
              <div className="setup-list">
                {needsSetup.map(item=>(
                  <Link href={item.href} key={item.label}>
                    <span>{item.label}</span><span>→</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="card setup-card complete">
              <div className="setup-icon">✓</div>
              <h3>You’re ready</h3>
              <p className="muted">Your business profile is configured. Your receptionist is ready to handle customers.</p>
              <Link href="/" className="primary-link">Test your receptionist</Link>
            </div>
          )}

          <div className="card quick-card">
            <h3>Quick actions</h3>
            <Link href="/conversations">Open inbox <span>→</span></Link>
            <Link href="/settings">Update business info <span>→</span></Link>
            <Link href="/automations">Manage follow-ups <span>→</span></Link>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
