import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function processEscalationJobs(limit = 25) {
  const supabase = createServerSupabaseClient();

  const { data: jobs, error } = await supabase
    .from("escalation_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for")
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: any[] = [];

  for (const job of jobs ?? []) {
    const { data: conversation } = job.conversation_id
      ? await supabase
          .from("conversations")
          .select("status")
          .eq("id", job.conversation_id)
          .maybeSingle()
      : { data: null };

    if (conversation && conversation.status !== "human") {
      await supabase
        .from("escalation_jobs")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString()
        })
        .eq("id", job.id);

      results.push({ id: job.id, status: "cancelled" });
      continue;
    }

    const metadata: any = job.metadata ?? {};
    const recipients: string[] = Array.isArray(metadata.recipients) ? metadata.recipients : [];

    for (const userId of recipients) {
      await supabase.from("notifications").insert({
        business_id: job.business_id,
        user_id: userId,
        conversation_id: job.conversation_id,
        customer_id: job.customer_id,
        event_type: job.event_type,
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
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id);

    results.push({ id: job.id, status: "sent" });
  }

  return results;
}
