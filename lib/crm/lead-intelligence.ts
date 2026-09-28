import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LeadSignal =
  | "general_question"
  | "pricing_interest"
  | "availability_interest"
  | "booking_intent"
  | "booking_created"
  | "payment_intent"
  | "not_interested";

const ranking = {
  new: 0,
  warm: 1,
  qualified: 2,
  converted: 3,
  lost: 4
} as const;

function targetStatus(signal: LeadSignal) {
  if (signal === "booking_created") return "converted";
  if (signal === "booking_intent" || signal === "payment_intent") return "qualified";
  if (signal === "pricing_interest" || signal === "availability_interest") return "warm";
  if (signal === "not_interested") return "lost";
  return "new";
}

export async function applyLeadSignal(input: {
  businessId: string;
  customerId: string;
  signal: LeadSignal;
}) {
  const supabase = createServerSupabaseClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id,lead_status")
    .eq("business_id", input.businessId)
    .eq("id", input.customerId)
    .single();

  if (error || !customer) throw new Error(error?.message ?? "Customer not found");

  const next = targetStatus(input.signal);
  const currentRank = ranking[customer.lead_status as keyof typeof ranking] ?? 0;
  const nextRank = ranking[next as keyof typeof ranking] ?? 0;

  const status =
    customer.lead_status === "lost"
      ? "lost"
      : next === "lost"
        ? "lost"
        : nextRank > currentRank
          ? next
          : customer.lead_status;

  const { data, error: updateError } = await supabase
    .from("customers")
    .update({
      lead_status: status,
      last_contacted_at: new Date().toISOString()
    })
    .eq("id", input.customerId)
    .select("*")
    .single();

  if (updateError) throw new Error(updateError.message);
  return data;
}
