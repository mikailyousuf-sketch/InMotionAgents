import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AvailabilitySlot = {
  startsAt: string;
  endsAt: string;
  resourceId: string | null;
};

export class InMotionBookingProvider {
  async getAvailability(input: {
    businessId: string;
    serviceId: string;
    from: string;
    to: string;
    resourceId?: string;
  }): Promise<AvailabilitySlot[]> {
    const supabase = createServerSupabaseClient();

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id,duration_minutes")
      .eq("id", input.serviceId)
      .eq("business_id", input.businessId)
      .single();

    if (serviceError || !service) throw new Error("Service not found");

    let resourceQuery = supabase
      .from("resources")
      .select("id,name")
      .eq("business_id", input.businessId)
      .eq("active", true);

    if (input.resourceId) resourceQuery = resourceQuery.eq("id", input.resourceId);

    const { data: resources, error: resourceError } = await resourceQuery;
    if (resourceError) throw new Error(resourceError.message);

    const { data: hours, error: hoursError } = await supabase
      .from("business_hours")
      .select("day_of_week,opens_at,closes_at,closed")
      .eq("business_id", input.businessId);

    if (hoursError) throw new Error(hoursError.message);

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("resource_id,starts_at,ends_at,status")
      .eq("business_id", input.businessId)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", input.to)
      .gt("ends_at", input.from);

    if (bookingsError) throw new Error(bookingsError.message);

    const { data: blocks, error: blocksError } = await supabase
      .from("blocked_periods")
      .select("resource_id,starts_at,ends_at")
      .eq("business_id", input.businessId)
      .lt("starts_at", input.to)
      .gt("ends_at", input.from);

    if (blocksError) throw new Error(blocksError.message);

    const durationMs = service.duration_minutes * 60_000;
    const from = new Date(input.from);
    const to = new Date(input.to);
    const slots: AvailabilitySlot[] = [];

    for (const resource of resources ?? []) {
      for (let cursor = new Date(from); cursor < to; cursor = new Date(cursor.getTime() + 15 * 60_000)) {
        const day = cursor.getDay();
        const dayHours = (hours ?? []).find((h) => h.day_of_week === day);
        if (!dayHours || dayHours.closed || !dayHours.opens_at || !dayHours.closes_at) continue;

        const datePrefix = cursor.toISOString().slice(0, 10);
        const open = new Date(`${datePrefix}T${String(dayHours.opens_at).slice(0,8)}+02:00`);
        const close = new Date(`${datePrefix}T${String(dayHours.closes_at).slice(0,8)}+02:00`);

        const start = new Date(cursor);
        const end = new Date(start.getTime() + durationMs);
        if (start < open || end > close) continue;

        const overlapsBooking = (bookings ?? []).some((b) => {
          if (b.resource_id && b.resource_id !== resource.id) return false;
          return new Date(b.starts_at) < end && new Date(b.ends_at) > start;
        });

        const overlapsBlock = (blocks ?? []).some((b) => {
          if (b.resource_id && b.resource_id !== resource.id) return false;
          return new Date(b.starts_at) < end && new Date(b.ends_at) > start;
        });

        if (!overlapsBooking && !overlapsBlock) {
          slots.push({
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
            resourceId: resource.id
          });
        }
      }
    }

    return slots;
  }

  async createBooking(input: {
    businessId: string;
    customerId?: string;
    serviceId: string;
    resourceId?: string;
    startsAt: string;
    endsAt: string;
    notes?: string;
  }) {
    const supabase = createServerSupabaseClient();

    const { data: existing, error: conflictError } = await supabase
      .from("bookings")
      .select("id")
      .eq("business_id", input.businessId)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", input.endsAt)
      .gt("ends_at", input.startsAt);

    if (conflictError) throw new Error(conflictError.message);

    const conflict = (existing ?? []).length > 0;
    if (conflict) throw new Error("That time is no longer available");

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        business_id: input.businessId,
        customer_id: input.customerId ?? null,
        service_id: input.serviceId,
        resource_id: input.resourceId ?? null,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        status: "confirmed",
        provider: "inmotion",
        notes: input.notes ?? null
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async cancelBooking(input: { businessId: string; bookingId: string; reason?: string }) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", notes: input.reason ?? null, updated_at: new Date().toISOString() })
      .eq("business_id", input.businessId)
      .eq("id", input.bookingId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateBooking(input: {
    businessId: string;
    bookingId: string;
    startsAt: string;
    endsAt: string;
    resourceId?: string;
  }) {
    const supabase = createServerSupabaseClient();

    const { data: existing, error: conflictError } = await supabase
      .from("bookings")
      .select("id")
      .eq("business_id", input.businessId)
      .neq("id", input.bookingId)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", input.endsAt)
      .gt("ends_at", input.startsAt);

    if (conflictError) throw new Error(conflictError.message);
    if ((existing ?? []).length > 0) throw new Error("That time is no longer available");

    const { data, error } = await supabase
      .from("bookings")
      .update({
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        resource_id: input.resourceId ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("business_id", input.businessId)
      .eq("id", input.bookingId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async getBooking(input: { businessId: string; bookingId: string }) {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("business_id", input.businessId)
      .eq("id", input.bookingId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
