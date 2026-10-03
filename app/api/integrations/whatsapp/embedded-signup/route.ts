import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encryptCredential } from "@/lib/integrations/credentials";

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

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Meta request failed (${response.status})`);
  }
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

  if (!businessId || !code || !wabaId || !phoneNumberId) {
    return Response.json(
      { error: "Meta did not return all required WhatsApp connection details." },
      { status: 400 }
    );
  }

  const membership = await membershipFor(user.id, businessId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return Response.json({ error: "Owner or admin access required" }, { status: 403 });
  }

  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return Response.json({ error: "Meta app credentials are not configured on the server." }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code
    });

    const exchange = await fetch(
      `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/oauth/access_token?${params.toString()}`,
      { cache: "no-store" }
    );

    const tokenData = await exchange.json();
    if (!exchange.ok || !tokenData?.access_token) {
      throw new Error(tokenData?.error?.message || "Meta token exchange failed");
    }

    const businessToken = String(tokenData.access_token);

    const phoneList = await graphRequest(
      `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type`,
      businessToken
    );

    const phone = (phoneList.data || []).find((item: any) => String(item.id) === phoneNumberId);
    if (!phone) {
      throw new Error("The selected WhatsApp phone number does not belong to the account Meta returned.");
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
      connection_mode: mode,
      credential: {
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        tag: encrypted.tag
      }
    };

    const { data: integration, error } = await admin
      .from("integration_connections")
      .upsert({
        business_id: businessId,
        provider: "whatsapp",
        status: "connected",
        config,
        updated_at: new Date().toISOString()
      }, { onConflict: "business_id,provider" })
      .select("id,provider,status,config")
      .single();

    if (error) throw error;

    const safeIntegration = {
      ...integration,
      config: {
        ...integration.config,
        credential: undefined
      }
    };

    return Response.json({ integration: safeIntegration });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
