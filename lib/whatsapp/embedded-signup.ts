import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encryptCredential } from "@/lib/integrations/credentials";

async function graphRequest(path: string, token: string, init?: RequestInit) {
  const version = process.env.META_GRAPH_VERSION || "v26.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || `Meta request failed (${response.status})`);
  }
  return data;
}


export async function ensureWhatsAppAppWebhook() {
  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.inmotionagents.co.za";

  if (!appId || !appSecret || !verifyToken) {
    throw new Error("Meta webhook configuration is incomplete on the server.");
  }

  const version = process.env.META_GRAPH_VERSION || "v26.0";
  const callbackUrl = `${baseUrl.replace(/\/$/, "")}/api/whatsapp/webhook`;
  const params = new URLSearchParams({
    object: "whatsapp_business_account",
    callback_url: callbackUrl,
    fields: "messages",
    verify_token: verifyToken,
    access_token: `${appId}|${appSecret}`
  });

  const response = await fetch(
    `https://graph.facebook.com/${version}/${appId}/subscriptions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store"
    }
  );

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success !== true) {
    throw new Error(data?.error?.message || "Meta could not configure the WhatsApp webhook.");
  }

  return { callbackUrl };
}

export async function completeWhatsAppEmbeddedSignup(input: {
  businessId: string;
  code: string;
  redirectUri?: string;
  wabaId?: string;
  phoneNumberId?: string;
  mode?: "coexistence" | "cloud_api";
}) {
  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Meta app credentials are not configured on the server.");
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code: input.code
  });
  if (input.redirectUri) params.set("redirect_uri", input.redirectUri);

  const exchange = await fetch(
    `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/oauth/access_token?${params.toString()}`,
    { cache: "no-store" }
  );

  const tokenData = await exchange.json().catch(() => null);
  if (!exchange.ok || !tokenData?.access_token) {
    throw new Error(tokenData?.error?.message || "Meta token exchange failed");
  }

  const businessToken = String(tokenData.access_token);

  let wabaId = input.wabaId || "";
  let phoneNumberId = input.phoneNumberId || "";

  // Redirect-based OAuth does not rely on the browser postMessage session payload.
  // The exchanged token itself carries the WABA(s) granted to our app inside
  // granular_scopes[].target_ids for whatsapp_business_management.
  if (!wabaId) {
    const version = process.env.META_GRAPH_VERSION || "v26.0";
    const appAccessToken = `${appId}|${appSecret}`;
    const debugUrl = new URL(`https://graph.facebook.com/${version}/debug_token`);
    debugUrl.searchParams.set("input_token", businessToken);
    debugUrl.searchParams.set("access_token", appAccessToken);

    const debugResponse = await fetch(debugUrl.toString(), { cache: "no-store" });
    const debugData = await debugResponse.json().catch(() => null);

    if (!debugResponse.ok || !debugData?.data?.is_valid) {
      throw new Error(
        debugData?.error?.message ||
        "Meta returned an invalid WhatsApp authorization token."
      );
    }

    const granularScopes = Array.isArray(debugData.data.granular_scopes)
      ? debugData.data.granular_scopes
      : [];

    const whatsappScope = granularScopes.find(
      (scope: any) => scope?.scope === "whatsapp_business_management"
    );

    const targetIds = Array.isArray(whatsappScope?.target_ids)
      ? whatsappScope.target_ids.map((id: unknown) => String(id)).filter(Boolean)
      : [];

    if (targetIds.length === 0) {
      throw new Error(
        "Meta authorized the login but did not grant access to a WhatsApp Business Account."
      );
    }

    // Meta orders the most recently onboarded WABAs first.
    wabaId = targetIds[0];
  }

  const phoneList = await graphRequest(
    `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,status`,
    businessToken
  );

  const phones = Array.isArray(phoneList.data) ? phoneList.data : [];
  let phone = phoneNumberId
    ? phones.find((item: any) => String(item.id) === phoneNumberId)
    : null;

  if (!phone && !phoneNumberId && phones.length === 1) {
    phone = phones[0];
    phoneNumberId = String(phone.id);
  }

  if (!phone) {
    if (!phoneNumberId && phones.length > 1) {
      throw new Error(
        "Meta granted access to more than one phone number on this WhatsApp account. Please reconnect with a single-number account for this test."
      );
    }
    throw new Error("The WhatsApp phone number returned by Meta is not available to this authorization.");
  }

  await ensureWhatsAppAppWebhook();

  await graphRequest(`${wabaId}/subscribed_apps`, businessToken, {
    method: "POST",
    body: JSON.stringify({})
  });

  let registrationPinEncrypted: ReturnType<typeof encryptCredential> | null = null;
  const phoneStatus = String(phone.status || "").toUpperCase();

  if (phoneStatus !== "CONNECTED") {
    const registrationPin = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

    await graphRequest(`${phoneNumberId}/register`, businessToken, {
      method: "POST",
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin: registrationPin
      })
    });

    registrationPinEncrypted = encryptCredential(registrationPin);

    const refreshedPhone = await graphRequest(
      `${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,status`,
      businessToken
    );

    phone = refreshedPhone;
  }

  const encrypted = encryptCredential(businessToken);
  const admin = createServerSupabaseClient();
  const config = {
    phone_number_id: phoneNumberId,
    whatsapp_business_account_id: wabaId,
    display_phone_number: phone.display_phone_number || null,
    verified_name: phone.verified_name || null,
    quality_rating: phone.quality_rating || null,
    code_verification_status: phone.code_verification_status || null,
    platform_type: phone.platform_type || null,
    phone_status: phone.status || null,
    connection_mode: input.mode || "cloud_api",
    embedded_signup_completed_at: new Date().toISOString(),
    credential: {
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag
    },
    registration_pin_credential: registrationPinEncrypted
      ? {
          ciphertext: registrationPinEncrypted.ciphertext,
          iv: registrationPinEncrypted.iv,
          tag: registrationPinEncrypted.tag
        }
      : undefined
  };

  const { data: integration, error } = await admin
    .from("integration_connections")
    .upsert({
      business_id: input.businessId,
      provider: "whatsapp",
      status: "connected",
      config,
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id,provider" })
    .select("id,provider,status,config")
    .single();

  if (error) throw error;

  return {
    ...integration,
    config: {
      ...integration.config,
      credential: undefined
    }
  };
}
