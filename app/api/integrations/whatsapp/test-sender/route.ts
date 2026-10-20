import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { encryptCredential } from "@/lib/integrations/credentials";

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

  const version = process.env.META_GRAPH_VERSION || "v26.0";
  const metaResponse = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,status`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    }
  );

  const meta = await metaResponse.json().catch(() => null);
  if (!metaResponse.ok) {
    return Response.json(
      { error: meta?.error?.message || "Meta rejected the test sender token." },
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
      display_phone_number: meta?.display_phone_number || null,
      verified_name: meta?.verified_name || "Meta Test Number",
      code_verification_status: meta?.code_verification_status || null,
      platform_type: meta?.platform_type || null,
      status: meta?.status || null,
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
      display_phone_number: meta?.display_phone_number || null,
      verified_name: meta?.verified_name || "Meta Test Number"
    }
  });
}
