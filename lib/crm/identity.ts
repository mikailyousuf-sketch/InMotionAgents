import { createServerSupabaseClient } from "@/lib/supabase/server";

export type CustomerIdentity = {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
};

function cleanPhone(phone?: string | null) {
  if (!phone) return null;
  const normalized = phone.replace(/\s+/g, "").trim();
  return normalized || null;
}

function cleanEmail(email?: string | null) {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

export async function findOrCreateCustomerByIdentity(input: {
  businessId: string;
  identity: CustomerIdentity;
}) {
  const supabase = createServerSupabaseClient();
  const phone = cleanPhone(input.identity.phone);
  const email = cleanEmail(input.identity.email);
  const fullName = input.identity.fullName?.trim() || null;

  if (phone) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", input.businessId)
      .eq("phone", phone)
      .maybeSingle();

    if (data) {
      const updates: Record<string, unknown> = { last_contacted_at: new Date().toISOString() };
      if (!data.full_name && fullName) updates.full_name = fullName;
      if (!data.email && email) updates.email = email;

      const { data: updated } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", data.id)
        .select("*")
        .single();

      return updated ?? data;
    }
  }

  if (email) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", input.businessId)
      .eq("email", email)
      .maybeSingle();

    if (data) {
      const updates: Record<string, unknown> = { last_contacted_at: new Date().toISOString() };
      if (!data.full_name && fullName) updates.full_name = fullName;
      if (!data.phone && phone) updates.phone = phone;

      const { data: updated } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", data.id)
        .select("*")
        .single();

      return updated ?? data;
    }
  }

  if (fullName) {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", input.businessId)
      .ilike("full_name", fullName)
      .limit(1)
      .maybeSingle();

    if (data && !phone && !email) {
      await supabase
        .from("customers")
        .update({ last_contacted_at: new Date().toISOString() })
        .eq("id", data.id);
      return data;
    }
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      business_id: input.businessId,
      full_name: fullName,
      phone,
      email,
      lead_status: "new",
      last_contacted_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function attachConversationToCustomer(input: {
  businessId: string;
  conversationId: string;
  customerId: string;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("conversations")
    .update({
      customer_id: input.customerId,
      updated_at: new Date().toISOString()
    })
    .eq("business_id", input.businessId)
    .eq("id", input.conversationId);

  if (error) throw new Error(error.message);
}
