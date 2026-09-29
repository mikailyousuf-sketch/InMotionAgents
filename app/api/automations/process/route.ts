import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";
import { processDueOutboundJobs } from "@/lib/automations/worker";

export async function POST() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = await getPrimaryUserBusiness();

  if (!["owner", "admin"].includes(current.role)) {
    return Response.json({ error: "Owner or admin access required" }, { status: 403 });
  }

  const results = await processDueOutboundJobs({
    businessId: current.business.id,
    limit: 25
  });

  return Response.json({ processed: results.length, results });
}
