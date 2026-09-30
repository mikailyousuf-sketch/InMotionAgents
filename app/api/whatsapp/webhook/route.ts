import crypto from "crypto";
import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { resolveWhatsAppBusiness } from "@/lib/whatsapp/resolve-business";
import {
  claimWhatsAppMessage,
  completeWhatsAppMessageReceipt,
  failWhatsAppMessageReceipt,
  setExternalMessageId,
  recordWhatsAppDeliveryEvent
} from "@/lib/whatsapp/messages";
import { findOrCreateCustomerByIdentity } from "@/lib/crm/identity";
import { parseOptPreference, setContactPreference } from "@/lib/automations/preferences";
import { writeAuditLog } from "@/lib/audit/log";

export const runtime = "nodejs";

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return false;
  if (!signature?.startsWith("sha256=")) return false;

  const expected = "sha256=" + crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    token === process.env.META_WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Webhook verification failed", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  await writeAuditLog({
    action: "whatsapp_webhook.received",
    entityType: "whatsapp_webhook",
    metadata: {
      signaturePresent: Boolean(request.headers.get("x-hub-signature-256")),
      contentLength: rawBody.length
    }
  });

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    await writeAuditLog({
      action: "whatsapp_webhook.signature_failed",
      entityType: "whatsapp_webhook",
      metadata: { signaturePresent: Boolean(request.headers.get("x-hub-signature-256")) }
    });
    return new Response("Invalid webhook signature", { status: 401 });
  }

  let payload: any;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    await writeAuditLog({
      action: "whatsapp_webhook.invalid_json",
      entityType: "whatsapp_webhook"
    });
    return new Response("Invalid JSON", { status: 400 });
  }

  if (payload?.object !== "whatsapp_business_account") {
    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change?.value;
        const phoneNumberId = value?.metadata?.phone_number_id;

        await writeAuditLog({
          action: "whatsapp_webhook.change_received",
          entityType: "whatsapp_webhook",
          metadata: {
            field: change?.field ?? null,
            phoneNumberId: phoneNumberId ?? null,
            messageCount: Array.isArray(value?.messages) ? value.messages.length : 0,
            statusCount: Array.isArray(value?.statuses) ? value.statuses.length : 0
          }
        });

        if (!phoneNumberId) continue;

        let business: Awaited<ReturnType<typeof resolveWhatsAppBusiness>> | null = null;

        for (const status of value?.statuses ?? []) {
          try {
            if (!business) {
            business = await resolveWhatsAppBusiness(phoneNumberId);
            await writeAuditLog({
              businessId: business.id,
              action: "whatsapp_webhook.business_resolved",
              entityType: "whatsapp_webhook",
              metadata: { phoneNumberId, businessSlug: business.slug }
            });
          }
            await recordWhatsAppDeliveryEvent({
              businessId: business.id,
              externalMessageId: String(status.id),
              status: String(status.status ?? "unknown"),
              payload: status
            });
          } catch (error) {
            console.error("WhatsApp status event error", error);
          }
        }

        for (const message of value?.messages ?? []) {
          const externalMessageId = String(message?.id ?? "");
          if (!externalMessageId) continue;

          const claimed = await claimWhatsAppMessage(externalMessageId);
          if (!claimed) continue;

          try {
            if (!business) business = await resolveWhatsAppBusiness(phoneNumberId);

            if (message?.type !== "text" || !message?.text?.body) {
              await completeWhatsAppMessageReceipt({
                externalMessageId,
                businessId: business.id
              });
              continue;
            }

          const whatsappId = String(message.from ?? "").replace(/\D/g, "");
          const phone = whatsappId ? `+${whatsappId}` : null;

          const matchingContact = (value?.contacts ?? []).find(
            (contact: any) => String(contact?.wa_id ?? "") === String(message.from ?? "")
          );

          const customer = await findOrCreateCustomerByIdentity({
            businessId: business.id,
            identity: {
              phone,
              fullName: matchingContact?.profile?.name ?? null
            }
          });

          const preference = parseOptPreference(String(message.text.body));

          if (preference) {
            await setContactPreference({
              businessId: business.id,
              customerId: customer.id,
              channel: "whatsapp",
              optedOut: preference === "opt_out",
              source: "whatsapp_keyword"
            });

            await setExternalMessageId({
              conversationId: (await runAgentTurn({
                businessSlug: business.slug,
                userMessage: String(message.text.body),
                channel: "whatsapp",
                externalThreadId: whatsappId,
                customer: {
                  id: customer.id,
                  phone,
                  fullName: matchingContact?.profile?.name ?? null
                }
              })).conversationId,
              externalMessageId,
              content: String(message.text.body)
            });

            await sendWhatsAppText({
              phoneNumberId,
              to: whatsappId,
              body: preference === "opt_out"
                ? "You’ve been opted out of automated WhatsApp messages. Reply START to opt back in."
                : "You’ve been opted back in to automated WhatsApp messages."
            });

            await completeWhatsAppMessageReceipt({
              externalMessageId,
              businessId: business.id
            });

            continue;
          }

          const result = await runAgentTurn({
            businessSlug: business.slug,
            userMessage: String(message.text.body),
            channel: "whatsapp",
            externalThreadId: whatsappId,
            customer: {
              id: customer.id,
              phone,
              fullName: matchingContact?.profile?.name ?? null
            }
          });

          await setExternalMessageId({
            conversationId: result.conversationId,
            externalMessageId,
            content: String(message.text.body)
          });

          if (result.message) {
            await sendWhatsAppText({
              phoneNumberId,
              to: whatsappId,
              body: result.message
            });
          }

          await completeWhatsAppMessageReceipt({
            externalMessageId,
            businessId: business.id
          });
          } catch (messageError) {
            const messageErrorText =
              messageError instanceof Error ? messageError.message : String(messageError);

            await failWhatsAppMessageReceipt({
              externalMessageId,
              businessId: business?.id ?? null,
              error: messageErrorText
            });

            console.error("WhatsApp message processing error", messageError);
          }
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("WhatsApp webhook processing error", error);
    await writeAuditLog({
      action: "whatsapp_webhook.processing_failed",
      entityType: "whatsapp_webhook",
      metadata: {
        error: error instanceof Error ? error.message : String(error)
      }
    });

    // Returning 200 prevents endless webhook retries for application-level failures.
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}
