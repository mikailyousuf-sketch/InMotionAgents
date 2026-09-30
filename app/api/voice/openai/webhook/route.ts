import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findOrCreateCustomerByIdentity } from "@/lib/crm/identity";
import { resolveVoiceBusiness } from "@/lib/voice/resolve-business";
import { buildVoiceSessionPrompts } from "@/lib/voice/prompt";

export const runtime = "nodejs";

function safeEqualBase64(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function verifyOpenAIWebhook(rawBody: string, headers: Headers) {
  const secret = process.env.OPENAI_WEBHOOK_SECRET;
  if (!secret) return false;

  const webhookId = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");

  if (!webhookId || !timestamp || !signatureHeader) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  if (Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  const encodedSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(encodedSecret, "base64");
  } catch {
    return false;
  }

  const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  const supplied = signatureHeader
    .split(" ")
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => value.startsWith("v1,") ? value.slice(3) : "")
    .filter(Boolean);

  return supplied.some(signature => safeEqualBase64(expected, signature));
}

function sipHeader(headers: any[], name: string) {
  return headers.find((header:any) =>
    String(header?.name || "").toLowerCase() === name.toLowerCase()
  )?.value ?? null;
}

function extractPhoneFromSip(value: string | null) {
  if (!value) return null;
  const match = value.match(/sip:\+?([0-9]+)@/i);
  return match ? `+${match[1]}` : null;
}

async function claimWebhook(webhookId: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("webhook_receipts").insert({
    provider: "openai",
    external_event_id: webhookId,
    status: "processing",
    updated_at: new Date().toISOString()
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

async function finishWebhook(webhookId: string, businessId: string | null, error?: string) {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("webhook_receipts")
    .update({
      business_id: businessId,
      status: error ? "failed" : "completed",
      last_error: error ? error.slice(0,2000) : null,
      updated_at: new Date().toISOString()
    })
    .eq("provider","openai")
    .eq("external_event_id",webhookId);
}

async function acceptLiveSession(sessionId: string, slug: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const { voiceInstructions, backendInstructions } = await buildVoiceSessionPrompts(slug);

  const response = await fetch(
    `https://api.openai.com/v1/live/sessions/${encodeURIComponent(sessionId)}/accept`,
    {
      method:"POST",
      headers:{
        Authorization:`Bearer ${apiKey}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        session:{
          type:"live",
          model:process.env.OPENAI_LIVE_MODEL || "gpt-live-1",
          instructions:voiceInstructions,
          audio:{ output:{ voice:process.env.OPENAI_LIVE_VOICE || "marin" } },
          delegation:{
            type:"responses",
            responses:{
              model:process.env.OPENAI_LIVE_BACKEND_MODEL || "gpt-6-luna",
              instructions:backendInstructions
            }
          }
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`OpenAI Live accept failed (${response.status}): ${await response.text()}`);
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyOpenAIWebhook(rawBody, request.headers)) {
    return new Response("Invalid signature", { status: 400 });
  }

  const webhookId = request.headers.get("webhook-id");
  if (!webhookId) return new Response("Missing webhook id", { status: 400 });

  if (!(await claimWebhook(webhookId))) {
    return new Response("OK", { status: 200 });
  }

  let businessId: string | null = null;

  try {
    const event = JSON.parse(rawBody);
    const supported =
      event?.type === "live.transport.incoming" ||
      event?.type === "realtime.call.incoming";

    if (!supported) {
      await finishWebhook(webhookId, null);
      return new Response("OK", { status: 200 });
    }

    const data = event?.data ?? {};
    const sessionId = String(data.session_id || data.call_id || "");
    const headers = Array.isArray(data.sip_headers) ? data.sip_headers : [];

    if (!sessionId) throw new Error("Incoming voice event has no session id");

    const fromNumber = extractPhoneFromSip(sipHeader(headers,"From"));
    const toNumber = extractPhoneFromSip(sipHeader(headers,"To"));

    const business = await resolveVoiceBusiness(toNumber);
    businessId = business.id;

    const customer = fromNumber
      ? await findOrCreateCustomerByIdentity({
          businessId:business.id,
          identity:{ phone:fromNumber }
        })
      : null;

    const supabase = createServerSupabaseClient();

    const { error: callError } = await supabase
      .from("calls")
      .upsert({
        business_id:business.id,
        customer_id:customer?.id ?? null,
        provider:"openai_sip",
        external_call_id:sessionId,
        direction:"inbound",
        from_number:fromNumber,
        to_number:toNumber,
        status:"answered",
        handled_by:"ai",
        answered_at:new Date().toISOString(),
        metadata:{
          openai_event_type:event.type,
          openai_webhook_id:webhookId
        },
        updated_at:new Date().toISOString()
      },{ onConflict:"provider,external_call_id" });

    if (callError) throw new Error(callError.message);

    await acceptLiveSession(sessionId,business.slug);

    await finishWebhook(webhookId,business.id);
    return new Response("OK", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishWebhook(webhookId,businessId,message);
    console.error("OpenAI voice webhook error",error);
    return new Response("Voice webhook failed", { status: 500 });
  }
}
