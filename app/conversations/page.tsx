import { AppShell } from "@/components/AppShell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const supabase = createServerSupabaseClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,status,channel,started_at,updated_at,customers(full_name,phone)")
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <AppShell>
      <h1>Conversations</h1>
      <p className="muted">Live AI and human-handled threads.</p>

      <div className="card" style={{ marginTop: 24, padding: 0, overflow: "hidden" }}>
        {(conversations ?? []).length === 0 ? (
          <p className="muted" style={{ padding: 18 }}>No conversations yet.</p>
        ) : (
          (conversations ?? []).map((conversation: any) => (
            <div
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
                <div>{conversation.status === "human" ? "Human takeover" : "AI handling"}</div>
              </div>
              <div>
                <span className="muted">Updated</span>
                <div>{new Date(conversation.updated_at).toLocaleString("en-ZA")}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
