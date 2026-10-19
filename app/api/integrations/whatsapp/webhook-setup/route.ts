import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptCredential } from "@/lib/integrations/credentials";
import { ensureWhatsAppAppWebhook } from "@/lib/whatsapp/embedded-signup";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const businessId = String(body?.businessId || "");
  if (!businessId) {
    return Response.json({ error: "businessId is required" }, { status: 400 });
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

  const { data: integration, error } = await admin
    .from("integration_connections")
    .select("status,config")
    .eq("business_id", businessId)
    .eq("provider", "whatsapp")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const config: any = integration?.config || {};
  const wabaId = String(config.whatsapp_business_account_id || "");
  const credential = config.credential;

  if (
    integration?.status !== "connected" ||
    !wabaId ||
    !credential?.ciphertext ||
    !credential?.iv ||
    !credential?.tag
  ) {
    return Response.json({ error: "WhatsApp is not connected." }, { status: 400 });
  }

  try {
    const token = decryptCredential({
      ciphertext: String(credential.ciphertext),
      iv: String(credential.iv),
      tag: String(credential.tag)
    });

    const { callbackUrl } = await ensureWhatsAppAppWebhook();

    const version = process.env.META_GRAPH_VERSION || "v26.0";
    const subscribe = await fetch(
      `https://graph.facebook.com/${version}/${wabaId}/subscribed_apps`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({}),
        cache: "no-store"
      }
    );

    const subscriptionData = await subscribe.json().catch(() => null);
    if (!subscribe.ok || subscriptionData?.success !== true) {
      throw new Error(
        subscriptionData?.error?.message ||
        "Meta could not subscribe the WhatsApp account to InMotion."
      );
    }

    return Response.json({ ok: true, callbackUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("whatsapp_webhook_setup_failed", { message });
    return Response.json({ error: message }, { status: 502 });
  }
}
