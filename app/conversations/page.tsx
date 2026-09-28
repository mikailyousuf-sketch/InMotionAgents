import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const { business } = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id,status,channel,started_at,updated_at,customers(full_name,phone)")
    .eq("business_id", business.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (
    <AppShell>
      <h1>Conversations</h1>
      <p className="muted">{business.name} · live AI and human-handled threads.</p>

      <div className="card" style={{ marginTop: 24, padding: 0, overflow: "hidden" }}>
        {(conversations ?? []).length === 0 ? (
          <p className="muted" style={{ padding: 18 }}>No conversations yet.</p>
        ) : (
          (conversations ?? []).map((conversation: any) => (
            <Link
              href={`/conversations/${conversation.id}`}
              key={conversation.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr 1fr",
                gap: 12,
                padding: 16,
                borderBottom: "1px solid var(--line)"
              }}
            >
              <div>
                <strong>{conversation.customers?.full_name ?? "Unknown customer"}</strong>
                <div className="muted" style={{ fontSize: 13 }}>
                  {conversation.customers?.phone ?? conversation.channel}
                </div>
              </div>
              <div>
                <span className="muted">Status</span>
                <div>{conversation.status === "human" ? "Human takeover" : conversation.status}</div>
              </div>
              <div>
                <span className="muted">Updated</span>
                <div>{new Date(conversation.updated_at).toLocaleString("en-ZA")}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
