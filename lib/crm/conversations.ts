import { createServerSupabaseClient } from "@/lib/supabase/server";
import { dispatchStaffEvent } from "@/lib/notifications/engine";
import { generateHandoverSummary } from "@/lib/agent/intelligence";

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

  const now = new Date().toISOString();

  if (input.senderType === "customer") {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("unread_for_staff")
      .eq("id", input.conversationId)
      .maybeSingle();

    await supabase
      .from("conversations")
      .update({
        updated_at: now,
        last_customer_message_at: now,
        unread_for_staff: Number(conversation?.unread_for_staff ?? 0) + 1
      })
      .eq("id", input.conversationId);
  } else if (input.senderType === "human") {
    await supabase
      .from("conversations")
      .update({
        updated_at: now,
        last_staff_message_at: now,
        unread_for_staff: 0
      })
      .eq("id", input.conversationId);
  } else {
    await supabase
      .from("conversations")
      .update({ updated_at: now })
      .eq("id", input.conversationId);
  }
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

  const { data: customer } = data.customer_id
    ? await supabase
        .from("customers")
        .select("full_name,phone")
        .eq("id", data.customer_id)
        .maybeSingle()
    : { data: null };

  await Promise.all([
    dispatchStaffEvent({
      businessId: input.businessId,
      eventType: "human_handover",
      conversationId: input.conversationId,
      customerId: data.customer_id ?? null,
      title: "Human handover required",
      body: customer?.full_name
        ? `${customer.full_name} needs human assistance${input.reason ? `: ${input.reason}` : "."}`
        : `A customer needs human assistance${input.reason ? `: ${input.reason}` : "."}`,
      metadata: {
        reason: input.reason ?? null,
        customer_phone: customer?.phone ?? null
      }
    }),
    generateHandoverSummary({
      businessId: input.businessId,
      conversationId: input.conversationId,
      customerId: data.customer_id ?? null,
      reason: input.reason ?? null
    })
  ]);

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
