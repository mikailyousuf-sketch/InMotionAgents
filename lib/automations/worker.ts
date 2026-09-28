import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isOptedOut } from "@/lib/automations/preferences";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { recordUsage } from "@/lib/billing/usage";

export async function processDueOutboundJobs(limit = 25) {
  const supabase = createServerSupabaseClient();

  const { data: jobs, error } = await supabase
    .from("outbound_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for")
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: any[] = [];

  for (const job of jobs ?? []) {
    const { data: claimed } = await supabase
      .from("outbound_jobs")
      .update({
        status: "processing",
        attempts: Number(job.attempts ?? 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", job.id)
      .eq("status", "pending")
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
              updated_at: new Date().toISOString()
            })
            .eq("id", claimed.id);

          results.push({ id: claimed.id, status: "skipped" });
          continue;
        }
      }

      if (claimed.channel !== "whatsapp") {
        throw new Error(`Unsupported outbound channel: ${claimed.channel}`);
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

      const externalMessageId =
        sendResult?.messages?.[0]?.id ??
        null;

      await supabase
        .from("outbound_jobs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          external_message_id: externalMessageId,
          last_error: null,
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
      await supabase
        .from("outbound_jobs")
        .update({
          status: "failed",
          last_error: error instanceof Error ? error.message : "Unknown send error",
          updated_at: new Date().toISOString()
        })
        .eq("id", claimed.id);

      results.push({
        id: claimed.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown send error"
      });
    }
  }

  return results;
}
