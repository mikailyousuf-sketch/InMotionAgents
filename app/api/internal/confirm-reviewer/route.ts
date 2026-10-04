import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const REVIEWER_EMAIL = "reviewer@inmotionagents.co.za";

export async function GET() {
  const auth = await createAuthServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServerSupabaseClient();

  const { data: memberships, error: membershipError } = await admin
    .from("business_members")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1);

  if (membershipError) {
    return Response.json({ error: membershipError.message }, { status: 500 });
  }

  if (!memberships?.length) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: users, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    return Response.json({ error: listError.message }, { status: 500 });
  }

  const reviewer = users.users.find(
    (candidate) => candidate.email?.toLowerCase() === REVIEWER_EMAIL.toLowerCase()
  );

  if (!reviewer) {
    return Response.json({ error: "Reviewer user not found" }, { status: 404 });
  }

  const { data, error } = await admin.auth.admin.updateUserById(reviewer.id, {
    email_confirm: true,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    email: data.user?.email ?? REVIEWER_EMAIL,
    confirmed: Boolean(data.user?.email_confirmed_at),
  });
}
