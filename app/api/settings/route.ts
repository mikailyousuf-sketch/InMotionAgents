import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getMembership(userId: string, businessId: string) {
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

  const businessId = new URL(request.url).searchParams.get("businessId");
  if (!businessId) return Response.json({ error: "businessId is required" }, { status: 400 });

  const membership = await getMembership(user.id, businessId);
  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  const admin = createServerSupabaseClient();
  const [
    { data: business },
    { data: services },
    { data: hours },
    { data: resources },
    { data: policies },
    { data: faqs }
  ] = await Promise.all([
    admin.from("businesses").select("*").eq("id", businessId).single(),
    admin.from("services").select("*").eq("business_id", businessId).order("name"),
    admin.from("business_hours").select("*").eq("business_id", businessId).order("day_of_week"),
    admin.from("resources").select("*").eq("business_id", businessId).order("name"),
    admin.from("business_policies").select("*").eq("business_id", businessId).order("title"),
    admin.from("business_faqs").select("*").eq("business_id", businessId).order("question")
  ]);

  return Response.json({ business, services: services ?? [], hours: hours ?? [], resources: resources ?? [], policies: policies ?? [], faqs: faqs ?? [], role: membership.role });
}

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const businessId = String(body?.businessId || "");
  const membership = await getMembership(user.id, businessId);

  if (!membership || !["owner","admin"].includes(membership.role)) {
    return Response.json({ error: "Owner or admin access required" }, { status: 403 });
  }

  const admin = createServerSupabaseClient();

  const { error: businessError } = await admin
    .from("businesses")
    .update({
      name: body.business?.name,
      description: body.business?.description || null,
      phone: body.business?.phone || null,
      email: body.business?.email || null,
      website: body.business?.website || null,
      timezone: body.business?.timezone || "Africa/Johannesburg",
      tone: body.business?.tone || "friendly_professional",
      agent_name: body.business?.agentName || "Ava",
      updated_at: new Date().toISOString()
    })
    .eq("id", businessId);

  if (businessError) return Response.json({ error: businessError.message }, { status: 500 });

  await Promise.all([
    admin.from("services").delete().eq("business_id", businessId),
    admin.from("business_hours").delete().eq("business_id", businessId),
    admin.from("resources").delete().eq("business_id", businessId),
    admin.from("business_policies").delete().eq("business_id", businessId),
    admin.from("business_faqs").delete().eq("business_id", businessId)
  ]);

  if (body.services?.length) {
    const { error } = await admin.from("services").insert(body.services.map((service:any)=>({
      business_id: businessId,
      name: service.name,
      description: service.description || null,
      duration_minutes: Number(service.durationMinutes || 30),
      price_cents: service.price === "" || service.price == null ? null : Math.round(Number(service.price) * 100),
      currency: service.currency || "ZAR",
      active: true
    })));
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (body.hours?.length) {
    const { error } = await admin.from("business_hours").insert(body.hours.map((row:any)=>({
      business_id: businessId,
      day_of_week: Number(row.dayOfWeek),
      opens_at: row.closed ? null : row.opensAt,
      closes_at: row.closed ? null : row.closesAt,
      closed: Boolean(row.closed)
    })));
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (body.resources?.length) {
    const { error } = await admin.from("resources").insert(body.resources.map((resource:any)=>({
      business_id: businessId,
      name: resource.name,
      resource_type: resource.type || "staff",
      active: true
    })));
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (body.policies?.length) {
    const { error } = await admin.from("business_policies").insert(body.policies.map((policy:any)=>({
      business_id: businessId,
      policy_type: policy.type || "general",
      title: policy.title,
      content: policy.content,
      active: true
    })));
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (body.faqs?.length) {
    const { error } = await admin.from("business_faqs").insert(body.faqs.map((faq:any)=>({
      business_id: businessId,
      question: faq.question,
      answer: faq.answer,
      active: true
    })));
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
