import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decryptCredential, encryptCredential } from "@/lib/integrations/credentials";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
export const OUTLOOK_SCOPES = "openid profile offline_access User.Read Calendars.ReadWrite";

type StoredOutlookToken = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
};

export function outlookClientConfig(origin?: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID || "";
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin || "";
  const redirectUri = baseUrl ? `${baseUrl.replace(/\/$/, "")}/api/integrations/outlook/callback` : "";

  return { clientId, clientSecret, redirectUri };
}

export async function exchangeOutlookCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = outlookClientConfig();
  if (!clientId || !clientSecret) throw new Error("Microsoft OAuth is not configured.");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: OUTLOOK_SCOPES
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || !data?.access_token || !data?.refresh_token) {
    throw new Error(data?.error_description || "Microsoft token exchange failed.");
  }

  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    scope: data.scope ? String(data.scope) : undefined
  } satisfies StoredOutlookToken;
}

async function refreshOutlookToken(refreshToken: string) {
  const { clientId, clientSecret } = outlookClientConfig();
  if (!clientId || !clientSecret) throw new Error("Microsoft OAuth is not configured.");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: OUTLOOK_SCOPES
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || "Microsoft refresh token was rejected.");
  }

  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token || refreshToken),
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
    scope: data.scope ? String(data.scope) : undefined
  } satisfies StoredOutlookToken;
}

function decodeStoredToken(value: any): StoredOutlookToken {
  if (!value?.ciphertext || !value?.iv || !value?.tag) {
    throw new Error("Outlook credentials are missing.");
  }
  return JSON.parse(decryptCredential({
    ciphertext: String(value.ciphertext),
    iv: String(value.iv),
    tag: String(value.tag)
  })) as StoredOutlookToken;
}

export function encryptOutlookToken(token: StoredOutlookToken) {
  return encryptCredential(JSON.stringify(token));
}

export async function getOutlookAccessToken(businessId: string, forceRefresh = false) {
  const supabase = createServerSupabaseClient();
  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("id,status,credentials_encrypted")
    .eq("business_id", businessId)
    .eq("provider", "outlook")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!connection || connection.status !== "connected") {
    throw new Error("Outlook Calendar is not connected.");
  }

  let token = decodeStoredToken(connection.credentials_encrypted);
  if (forceRefresh || token.expiresAt <= Date.now() + 90_000) {
    token = await refreshOutlookToken(token.refreshToken);
    const encrypted = encryptOutlookToken(token);
    const { error: updateError } = await supabase
      .from("integration_connections")
      .update({
        credentials_encrypted: encrypted,
        updated_at: new Date().toISOString()
      })
      .eq("id", connection.id);
    if (updateError) throw new Error(updateError.message);
  }

  return token.accessToken;
}

export async function outlookGraphRequest(
  businessId: string,
  path: string,
  init?: RequestInit
) {
  const request = async (token: string) => fetch(`${GRAPH_ROOT}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="UTC"',
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  let response = await request(await getOutlookAccessToken(businessId));
  if (response.status === 401) {
    response = await request(await getOutlookAccessToken(businessId, true));
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || `Microsoft Graph request failed (${response.status})`);
  }
  return data;
}

export async function rawMicrosoftGraphRequest(
  accessToken: string,
  path: string,
  init?: RequestInit
) {
  const response = await fetch(`${GRAPH_ROOT}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: 'outlook.timezone="UTC"',
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || `Microsoft Graph request failed (${response.status})`);
  }
  return data;
}
