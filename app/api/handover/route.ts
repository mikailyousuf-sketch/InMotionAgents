import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cancelEscalationsForConversation } from "@/lib/notifications/engine";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const conversationId = String(body?.conversationId || "");
  const action = String(body?.action || "");

  if (!conversationId || !["takeover","return_to_ai","close"].includes(action)) {
    return Response.json({ error: "Invalid handover action" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id,business_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!existing) return Response.json({ error: "Conversation not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", existing.business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  const nextStatus = action === "return_to_ai" ? "ai" : action === "close" ? "closed" : "human";

  const { data: conversation, error } = await supabase
    .from("conversations")
    .update({
      status: nextStatus,
      closed_at: action === "close" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", conversationId)
    .eq("business_id", existing.business_id)
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await supabase.from("handover_events").insert({
    business_id: conversation.business_id,
    conversation_id: conversation.id,
    action: action === "return_to_ai" ? "returned_to_ai" : action === "close" ? "closed" : "accepted"
  });

  if (["takeover", "return_to_ai", "close"].includes(action)) {
    await cancelEscalationsForConversation(conversation.id);
  }

  return Response.json({ conversation });
}
