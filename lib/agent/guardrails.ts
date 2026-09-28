import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getAgentGuardrails(businessId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("agent_guardrails")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("priority", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function recordAgentEvent(input: {
  businessId: string;
  conversationId?: string | null;
  customerId?: string | null;
  eventType: string;
  severity?: "info" | "warning" | "error";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();

  await supabase.from("agent_events").insert({
    business_id: input.businessId,
    conversation_id: input.conversationId ?? null,
    customer_id: input.customerId ?? null,
    event_type: input.eventType,
    severity: input.severity ?? "info",
    message: input.message,
    metadata: input.metadata ?? {}
  });
}

export function formatGuardrailsForPrompt(rules: any[]) {
  if (!rules.length) {
    return "No additional custom escalation rules are configured.";
  }

  return rules.map((rule, index) =>
    `${index + 1}. [${rule.action}] ${rule.title}: ${rule.instructions}`
  ).join("\n");
}
