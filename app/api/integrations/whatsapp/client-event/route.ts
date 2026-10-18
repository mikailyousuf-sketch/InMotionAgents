import { createAuthServerClient } from "@/lib/supabase/auth-server";

const allowed = new Set([
  "source",
  "event",
  "eventType",
  "currentStep",
  "errorCode",
  "errorMessage",
  "fbStatus",
  "hasAuthResponse",
  "timestamp"
]);

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body || {})) {
    if (!allowed.has(key)) continue;
    if (typeof value === "string") safe[key] = value.slice(0, 500);
    else if (typeof value === "boolean" || typeof value === "number" || value == null) safe[key] = value;
  }

  console.info("whatsapp_embedded_signup_client_event", {
    userId: user.id,
    ...safe
  });

  return Response.json({ ok: true });
}
