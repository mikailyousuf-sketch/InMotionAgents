import { createServerSupabaseClient } from "@/lib/supabase/server";

const STALE_RECEIPT_MINUTES = 10;

export async function claimWhatsAppMessage(externalMessageId: string) {
  const supabase = createServerSupabaseClient();

  const { error: insertError } = await supabase
    .from("webhook_receipts")
    .insert({
      provider: "whatsapp",
      external_event_id: externalMessageId,
      status: "processing",
      updated_at: new Date().toISOString()
    });

  if (!insertError) return true;

  if (insertError.code !== "23505") {
    throw new Error(insertError.message);
  }

  const { data: existing, error: readError } = await supabase
    .from("webhook_receipts")
    .select("id,status,updated_at")
    .eq("provider", "whatsapp")
    .eq("external_event_id", externalMessageId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);
  if (!existing) return false;

  if (existing.status === "completed") return false;

  const staleCutoff = Date.now() - STALE_RECEIPT_MINUTES * 60_000;
  const stale = new Date(existing.updated_at).getTime() < staleCutoff;

  if (existing.status !== "failed" && !stale) return false;

  let retryQuery = supabase
    .from("webhook_receipts")
    .update({
      status: "processing",
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", existing.id);

  retryQuery = existing.status === "failed"
    ? retryQuery.eq("status", "failed")
    : retryQuery.eq("status", "processing").lt("updated_at", new Date(staleCutoff).toISOString());

  const { data: reclaimed, error: reclaimError } = await retryQuery
    .select("id")
    .maybeSingle();

  if (reclaimError) throw new Error(reclaimError.message);
  return Boolean(reclaimed);
}

export async function completeWhatsAppMessageReceipt(input: {
  externalMessageId: string;
  businessId?: string | null;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("webhook_receipts")
    .update({
      status: "completed",
      business_id: input.businessId ?? null,
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("provider", "whatsapp")
    .eq("external_event_id", input.externalMessageId);

  if (error) throw new Error(error.message);
}

export async function failWhatsAppMessageReceipt(input: {
  externalMessageId: string;
  businessId?: string | null;
  error: string;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("webhook_receipts")
    .update({
      status: "failed",
      business_id: input.businessId ?? null,
      last_error: input.error.slice(0, 2000),
      updated_at: new Date().toISOString()
    })
    .eq("provider", "whatsapp")
    .eq("external_event_id", input.externalMessageId);

  if (error) throw new Error(error.message);
}

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
