import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();

  if (!user) {
    return Response.json({ error: "You must be logged in to create a workspace." }, { status: 401 });
  }

  const body = await request.json();
  const supabase = createServerSupabaseClient();

  const name = String(body?.business?.name || "").trim();
  if (!name) {
    return Response.json({ error: "Business name is required" }, { status: 400 });
  }

  const slug = slugify(body?.business?.slug || name);
  const timezone = body?.business?.timezone || "Africa/Johannesburg";

  const { data: existing } = await supabase
    .from("businesses")
    .select("id,created_by")
    .eq("slug", slug)
    .maybeSingle();

  if (existing?.id) {
    const { data: membership } = await supabase
      .from("business_members")
      .select("role")
      .eq("business_id", existing.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return Response.json({ error: "That workspace slug already exists." }, { status: 409 });
    }
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .upsert({
      name,
      slug,
      timezone,
      description: body?.business?.description || null,
      phone: body?.business?.phone || null,
      email: body?.business?.email || null,
      website: body?.business?.website || null,
      tone: body?.business?.tone || "friendly_professional",
      agent_name: body?.business?.agentName || "Ava",
      onboarding_complete: true,
      created_by: existing?.created_by || user.id
    }, { onConflict: "slug" })
    .select("*")
    .single();

  if (businessError || !business) {
    return Response.json({ error: businessError?.message || "Could not create business" }, { status: 500 });
  }

  await supabase.from("business_members").upsert({
    business_id: business.id,
    user_id: user.id,
    role: "owner"
  });

  await Promise.all([
    supabase.from("services").delete().eq("business_id", business.id),
    supabase.from("business_hours").delete().eq("business_id", business.id),
    supabase.from("resources").delete().eq("business_id", business.id),
    supabase.from("business_policies").delete().eq("business_id", business.id),
    supabase.from("business_faqs").delete().eq("business_id", business.id)
  ]);

  if (Array.isArray(body?.services) && body.services.length) {
    const { error } = await supabase.from("services").insert(
      body.services.map((service: any) => ({
        business_id: business.id,
        name: service.name,
        description: service.description || null,
        duration_minutes: Number(service.durationMinutes || 30),
        price_cents: service.price ? Math.round(Number(service.price) * 100) : null,
        currency: service.currency || "ZAR",
        active: true
      }))
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body?.hours) && body.hours.length) {
    const { error } = await supabase.from("business_hours").insert(
      body.hours.map((row: any) => ({
        business_id: business.id,
        day_of_week: Number(row.dayOfWeek),
        opens_at: row.closed ? null : row.opensAt,
        closes_at: row.closed ? null : row.closesAt,
        closed: Boolean(row.closed)
      }))
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body?.resources) && body.resources.length) {
    const { error } = await supabase.from("resources").insert(
      body.resources.map((resource: any) => ({
        business_id: business.id,
        name: resource.name,
        resource_type: resource.type || "staff",
        active: true
      }))
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body?.policies) && body.policies.length) {
    const { error } = await supabase.from("business_policies").insert(
      body.policies.map((policy: any) => ({
        business_id: business.id,
        policy_type: policy.type || "general",
        title: policy.title,
        content: policy.content,
        active: true
      }))
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(body?.faqs) && body.faqs.length) {
    const { error } = await supabase.from("business_faqs").insert(
      body.faqs.map((faq: any) => ({
        business_id: business.id,
        question: faq.question,
        answer: faq.answer,
        active: true
      }))
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ business });
}
