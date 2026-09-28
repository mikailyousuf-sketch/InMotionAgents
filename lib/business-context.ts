import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getBusinessContext(slug = "northstar-dental") {
  const supabase = createServerSupabaseClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,slug,timezone,booking_provider")
    .eq("slug", slug)
    .single();

  if (businessError || !business) {
    throw new Error(`Business not found: ${businessError?.message ?? slug}`);
  }

  const [{ data: services, error: servicesError }, { data: hours, error: hoursError }] =
    await Promise.all([
      supabase
        .from("services")
        .select("id,name,description,duration_minutes,price_cents,currency,active")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("name"),
      supabase
        .from("business_hours")
        .select("day_of_week,opens_at,closes_at,closed")
        .eq("business_id", business.id)
        .order("day_of_week")
    ]);

  if (servicesError) throw new Error(`Could not load services: ${servicesError.message}`);
  if (hoursError) throw new Error(`Could not load business hours: ${hoursError.message}`);

  return {
    business,
    services: services ?? [],
    hours: hours ?? []
  };
}
