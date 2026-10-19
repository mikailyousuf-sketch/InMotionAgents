import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { completeWhatsAppEmbeddedSignup } from "@/lib/whatsapp/embedded-signup";

function redirectResult(request: Request, params: Record<string,string>) {
  const url = new URL("/integrations/whatsapp", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const metaError = url.searchParams.get("error_description") || url.searchParams.get("error") || "";

  if (metaError) return redirectResult(request, { error: "meta-cancelled" });
  if (!code || !state) return redirectResult(request, { error: "missing-code" });

  const cookieHeader = request.headers.get("cookie") || "";
  const raw = cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith("inmotion_whatsapp_oauth="))
    ?.slice("inmotion_whatsapp_oauth=".length);

  if (!raw) return redirectResult(request, { error: "expired-state" });

  let saved: { state: string; businessId: string; redirectUri: string };
  try {
    saved = JSON.parse(decodeURIComponent(raw));
  } catch {
    return redirectResult(request, { error: "invalid-state" });
  }

  if (saved.state !== state || !saved.businessId || !saved.redirectUri) {
    return redirectResult(request, { error: "invalid-state" });
  }

  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const admin = createServerSupabaseClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", saved.businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return redirectResult(request, { error: "forbidden" });
  }

  try {
    await completeWhatsAppEmbeddedSignup({
      businessId: saved.businessId,
      code,
      redirectUri: saved.redirectUri,
      mode: "cloud_api"
    });

    const response = redirectResult(request, { connected: "1" });
    response.cookies.set("inmotion_whatsapp_oauth", "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    console.error("whatsapp_oauth_callback_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    const response = redirectResult(request, { error: "connection-failed" });
    response.cookies.set("inmotion_whatsapp_oauth", "", { maxAge: 0, path: "/" });
    return response;
  }
}
