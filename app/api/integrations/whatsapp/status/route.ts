import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptCredential } from "@/lib/integrations/credentials";

async function getMembership(userId: string, businessId: string) {
  const admin = createServerSupabaseClient();
  const { data } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

export async function GET(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = new URL(request.url).searchParams.get("businessId");
  if (!businessId) return Response.json({ error: "businessId is required" }, { status: 400 });

  const membership = await getMembership(user.id, businessId);
  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  const admin = createServerSupabaseClient();
  const { data: integration, error } = await admin
    .from("integration_connections")
    .select("id,status,config,updated_at")
    .eq("business_id", businessId)
    .eq("provider", "whatsapp")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (!integration) {
    return Response.json({
      state: "not_connected",
      role: membership.role,
      meta: null
    });
  }

  const config: any = integration.config || {};
  const phoneNumberId = String(config.phone_number_id || "");
  const wabaId = String(config.whatsapp_business_account_id || "");
  const credential = config.credential;

  if (
    integration.status !== "connected" ||
    !phoneNumberId ||
    !wabaId ||
    !credential?.ciphertext ||
    !credential?.iv ||
    !credential?.tag
  ) {
    return Response.json({
      state: "needs_reconnection",
      role: membership.role,
      meta: null
    });
  }

  try {
    const token = decryptCredential({
      ciphertext: String(credential.ciphertext),
      iv: String(credential.iv),
      tag: String(credential.tag)
    });

    const version = process.env.META_GRAPH_VERSION || "v26.0";
    const response = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json({
        state: "needs_reconnection",
        role: membership.role,
        meta: null,
        reason: data?.error?.message || "Meta rejected the stored WhatsApp connection."
      });
    }

    const verification = String(data?.code_verification_status || "").toUpperCase();
    const usable = verification === "VERIFIED";

    return Response.json({
      state: usable ? "connected" : "needs_reconnection",
      role: membership.role,
      meta: {
        id: data.id,
        display_phone_number: data.display_phone_number || config.display_phone_number || null,
        verified_name: data.verified_name || config.verified_name || null,
        quality_rating: data.quality_rating || null,
        code_verification_status: data.code_verification_status || null,
        platform_type: data.platform_type || null
      },
      reason: usable ? null : `Meta reports phone verification as ${verification || "unknown"}.`
    });
  } catch (error) {
    return Response.json({
      state: "needs_reconnection",
      role: membership.role,
      meta: null,
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}
