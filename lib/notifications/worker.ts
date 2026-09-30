import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProcessEscalationOptions = {
  businessId?: string;
  limit?: number;
};

export async function processEscalationJobs(options: ProcessEscalationOptions = {}) {
  const supabase = createServerSupabaseClient();
  const limit = options.limit ?? 25;
  const now = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - 15 * 60_000).toISOString();

  let query = supabase
    .from("escalation_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .or(`claimed_at.is.null,claimed_at.lt.${staleCutoff}`)
    .order("scheduled_for")
    .limit(limit);

  if (options.businessId) {
    query = query.eq("business_id", options.businessId);
  }

  const { data: jobs, error } = await query;
  if (error) throw new Error(error.message);

  const results: any[] = [];

  for (const job of jobs ?? []) {
    let claim = supabase
      .from("escalation_jobs")
      .update({
        claimed_at: now,
        attempts: Number(job.attempts ?? 0) + 1,
        last_error: null,
        updated_at: now
      })
      .eq("id", job.id)
      .eq("status", "pending");

    claim = job.claimed_at
      ? claim.lt("claimed_at", staleCutoff)
      : claim.is("claimed_at", null);

    const { data: claimed, error: claimError } = await claim
      .select("*")
      .maybeSingle();

    if (claimError) throw new Error(claimError.message);
    if (!claimed) continue;

    try {
      const { data: conversation } = claimed.conversation_id
        ? await supabase
            .from("conversations")
            .select("status")
            .eq("id", claimed.conversation_id)
            .maybeSingle()
        : { data: null };

      if (conversation && conversation.status !== "human") {
        await supabase
          .from("escalation_jobs")
          .update({
            status: "cancelled",
            claimed_at: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", claimed.id);

        results.push({ id: claimed.id, status: "cancelled" });
        continue;
      }

      const metadata: any = claimed.metadata ?? {};
      const recipients: string[] = Array.isArray(metadata.recipients) ? metadata.recipients : [];

      for (const userId of recipients) {
        await supabase.from("notifications").insert({
          business_id: claimed.business_id,
          user_id: userId,
          conversation_id: claimed.conversation_id,
          customer_id: claimed.customer_id,
          event_type: claimed.event_type,
          title: metadata.title || "Escalation",
          body: metadata.body || "A conversation still needs human attention.",
          status: "unread",
          metadata: {
            escalated: true,
            channel: metadata.channel || "in_app"
          }
        });
      }

      await supabase
        .from("escalation_jobs")
        .update({
          status: "sent",
          claimed_at: null,
          last_error: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", claimed.id);

      results.push({ id: claimed.id, status: "sent" });
    } catch (jobError) {
      const errorText = jobError instanceof Error ? jobError.message : String(jobError);

      await supabase
        .from("escalation_jobs")
        .update({
          claimed_at: null,
          last_error: errorText.slice(0, 2000),
          updated_at: new Date().toISOString()
        })
        .eq("id", claimed.id);

      results.push({ id: claimed.id, status: "failed", error: errorText });
    }
  }

  return results;
}
