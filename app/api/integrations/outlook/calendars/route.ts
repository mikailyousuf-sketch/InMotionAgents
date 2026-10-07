import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { outlookGraphRequest } from "@/lib/integrations/outlook";

async function accessFor(userId: string, businessId: string) {
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
  if (!await accessFor(user.id, businessId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await outlookGraphRequest(
      businessId,
      "me/calendars?$select=id,name,canEdit,isDefaultCalendar&$top=100"
    );

    return Response.json({
      calendars: (result?.value || []).map((calendar: any) => ({
        id: calendar.id,
        name: calendar.name,
        canEdit: Boolean(calendar.canEdit),
        isDefault: Boolean(calendar.isDefaultCalendar)
      }))
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Could not load Outlook calendars."
    }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const businessId = String(body?.businessId || "");
  const calendarId = String(body?.calendarId || "");
  if (!businessId || !calendarId) {
    return Response.json({ error: "businessId and calendarId are required" }, { status: 400 });
  }

  const membership = await accessFor(user.id, businessId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return Response.json({ error: "Owner or admin access required" }, { status: 403 });
  }

  try {
    const calendar = await outlookGraphRequest(
      businessId,
      `me/calendars/${encodeURIComponent(calendarId)}?$select=id,name,canEdit`
    );
    if (!calendar?.canEdit) {
      return Response.json({ error: "Choose a calendar you can edit." }, { status: 422 });
    }

    const admin = createServerSupabaseClient();
    const { data: connection, error: readError } = await admin
      .from("integration_connections")
      .select("config")
      .eq("business_id", businessId)
      .eq("provider", "outlook")
      .single();

    if (readError) throw readError;

    const { error } = await admin
      .from("integration_connections")
      .update({
        config: {
          ...(connection.config || {}),
          calendar_id: calendar.id,
          calendar_name: calendar.name || "Calendar"
        },
        updated_at: new Date().toISOString()
      })
      .eq("business_id", businessId)
      .eq("provider", "outlook");

    if (error) throw error;

    return Response.json({
      calendar: { id: calendar.id, name: calendar.name || "Calendar" }
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Could not select Outlook calendar."
    }, { status: 502 });
  }
}
