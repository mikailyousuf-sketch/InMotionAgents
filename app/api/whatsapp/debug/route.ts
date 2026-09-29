import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServerSupabaseClient();

  const { data: memberships } = await admin
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id);

  const businessIds = (memberships ?? []).map((row: any) => row.business_id);

  const { data, error } = await admin
    .from("audit_logs")
    .select("id,business_id,action,metadata,created_at")
    .like("action", "whatsapp_webhook.%")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const visible = (data ?? []).filter((row: any) =>
    row.business_id === null || businessIds.includes(row.business_id)
  );

  return Response.json({ events: visible });
}
