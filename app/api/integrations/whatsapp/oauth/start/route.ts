import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const businessId = new URL(request.url).searchParams.get("businessId") || "";
  if (!businessId) return NextResponse.redirect(new URL("/integrations/whatsapp?error=missing-business", request.url));

  const admin = createServerSupabaseClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.redirect(new URL("/integrations/whatsapp?error=forbidden", request.url));
  }

  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || "";
  const configId = process.env.NEXT_PUBLIC_META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || "";
  const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/integrations/whatsapp/oauth/callback`;

  if (!appId || !configId) {
    return NextResponse.redirect(new URL("/integrations/whatsapp?error=meta-not-configured", request.url));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const authUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("config_id", configId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("override_default_response_type", "true");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("extras", JSON.stringify({
    setup: {},
    sessionInfoVersion: "3",
    version: "v4"
  }));

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("inmotion_whatsapp_oauth", JSON.stringify({
    state,
    businessId,
    redirectUri
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/"
  });

  return response;
}
