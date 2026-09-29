import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enqueueOutboundJob } from "@/lib/automations/queue";

function asLocalDateTime(value: string, timezone = "Africa/Johannesburg") {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export async function scheduleBookingAutomations(input: {
  businessId: string;
  bookingId: string;
}) {
  const supabase = createServerSupabaseClient();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id,starts_at,ends_at,customers(id,full_name,phone),services(name),businesses(name,timezone)")
    .eq("id", input.bookingId)
    .eq("business_id", input.businessId)
    .single();

  if (error || !booking) throw new Error(error?.message ?? "Booking not found");

  const customer: any = Array.isArray((booking as any).customers) ? (booking as any).customers[0] : (booking as any).customers;
  const service: any = Array.isArray((booking as any).services) ? (booking as any).services[0] : (booking as any).services;
  const business: any = Array.isArray((booking as any).businesses) ? (booking as any).businesses[0] : (booking as any).businesses;

  if (!customer?.id || !customer?.phone) return [];

  const { data: automations, error: automationError } = await supabase
    .from("automations")
    .select("id,trigger_type,template_id,config,message_templates(body)")
    .eq("business_id", input.businessId)
    .eq("status", "active")
    .in("trigger_type", ["booking_created", "booking_reminder"]);

  if (automationError) throw new Error(automationError.message);

  const created: any[] = [];

  for (const automation of automations ?? []) {
    const template: any = Array.isArray((automation as any).message_templates)
      ? (automation as any).message_templates[0]
      : (automation as any).message_templates;

    if (!template?.body) continue;

    let scheduledFor = new Date().toISOString();

    if (automation.trigger_type === "booking_reminder") {
      const minutesBefore = Number((automation.config as any)?.minutes_before ?? 1440);
      scheduledFor = new Date(
        new Date(booking.starts_at).getTime() - minutesBefore * 60_000
      ).toISOString();

      if (new Date(scheduledFor).getTime() <= Date.now()) continue;
    }

    const job = await enqueueOutboundJob({
      businessId: input.businessId,
      automationId: automation.id,
      templateId: automation.template_id,
      customerId: customer.id,
      bookingId: booking.id,
      channel: "whatsapp",
      destination: customer.phone,
      body: template.body,
      scheduledFor,
      variables: {
        customer_name: customer.full_name ?? "",
        business_name: business?.name ?? "",
        service_name: service?.name ?? "",
        booking_time: asLocalDateTime(booking.starts_at, business?.timezone ?? "Africa/Johannesburg")
      },
      metadata: {
        trigger: automation.trigger_type
      },
      dedupeKey: [
        "booking",
        booking.id,
        "automation",
        automation.id,
        "scheduled",
        scheduledFor
      ].join(":")
    });

    created.push(job);
  }

  return created;
}

export async function scheduleLeadFollowup(input: {
  businessId: string;
  customerId: string;
  delayMinutes?: number;
}) {
  const supabase = createServerSupabaseClient();

  const [{ data: customer }, { data: automations }] = await Promise.all([
    supabase
      .from("customers")
      .select("id,full_name,phone,lead_status")
      .eq("id", input.customerId)
      .eq("business_id", input.businessId)
      .single(),
    supabase
      .from("automations")
      .select("id,template_id,config,message_templates(body)")
      .eq("business_id", input.businessId)
      .eq("status", "active")
      .eq("trigger_type", "lead_followup")
  ]);

  if (!customer?.phone) return [];

  const created: any[] = [];

  for (const automation of automations ?? []) {
    const template: any = Array.isArray((automation as any).message_templates)
      ? (automation as any).message_templates[0]
      : (automation as any).message_templates;

    if (!template?.body) continue;

    const delay = input.delayMinutes ?? Number((automation.config as any)?.delay_minutes ?? 1440);
    const scheduledFor = new Date(Date.now() + delay * 60_000).toISOString();

    const job = await enqueueOutboundJob({
      businessId: input.businessId,
      automationId: automation.id,
      templateId: automation.template_id,
      customerId: customer.id,
      channel: "whatsapp",
      destination: customer.phone,
      body: template.body,
      scheduledFor,
      variables: {
        customer_name: customer.full_name ?? ""
      },
      metadata: {
        trigger: "lead_followup",
        lead_status: customer.lead_status
      },
      dedupeKey: [
        "lead",
        customer.id,
        "automation",
        automation.id,
        "status",
        customer.lead_status || "unknown"
      ].join(":")
    });

    created.push(job);
  }

  return created;
}
