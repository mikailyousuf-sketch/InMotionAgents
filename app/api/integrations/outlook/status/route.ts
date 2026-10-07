import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { outlookGraphRequest } from "@/lib/integrations/outlook";

async function membershipFor(userId: string, businessId: string) {
  const admin = createServerSupabaseClient();
  const { data } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function GET(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = new URL(request.url).searchParams.get("businessId") || "";
  if (!businessId) return Response.json({ error: "businessId is required" }, { status: 400 });

  const membership = await membershipFor(user.id, businessId);
  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  const admin = createServerSupabaseClient();
  const { data: connection, error } = await admin
    .from("integration_connections")
    .select("status,config,credentials_encrypted,updated_at")
    .eq("business_id", businessId)
    .eq("provider", "outlook")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!connection || connection.status !== "connected") {
    return Response.json({ state: "not_connected", role: membership.role, meta: null });
  }

  if (!connection.credentials_encrypted) {
    return Response.json({ state: "needs_reconnection", role: membership.role, meta: connection.config || null });
  }

  try {
    const calendarId = String(connection.config?.calendar_id || "");
    const calendar = await outlookGraphRequest(
      businessId,
      calendarId
        ? `me/calendars/${encodeURIComponent(calendarId)}?$select=id,name,canEdit,owner`
        : "me/calendar?$select=id,name,canEdit,owner"
    );

    return Response.json({
      state: "connected",
      role: membership.role,
      meta: {
        ...(connection.config || {}),
        calendar_id: calendar?.id || calendarId || null,
        calendar_name: calendar?.name || connection.config?.calendar_name || "Calendar",
        can_edit: Boolean(calendar?.canEdit)
      }
    });
  } catch (error) {
    return Response.json({
      state: "needs_reconnection",
      role: membership.role,
      meta: connection.config || null,
      reason: error instanceof Error ? error.message : "Microsoft rejected the calendar connection."
    });
  }
}

export async function DELETE(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = new URL(request.url).searchParams.get("businessId") || "";
  if (!businessId) return Response.json({ error: "businessId is required" }, { status: 400 });

  const membership = await membershipFor(user.id, businessId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return Response.json({ error: "Owner or admin access required" }, { status: 403 });
  }

  const admin = createServerSupabaseClient();
  const { error } = await admin
    .from("integration_connections")
    .update({
      status: "disconnected",
      credentials_encrypted: null,
      updated_at: new Date().toISOString()
    })
    .eq("business_id", businessId)
    .eq("provider", "outlook");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await admin
    .from("businesses")
    .update({ booking_provider: "inmotion", updated_at: new Date().toISOString() })
    .eq("id", businessId)
    .eq("booking_provider", "outlook");

  return Response.json({ ok: true });
}
