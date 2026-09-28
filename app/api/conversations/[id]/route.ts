import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (conversationError || !conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", conversation.business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  const [
    { data: messages, error: messagesError },
    { data: customer },
    { data: members }
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .eq("business_id", conversation.business_id)
      .order("created_at"),
    conversation.customer_id
      ? supabase
          .from("customers")
          .select("id,full_name,phone,email,lead_status,source,notes,last_contacted_at,created_at")
          .eq("id", conversation.customer_id)
          .eq("business_id", conversation.business_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("business_members")
      .select("user_id,role")
      .eq("business_id", conversation.business_id)
  ]);

  if (messagesError) return Response.json({ error: messagesError.message }, { status: 500 });

  const memberIds = (members ?? []).map((member:any) => member.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("user_profiles").select("id,full_name").in("id", memberIds)
    : { data: [] as any[] };

  const profileMap = new Map((profiles ?? []).map((profile:any) => [profile.id, profile.full_name]));

  const team = (members ?? []).map((member:any) => ({
    user_id: member.user_id,
    role: member.role,
    full_name: profileMap.get(member.user_id) ?? "Staff"
  }));

  const { data: bookings } = customer?.id
    ? await supabase
        .from("bookings")
        .select("id,starts_at,ends_at,status,services(name),resources(name)")
        .eq("business_id", conversation.business_id)
        .eq("customer_id", customer.id)
        .order("starts_at", { ascending: false })
        .limit(10)
    : { data: [] as any[] };

  if ((conversation.unread_for_staff ?? 0) > 0) {
    await supabase
      .from("conversations")
      .update({ unread_for_staff: 0 })
      .eq("id", conversation.id);
  }

  return Response.json({
    conversation: { ...conversation, unread_for_staff: 0 },
    messages: messages ?? [],
    customer,
    bookings: bookings ?? [],
    team
  });
}
