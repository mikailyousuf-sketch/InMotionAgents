import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

export async function GET() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  const admin = createServerSupabaseClient();
  const businessId = current.business.id;

  const [
    { data: events },
    { data: failedJobs },
    { data: integrations },
    { data: handovers },
    { data: audits },
    { count: unreadConversations }
  ] = await Promise.all([
    admin
      .from("agent_events")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("outbound_jobs")
      .select("id,status,last_error,scheduled_for,created_at")
      .eq("business_id", businessId)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("integration_connections")
      .select("provider,status,updated_at")
      .eq("business_id", businessId)
      .order("provider"),
    admin
      .from("conversations")
      .select("id,status,updated_at,customers(full_name,phone)")
      .eq("business_id", businessId)
      .eq("status", "human")
      .order("updated_at", { ascending: false })
      .limit(25),
    admin
      .from("audit_logs")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gt("unread_for_staff", 0)
  ]);

  return Response.json({
    business: current.business,
    role: current.role,
    events: events ?? [],
    failedJobs: failedJobs ?? [],
    integrations: integrations ?? [],
    handovers: handovers ?? [],
    audits: audits ?? [],
    unreadConversations: unreadConversations ?? 0
  });
}
