import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";
import { writeAuditLog } from "@/lib/audit/log";

export async function GET() {
  const userClient = await createAuthServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  const admin = createServerSupabaseClient();

  const { data, error } = await admin
    .from("agent_guardrails")
    .select("*")
    .eq("business_id", current.business.id)
    .order("priority");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    guardrails: data ?? [],
    business: current.business,
    role: current.role
  });
}

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  if (!["owner", "admin"].includes(current.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const title = String(body?.title || "").trim();
  const instructions = String(body?.instructions || "").trim();
  const ruleType = String(body?.ruleType || "custom");
  const action = ["handover", "block", "warn"].includes(body?.action) ? body.action : "handover";
  const priority = Number(body?.priority || 100);

  if (!title || !instructions) {
    return Response.json({ error: "Title and instructions are required" }, { status: 400 });
  }

  const admin = createServerSupabaseClient();
  const { data, error } = await admin
    .from("agent_guardrails")
    .insert({
      business_id: current.business.id,
      rule_type: ruleType,
      title,
      instructions,
      action,
      priority,
      active: true
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    businessId: current.business.id,
    actorUserId: user.id,
    action: "guardrail.created",
    entityType: "agent_guardrail",
    entityId: data.id,
    metadata: { title, action, priority }
  });

  return Response.json({ guardrail: data });
}

export async function PATCH(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  if (!["owner", "admin"].includes(current.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = String(body?.id || "");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const patch: any = { updated_at: new Date().toISOString() };
  for (const key of ["title", "instructions", "rule_type", "action", "priority", "active"]) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  const admin = createServerSupabaseClient();
  const { error } = await admin
    .from("agent_guardrails")
    .update(patch)
    .eq("id", id)
    .eq("business_id", current.business.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    businessId: current.business.id,
    actorUserId: user.id,
    action: "guardrail.updated",
    entityType: "agent_guardrail",
    entityId: id,
    metadata: patch
  });

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  if (!["owner", "admin"].includes(current.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { error } = await admin
    .from("agent_guardrails")
    .delete()
    .eq("id", id)
    .eq("business_id", current.business.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    businessId: current.business.id,
    actorUserId: user.id,
    action: "guardrail.deleted",
    entityType: "agent_guardrail",
    entityId: id
  });

  return Response.json({ ok: true });
}
