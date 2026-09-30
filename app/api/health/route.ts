import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();

  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase
      .from("businesses")
      .select("id")
      .limit(1);

    if (error) throw new Error(error.message);

    return Response.json({
      status:"ok",
      database:"ok",
      latencyMs:Date.now()-started,
      timestamp:new Date().toISOString()
    },{
      headers:{ "Cache-Control":"no-store" }
    });
  } catch {
    return Response.json({
      status:"degraded",
      database:"unavailable",
      latencyMs:Date.now()-started,
      timestamp:new Date().toISOString()
    },{
      status:503,
      headers:{ "Cache-Control":"no-store" }
    });
  }
}
