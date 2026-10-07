import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InMotionBookingProvider } from "@/lib/booking/inmotion-provider";
import { OutlookBookingProvider } from "@/lib/booking/outlook-provider";

const inmotion = new InMotionBookingProvider();
const outlook = new OutlookBookingProvider();

export async function getBookingProvider(businessId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("booking_provider")
    .eq("id", businessId)
    .single();

  if (error || !data) throw new Error(error?.message || "Business not found");

  if (data.booking_provider === "outlook") return outlook;

  // Google, Playtomic and other providers will plug into this router later.
  return inmotion;
}
