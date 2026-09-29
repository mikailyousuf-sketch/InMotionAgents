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
    admin.from("services").select("*").eq("business_id", businessId).eq("active", true).order("name"),
    admin.from("business_hours").select("*").eq("business_id", businessId).order("day_of_week"),
    admin.from("resources").select("*").eq("business_id", businessId).eq("active", true).order("name"),
    admin.from("business_policies").select("*").eq("business_id", businessId).eq("active", true).order("title"),
    admin.from("business_faqs").select("*").eq("business_id", businessId).eq("active", true).order("question")
  ]);

  return Response.json({
    business,
    services: services ?? [],
    hours: hours ?? [],
    resources: resources ?? [],
    policies: policies ?? [],
    faqs: faqs ?? [],
    role: membership.role
  });
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

  const services = Array.isArray(body.services) ? body.services : [];
  const serviceIds = services.map((item:any)=>item.id).filter(Boolean);

  const { data: existingServices } = await admin
    .from("services")
    .select("id")
    .eq("business_id", businessId)
    .eq("active", true);

  const removedServiceIds = (existingServices ?? [])
    .map((item:any)=>item.id)
    .filter((id:string)=>!serviceIds.includes(id));

  if (removedServiceIds.length) {
    const { error } = await admin
      .from("services")
      .update({ active: false })
      .eq("business_id", businessId)
      .in("id", removedServiceIds);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  for (const service of services) {
    const payload = {
      business_id: businessId,
      name: service.name,
      description: service.description || null,
      duration_minutes: Number(service.durationMinutes || 30),
      price_cents: service.price === "" || service.price == null ? null : Math.round(Number(service.price) * 100),
      currency: service.currency || "ZAR",
      active: true
    };

    const query = service.id
      ? admin.from("services").update(payload).eq("id", service.id).eq("business_id", businessId)
      : admin.from("services").insert(payload);

    const { error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  const resources = Array.isArray(body.resources) ? body.resources : [];
  const resourceIds = resources.map((item:any)=>item.id).filter(Boolean);

  const { data: existingResources } = await admin
    .from("resources")
    .select("id")
    .eq("business_id", businessId)
    .eq("active", true);

  const removedResourceIds = (existingResources ?? [])
    .map((item:any)=>item.id)
    .filter((id:string)=>!resourceIds.includes(id));

  if (removedResourceIds.length) {
    const { error } = await admin
      .from("resources")
      .update({ active: false })
      .eq("business_id", businessId)
      .in("id", removedResourceIds);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  for (const resource of resources) {
    const payload = {
      business_id: businessId,
      name: resource.name,
      resource_type: resource.type || "staff",
      active: true
    };

    const query = resource.id
      ? admin.from("resources").update(payload).eq("id", resource.id).eq("business_id", businessId)
      : admin.from("resources").insert(payload);

    const { error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  // Business hours are not referenced by bookings, so replace only this safe schedule table.
  const { error: hoursDeleteError } = await admin
    .from("business_hours")
    .delete()
    .eq("business_id", businessId)
    .is("location_id", null);

  if (hoursDeleteError) return Response.json({ error: hoursDeleteError.message }, { status: 500 });

  if (body.hours?.length) {
    const { error } = await admin.from("business_hours").insert(body.hours.map((row:any)=>({
      business_id: businessId,
      location_id: null,
      day_of_week: Number(row.dayOfWeek),
      opens_at: row.closed ? null : row.opensAt,
      closes_at: row.closed ? null : row.closesAt,
      closed: Boolean(row.closed)
    })));
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  const policies = Array.isArray(body.policies) ? body.policies : [];
  const policyIds = policies.map((item:any)=>item.id).filter(Boolean);
  const { data: existingPolicies } = await admin.from("business_policies").select("id").eq("business_id", businessId).eq("active", true);
  const removedPolicyIds = (existingPolicies ?? []).map((item:any)=>item.id).filter((id:string)=>!policyIds.includes(id));

  if (removedPolicyIds.length) {
    const { error } = await admin.from("business_policies").update({ active:false }).eq("business_id",businessId).in("id",removedPolicyIds);
    if (error) return Response.json({ error:error.message },{status:500});
  }

  for (const policy of policies) {
    const payload = {
      business_id: businessId,
      policy_type: policy.type || "general",
      title: policy.title,
      content: policy.content,
      active: true
    };
    const query = policy.id
      ? admin.from("business_policies").update(payload).eq("id",policy.id).eq("business_id",businessId)
      : admin.from("business_policies").insert(payload);
    const { error } = await query;
    if (error) return Response.json({ error:error.message },{status:500});
  }

  const faqs = Array.isArray(body.faqs) ? body.faqs : [];
  const faqIds = faqs.map((item:any)=>item.id).filter(Boolean);
  const { data: existingFaqs } = await admin.from("business_faqs").select("id").eq("business_id",businessId).eq("active",true);
  const removedFaqIds = (existingFaqs ?? []).map((item:any)=>item.id).filter((id:string)=>!faqIds.includes(id));

  if (removedFaqIds.length) {
    const { error } = await admin.from("business_faqs").update({active:false}).eq("business_id",businessId).in("id",removedFaqIds);
    if (error) return Response.json({ error:error.message },{status:500});
  }

  for (const faq of faqs) {
    const payload = {
      business_id: businessId,
      question: faq.question,
      answer: faq.answer,
      active: true
    };
    const query = faq.id
      ? admin.from("business_faqs").update(payload).eq("id",faq.id).eq("business_id",businessId)
      : admin.from("business_faqs").insert(payload);
    const { error } = await query;
    if (error) return Response.json({ error:error.message },{status:500});
  }

  return Response.json({ ok: true });
}
