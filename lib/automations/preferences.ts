import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cancelPendingJobsForCustomer } from "@/lib/automations/queue";

const STOP_WORDS = new Set(["stop","unsubscribe","cancel","opt out","optout"]);
const START_WORDS = new Set(["start","subscribe","resume","unstop"]);

export function parseOptPreference(message: string) {
  const normalized = message.trim().toLowerCase();
  if (STOP_WORDS.has(normalized)) return "opt_out" as const;
  if (START_WORDS.has(normalized)) return "opt_in" as const;
  return null;
}

export async function setContactPreference(input: {
  businessId: string;
  customerId: string;
  channel: string;
  optedOut: boolean;
  source?: string;
}) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("contact_preferences")
    .upsert({
      business_id: input.businessId,
      customer_id: input.customerId,
      channel: input.channel,
      opted_out: input.optedOut,
      opted_out_at: input.optedOut ? new Date().toISOString() : null,
      source: input.source ?? null,
      updated_at: new Date().toISOString()
    }, { onConflict: "business_id,customer_id,channel" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  if (input.optedOut) {
    await cancelPendingJobsForCustomer({
      businessId: input.businessId,
      customerId: input.customerId,
      channel: input.channel
    });
  }

  return data;
}

export async function isOptedOut(input: {
  businessId: string;
  customerId: string;
  channel: string;
}) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("contact_preferences")
    .select("opted_out")
    .eq("business_id", input.businessId)
    .eq("customer_id", input.customerId)
    .eq("channel", input.channel)
    .maybeSingle();

  return Boolean(data?.opted_out);
}
