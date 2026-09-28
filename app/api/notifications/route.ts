import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("notifications")
    .select("id,business_id,conversation_id,customer_id,event_type,title,body,status,metadata,created_at,read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (unreadOnly) query = query.eq("status", "unread");

  const { data, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const notificationId = String(body?.notificationId || "");
  const markAll = Boolean(body?.markAll);

  const supabase = createServerSupabaseClient();

  if (markAll) {
    const { error } = await supabase
      .from("notifications")
      .update({
        status: "read",
        read_at: new Date().toISOString()
      })
      .eq("user_id", user.id)
      .eq("status", "unread");

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  if (!notificationId) {
    return Response.json({ error: "notificationId is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      status: "read",
      read_at: new Date().toISOString()
    })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
