import { createServerSupabaseClient } from "@/lib/supabase/server";

export type UsageEventType =
  | "agent_turn"
  | "message_inbound"
  | "message_outbound"
  | "booking_created"
  | "handover_requested"
  | "whatsapp_outbound";

export async function recordUsage(input: {
  businessId: string;
  eventType: UsageEventType;
  quantity?: number;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.from("usage_events").insert({
    business_id: input.businessId,
    event_type: input.eventType,
    quantity: input.quantity ?? 1,
    metadata: input.metadata ?? {}
  });

  if (error) {
    console.error("Usage event failed", error.message);
  }
}

export async function ensureDevelopmentSubscription(businessId: string) {
  const supabase = createServerSupabaseClient();

  const { data: plan } = await supabase
    .from("plans")
    .select("id")
    .eq("code", "development")
    .single();

  if (!plan) return;

  await supabase.from("business_subscriptions").upsert({
    business_id: businessId,
    plan_id: plan.id,
    status: "trial",
    updated_at: new Date().toISOString()
  }, { onConflict: "business_id" });
}
