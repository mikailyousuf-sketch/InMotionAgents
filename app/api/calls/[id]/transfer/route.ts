import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";
import { transferLiveSession } from "@/lib/voice/openai-control";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();

  if (!user) return Response.json({ error:"Unauthorized" },{ status:401 });

  const current = await getPrimaryUserBusiness();
  const { id } = await params;
  const body = await request.json();
  const targetUri = String(body?.targetUri || "").trim();

  if (!targetUri.startsWith("sip:")) {
    return Response.json(
      { error:"targetUri must be a SIP URI, for example sip:staff@example.com" },
      { status:400 }
    );
  }

  const supabase = createServerSupabaseClient();
  const { data: call, error } = await supabase
    .from("calls")
    .select("id,business_id,provider,external_call_id,status")
    .eq("id",id)
    .eq("business_id",current.business.id)
    .maybeSingle();

  if (error) return Response.json({ error:error.message },{ status:500 });
  if (!call) return Response.json({ error:"Call not found" },{ status:404 });
  if (call.provider !== "openai_sip" || !call.external_call_id) {
    return Response.json({ error:"This call is not controlled by OpenAI SIP" },{ status:409 });
  }
  if (["completed","failed","missed"].includes(call.status)) {
    return Response.json({ error:"Call is no longer active" },{ status:409 });
  }

  try {
    await transferLiveSession(call.external_call_id,targetUri);

    await supabase
      .from("calls")
      .update({
        status:"transferred",
        handled_by:"mixed",
        outcome:"Transferred to staff",
        updated_at:new Date().toISOString()
      })
      .eq("id",call.id);

    return Response.json({ ok:true });
  } catch (transferError) {
    const message=transferError instanceof Error?transferError.message:String(transferError);
    return Response.json({ error:message },{ status:502 });
  }
}
