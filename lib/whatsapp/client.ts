import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptCredential } from "@/lib/integrations/credentials";

async function resolveAccessToken(phoneNumberId: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("provider", "whatsapp")
    .eq("status", "connected");

  const connection = (data || []).find(
    (row: any) => String(row?.config?.phone_number_id || "") === phoneNumberId
  );

  const credential = connection?.config?.credential;
  if (credential?.ciphertext && credential?.iv && credential?.tag) {
    return decryptCredential({
      ciphertext: String(credential.ciphertext),
      iv: String(credential.iv),
      tag: String(credential.tag)
    });
  }

  return process.env.META_WHATSAPP_ACCESS_TOKEN || "";
}

export async function sendWhatsAppText(input: {
  phoneNumberId: string;
  to: string;
  body: string;
}) {
  const token = await resolveAccessToken(input.phoneNumberId);
  const graphVersion = process.env.META_GRAPH_VERSION;

  if (!token || !graphVersion) {
    if (process.env.WHATSAPP_MOCK_MODE === "true") {
      console.log("[WhatsApp mock send]", input);
      return { mock: true };
    }
    throw new Error("WhatsApp access token or Graph version is not configured");
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${input.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: {
          preview_url: false,
          body: input.body
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`);
  }

  return data;
}
