import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function requireManager(userId: string, businessId: string) {
  const admin = createServerSupabaseClient();
  const { data } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data || !["owner","admin"].includes(data.role)) return null;
  return data;
}

export async function GET(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = new URL(request.url).searchParams.get("businessId");
  if (!businessId) return Response.json({ error: "businessId is required" }, { status: 400 });

  const manager = await requireManager(user.id, businessId);
  if (!manager) return Response.json({ error: "Forbidden" }, { status: 403 });

  const admin = createServerSupabaseClient();

  const [{ data: members }, { data: invites }] = await Promise.all([
    admin
      .from("business_members")
      .select("user_id,role,created_at")
      .eq("business_id", businessId)
      .order("created_at"),
    admin
      .from("business_invites")
      .select("id,email,role,token,accepted_at,expires_at,created_at")
      .eq("business_id", businessId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false })
  ]);

  const userIds = (members ?? []).map((member:any) => member.user_id);
  const { data: profiles } = userIds.length
    ? await admin.from("user_profiles").select("id,full_name").in("id", userIds)
    : { data: [] as any[] };

  const profileMap = new Map((profiles ?? []).map((profile:any) => [profile.id, profile]));

  const hydratedMembers = (members ?? []).map((member:any) => ({
    ...member,
    user_profiles: profileMap.get(member.user_id) ?? null
  }));

  return Response.json({ members: hydratedMembers, invites: invites ?? [] });
}

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const businessId = String(body?.businessId || "");
  const email = String(body?.email || "").trim().toLowerCase();
  const role = ["owner","admin","staff"].includes(body?.role) ? body.role : "staff";

  if (!businessId || !email) return Response.json({ error: "businessId and email are required" }, { status: 400 });

  const manager = await requireManager(user.id, businessId);
  if (!manager) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (role === "owner" && manager.role !== "owner") {
    return Response.json({ error: "Only an owner can invite another owner" }, { status: 403 });
  }

  const admin = createServerSupabaseClient();

  const { data: existingInvite } = await admin
    .from("business_invites")
    .select("id")
    .eq("business_id", businessId)
    .ilike("email", email)
    .is("accepted_at", null)
    .maybeSingle();

  if (existingInvite) return Response.json({ error: "A pending invite already exists for that email" }, { status: 409 });

  const { data: invite, error } = await admin
    .from("business_invites")
    .insert({
      business_id: businessId,
      email,
      role,
      invited_by: user.id
    })
    .select("id,email,role,token,expires_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ invite });
}

export async function PATCH(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const businessId = String(body?.businessId || "");
  const memberUserId = String(body?.userId || "");
  const role = ["owner","admin","staff"].includes(body?.role) ? body.role : null;

  if (!businessId || !memberUserId || !role) return Response.json({ error: "Invalid request" }, { status: 400 });

  const manager = await requireManager(user.id, businessId);
  if (!manager) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (role === "owner" && manager.role !== "owner") return Response.json({ error: "Only an owner can promote owners" }, { status: 403 });

  const admin = createServerSupabaseClient();
  const { error } = await admin
    .from("business_members")
    .update({ role })
    .eq("business_id", businessId)
    .eq("user_id", memberUserId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
