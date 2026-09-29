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
  dedupeKey?: string | null;
}) {
  const supabase = createServerSupabaseClient();

  const renderedBody = renderTemplate(input.body, input.variables ?? {});
  const payload = {
    business_id: input.businessId,
    automation_id: input.automationId ?? null,
    template_id: input.templateId ?? null,
    customer_id: input.customerId ?? null,
    booking_id: input.bookingId ?? null,
    channel: input.channel ?? "whatsapp",
    destination: input.destination ?? null,
    rendered_body: renderedBody,
    scheduled_for: input.scheduledFor,
    next_attempt_at: input.scheduledFor,
    status: "pending",
    metadata: input.metadata ?? {},
    dedupe_key: input.dedupeKey ?? null,
    updated_at: new Date().toISOString()
  };

  if (input.dedupeKey) {
    const { data: existing } = await supabase
      .from("outbound_jobs")
      .select("*")
      .eq("business_id", input.businessId)
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle();

    if (existing) {
      // A pending/failed job may be refreshed when the underlying booking changes.
      // Sent/skipped jobs are historical records and remain untouched.
      if (["pending", "failed", "cancelled"].includes(existing.status)) {
        const { data, error } = await supabase
          .from("outbound_jobs")
          .update({
            ...payload,
            status: "pending",
            attempts: 0,
            last_error: null,
            sent_at: null,
            external_message_id: null
          })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) throw new Error(error.message);
        return data;
      }

      return existing;
    }
  }

  const { data, error } = await supabase
    .from("outbound_jobs")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    // Another request may have inserted the same dedupe key in parallel.
    if (input.dedupeKey && error.code === "23505") {
      const { data: existing } = await supabase
        .from("outbound_jobs")
        .select("*")
        .eq("business_id", input.businessId)
        .eq("dedupe_key", input.dedupeKey)
        .single();

      if (existing) return existing;
    }
    throw new Error(error.message);
  }

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
    .in("status", ["pending", "failed"]);

  if (input.channel) query = query.eq("channel", input.channel);

  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function cancelPendingJobsForBooking(input: {
  businessId: string;
  bookingId: string;
  reason?: string;
}) {
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("outbound_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
      last_error: input.reason || "Cancelled because booking changed"
    })
    .eq("business_id", input.businessId)
    .eq("booking_id", input.bookingId)
    .in("status", ["pending", "failed"]);

  if (error) throw new Error(error.message);
}
