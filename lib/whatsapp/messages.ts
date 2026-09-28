import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function whatsappMessageAlreadyProcessed(externalMessageId: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("messages")
    .select("id")
    .eq("external_message_id", externalMessageId)
    .maybeSingle();

  return Boolean(data);
}

export async function setExternalMessageId(input: {
  conversationId: string;
  externalMessageId: string;
  content: string;
}) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", input.conversationId)
    .eq("direction", "inbound")
    .eq("content", input.content)
    .is("external_message_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return;

  const { error: updateError } = await supabase
    .from("messages")
    .update({ external_message_id: input.externalMessageId })
    .eq("id", data.id);

  if (updateError) throw new Error(updateError.message);
}

export async function recordWhatsAppDeliveryEvent(input: {
  businessId?: string | null;
  externalMessageId: string;
  status: string;
  payload: unknown;
}) {
  const supabase = createServerSupabaseClient();
  await supabase.from("message_delivery_events").insert({
    business_id: input.businessId ?? null,
    external_message_id: input.externalMessageId,
    provider: "whatsapp",
    status: input.status,
    payload: input.payload
  });
}
