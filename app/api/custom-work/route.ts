import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";
import { writeAuditLog } from "@/lib/audit/log";

export async function GET() {
  const auth=await createAuthServerClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user) return Response.json({error:"Unauthorized"},{status:401});

  const current=await getPrimaryUserBusiness();
  const supabase=createServerSupabaseClient();

  const {data,error}=await supabase
    .from("custom_work_requests")
    .select("*")
    .eq("business_id",current.business.id)
    .order("created_at",{ascending:false});

  if(error) return Response.json({error:error.message},{status:500});
  return Response.json({requests:data??[],role:current.role});
}

export async function POST(request:Request){
  const auth=await createAuthServerClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user) return Response.json({error:"Unauthorized"},{status:401});

  const current=await getPrimaryUserBusiness();
  const body=await request.json();

  const title=String(body?.title||"").trim();
  const description=String(body?.description||"").trim();
  const requestType=String(body?.requestType||"custom_automation");
  const currentSystems=String(body?.currentSystems||"").trim();
  const desiredOutcome=String(body?.desiredOutcome||"").trim();

  if(!title||!description){
    return Response.json({error:"Title and description are required"},{status:400});
  }

  const supabase=createServerSupabaseClient();
  const {data,error}=await supabase
    .from("custom_work_requests")
    .insert({
      business_id:current.business.id,
      requested_by:user.id,
      request_type:requestType,
      title,
      description,
      current_systems:currentSystems||null,
      desired_outcome:desiredOutcome||null,
      status:"new"
    })
    .select("*")
    .single();

  if(error) return Response.json({error:error.message},{status:500});

  await writeAuditLog({
    businessId:current.business.id,
    actorUserId:user.id,
    action:"custom_work.requested",
    entityType:"custom_work_request",
    entityId:data.id,
    metadata:{requestType,title}
  });

  return Response.json({request:data});
}
