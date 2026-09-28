import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();

  if (!user) {
    return Response.json({ businesses: [] }, { status: 200 });
  }

  const admin = createServerSupabaseClient();

  const { data: memberships, error } = await admin
    .from("business_members")
    .select("role,businesses(id,name,slug,onboarding_complete,created_at)")
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const businesses = (memberships ?? [])
    .map((row: any) => row.businesses)
    .filter(Boolean);

  return Response.json({ businesses });
}
