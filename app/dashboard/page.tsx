import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  CalendarDays,
  ChevronRight,
  Inbox,
  MessageSquareText,
  Sparkles,
  UserRoundCheck,
  UsersRound
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GlowingEffect } from "@/components/GlowingEffect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

function timeAgo(value:string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function DashboardPage() {
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const startOfDay = new Date();
  startOfDay.setHours(0,0,0,0);
  const startOfTomorrow = new Date(startOfDay);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const [
    { count: todayConversations },
    { count: activeLeads },
    { count: todayBookings },
    { count: handovers },
    { count: unread },
    { data: whatsapp },
    { count: serviceCount },
    { count: hoursCount },
    { data: recentConversations },
    { count: pendingSuggestions }
  ] = await Promise.all([
    supabase.from("conversations").select("*",{count:"exact",head:true})
      .eq("business_id",business.id).gte("started_at",startOfDay.toISOString()),
    supabase.from("customers").select("*",{count:"exact",head:true})
      .eq("business_id",business.id).in("lead_status",["warm","qualified"]),
    supabase.from("bookings").select("*",{count:"exact",head:true})
      .eq("business_id",business.id)
      .gte("starts_at",startOfDay.toISOString())
      .lt("starts_at",startOfTomorrow.toISOString()),
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
      .limit(6),
    supabase.from("knowledge_suggestions")
      .select("*",{count:"exact",head:true})
      .eq("business_id",business.id)
      .eq("status","pending")
  ]);

  const needsSetup = !serviceCount || !hoursCount || whatsapp?.status !== "connected";
  const attention = Number(handovers ?? 0) + Number(unread ?? 0);
  const receptionistReady = Boolean(serviceCount && hoursCount);

  const metrics = [
    {label:"Conversations",value:todayConversations ?? 0,icon:MessageSquareText,href:"/conversations"},
    {label:"Bookings",value:todayBookings ?? 0,icon:CalendarDays,href:"/bookings"},
    {label:"Active leads",value:activeLeads ?? 0,icon:UsersRound,href:"/customers"},
    {label:"Handovers",value:handovers ?? 0,icon:UserRoundCheck,href:"/conversations"}
  ];

  const quickActions = [
    {label:"Inbox",href:"/conversations",icon:Inbox},
    {label:"Bookings",href:"/bookings",icon:CalendarDays},
    {label:"Customers",href:"/customers",icon:UsersRound},
    {label:"Receptionist",href:"/receptionist",icon:Bot}
  ];

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />

      <div className="command-page">
        <header className="command-topbar">
          <div>
            <div className="command-business-name">{business.name}</div>
            <div className="command-date">
              {new Intl.DateTimeFormat("en-ZA",{weekday:"long",day:"numeric",month:"long"}).format(new Date())}
            </div>
          </div>

          <div className="command-top-actions">
            {attention > 0 && (
              <Link href="/conversations" className="command-alert glass-chip">
                <span>{attention}</span> need attention
              </Link>
            )}
            <div className={`command-agent-status glass-chip ${receptionistReady ? "online" : ""}`}>
              <span className="status-orb" />
              AI Receptionist
              <strong>{receptionistReady ? "Online" : "Setup"}</strong>
            </div>
          </div>
        </header>

        <section className="command-metrics" aria-label="Today">
          {metrics.map(metric=>{
            const Icon = metric.icon;
            return (
              <GlowingEffect key={metric.label}>
                <Link href={metric.href} className="command-metric glass-surface">
                  <div className="command-metric-icon"><Icon size={19} strokeWidth={1.7} /></div>
                  <div>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                  <ArrowUpRight className="command-chevron" size={14} strokeWidth={1.7} />
                </Link>
              </GlowingEffect>
            );
          })}
        </section>

        <div className="command-grid">
          <GlowingEffect className="activity-panel-glow">
            <section className="command-panel activity-panel glass-surface">
            <div className="command-panel-head">
              <div>
                <div className="command-panel-title">
                  <h2>Live activity</h2>
                  <span className="live-indicator"><i /> Live</span>
                </div>
                <p>What your receptionist has been handling.</p>
              </div>
              <Link href="/conversations" className="command-text-link">View inbox <ArrowUpRight size={12} /></Link>
            </div>

            <div className="activity-list">
              {(recentConversations ?? []).length === 0 ? (
                <div className="command-empty">
                  <div className="command-empty-mark"><Sparkles size={18} strokeWidth={1.6} /></div>
                  <strong>Quiet for now</strong>
                  <span>New customer activity will appear here automatically.</span>
                </div>
              ) : (recentConversations ?? []).map((conversation:any) => {
                const customer = Array.isArray(conversation.customers)
                  ? conversation.customers[0]
                  : conversation.customers;
                const human = conversation.status === "human";
                return (
                  <Link href={`/conversations/${conversation.id}`} className="activity-row" key={conversation.id}>
                    <div className={`activity-rail ${human ? "human" : ""}`}><span /></div>
                    <div className="activity-icon">
                      {human ? <UserRoundCheck size={15} strokeWidth={1.7} /> : <MessageSquareText size={15} strokeWidth={1.7} />}
                    </div>
                    <div className="activity-copy">
                      <strong>{human ? "Handover requested" : "Customer conversation"}</strong>
                      <span>{customer?.full_name || customer?.phone || "Customer"} · {human ? "Waiting for your team" : "AI handling"}</span>
                    </div>
                    {(conversation.unread_for_staff ?? 0) > 0 && (
                      <span className="activity-unread">{conversation.unread_for_staff}</span>
                    )}
                    <time>{timeAgo(conversation.updated_at)}</time>
                    <ChevronRight className="activity-arrow" size={14} strokeWidth={1.6} />
                  </Link>
                );
              })}
            </div>
            </section>
          </GlowingEffect>

          <aside className="command-side">
            <GlowingEffect>
              <section className="command-panel glance-panel glass-surface">
              <div className="command-panel-head compact">
                <div>
                  <h2>Today at a glance</h2>
                  <p>Only the essentials.</p>
                </div>
              </div>
              <div className="glance-list">
                <div><span>Conversations</span><strong>{todayConversations ?? 0}</strong></div>
                <div><span>Bookings</span><strong>{todayBookings ?? 0}</strong></div>
                <div><span>Active leads</span><strong>{activeLeads ?? 0}</strong></div>
                <div><span>Handovers</span><strong>{handovers ?? 0}</strong></div>
              </div>
              </section>
            </GlowingEffect>

            <GlowingEffect>
              <section className="command-panel quick-panel glass-surface">
              <div className="command-panel-head compact">
                <div><h2>Quick actions</h2></div>
              </div>
              <div className="quick-grid">
                {quickActions.map(item=>{
                  const Icon = item.icon;
                  return (
                    <Link href={item.href} key={item.label}>
                      <span><Icon size={17} strokeWidth={1.7} /></span>
                      <strong>{item.label}</strong>
                    </Link>
                  );
                })}
              </div>
              </section>
            </GlowingEffect>

            {(needsSetup || pendingSuggestions) && (
              <section className="command-nudge glass-surface">
                <span><Sparkles size={15} strokeWidth={1.7} /></span>
                <div>
                  <strong>{needsSetup ? "Finish setup" : "Receptionist can improve"}</strong>
                  <p>
                    {needsSetup
                      ? "Complete your business setup before going fully live."
                      : `${pendingSuggestions} suggestion${pendingSuggestions === 1 ? "" : "s"} waiting for review.`}
                  </p>
                </div>
                <Link href={needsSetup ? "/settings" : "/improve"}>Open <ArrowUpRight size={11} /></Link>
              </section>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
