import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getCurrentBusiness(userId: string) {
  const admin = createServerSupabaseClient();
  const { data: memberships } = await admin
    .from("business_members")
    .select("role,businesses(id,name)")
    .eq("user_id", userId);

  return (memberships ?? [])
    .map((row: any) => ({
      role: row.role,
      business: Array.isArray(row.businesses) ? row.businesses[0] : row.businesses
    }))
    .find((row: any) => row.business?.id) ?? null;
}

export async function GET() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getCurrentBusiness(user.id);
  if (!current) return Response.json({ error: "No workspace" }, { status: 404 });

  const admin = createServerSupabaseClient();
  const { data, error } = await admin
    .from("notification_rules")
    .select("*")
    .eq("business_id", current.business.id)
    .order("created_at");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ rules: data ?? [], role: current.role, business: current.business });
}

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getCurrentBusiness(user.id);
  if (!current || !["owner","admin"].includes(current.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const eventType = String(body?.eventType || "human_handover");
  const recipientRole = ["owner","admin","staff"].includes(body?.recipientRole) ? body.recipientRole : null;
  const channel = ["in_app","whatsapp","email"].includes(body?.channel) ? body.channel : "in_app";
  const delayMinutes = Math.max(0, Number(body?.delayMinutes || 0));

  if (!recipientRole) {
    return Response.json({ error: "recipientRole is required" }, { status: 400 });
  }

  const admin = createServerSupabaseClient();
  const { data, error } = await admin
    .from("notification_rules")
    .insert({
      business_id: current.business.id,
      event_type: eventType,
      recipient_role: recipientRole,
      channel,
      delay_minutes: delayMinutes,
      active: true
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ rule: data });
}

export async function PATCH(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getCurrentBusiness(user.id);
  if (!current || !["owner","admin"].includes(current.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = String(body?.id || "");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { error } = await admin
    .from("notification_rules")
    .update({
      active: Boolean(body?.active),
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("business_id", current.business.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
