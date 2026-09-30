import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export async function GET() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DEBUG_ROUTES !== "true"
  ) {
    return new Response("Not found", { status:404 });
  }

  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error:"Unauthorized" },{ status:401 });

  const current = await getPrimaryUserBusiness();
  if (!["owner","admin"].includes(current.role)) {
    return Response.json({ error:"Forbidden" },{ status:403 });
  }

  const admin = createServerSupabaseClient();

  const { data, error } = await admin
    .from("audit_logs")
    .select("id,business_id,action,metadata,created_at")
    .like("action","whatsapp_webhook.%")
    .or(`business_id.eq.${current.business.id},business_id.is.null`)
    .order("created_at",{ ascending:false })
    .limit(40);

  if (error) return Response.json({ error:error.message },{ status:500 });

  return Response.json({ events:data ?? [] });
}
