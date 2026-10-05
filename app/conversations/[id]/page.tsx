import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  MessageSquareText,
  UserRoundCheck
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";
import ConversationDetailClient from "./ConversationDetailClient";

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

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,status,updated_at,unread_for_staff,customers(full_name,phone)")
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false })
    .limit(40);

  return (
    <AppShell>
      <div className="conversation-split-page command-page">
        <aside className="conversation-split-list" aria-label="Conversation list">
          <div className="conversation-split-list-head">
            <Link href="/conversations" className="conversation-back">
              <ArrowLeft size={14} strokeWidth={1.8}/> Inbox
            </Link>
            <div>
              <strong>Conversations</strong>
              <span>{conversations?.length ?? 0} total</span>
            </div>
          </div>

          <div className="conversation-split-scroll">
            {(conversations ?? []).map((conversation:any) => {
              const customer = Array.isArray(conversation.customers)
                ? conversation.customers[0]
                : conversation.customers;
              const human = conversation.status === "human";
              const unread = Number(conversation.unread_for_staff ?? 0);
              const selected = conversation.id === id;

              return (
                <Link
                  key={conversation.id}
                  href={`/conversations/${conversation.id}`}
                  className={`conversation-split-row ${selected ? "selected" : ""} ${human ? "human" : ""}`}
                >
                  <span className={`conversation-split-avatar ${human ? "human" : ""}`}>
                    {human
                      ? <UserRoundCheck size={16} strokeWidth={1.8}/>
                      : <MessageSquareText size={16} strokeWidth={1.8}/>
                    }
                  </span>

                  <span className="conversation-split-copy">
                    <span className="conversation-split-name">
                      <strong>{customer?.full_name || customer?.phone || "Customer"}</strong>
                      <time>{relativeTime(conversation.updated_at)}</time>
                    </span>
                    <span className="conversation-split-state">
                      {human ? "Waiting for you" : conversation.status === "ai" ? "AI handling" : conversation.status}
                    </span>
                  </span>

                  {unread > 0 && <b className="conversation-split-unread">{unread}</b>}
                  {!human && selected && <Bot className="conversation-split-bot" size={13}/>}
                </Link>
              );
            })}
          </div>
        </aside>

        <section className="conversation-split-chat">
          <ConversationDetailClient conversationId={id} />
        </section>
      </div>
    </AppShell>
  );
}
