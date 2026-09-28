import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const businessSlug = body?.businessSlug || "northstar-dental";
  const admin = createServerSupabaseClient();

  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("slug", businessSlug)
    .maybeSingle();

  if (!business) return Response.json({ error: "Workspace not found" }, { status: 404 });

  const { data: membership } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", business.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  const from = String(body?.from || "27820000000").replace(/\D/g, "");
  const message = String(body?.message || "").trim();

  if (!message) return Response.json({ error: "message is required" }, { status: 400 });

  const result = await runAgentTurn({
    businessSlug,
    userMessage: message,
    channel: "whatsapp",
    externalThreadId: from,
    customer: {
      phone: `+${from}`,
      fullName: body?.name || "WhatsApp Test Customer"
    }
  });

  return Response.json(result);
}
