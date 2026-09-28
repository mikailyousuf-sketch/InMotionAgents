import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";

async function getBusinessAndRole(_userId: string) {
  return getPrimaryUserBusiness();
}

export async function GET(){
  const auth=await createAuthServerClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user) return Response.json({error:"Unauthorized"},{status:401});

  const current=await getBusinessAndRole(user.id);
  if(!current) return Response.json({error:"No workspace"},{status:404});

  const admin=createServerSupabaseClient();
  const [{data:templates},{data:automations},{data:jobs}]=await Promise.all([
    admin.from("message_templates").select("*").eq("business_id",current.business.id).order("created_at",{ascending:false}),
    admin.from("automations").select("*,message_templates(name)").eq("business_id",current.business.id).order("created_at",{ascending:false}),
    admin.from("outbound_jobs").select("id,status,channel,destination,rendered_body,scheduled_for,sent_at,last_error,created_at").eq("business_id",current.business.id).order("created_at",{ascending:false}).limit(100)
  ]);

  return Response.json({business:current.business,role:current.role,templates:templates??[],automations:automations??[],jobs:jobs??[]});
}

export async function POST(request:Request){
  const auth=await createAuthServerClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user) return Response.json({error:"Unauthorized"},{status:401});

  const current=await getBusinessAndRole(user.id);
  if(!current||!["owner","admin"].includes(current.role)) return Response.json({error:"Forbidden"},{status:403});

  const body=await request.json();
  const admin=createServerSupabaseClient();

  if(body?.kind==="template"){
    const {data,error}=await admin.from("message_templates").insert({
      business_id:current.business.id,
      name:String(body.name||"Untitled"),
      channel:String(body.channel||"whatsapp"),
      body:String(body.body||""),
      template_type:String(body.templateType||"custom"),
      active:true
    }).select("*").single();
    if(error) return Response.json({error:error.message},{status:500});
    return Response.json({template:data});
  }

  if(body?.kind==="automation"){
    const triggerType=String(body.triggerType||"manual");
    const config:any={};
    if(triggerType==="booking_reminder"){
      config.minutes_before=Number(body.minutesBefore||1440);
    }
    if(triggerType==="lead_followup"){
      config.delay_minutes=Number(body.delayMinutes||1440);
    }
    const {data,error}=await admin.from("automations").insert({
      business_id:current.business.id,
      name:String(body.name||"Untitled automation"),
      trigger_type:triggerType,
      status:"active",
      channel:String(body.channel||"whatsapp"),
      template_id:body.templateId||null,
      config
    }).select("*").single();
    if(error) return Response.json({error:error.message},{status:500});
    return Response.json({automation:data});
  }

  return Response.json({error:"Unknown kind"},{status:400});
}

export async function PATCH(request:Request){
  const auth=await createAuthServerClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user) return Response.json({error:"Unauthorized"},{status:401});

  const current=await getBusinessAndRole(user.id);
  if(!current||!["owner","admin"].includes(current.role)) return Response.json({error:"Forbidden"},{status:403});

  const body=await request.json();
  const admin=createServerSupabaseClient();

  if(body?.kind==="automation"&&body?.id){
    const {error}=await admin.from("automations").update({
      status:body.status,
      updated_at:new Date().toISOString()
    }).eq("id",body.id).eq("business_id",current.business.id);
    if(error) return Response.json({error:error.message},{status:500});
    return Response.json({ok:true});
  }

  return Response.json({error:"Invalid request"},{status:400});
}
