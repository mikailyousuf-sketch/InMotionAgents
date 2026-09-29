import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function getMembership(userId:string,businessId:string){
  const admin=createServerSupabaseClient();
  const {data}=await admin.from("business_members").select("role").eq("business_id",businessId).eq("user_id",userId).maybeSingle();
  return data;
}

export async function GET(request:Request){
  const auth=await createAuthServerClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user) return Response.json({error:"Unauthorized"},{status:401});

  const businessId=new URL(request.url).searchParams.get("businessId");
  if(!businessId) return Response.json({error:"businessId is required"},{status:400});

  const membership=await getMembership(user.id,businessId);
  if(!membership) return Response.json({error:"Forbidden"},{status:403});

  const admin=createServerSupabaseClient();
  const {data,error}=await admin
    .from("integration_connections")
    .select("id,provider,status,config,created_at,updated_at")
    .eq("business_id",businessId)
    .order("provider");

  if(error) return Response.json({error:error.message},{status:500});

  return Response.json({integrations:data??[],role:membership.role});
}

export async function POST(request:Request){
  const auth=await createAuthServerClient();
  const {data:{user}}=await auth.auth.getUser();
  if(!user) return Response.json({error:"Unauthorized"},{status:401});

  const body=await request.json();
  const businessId=String(body?.businessId||"");
  const provider=String(body?.provider||"");
  const status=["connected","setup_required","disconnected"].includes(body?.status)?body.status:"setup_required";

  if(!businessId||!provider) return Response.json({error:"businessId and provider are required"},{status:400});

  const membership=await getMembership(user.id,businessId);
  if(!membership||!["owner","admin"].includes(membership.role)){
    return Response.json({error:"Owner or admin access required"},{status:403});
  }

  const safeConfig:any={};
  const inputConfig=body?.config||{};

  // Only non-secret connection metadata is persisted here.
  for(const key of ["phone_number_id","whatsapp_business_account_id","calendar_id","external_business_id","base_url","location_id","booking_mode","phone_number","provider_name"]){
    if(inputConfig[key]) safeConfig[key]=String(inputConfig[key]);
  }

  const admin=createServerSupabaseClient();
  const {data,error}=await admin
    .from("integration_connections")
    .upsert({
      business_id:businessId,
      provider,
      status,
      config:safeConfig,
      updated_at:new Date().toISOString()
    },{onConflict:"business_id,provider"})
    .select("id,provider,status,config")
    .single();

  if(error) return Response.json({error:error.message},{status:500});

  if(provider==="inmotion_booking"&&status==="connected"){
    await admin.from("businesses").update({booking_provider:"inmotion"}).eq("id",businessId);
  }

  return Response.json({integration:data});
}
