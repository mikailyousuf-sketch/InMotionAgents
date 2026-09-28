import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getCustomerProfile(customerId: string) {
  const supabase = createServerSupabaseClient();

  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();

  if (error || !customer) throw new Error(error?.message ?? "Customer not found");

  const [{ data: bookings }, { data: conversations }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,starts_at,ends_at,status,services(name),resources(name)")
      .eq("customer_id", customerId)
      .order("starts_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("id,status,channel,started_at,updated_at")
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false })
  ]);

  return {
    customer,
    bookings: bookings ?? [],
    conversations: conversations ?? []
  };
}

export async function listCustomers() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id,full_name,phone,email,lead_status,last_contacted_at,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
