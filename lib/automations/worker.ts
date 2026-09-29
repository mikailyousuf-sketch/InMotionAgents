import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isOptedOut } from "@/lib/automations/preferences";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { recordUsage } from "@/lib/billing/usage";

type ProcessOptions = {
  businessId?: string;
  limit?: number;
};

export async function processDueOutboundJobs(options: ProcessOptions = {}) {
  const supabase = createServerSupabaseClient();
  const limit = options.limit ?? 25;
  const now = new Date().toISOString();

  let pendingQuery = supabase
    .from("outbound_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("scheduled_for")
    .limit(limit);

  let failedQuery = supabase
    .from("outbound_jobs")
    .select("*")
    .eq("status", "failed")
    .not("next_attempt_at", "is", null)
    .lte("next_attempt_at", now)
    .order("next_attempt_at")
    .limit(limit);

  if (options.businessId) {
    pendingQuery = pendingQuery.eq("business_id", options.businessId);
    failedQuery = failedQuery.eq("business_id", options.businessId);
  }

  const [
    { data: pendingJobs, error: pendingError },
    { data: retryJobs, error: retryError }
  ] = await Promise.all([pendingQuery, failedQuery]);

  if (pendingError) throw new Error(pendingError.message);
  if (retryError) throw new Error(retryError.message);

  const jobs = [...(pendingJobs ?? []), ...(retryJobs ?? [])]
    .sort((a, b) => {
      const aTime = new Date(a.next_attempt_at || a.scheduled_for).getTime();
      const bTime = new Date(b.next_attempt_at || b.scheduled_for).getTime();
      return aTime - bTime;
    })
    .slice(0, limit);

  const results: any[] = [];

  for (const job of jobs) {
    const previousStatus = job.status;
    const nextAttempts = Number(job.attempts ?? 0) + 1;

    const { data: claimed } = await supabase
      .from("outbound_jobs")
      .update({
        status: "processing",
        attempts: nextAttempts,
        next_attempt_at: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id)
      .eq("status", previousStatus)
      .select("*")
      .maybeSingle();

    if (!claimed) continue;

    try {
      if (claimed.customer_id) {
        const optedOut = await isOptedOut({
          businessId: claimed.business_id,
          customerId: claimed.customer_id,
          channel: claimed.channel
        });

        if (optedOut) {
          await supabase
            .from("outbound_jobs")
            .update({
              status: "skipped",
              last_error: "Customer opted out",
              next_attempt_at: null,
              updated_at: new Date().toISOString()
            })
            .eq("id", claimed.id);

          results.push({ id: claimed.id, status: "skipped" });
          continue;
        }
      }

      if (claimed.channel !== "whatsapp") {
        throw new Error("Unsupported outbound channel: " + claimed.channel);
      }

      const { data: connections } = await supabase
        .from("integration_connections")
        .select("config")
        .eq("business_id", claimed.business_id)
        .eq("provider", "whatsapp")
        .eq("status", "connected");

      const phoneNumberId =
        (connections?.[0]?.config as any)?.phone_number_id ||
        process.env.META_PHONE_NUMBER_ID;

      if (!phoneNumberId) {
        throw new Error("WhatsApp phone number ID is not configured");
      }

      if (!claimed.destination) {
        throw new Error("Outbound job has no destination");
      }

      const sendResult: any = await sendWhatsAppText({
        phoneNumberId,
        to: String(claimed.destination).replace(/\D/g, ""),
        body: claimed.rendered_body
      });

      const externalMessageId = sendResult?.messages?.[0]?.id ?? null;

      await supabase
        .from("outbound_jobs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          external_message_id: externalMessageId,
          last_error: null,
          next_attempt_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", claimed.id);

      await recordUsage({
        businessId: claimed.business_id,
        eventType: "whatsapp_outbound",
        metadata: {
          outboundJobId: claimed.id,
          automationId: claimed.automation_id
        }
      });

      results.push({ id: claimed.id, status: "sent", externalMessageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown send error";
      const maxAttempts = Number(claimed.max_attempts ?? 3);
      const canRetry = nextAttempts < maxAttempts;
      const retryDelayMinutes = Math.min(60, Math.pow(2, Math.max(0, nextAttempts - 1)) * 5);
      const retryAt = canRetry
        ? new Date(Date.now() + retryDelayMinutes * 60_000).toISOString()
        : null;

      await supabase
        .from("outbound_jobs")
        .update({
          status: "failed",
          last_error: message,
          next_attempt_at: retryAt,
          updated_at: new Date().toISOString()
        })
        .eq("id", claimed.id);

      results.push({
        id: claimed.id,
        status: canRetry ? "retry_scheduled" : "failed",
        retryAt,
        error: message
      });
    }
  }

  return results;
}
