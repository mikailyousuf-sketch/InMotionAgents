import { redirect } from "next/navigation";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireUser() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();

  if (!user) redirect("/login");
  return user;
}

export async function requireBusinessAccess(businessId: string) {
  const user = await requireUser();
  const admin = createServerSupabaseClient();

  const { data: membership, error } = await admin
    .from("business_members")
    .select("business_id,user_id,role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !membership) redirect("/dashboard");
  return { user, membership };
}

export async function listUserBusinesses() {
  const user = await requireUser();
  const admin = createServerSupabaseClient();

  const { data: memberships, error } = await admin
    .from("business_members")
    .select("role,businesses(id,name,slug,onboarding_complete,created_at)")
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  return memberships ?? [];
}
