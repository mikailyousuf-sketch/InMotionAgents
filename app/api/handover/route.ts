import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json();
  const conversationId = String(body?.conversationId || "");
  const action = String(body?.action || "");

  if (!conversationId || !["takeover","return_to_ai","close"].includes(action)) {
    return Response.json({ error: "Invalid handover action" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const nextStatus = action === "return_to_ai" ? "ai" : action === "close" ? "closed" : "human";

  const { data: conversation, error } = await supabase
    .from("conversations")
    .update({
      status: nextStatus,
      closed_at: action === "close" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", conversationId)
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await supabase.from("handover_events").insert({
    business_id: conversation.business_id,
    conversation_id: conversation.id,
    action: action === "return_to_ai" ? "returned_to_ai" : action === "close" ? "closed" : "accepted"
  });

  return Response.json({ conversation });
}
