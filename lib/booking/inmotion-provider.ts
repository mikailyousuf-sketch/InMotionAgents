import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AvailabilitySlot = {
  startsAt: string;
  endsAt: string;
  resourceId: string | null;
  resourceName?: string;
};

function timeToMinutes(value: string | null | undefined) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function zonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  const weekdays: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };

  return {
    dayOfWeek: weekdays[parts.weekday] ?? 0,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

export class InMotionBookingProvider {
  async getAvailability(input: {
    businessId: string;
    serviceId: string;
    from: string;
    to: string;
    resourceId?: string;
  }): Promise<AvailabilitySlot[]> {
    const supabase = createServerSupabaseClient();

    const [
      { data: service, error: serviceError },
      { data: business, error: businessError },
      { data: mappings, error: mappingError },
      { data: hours, error: hoursError },
      { data: bookingSettings, error: bookingSettingsError }
    ] = await Promise.all([
      supabase
        .from("services")
        .select("id,duration_minutes,active")
        .eq("id", input.serviceId)
        .eq("business_id", input.businessId)
        .single(),
      supabase
        .from("businesses")
        .select("timezone")
        .eq("id", input.businessId)
        .single(),
      supabase
        .from("resource_services")
        .select("resource_id")
        .eq("service_id", input.serviceId),
      supabase
        .from("business_hours")
        .select("day_of_week,opens_at,closes_at,closed")
        .eq("business_id", input.businessId)
        .is("location_id", null),
      supabase
        .from("booking_settings")
        .select("slot_interval_minutes")
        .eq("business_id", input.businessId)
        .maybeSingle()
    ]);

    if (serviceError || !service || !service.active) throw new Error("Service not found or inactive");
    if (businessError || !business) throw new Error("Business not found");
    if (mappingError) throw new Error(mappingError.message);
    if (hoursError) throw new Error(hoursError.message);
    if (bookingSettingsError) throw new Error(bookingSettingsError.message);

    const timezone = business.timezone || "Africa/Johannesburg";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    } catch {
      throw new Error("Invalid business timezone: " + timezone);
    }

    const allowedResourceIds = (mappings ?? []).map((row) => row.resource_id);
    if (allowedResourceIds.length === 0) {
      throw new Error("This service has no staff or resource assigned yet");
    }

    if (input.resourceId && !allowedResourceIds.includes(input.resourceId)) {
      throw new Error("Selected staff/resource is not assigned to this service");
    }

    const { data: resources, error: resourceError } = await supabase
      .from("resources")
      .select("id,name")
      .eq("business_id", input.businessId)
      .eq("active", true)
      .in("id", input.resourceId ? [input.resourceId] : allowedResourceIds);

    if (resourceError) throw new Error(resourceError.message);
    if (!resources?.length) return [];

    const resourceIds = resources.map((resource) => resource.id);

    const [
      { data: bookings, error: bookingsError },
      { data: blocks, error: blocksError },
      { data: resourceHours, error: resourceHoursError }
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select("resource_id,starts_at,ends_at,status")
        .eq("business_id", input.businessId)
        .in("resource_id", resourceIds)
        .in("status", ["pending", "confirmed"])
        .lt("starts_at", input.to)
        .gt("ends_at", input.from),
      supabase
        .from("blocked_periods")
        .select("resource_id,starts_at,ends_at")
        .eq("business_id", input.businessId)
        .lt("starts_at", input.to)
        .gt("ends_at", input.from),
      supabase
        .from("resource_availability")
        .select("resource_id,day_of_week,starts_at,ends_at")
        .in("resource_id", resourceIds)
    ]);

    if (bookingsError) throw new Error(bookingsError.message);
    if (blocksError) throw new Error(blocksError.message);
    if (resourceHoursError) throw new Error(resourceHoursError.message);

    const durationMs = service.duration_minutes * 60_000;
    const slotIntervalMinutes = Number(bookingSettings?.slot_interval_minutes ?? 15);
    const slotIntervalMs = slotIntervalMinutes * 60_000;
    const from = new Date(input.from);
    const to = new Date(input.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new Error("Invalid availability window");
    }

    const slots: AvailabilitySlot[] = [];

    for (const resource of resources) {
      const specificAvailability = (resourceHours ?? []).filter(
        (row) => row.resource_id === resource.id
      );

      for (
        let cursor = new Date(Math.ceil(from.getTime() / slotIntervalMs) * slotIntervalMs);
        cursor < to;
        cursor = new Date(cursor.getTime() + slotIntervalMs)
      ) {
        const start = cursor;
        const end = new Date(start.getTime() + durationMs);
        if (end > to) continue;

        const localStart = zonedParts(start, timezone);
        const localEnd = zonedParts(new Date(end.getTime() - 1), timezone);

        if (localEnd.dayOfWeek !== localStart.dayOfWeek) continue;

        const dayHours = (hours ?? []).find(
          (row) => row.day_of_week === localStart.dayOfWeek
        );
        if (!dayHours || dayHours.closed) continue;

        const opensAt = timeToMinutes(dayHours.opens_at);
        const closesAt = timeToMinutes(dayHours.closes_at);
        if (opensAt == null || closesAt == null) continue;

        const endMinuteExclusive = localEnd.minuteOfDay + 1;
        if (localStart.minuteOfDay < opensAt || endMinuteExclusive > closesAt) continue;

        if (specificAvailability.length) {
          const allowedToday = specificAvailability.some((row) => {
            if (row.day_of_week !== localStart.dayOfWeek) return false;
            const resourceStart = timeToMinutes(row.starts_at);
            const resourceEnd = timeToMinutes(row.ends_at);
            return resourceStart != null &&
              resourceEnd != null &&
              localStart.minuteOfDay >= resourceStart &&
              endMinuteExclusive <= resourceEnd;
          });
          if (!allowedToday) continue;
        }

        const overlapsBooking = (bookings ?? []).some(
          (booking) =>
            booking.resource_id === resource.id &&
            new Date(booking.starts_at) < end &&
            new Date(booking.ends_at) > start
        );

        const overlapsBlock = (blocks ?? []).some(
          (block) =>
            (!block.resource_id || block.resource_id === resource.id) &&
            new Date(block.starts_at) < end &&
            new Date(block.ends_at) > start
        );

        if (!overlapsBooking && !overlapsBlock) {
          slots.push({
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
            resourceId: resource.id,
            resourceName: resource.name
          });
        }
      }
    }

    return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  private async assertResourceForService(input: {
    businessId: string;
    serviceId: string;
    resourceId: string;
  }) {
    const supabase = createServerSupabaseClient();

    const [{ data: resource }, { data: mapping }] = await Promise.all([
      supabase
        .from("resources")
        .select("id,active")
        .eq("id", input.resourceId)
        .eq("business_id", input.businessId)
        .maybeSingle(),
      supabase
        .from("resource_services")
        .select("resource_id")
        .eq("resource_id", input.resourceId)
        .eq("service_id", input.serviceId)
        .maybeSingle()
    ]);

    if (!resource?.active || !mapping) {
      throw new Error("Selected staff/resource is not available for this service");
    }
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

    if (!input.resourceId) throw new Error("A staff member or resource is required");

    await this.assertResourceForService({
      businessId: input.businessId,
      serviceId: input.serviceId,
      resourceId: input.resourceId
    });

    try {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          business_id: input.businessId,
          customer_id: input.customerId ?? null,
          service_id: input.serviceId,
          resource_id: input.resourceId,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          status: "confirmed",
          provider: "inmotion",
          notes: input.notes ?? null
        })
        .select("*")
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      if (
        error?.code === "23P01" ||
        String(error?.message || "").includes("bookings_resource_no_overlap")
      ) {
        throw new Error("That time was just booked by someone else. Please choose another slot.");
      }
      throw new Error(error?.message || "Could not create booking");
    }
  }

  async cancelBooking(input: {
    businessId: string;
    bookingId: string;
    reason?: string;
  }) {
    const supabase = createServerSupabaseClient();
    const current = await this.getBooking({
      businessId: input.businessId,
      bookingId: input.bookingId
    });

    if (current.status === "cancelled") return current;
    if (!["pending", "confirmed"].includes(current.status)) {
      throw new Error("Booking cannot be cancelled from status: " + current.status);
    }

    const { data, error } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        notes: input.reason ?? current.notes ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("business_id", input.businessId)
      .eq("id", input.bookingId)
      .in("status", ["pending", "confirmed"])
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
    const current = await this.getBooking({
      businessId: input.businessId,
      bookingId: input.bookingId
    });

    if (!["pending", "confirmed"].includes(current.status)) {
      throw new Error("Booking cannot be rescheduled from status: " + current.status);
    }

    const resourceId = input.resourceId ?? current.resource_id;
    if (!resourceId) throw new Error("A staff member or resource is required");

    await this.assertResourceForService({
      businessId: input.businessId,
      serviceId: current.service_id,
      resourceId
    });

    try {
      const { data, error } = await supabase
        .from("bookings")
        .update({
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          resource_id: resourceId,
          updated_at: new Date().toISOString()
        })
        .eq("business_id", input.businessId)
        .eq("id", input.bookingId)
        .in("status", ["pending", "confirmed"])
        .select("*")
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      if (
        error?.code === "23P01" ||
        String(error?.message || "").includes("bookings_resource_no_overlap")
      ) {
        throw new Error("That time was just booked by someone else. Please choose another slot.");
      }
      throw new Error(error?.message || "Could not reschedule booking");
    }
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
