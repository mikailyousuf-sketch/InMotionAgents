import { isInternalWorkerRequest } from "@/lib/security/internal-worker";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isInternalWorkerRequest(request)) {
    return Response.json({ error:"Unauthorized" },{ status:401 });
  }

  const body = await request.json();
  const sessionId = String(body?.sessionId || "");
  const event = String(body?.event || "");

  if (!sessionId || !event) {
    return Response.json({ error:"sessionId and event are required" },{ status:400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: call, error } = await supabase
    .from("calls")
    .select("id,status,started_at")
    .eq("provider","openai_sip")
    .eq("external_call_id",sessionId)
    .maybeSingle();

  if (error) return Response.json({ error:error.message },{ status:500 });
  if (!call) return Response.json({ error:"Call not found" },{ status:404 });

  if (event === "closed") {
    const endedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - new Date(call.started_at).getTime()) / 1000)
    );

    await supabase
      .from("calls")
      .update({
        status:call.status === "transferred" ? "transferred" : "completed",
        ended_at:endedAt.toISOString(),
        duration_seconds:durationSeconds,
        updated_at:endedAt.toISOString(),
        metadata:{
          ...(body?.metadata && typeof body.metadata === "object" ? body.metadata : {})
        }
      })
      .eq("id",call.id);
  } else if (event === "worker_error") {
    await supabase
      .from("calls")
      .update({
        outcome:"Voice worker error",
        metadata:{
          voice_worker_error:String(body?.error || "Unknown voice worker error")
        },
        updated_at:new Date().toISOString()
      })
      .eq("id",call.id);
  }

  return Response.json({ ok:true });
}
