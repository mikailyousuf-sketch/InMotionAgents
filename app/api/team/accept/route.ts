import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const token = String(body?.token || "");
  if (!token) return Response.json({ error: "Invite token is required" }, { status: 400 });

  const admin = createServerSupabaseClient();

  const { data: invite, error } = await admin
    .from("business_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !invite) return Response.json({ error: "Invite is invalid or expired" }, { status: 404 });

  if ((user.email || "").toLowerCase() !== String(invite.email).toLowerCase()) {
    return Response.json({ error: "This invite was sent to a different email address" }, { status: 403 });
  }

  const { error: memberError } = await admin.from("business_members").upsert({
    business_id: invite.business_id,
    user_id: user.id,
    role: invite.role
  });

  if (memberError) return Response.json({ error: memberError.message }, { status: 500 });

  await admin
    .from("business_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return Response.json({ ok: true, businessId: invite.business_id });
}
