import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  encryptOutlookToken,
  exchangeOutlookCode,
  outlookClientConfig,
  rawMicrosoftGraphRequest
} from "@/lib/integrations/outlook";

function redirectWith(request: Request, key: string, value: string) {
  const url = new URL("/integrations/outlook", request.url);
  url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const microsoftError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (microsoftError) return redirectWith(request, "error", "microsoft-cancelled");
  if (!code || !state) return redirectWith(request, "error", "missing-code");

  const cookieHeader = request.headers.get("cookie") || "";
  const rawCookie = cookieHeader
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith("inmotion_outlook_oauth="))
    ?.slice("inmotion_outlook_oauth=".length);

  if (!rawCookie) return redirectWith(request, "error", "expired-state");

  let saved: { state: string; businessId: string };
  try {
    saved = JSON.parse(decodeURIComponent(rawCookie));
  } catch {
    return redirectWith(request, "error", "invalid-state");
  }

  if (saved.state !== state || !saved.businessId) {
    return redirectWith(request, "error", "invalid-state");
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
    return redirectWith(request, "error", "forbidden");
  }

  try {
    const { redirectUri } = outlookClientConfig(new URL(request.url).origin);
    const token = await exchangeOutlookCode(code, redirectUri);
    const [profile, calendar] = await Promise.all([
      rawMicrosoftGraphRequest(token.accessToken, "me?$select=id,displayName,mail,userPrincipalName"),
      rawMicrosoftGraphRequest(token.accessToken, "me/calendar?$select=id,name,canEdit,owner")
    ]);

    const encrypted = encryptOutlookToken(token);
    const { error: integrationError } = await admin
      .from("integration_connections")
      .upsert({
        business_id: saved.businessId,
        provider: "outlook",
        status: "connected",
        config: {
          calendar_id: calendar?.id || null,
          calendar_name: calendar?.name || "Calendar",
          account_name: profile?.displayName || null,
          account_email: profile?.mail || profile?.userPrincipalName || null,
          microsoft_user_id: profile?.id || null,
          connected_at: new Date().toISOString()
        },
        credentials_encrypted: encrypted,
        updated_at: new Date().toISOString()
      }, { onConflict: "business_id,provider" });

    if (integrationError) throw integrationError;

    const { error: businessError } = await admin
      .from("businesses")
      .update({ booking_provider: "outlook", updated_at: new Date().toISOString() })
      .eq("id", saved.businessId);

    if (businessError) throw businessError;

    const response = redirectWith(request, "connected", "1");
    response.cookies.set("inmotion_outlook_oauth", "", { maxAge: 0, path: "/" });
    return response;
  } catch {
    const response = redirectWith(request, "error", "connection-failed");
    response.cookies.set("inmotion_outlook_oauth", "", { maxAge: 0, path: "/" });
    return response;
  }
}
