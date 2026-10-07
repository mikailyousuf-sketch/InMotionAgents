import { createServerSupabaseClient } from "@/lib/supabase/server";
import { outlookGraphRequest } from "@/lib/integrations/outlook";
import { InMotionBookingProvider, AvailabilitySlot } from "@/lib/booking/inmotion-provider";

const localProvider = new InMotionBookingProvider();

function graphDate(value: string) {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  return new Date(normalized);
}

function graphUtc(value: string) {
  return new Date(value).toISOString().replace(/Z$/, "");
}

async function getCalendarId(businessId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .select("status,config")
    .eq("business_id", businessId)
    .eq("provider", "outlook")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.status !== "connected") throw new Error("Outlook Calendar is not connected.");

  const calendarId = String(data.config?.calendar_id || "");
  if (!calendarId) throw new Error("Outlook Calendar connection has no calendar selected.");
  return calendarId;
}

function calendarPath(calendarId: string, suffix: string) {
  return `me/calendars/${encodeURIComponent(calendarId)}/${suffix}`;
}

export class OutlookBookingProvider {
  async getAvailability(input: {
    businessId: string;
    serviceId: string;
    from: string;
    to: string;
    resourceId?: string;
  }): Promise<AvailabilitySlot[]> {
    const baseSlots = await localProvider.getAvailability(input);
    if (!baseSlots.length) return [];

    const calendarId = await getCalendarId(input.businessId);
    const query = new URLSearchParams({
      startDateTime: new Date(input.from).toISOString(),
      endDateTime: new Date(input.to).toISOString(),
      "$select": "id,start,end,showAs,isCancelled"
    });

    const result = await outlookGraphRequest(
      input.businessId,
      `${calendarPath(calendarId, "calendarView")}?${query.toString()}`
    );

    const busy = (result?.value || [])
      .filter((event: any) => !event?.isCancelled && String(event?.showAs || "busy").toLowerCase() !== "free")
      .map((event: any) => ({
        start: graphDate(String(event.start?.dateTime || "")),
        end: graphDate(String(event.end?.dateTime || ""))
      }))
      .filter((event: any) => !Number.isNaN(event.start.getTime()) && !Number.isNaN(event.end.getTime()));

    return baseSlots.filter((slot) => {
      const start = new Date(slot.startsAt);
      const end = new Date(slot.endsAt);
      return !busy.some((event: any) => event.start < end && event.end > start);
    });
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
    const calendarId = await getCalendarId(input.businessId);
    const supabase = createServerSupabaseClient();

    const [{ data: service }, customerResult] = await Promise.all([
      supabase
        .from("services")
        .select("name")
        .eq("business_id", input.businessId)
        .eq("id", input.serviceId)
        .maybeSingle(),
      input.customerId
        ? supabase
            .from("customers")
            .select("full_name,email,phone")
            .eq("business_id", input.businessId)
            .eq("id", input.customerId)
            .maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    const customer = customerResult.data as any;
    const local = await localProvider.createBooking(input);

    try {
      const event = await outlookGraphRequest(
        input.businessId,
        calendarPath(calendarId, "events"),
        {
          method: "POST",
          body: JSON.stringify({
            subject: `${service?.name || "Appointment"} · ${customer?.full_name || "Customer"}`,
            body: {
              contentType: "text",
              content: [
                "Booked by InMotion.",
                customer?.phone ? `Customer phone: ${customer.phone}` : "",
                input.notes || ""
              ].filter(Boolean).join("\n")
            },
            start: { dateTime: graphUtc(input.startsAt), timeZone: "UTC" },
            end: { dateTime: graphUtc(input.endsAt), timeZone: "UTC" },
            attendees: customer?.email
              ? [{
                  emailAddress: {
                    address: customer.email,
                    name: customer.full_name || customer.email
                  },
                  type: "required"
                }]
              : []
          })
        }
      );

      const { data: updated, error } = await supabase
        .from("bookings")
        .update({
          provider: "outlook",
          external_booking_id: event?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq("business_id", input.businessId)
        .eq("id", local.id)
        .select("*")
        .single();

      if (error) throw error;
      return updated;
    } catch (error) {
      await localProvider.cancelBooking({
        businessId: input.businessId,
        bookingId: local.id,
        reason: "Rolled back because Outlook event creation failed."
      }).catch(() => null);
      throw error;
    }
  }

  async cancelBooking(input: {
    businessId: string;
    bookingId: string;
    reason?: string;
  }) {
    const current = await localProvider.getBooking({
      businessId: input.businessId,
      bookingId: input.bookingId
    });

    if (current.provider === "outlook" && current.external_booking_id) {
      const calendarId = await getCalendarId(input.businessId);
      try {
        await outlookGraphRequest(
          input.businessId,
          calendarPath(calendarId, `events/${encodeURIComponent(current.external_booking_id)}`),
          { method: "DELETE" }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : "";
        if (!message.includes("not found") && !message.includes("does not exist")) throw error;
      }
    }

    return localProvider.cancelBooking(input);
  }

  async updateBooking(input: {
    businessId: string;
    bookingId: string;
    startsAt: string;
    endsAt: string;
    resourceId?: string;
  }) {
    const current = await localProvider.getBooking({
      businessId: input.businessId,
      bookingId: input.bookingId
    });

    const updated = await localProvider.updateBooking(input);

    if (current.provider === "outlook" && current.external_booking_id) {
      const calendarId = await getCalendarId(input.businessId);
      try {
        await outlookGraphRequest(
          input.businessId,
          calendarPath(calendarId, `events/${encodeURIComponent(current.external_booking_id)}`),
          {
            method: "PATCH",
            body: JSON.stringify({
              start: { dateTime: graphUtc(input.startsAt), timeZone: "UTC" },
              end: { dateTime: graphUtc(input.endsAt), timeZone: "UTC" }
            })
          }
        );
      } catch (error) {
        await localProvider.updateBooking({
          businessId: input.businessId,
          bookingId: input.bookingId,
          startsAt: current.starts_at,
          endsAt: current.ends_at,
          resourceId: current.resource_id || undefined
        }).catch(() => null);
        throw error;
      }
    }

    return updated;
  }

  async getBooking(input: { businessId: string; bookingId: string }) {
    return localProvider.getBooking(input);
  }
}
