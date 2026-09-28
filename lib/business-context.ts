import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getBusinessContext(slug = "northstar-dental") {
  const supabase = createServerSupabaseClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,slug,timezone,booking_provider,description,phone,email,website,tone,agent_name,onboarding_complete")
    .eq("slug", slug)
    .single();

  if (businessError || !business) {
    throw new Error(`Business not found: ${businessError?.message ?? slug}`);
  }

  const [
    { data: services, error: servicesError },
    { data: hours, error: hoursError },
    { data: policies, error: policiesError },
    { data: faqs, error: faqsError }
  ] = await Promise.all([
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
      .order("day_of_week"),
    supabase
      .from("business_policies")
      .select("policy_type,title,content")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("title"),
    supabase
      .from("business_faqs")
      .select("question,answer")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("question")
  ]);

  if (servicesError) throw new Error(`Could not load services: ${servicesError.message}`);
  if (hoursError) throw new Error(`Could not load business hours: ${hoursError.message}`);
  if (policiesError) throw new Error(`Could not load policies: ${policiesError.message}`);
  if (faqsError) throw new Error(`Could not load FAQs: ${faqsError.message}`);

  return {
    business,
    services: services ?? [],
    hours: hours ?? [],
    policies: policies ?? [],
    faqs: faqs ?? []
  };
}
