import { createServerSupabaseClient } from "@/lib/supabase/server";

function normalizePhone(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export async function resolveVoiceBusiness(toNumber: string | null) {
  const supabase = createServerSupabaseClient();
  const normalizedTo = normalizePhone(toNumber);

  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("business_id,config,businesses(id,name,slug,timezone,agent_name,tone)")
    .eq("provider", "voice")
    .eq("status", "connected");

  if (error) throw new Error(error.message);

  for (const connection of connections ?? []) {
    const configured = normalizePhone((connection.config as any)?.phone_number);
    if (!configured || !normalizedTo || configured !== normalizedTo) continue;

    const business = Array.isArray((connection as any).businesses)
      ? (connection as any).businesses[0]
      : (connection as any).businesses;

    if (business?.id) return business;
  }

  const fallbackSlug = process.env.VOICE_DEMO_BUSINESS_SLUG;
  if (!fallbackSlug) {
    throw new Error("No connected voice business matches the called number");
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("businesses")
    .select("id,name,slug,timezone,agent_name,tone")
    .eq("slug", fallbackSlug)
    .single();

  if (fallbackError || !fallback) {
    throw new Error(fallbackError?.message || "Voice fallback business not found");
  }

  return fallback;
}
