import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InMotionBookingProvider } from "@/lib/booking/inmotion-provider";
import { recordUsage } from "@/lib/billing/usage";
import { scheduleBookingAutomations } from "@/lib/automations/triggers";
import { cancelPendingJobsForBooking } from "@/lib/automations/queue";

const provider = new InMotionBookingProvider();

function normalize(text: string) {
  return text.trim().toLowerCase();
}

async function getServiceByName(businessId: string, serviceName: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("services")
    .select("id,name,duration_minutes")
    .eq("business_id", businessId)
    .eq("active", true);

  if (error) throw new Error(error.message);

  const wanted = normalize(serviceName);
  const match = (data ?? []).find((service) => {
    const name = normalize(service.name);
    return name === wanted || name.includes(wanted) || wanted.includes(name);
  });

  if (!match) throw new Error(`Service not found: ${serviceName}`);
  return match;
}

async function getOrCreateCustomer(
  businessId: string,
  input: { fullName: string; phone?: string; email?: string }
) {
  const supabase = createServerSupabaseClient();

  if (input.phone) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .eq("phone", input.phone)
      .maybeSingle();

    if (data) return data;
  }

  if (input.email) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .eq("email", input.email)
      .maybeSingle();

    if (data) return data;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: businessId,
      full_name: input.fullName,
      phone: input.phone ?? null,
      email: input.email ?? null
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function checkAvailability(input: {
  businessId: string;
  serviceName: string;
  from: string;
  to: string;
}) {
  const service = await getServiceByName(input.businessId, input.serviceName);
  const slots = await provider.getAvailability({
    businessId: input.businessId,
    serviceId: service.id,
    from: input.from,
    to: input.to
  });

  return {
    service: service.name,
    durationMinutes: service.duration_minutes,
    slots: slots.slice(0, 12)
  };
}

export async function createBookingFromAgent(input: {
  businessId: string;
  serviceName: string;
  customerName: string;
  startsAt: string;
  resourceId?: string;
  phone?: string;
  email?: string;
}) {
  const service = await getServiceByName(input.businessId, input.serviceName);
  const customer = await getOrCreateCustomer(input.businessId, {
    fullName: input.customerName,
    phone: input.phone,
    email: input.email
  });

  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);

  const liveSlots = await provider.getAvailability({
    businessId: input.businessId,
    serviceId: service.id,
    from: start.toISOString(),
    to: end.toISOString(),
    resourceId: input.resourceId
  });

  const exactSlot = liveSlots.find(
    (slot) => new Date(slot.startsAt).getTime() === start.getTime()
  );

  if (!exactSlot) {
    throw new Error("That selected time is no longer available. Please check availability again.");
  }

  const booking = await provider.createBooking({
    businessId: input.businessId,
    customerId: customer.id,
    serviceId: service.id,
    resourceId: exactSlot.resourceId ?? undefined,
    startsAt: start.toISOString(),
    endsAt: end.toISOString()
  });

  await recordUsage({
    businessId: input.businessId,
    eventType: "booking_created",
    metadata: { serviceId: service.id }
  });

  await scheduleBookingAutomations({
    businessId: input.businessId,
    bookingId: booking.id
  });

  return {
    bookingId: booking.id,
    customerId: customer.id,
    customer: customer.full_name,
    service: service.name,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    status: booking.status
  };
}

export async function findBookings(input: {
  businessId: string;
  customerName?: string;
  phone?: string;
}) {
  const supabase = createServerSupabaseClient();

  let customerIds: string[] = [];
  if (input.phone) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", input.businessId)
      .eq("phone", input.phone);
    customerIds = (data ?? []).map((row) => row.id);
  } else if (input.customerName) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", input.businessId)
      .ilike("full_name", `%${input.customerName}%`);
    customerIds = (data ?? []).map((row) => row.id);
  }

  if (customerIds.length === 0) return { bookings: [] };

  const { data, error } = await supabase
    .from("bookings")
    .select("id,starts_at,ends_at,status,services(name),resources(name),customers(full_name)")
    .eq("business_id", input.businessId)
    .in("customer_id", customerIds)
    .in("status", ["pending", "confirmed"])
    .order("starts_at");

  if (error) throw new Error(error.message);
  return { bookings: data ?? [] };
}

export async function cancelBookingFromAgent(input: {
  businessId: string;
  bookingId: string;
  reason?: string;
}) {
  const booking = await provider.getBooking({
    businessId: input.businessId,
    bookingId: input.bookingId
  });

  const twelveHours = 12 * 60 * 60 * 1000;
  if (new Date(booking.starts_at).getTime() - Date.now() < twelveHours) {
    throw new Error("This booking is within the 12-hour cancellation window and requires human assistance.");
  }

  const cancelled = await provider.cancelBooking(input);

  await cancelPendingJobsForBooking({
    businessId: input.businessId,
    bookingId: input.bookingId,
    reason: "Cancelled because booking was cancelled"
  });

  return { bookingId: cancelled.id, status: cancelled.status };
}

export async function rescheduleBookingFromAgent(input: {
  businessId: string;
  bookingId: string;
  startsAt: string;
  resourceId?: string;
}) {
  const booking = await provider.getBooking({
    businessId: input.businessId,
    bookingId: input.bookingId
  });

  const twelveHours = 12 * 60 * 60 * 1000;
  if (new Date(booking.starts_at).getTime() - Date.now() < twelveHours) {
    throw new Error("This booking is within the 12-hour reschedule window and requires human assistance.");
  }

  const supabase = createServerSupabaseClient();
  const { data: service, error } = await supabase
    .from("services")
    .select("duration_minutes")
    .eq("id", booking.service_id)
    .single();

  if (error || !service) throw new Error("Could not load booking service");

  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);

  const updated = await provider.updateBooking({
    businessId: input.businessId,
    bookingId: input.bookingId,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    resourceId: input.resourceId ?? booking.resource_id ?? undefined
  });

  await cancelPendingJobsForBooking({
    businessId: input.businessId,
    bookingId: input.bookingId,
    reason: "Cancelled because booking was rescheduled"
  });

  await scheduleBookingAutomations({
    businessId: input.businessId,
    bookingId: input.bookingId
  });

  return {
    bookingId: updated.id,
    startsAt: updated.starts_at,
    endsAt: updated.ends_at,
    status: updated.status
  };
}
