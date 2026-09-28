import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function resolveWhatsAppBusiness(phoneNumberId: string) {
  const supabase = createServerSupabaseClient();

  const { data: connections } = await supabase
    .from("integration_connections")
    .select("business_id,config")
    .eq("provider", "whatsapp")
    .eq("status", "connected");

  const connection = (connections ?? []).find(
    (row: any) => row?.config?.phone_number_id === phoneNumberId
  );

  if (connection?.business_id) {
    const { data: business, error } = await supabase
      .from("businesses")
      .select("id,slug,name")
      .eq("id", connection.business_id)
      .single();

    if (error || !business) throw new Error("Connected WhatsApp business could not be loaded");
    return business;
  }

  if (
    process.env.META_PHONE_NUMBER_ID &&
    process.env.META_PHONE_NUMBER_ID === phoneNumberId
  ) {
    const slug = process.env.WHATSAPP_DEMO_BUSINESS_SLUG || "northstar-dental";
    const { data: business, error } = await supabase
      .from("businesses")
      .select("id,slug,name")
      .eq("slug", slug)
      .single();

    if (error || !business) throw new Error("Demo WhatsApp business could not be loaded");
    return business;
  }

  throw new Error(`No business is connected to WhatsApp phone number ID ${phoneNumberId}`);
}
