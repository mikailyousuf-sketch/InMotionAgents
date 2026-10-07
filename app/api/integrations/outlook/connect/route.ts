import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OUTLOOK_SCOPES, outlookClientConfig } from "@/lib/integrations/outlook";

export async function GET(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const businessId = new URL(request.url).searchParams.get("businessId") || "";
  if (!businessId) return NextResponse.redirect(new URL("/integrations/outlook?error=missing-business", request.url));

  const admin = createServerSupabaseClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.redirect(new URL("/integrations/outlook?error=forbidden", request.url));
  }

  const origin = new URL(request.url).origin;
  const { clientId, redirectUri } = outlookClientConfig(origin);
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/integrations/outlook?error=not-configured", request.url));
  }

  const state = crypto.randomBytes(24).toString("hex");
  const authorize = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_mode", "query");
  authorize.searchParams.set("scope", OUTLOOK_SCOPES);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorize);
  response.cookies.set("inmotion_outlook_oauth", JSON.stringify({ state, businessId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/"
  });
  return response;
}
