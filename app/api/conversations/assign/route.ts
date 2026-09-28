import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const conversationId = String(body?.conversationId || "");
  const assignedUserId = body?.assignedUserId ? String(body.assignedUserId) : null;

  if (!conversationId) {
    return Response.json({ error: "conversationId is required" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,business_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return Response.json({ error: "Conversation not found" }, { status: 404 });

  const { data: currentMembership } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", conversation.business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!currentMembership) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (assignedUserId) {
    const { data: targetMembership } = await supabase
      .from("business_members")
      .select("user_id")
      .eq("business_id", conversation.business_id)
      .eq("user_id", assignedUserId)
      .maybeSingle();

    if (!targetMembership) {
      return Response.json({ error: "Assigned user is not a member of this workspace" }, { status: 400 });
    }
  }

  const { error } = await supabase
    .from("conversations")
    .update({
      assigned_user_id: assignedUserId,
      updated_at: new Date().toISOString()
    })
    .eq("id", conversationId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
