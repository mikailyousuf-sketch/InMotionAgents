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
    const [response, wabaResponse] = await Promise.all([
      fetch(
        `https://graph.facebook.com/${version}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,health_status`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        }
      ),
      fetch(
        `https://graph.facebook.com/${version}/${wabaId}?fields=id,status,account_review_status,business_verification_status,health_status`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store"
        }
      )
    ]);

    const data = await response.json();
    const wabaData = await wabaResponse.json().catch(() => null);

    if (!response.ok) {
      return Response.json({
        state: "needs_reconnection",
        role: membership.role,
        meta: null,
        reason: data?.error?.message || "Meta rejected the stored WhatsApp connection."
      });
    }

    const verification = String(data?.code_verification_status || "").toUpperCase();

    const healthCandidates = [data?.health_status, wabaResponse.ok ? wabaData?.health_status : null]
      .filter(Boolean);

    const healthBlocked = healthCandidates.some(
      (health: any) => String(health?.can_send_message || "").toUpperCase() === "BLOCKED"
    );

    const healthErrors = healthCandidates.flatMap((health: any) =>
      Array.isArray(health?.entities)
        ? health.entities.flatMap((entity: any) =>
            Array.isArray(entity?.errors)
              ? entity.errors.map((item: any) => ({
                  entity_type: entity?.entity_type || null,
                  entity_id: entity?.id || null,
                  error_code: item?.error_code ?? null,
                  error_description: item?.error_description || null,
                  possible_solution: item?.possible_solution || null
                }))
              : []
          )
        : []
    );

    const usable = verification === "VERIFIED" && !healthBlocked;

    const healthReason = healthErrors
      .map((item: any) =>
        [item.error_description, item.possible_solution].filter(Boolean).join(" ")
      )
      .filter(Boolean)
      .join(" ");

    console.info("whatsapp_connection_health", {
      phoneNumberId,
      wabaId,
      verification,
      phoneHealth: data?.health_status?.can_send_message || null,
      wabaHealth: wabaData?.health_status?.can_send_message || null,
      wabaStatus: wabaData?.status || null,
      accountReviewStatus: wabaData?.account_review_status || null,
      businessVerificationStatus: wabaData?.business_verification_status || null,
      healthErrors
    });

    return Response.json({
      state: healthBlocked ? "blocked" : usable ? "connected" : "needs_reconnection",
      role: membership.role,
      meta: {
        id: data.id,
        waba_id: wabaId,
        display_phone_number: data.display_phone_number || config.display_phone_number || null,
        verified_name: data.verified_name || config.verified_name || null,
        quality_rating: data.quality_rating || null,
        code_verification_status: data.code_verification_status || null,
        platform_type: data.platform_type || null,
        health_status: data?.health_status || wabaData?.health_status || null,
        waba_status: wabaData?.status || null,
        account_review_status: wabaData?.account_review_status || null,
        business_verification_status: wabaData?.business_verification_status || null
      },
      reason: healthBlocked
        ? healthReason || "Meta has blocked outbound WhatsApp messaging for this account."
        : usable
          ? null
          : `Meta reports phone verification as ${verification || "unknown"}.`
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
