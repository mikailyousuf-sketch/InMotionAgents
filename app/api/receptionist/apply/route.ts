import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";
import { writeAuditLog } from "@/lib/audit/log";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const current = await getPrimaryUserBusiness();
  if (!["owner","admin"].includes(current.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const proposalId = String(body?.proposalId || "");
  const decision = String(body?.decision || "apply");

  if (!proposalId || !["apply","reject"].includes(decision)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: proposal } = await supabase
    .from("receptionist_change_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("business_id", current.business.id)
    .maybeSingle();

  if (!proposal) return Response.json({ error: "Proposal not found" }, { status: 404 });
  if (proposal.status !== "proposed") return Response.json({ error: "Proposal already reviewed" }, { status: 400 });

  if (decision === "reject") {
    await supabase
      .from("receptionist_change_proposals")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", proposal.id);

    return Response.json({ ok: true, status: "rejected" });
  }

  const changes = Array.isArray(proposal.changes) ? proposal.changes : [];

  try {
    for (const change of changes) {
      const type = change?.type;
      const data = change?.data || {};

      if (type === "tone") {
        const allowed = ["friendly_professional","casual","formal","luxury"];
        if (!allowed.includes(data.tone)) throw new Error("Unsupported tone");
        const { error } = await supabase
          .from("businesses")
          .update({ tone: data.tone, updated_at: new Date().toISOString() })
          .eq("id", current.business.id);
        if (error) throw error;
      }

      if (type === "faq") {
        if (!data.question || !data.answer) throw new Error("FAQ requires question and answer");
        const { error } = await supabase.from("business_faqs").insert({
          business_id: current.business.id,
          question: String(data.question),
          answer: String(data.answer),
          active: true
        });
        if (error) throw error;
      }

      if (type === "policy") {
        if (!data.title || !data.content) throw new Error("Policy requires title and content");
        const { error } = await supabase.from("business_policies").insert({
          business_id: current.business.id,
          title: String(data.title),
          content: String(data.content),
          policy_type: String(data.policy_type || "general"),
          active: true
        });
        if (error) throw error;
      }

      if (type === "guardrail") {
        if (!data.title || !data.instructions) throw new Error("Guardrail requires title and instructions");
        const { error } = await supabase.from("agent_guardrails").insert({
          business_id: current.business.id,
          rule_type: "custom",
          title: String(data.title),
          instructions: String(data.instructions),
          action: ["handover","block","warn"].includes(data.action) ? data.action : "handover",
          priority: Number(data.priority || 100),
          active: true
        });
        if (error) throw error;
      }

      if (type === "automation") {
        const templateBody = String(data.template_body || "").trim();
        let templateId: string | null = null;

        if (templateBody) {
          const { data: template, error: templateError } = await supabase
            .from("message_templates")
            .insert({
              business_id: current.business.id,
              name: `${String(data.name || "Receptionist automation")} template`,
              channel: String(data.channel || "whatsapp"),
              body: templateBody,
              template_type: "custom",
              active: true
            })
            .select("id")
            .single();

          if (templateError) throw templateError;
          templateId = template.id;
        }

        const triggerType = String(data.trigger_type || "manual");
        const config: any = {};
        if (triggerType === "booking_reminder") config.minutes_before = Number(data.minutes_before || 1440);
        if (triggerType === "lead_followup") config.delay_minutes = Number(data.delay_minutes || 1440);

        const { error } = await supabase.from("automations").insert({
          business_id: current.business.id,
          name: String(data.name || "Receptionist automation"),
          trigger_type: triggerType,
          status: "active",
          channel: String(data.channel || "whatsapp"),
          template_id: templateId,
          config
        });

        if (error) throw error;
      }
    }

    await supabase
      .from("receptionist_change_proposals")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", proposal.id);

    await writeAuditLog({
      businessId: current.business.id,
      actorUserId: user.id,
      action: "receptionist.change_applied",
      entityType: "receptionist_change_proposal",
      entityId: proposal.id,
      metadata: { changes }
    });

    return Response.json({ ok: true, status: "applied" });
  } catch (error) {
    await supabase
      .from("receptionist_change_proposals")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", proposal.id);

    return Response.json({
      error: error instanceof Error ? error.message : "Could not apply proposal"
    }, { status: 500 });
  }
}
