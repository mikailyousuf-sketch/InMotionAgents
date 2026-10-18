export const runtime = "nodejs";

export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!rawUrl || !anonKey) {
    return Response.json({
      ok: false,
      configured: false,
      reason: "Supabase environment variables are missing."
    }, { status: 503 });
  }

  let host = "invalid";
  try {
    host = new URL(rawUrl).host;
  } catch {
    return Response.json({
      ok: false,
      configured: true,
      host,
      reason: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL."
    }, { status: 503 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${rawUrl.replace(/\/$/, "")}/auth/v1/health`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`
      },
      signal: controller.signal,
      cache: "no-store"
    }).finally(() => clearTimeout(timer));

    const body = await response.text().catch(() => "");

    return Response.json({
      ok: response.ok,
      configured: true,
      host,
      status: response.status,
      authResponse: body.slice(0, 160)
    }, { status: response.ok ? 200 : 503 });
  } catch (error) {
    return Response.json({
      ok: false,
      configured: true,
      host,
      reason: error instanceof Error ? error.message : String(error)
    }, { status: 503 });
  }
}
