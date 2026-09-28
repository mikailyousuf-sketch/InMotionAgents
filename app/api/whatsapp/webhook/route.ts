import crypto from "crypto";
import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { resolveWhatsAppBusiness } from "@/lib/whatsapp/resolve-business";
import {
  whatsappMessageAlreadyProcessed,
  setExternalMessageId,
  recordWhatsAppDeliveryEvent
} from "@/lib/whatsapp/messages";
import { findOrCreateCustomerByIdentity } from "@/lib/crm/identity";
import { parseOptPreference, setContactPreference } from "@/lib/automations/preferences";

export const runtime = "nodejs";

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;
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

  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid webhook signature", { status: 401 });
  }

  let payload: any;

  try {
    payload = JSON.parse(rawBody);
  } catch {
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

        if (!phoneNumberId) continue;

        let business: Awaited<ReturnType<typeof resolveWhatsAppBusiness>> | null = null;

        for (const status of value?.statuses ?? []) {
          try {
            if (!business) business = await resolveWhatsAppBusiness(phoneNumberId);
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

          if (await whatsappMessageAlreadyProcessed(externalMessageId)) {
            continue;
          }

          if (message?.type !== "text" || !message?.text?.body) {
            continue;
          }

          if (!business) business = await resolveWhatsAppBusiness(phoneNumberId);

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
        }
      }
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("WhatsApp webhook processing error", error);

    // Returning 200 prevents endless webhook retries for application-level failures.
    return new Response("EVENT_RECEIVED", { status: 200 });
  }
}
