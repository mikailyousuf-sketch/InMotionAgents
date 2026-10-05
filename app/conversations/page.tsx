import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Inbox,
  MessageSquareText,
  UserRoundCheck
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

function relativeTime(value:string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function ConversationRow({ conversation }:{ conversation:any }) {
  const customer = Array.isArray(conversation.customers)
    ? conversation.customers[0]
    : conversation.customers;

  const human = conversation.status === "human";
  const unread = Number(conversation.unread_for_staff ?? 0);

  return (
    <Link
      href={`/conversations/${conversation.id}`}
      className={`mobile-conversation-row ${human ? "needs-human" : ""}`}
    >
      <div className={`conversation-avatar ${human ? "human" : ""}`}>
        {human
          ? <UserRoundCheck size={18} strokeWidth={1.8}/>
          : <MessageSquareText size={18} strokeWidth={1.8}/>
        }
      </div>

      <div className="conversation-row-main">
        <div className="conversation-row-top">
          <strong>{customer?.full_name || "Unknown customer"}</strong>
          <time>{relativeTime(conversation.updated_at)}</time>
        </div>

        <div className="conversation-row-bottom">
          <span>
            {human
              ? "Waiting for you"
              : conversation.status === "ai"
                ? "AI is handling this"
                : conversation.status
            }
          </span>
          {unread > 0 && <b>{unread}</b>}
        </div>
      </div>

      <ArrowRight className="conversation-row-arrow" size={15} strokeWidth={1.8}/>
    </Link>
  );
}

export default async function ConversationsPage() {
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id,status,channel,started_at,updated_at,assigned_user_id,unread_for_staff,customers(full_name,phone)")
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  const items = conversations ?? [];
  const attention = items.filter((item:any) =>
    item.status === "human" || Number(item.unread_for_staff ?? 0) > 0
  );
  const active = items.filter((item:any) =>
    !attention.some((priority:any) => priority.id === item.id)
  );
  const aiCount = items.filter((item:any)=>item.status === "ai").length;

  return (
    <AppShell>
      <div className="inbox-app-page command-page">
        <header className="inbox-app-head">
          <div>
            <div className="eyebrow">Inbox</div>
            <h1>Customer conversations</h1>
            <p>{business.name} · reply only when your receptionist needs you.</p>
          </div>

          <div className="inbox-app-status">
            <span className="status-orb"/>
            <span><strong>{aiCount}</strong> handled by AI</span>
          </div>
        </header>

        {attention.length > 0 && (
          <section className="inbox-priority">
            <div className="inbox-section-title">
              <div>
                <span className="priority-dot"/>
                <strong>Needs you</strong>
              </div>
              <small>{attention.length} conversation{attention.length === 1 ? "" : "s"}</small>
            </div>

            <div className="conversation-stack priority-stack">
              {attention.map((conversation:any) => (
                <ConversationRow key={conversation.id} conversation={conversation}/>
              ))}
            </div>
          </section>
        )}

        <section className="inbox-recent">
          <div className="inbox-section-title">
            <div>
              <Bot size={14} strokeWidth={1.7}/>
              <strong>{attention.length ? "Other conversations" : "Conversations"}</strong>
            </div>
            <small>{items.length} total</small>
          </div>

          {items.length === 0 ? (
            <div className="inbox-app-empty">
              <span><Inbox size={22} strokeWidth={1.6}/></span>
              <strong>No conversations yet</strong>
              <p>When customers message your business, they’ll appear here.</p>
            </div>
          ) : active.length === 0 ? (
            <div className="inbox-all-caught-up">
              <span><Bot size={18}/></span>
              <div>
                <strong>Everything else is handled</strong>
                <p>Your receptionist is looking after the remaining conversations.</p>
              </div>
            </div>
          ) : (
            <div className="conversation-stack">
              {active.map((conversation:any) => (
                <ConversationRow key={conversation.id} conversation={conversation}/>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
