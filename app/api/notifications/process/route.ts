import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { processEscalationJobs } from "@/lib/notifications/worker";

export async function POST() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const results = await processEscalationJobs();
  return Response.json({ processed: results.length, results });
}
