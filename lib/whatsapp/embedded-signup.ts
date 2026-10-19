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
  // Discover the exact WABA/phone pair authorized by the exchanged token instead.
  if (!wabaId || !phoneNumberId) {
    const assets = await graphRequest(
      "me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}}",
      businessToken
    );

    const pairs: Array<{ wabaId: string; phone: any }> = [];
    for (const business of assets?.data || []) {
      for (const waba of business?.owned_whatsapp_business_accounts?.data || []) {
        for (const phone of waba?.phone_numbers?.data || []) {
          if (waba?.id && phone?.id) pairs.push({ wabaId: String(waba.id), phone });
        }
      }
    }

    const filtered = pairs.filter((pair) => {
      if (wabaId && pair.wabaId !== wabaId) return false;
      if (phoneNumberId && String(pair.phone.id) !== phoneNumberId) return false;
      return true;
    });

    if (filtered.length === 0) {
      throw new Error("Meta authorized the login but returned no WhatsApp phone number.");
    }
    if (filtered.length > 1 && !wabaId && !phoneNumberId) {
      throw new Error("Meta authorized more than one WhatsApp number. Please reconnect and select a single WhatsApp account.");
    }

    wabaId = filtered[0].wabaId;
    phoneNumberId = String(filtered[0].phone.id);
  }

  const phoneList = await graphRequest(
    `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type`,
    businessToken
  );

  const phones = Array.isArray(phoneList.data) ? phoneList.data : [];
  const phone = phones.find((item: any) => String(item.id) === phoneNumberId);
  if (!phone) {
    throw new Error("The WhatsApp phone number returned by Meta is not available to this authorization.");
  }

  await graphRequest(`${wabaId}/subscribed_apps`, businessToken, {
    method: "POST",
    body: JSON.stringify({})
  });

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
    connection_mode: input.mode || "cloud_api",
    embedded_signup_completed_at: new Date().toISOString(),
    credential: {
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      tag: encrypted.tag
    }
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
