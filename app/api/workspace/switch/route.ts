import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const businessId = String(body?.businessId || "");
  if (!businessId) return Response.json({ error: "businessId is required" }, { status: 400 });

  const admin = createServerSupabaseClient();
  const { data: membership } = await admin
    .from("business_members")
    .select("business_id")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return Response.json({ error: "Forbidden" }, { status: 403 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set("inmotion_business_id", businessId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}
