import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getOrCreateConversation(input: {
  businessId: string;
  customerId?: string | null;
  conversationId?: string | null;
  channel?: string;
  externalThreadId?: string | null;
}) {
  const supabase = createServerSupabaseClient();

  if (input.conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("business_id", input.businessId)
      .eq("id", input.conversationId)
      .single();

    if (!error && data) return data;
  }

  if (input.externalThreadId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("business_id", input.businessId)
      .eq("channel", input.channel ?? "internal")
      .eq("external_thread_id", input.externalThreadId)
      .neq("status", "closed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) return data;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      business_id: input.businessId,
      customer_id: input.customerId ?? null,
      channel: input.channel ?? "internal",
      external_thread_id: input.externalThreadId ?? null,
      status: "ai"
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getOrCreateInternalConversation(input: {
  businessId: string;
  customerId?: string | null;
  conversationId?: string | null;
}) {
  return getOrCreateConversation({
    ...input,
    channel: "internal"
  });
}

export async function getConversationHistory(conversationId: string, limit = 20) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("sender_type,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .reverse()
    .filter((message) => ["customer", "ai", "human"].includes(message.sender_type));
}

export async function saveMessage(input: {
  businessId: string;
  conversationId: string;
  customerId?: string | null;
  direction: "inbound" | "outbound";
  senderType: "customer" | "ai" | "human" | "system";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("messages").insert({
    business_id: input.businessId,
    conversation_id: input.conversationId,
    customer_id: input.customerId ?? null,
    direction: input.direction,
    sender_type: input.senderType,
    content: input.content,
    metadata: input.metadata ?? {}
  });

  if (error) throw new Error(error.message);

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.conversationId);
}

export async function requestHumanHandover(input: {
  businessId: string;
  conversationId: string;
  reason?: string;
}) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("conversations")
    .update({
      status: "human",
      updated_at: new Date().toISOString()
    })
    .eq("business_id", input.businessId)
    .eq("id", input.conversationId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("handover_events").insert({
    business_id: input.businessId,
    conversation_id: input.conversationId,
    action: "requested",
    reason: input.reason ?? null
  });

  return data;
}

export async function updateLeadStatus(input: {
  businessId: string;
  customerId: string;
  status: "new" | "warm" | "qualified" | "converted" | "lost";
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .update({
      lead_status: input.status,
      last_contacted_at: new Date().toISOString()
    })
    .eq("business_id", input.businessId)
    .eq("id", input.customerId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
