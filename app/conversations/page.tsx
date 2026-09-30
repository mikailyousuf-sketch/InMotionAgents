import Link from "next/link";
import { ArrowUpRight, Inbox, MessageSquareText, UserRoundCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

function relativeTime(value:string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function ConversationsPage() {
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id,status,channel,started_at,updated_at,assigned_user_id,unread_for_staff,customers(full_name,phone)")
    .eq("business_id", business.id)
    .order("status", { ascending: false })
    .order("unread_for_staff", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  const items = conversations ?? [];
  const humanCount = items.filter((item:any)=>item.status === "human").length;
  const unreadCount = items.reduce((sum:number,item:any)=>sum + Number(item.unread_for_staff ?? 0),0);
  const aiCount = items.filter((item:any)=>item.status === "ai").length;

  return (
    <AppShell>
      <div className="ambient-orb ambient-orb-one" />
      <div className="ambient-orb ambient-orb-two" />
      <div className="ambient-grid" />

      <div className="inbox-page command-page">
        <header className="inbox-header">
          <div>
            <div className="eyebrow">Customer conversations</div>
            <h1>Inbox</h1>
            <p>{business.name} · one place for AI and human-handled conversations.</p>
          </div>
          <div className="inbox-summary glass-chip">
            <span><strong>{humanCount}</strong> need attention</span>
            <i />
            <span><strong>{unreadCount}</strong> unread</span>
            <i />
            <span><strong>{aiCount}</strong> AI handling</span>
          </div>
        </header>

        <section className="inbox-queue glass-surface">
          <div className="inbox-queue-head">
            <div>
              <h2>Conversation queue</h2>
              <p>Waiting customers first, then the latest activity.</p>
            </div>
            <span>{items.length} total</span>
          </div>

          {items.length === 0 ? (
            <div className="inbox-empty">
              <span><Inbox size={20} strokeWidth={1.6} /></span>
              <strong>Your inbox is quiet</strong>
              <p>New conversations will show here as soon as customers start messaging.</p>
            </div>
          ) : (
            <div className="inbox-list">
              {items.map((conversation:any) => {
                const customer = Array.isArray(conversation.customers)
                  ? conversation.customers[0]
                  : conversation.customers;
                const human = conversation.status === "human";
                const unread = Number(conversation.unread_for_staff ?? 0);

                return (
                  <Link href={`/conversations/${conversation.id}`} key={conversation.id} className={`inbox-row ${human ? "needs-human" : ""}`}>
                    <div className="inbox-avatar">
                      {human ? <UserRoundCheck size={17} strokeWidth={1.7} /> : <MessageSquareText size={17} strokeWidth={1.7} />}
                    </div>

                    <div className="inbox-person">
                      <strong>{customer?.full_name || "Unknown customer"}</strong>
                      <span>{customer?.phone || conversation.channel || "Customer"}</span>
                    </div>

                    <div className={`inbox-state ${human ? "human" : "ai"}`}>
                      <span className="state-dot" />
                      {human ? "Needs attention" : conversation.status === "ai" ? "AI handling" : conversation.status}
                    </div>

                    <div className="inbox-channel">{conversation.channel || "—"}</div>

                    <div className="inbox-updated">
                      <strong>{relativeTime(conversation.updated_at)}</strong>
                      <span>{new Date(conversation.updated_at).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</span>
                    </div>

                    <div className="inbox-row-end">
                      {unread > 0 && <span className="inbox-unread">{unread}</span>}
                      <ArrowUpRight size={14} strokeWidth={1.6} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
