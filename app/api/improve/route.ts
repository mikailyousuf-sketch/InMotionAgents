import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";
import { writeAuditLog } from "@/lib/audit/log";

export async function GET() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("knowledge_suggestions")
    .select("*")
    .eq("business_id", current.business.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({
    suggestions: data ?? [],
    role: current.role,
    business: current.business
  });
}

export async function PATCH(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  if (!["owner","admin"].includes(current.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const id = String(body?.id || "");
  const action = String(body?.action || "");

  if (!id || !["approve","dismiss"].includes(action)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: suggestion } = await supabase
    .from("knowledge_suggestions")
    .select("*")
    .eq("id", id)
    .eq("business_id", current.business.id)
    .maybeSingle();

  if (!suggestion) {
    return Response.json({ error: "Suggestion not found" }, { status: 404 });
  }

  if (action === "approve" && suggestion.suggestion_type !== "tone_insight") {
    const question = String(body?.question || suggestion.source_question || suggestion.title).trim();
    const answer = String(body?.answer || suggestion.suggested_answer || "").trim();

    if (!answer) {
      return Response.json({ error: "An approved answer is required" }, { status: 400 });
    }

    const { error: faqError } = await supabase
      .from("business_faqs")
      .insert({
        business_id: current.business.id,
        question,
        answer,
        active: true
      });

    if (faqError) return Response.json({ error: faqError.message }, { status: 500 });
  }

  if (action === "approve" && suggestion.suggestion_type === "tone_insight") {
    const tone = String(body?.tone || suggestion.metadata?.recommended_tone || "").trim();

    if (tone) {
      const { error: toneError } = await supabase
        .from("businesses")
        .update({ tone })
        .eq("id", current.business.id);

      if (toneError) return Response.json({ error: toneError.message }, { status: 500 });
    }
  }

  const { error } = await supabase
    .from("knowledge_suggestions")
    .update({
      status: action === "approve" ? "approved" : "dismissed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      suggested_answer: body?.answer ?? suggestion.suggested_answer
    })
    .eq("id", id)
    .eq("business_id", current.business.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await writeAuditLog({
    businessId: current.business.id,
    actorUserId: user.id,
    action: `knowledge_suggestion.${action}`,
    entityType: "knowledge_suggestion",
    entityId: id
  });

  return Response.json({ ok: true });
}
