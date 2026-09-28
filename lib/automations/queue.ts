import { createServerSupabaseClient } from "@/lib/supabase/server";
import { renderTemplate } from "@/lib/automations/templates";

export async function enqueueOutboundJob(input: {
  businessId: string;
  automationId?: string | null;
  templateId?: string | null;
  customerId?: string | null;
  bookingId?: string | null;
  channel?: string;
  destination?: string | null;
  body: string;
  scheduledFor: string;
  variables?: Record<string, string | number | null | undefined>;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServerSupabaseClient();

  const renderedBody = renderTemplate(input.body, input.variables ?? {});

  const { data, error } = await supabase
    .from("outbound_jobs")
    .insert({
      business_id: input.businessId,
      automation_id: input.automationId ?? null,
      template_id: input.templateId ?? null,
      customer_id: input.customerId ?? null,
      booking_id: input.bookingId ?? null,
      channel: input.channel ?? "whatsapp",
      destination: input.destination ?? null,
      rendered_body: renderedBody,
      scheduled_for: input.scheduledFor,
      status: "pending",
      metadata: input.metadata ?? {}
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function cancelPendingJobsForCustomer(input: {
  businessId: string;
  customerId: string;
  channel?: string;
}) {
  const supabase = createServerSupabaseClient();

  let query = supabase
    .from("outbound_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
      last_error: "Cancelled because customer opted out"
    })
    .eq("business_id", input.businessId)
    .eq("customer_id", input.customerId)
    .eq("status", "pending");

  if (input.channel) query = query.eq("channel", input.channel);

  const { error } = await query;
  if (error) throw new Error(error.message);
}
