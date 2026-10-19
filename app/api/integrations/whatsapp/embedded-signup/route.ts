import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { completeWhatsAppEmbeddedSignup } from "@/lib/whatsapp/embedded-signup";

async function membershipFor(userId: string, businessId: string) {
  const admin = createServerSupabaseClient();
  const { data } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const businessId = String(body?.businessId || "");
  const code = String(body?.code || "");
  const wabaId = String(body?.wabaId || "");
  const phoneNumberId = String(body?.phoneNumberId || "");
  const mode = body?.mode === "coexistence" ? "coexistence" : "cloud_api";

  if (!businessId || !code) {
    return Response.json(
      { error: "Meta did not return the required authorization code." },
      { status: 400 }
    );
  }

  const membership = await membershipFor(user.id, businessId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return Response.json({ error: "Owner or admin access required" }, { status: 403 });
  }

  try {
    const integration = await completeWhatsAppEmbeddedSignup({
      businessId,
      code,
      wabaId: wabaId || undefined,
      phoneNumberId: phoneNumberId || undefined,
      mode
    });

    return Response.json({ integration });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
