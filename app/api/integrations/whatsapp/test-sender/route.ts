import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encryptCredential } from "@/lib/integrations/credentials";
import { ensureWhatsAppAppWebhook } from "@/lib/whatsapp/embedded-signup";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const businessId = String(body?.businessId || "");
  const accessToken = String(body?.accessToken || "").trim();
  const phoneNumberId = process.env.META_TEST_PHONE_NUMBER_ID || "";

  if (!businessId || !accessToken || !phoneNumberId) {
    return Response.json(
      { error: "Business, test access token, or Meta test phone number is missing." },
      { status: 400 }
    );
  }

  const admin = createServerSupabaseClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return Response.json({ error: "Owner or admin access required" }, { status: 403 });
  }

  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "";
  const appSecret = process.env.META_APP_SECRET || "";
  const version = process.env.META_GRAPH_VERSION || "v26.0";

  if (!appId || !appSecret) {
    return Response.json(
      { error: "Meta app credentials are not configured on the server." },
      { status: 500 }
    );
  }

  const debugUrl = new URL(`https://graph.facebook.com/${version}/debug_token`);
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set("access_token", `${appId}|${appSecret}`);

  const debugResponse = await fetch(debugUrl.toString(), { cache: "no-store" });
  const debugData = await debugResponse.json().catch(() => null);

  if (!debugResponse.ok || !debugData?.data?.is_valid) {
    return Response.json(
      { error: debugData?.error?.message || "Meta rejected the temporary test token." },
      { status: 400 }
    );
  }

  const granularScopes = Array.isArray(debugData?.data?.granular_scopes)
    ? debugData.data.granular_scopes
    : [];

  const whatsappManagement = granularScopes.find(
    (scope: any) => scope?.scope === "whatsapp_business_management"
  );
  const whatsappMessaging = granularScopes.find(
    (scope: any) => scope?.scope === "whatsapp_business_messaging"
  );

  const targetIds = [
    ...(Array.isArray(whatsappManagement?.target_ids) ? whatsappManagement.target_ids : []),
    ...(Array.isArray(whatsappMessaging?.target_ids) ? whatsappMessaging.target_ids : [])
  ]
    .map((id: unknown) => String(id))
    .filter(Boolean);

  const wabaId = targetIds.find((id: string) => id !== phoneNumberId) || targetIds[0] || "";

  if (!wabaId) {
    return Response.json(
      { error: "Meta validated the token, but did not expose a WhatsApp Business Account for the test sender." },
      { status: 400 }
    );
  }

  try {
    await ensureWhatsAppAppWebhook();

    const subscribeResponse = await fetch(
      `https://graph.facebook.com/${version}/${wabaId}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({}),
        cache: "no-store"
      }
    );

    const subscribeData = await subscribeResponse.json().catch(() => null);
    if (!subscribeResponse.ok || subscribeData?.success !== true) {
      return Response.json(
        {
          error:
            subscribeData?.error?.message ||
            "Meta would not subscribe the test WhatsApp account to the InMotion webhook."
        },
        { status: 400 }
      );
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not configure the InMotion webhook for the Meta test sender."
      },
      { status: 400 }
    );
  }

  const { data: integration, error: readError } = await admin
    .from("integration_connections")
    .select("id,config")
    .eq("business_id", businessId)
    .eq("provider", "whatsapp")
    .maybeSingle();

  if (readError) {
    return Response.json({ error: readError.message }, { status: 500 });
  }

  const encrypted = encryptCredential(accessToken);
  const currentConfig: any = integration?.config || {};
  const nextConfig = {
    ...currentConfig,
    test_sender: {
      phone_number_id: phoneNumberId,
      whatsapp_business_account_id: wabaId,
      display_phone_number: null,
      verified_name: "Meta Test Number",
      code_verification_status: null,
      platform_type: "CLOUD_API",
      status: "TEST_READY",
      webhook_subscribed_at: new Date().toISOString(),
      enabled_at: new Date().toISOString(),
      credential: {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag
      }
    }
  };

  const writeResult = integration
    ? await admin
        .from("integration_connections")
        .update({
          config: nextConfig,
          updated_at: new Date().toISOString()
        })
        .eq("id", integration.id)
    : await admin
        .from("integration_connections")
        .upsert({
          business_id: businessId,
          provider: "whatsapp",
          status: "not_connected",
          config: nextConfig,
          updated_at: new Date().toISOString()
        }, { onConflict: "business_id,provider" });

  if (writeResult.error) {
    return Response.json({ error: writeResult.error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    sender: {
      phone_number_id: phoneNumberId,
      display_phone_number: null,
      verified_name: "Meta Test Number"
    }
  });
}
