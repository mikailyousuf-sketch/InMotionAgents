import { createAuthServerClient } from "@/lib/supabase/auth-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPrimaryUserBusiness } from "@/lib/auth/access";
import { InMotionBookingProvider } from "@/lib/booking/inmotion-provider";

const provider = new InMotionBookingProvider();

async function requireAuthenticatedWorkspace() {
  const auth = await createAuthServerClient();
  const { data: { user } } = await auth.auth.getUser();

  if (!user) return null;

  const current = await getPrimaryUserBusiness();
  return { user, current };
}

export async function GET(request: Request) {
  const access = await requireAuthenticatedWorkspace();
  if (!access) return Response.json({ error:"Unauthorized" },{ status:401 });

  const url = new URL(request.url);
  const serviceId = url.searchParams.get("serviceId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const resourceId = url.searchParams.get("resourceId") ?? undefined;

  if (!serviceId || !from || !to) {
    return Response.json({ error:"serviceId, from and to are required" },{ status:400 });
  }

  const supabase = createServerSupabaseClient();
  const { data: service } = await supabase
    .from("services")
    .select("id")
    .eq("id",serviceId)
    .eq("business_id",access.current.business.id)
    .eq("active",true)
    .maybeSingle();

  if (!service) {
    return Response.json({ error:"Service not found in this workspace" },{ status:404 });
  }

  if (resourceId) {
    const { data: resource } = await supabase
      .from("resources")
      .select("id")
      .eq("id",resourceId)
      .eq("business_id",access.current.business.id)
      .eq("active",true)
      .maybeSingle();

    if (!resource) {
      return Response.json({ error:"Resource not found in this workspace" },{ status:404 });
    }
  }

  try {
    const slots = await provider.getAvailability({
      businessId:access.current.business.id,
      serviceId,
      from,
      to,
      resourceId
    });

    return Response.json({ slots });
  } catch (error) {
    return Response.json({
      error:error instanceof Error ? error.message : "Could not load availability"
    },{ status:422 });
  }
}

export async function POST(request: Request) {
  const access = await requireAuthenticatedWorkspace();
  if (!access) return Response.json({ error:"Unauthorized" },{ status:401 });

  const body = await request.json();
  const customerId = String(body?.customerId || "");
  const serviceId = String(body?.serviceId || "");
  const resourceId = body?.resourceId ? String(body.resourceId) : undefined;
  const startsAt = String(body?.startsAt || "");
  const endsAt = String(body?.endsAt || "");

  if (!customerId || !serviceId || !startsAt || !endsAt) {
    return Response.json({
      error:"customerId, serviceId, startsAt and endsAt are required"
    },{ status:400 });
  }

  const supabase = createServerSupabaseClient();
  const businessId = access.current.business.id;

  const [{ data: customer }, { data: service }, resourceResult] = await Promise.all([
    supabase.from("customers").select("id").eq("id",customerId).eq("business_id",businessId).maybeSingle(),
    supabase.from("services").select("id").eq("id",serviceId).eq("business_id",businessId).eq("active",true).maybeSingle(),
    resourceId
      ? supabase.from("resources").select("id").eq("id",resourceId).eq("business_id",businessId).eq("active",true).maybeSingle()
      : Promise.resolve({ data:null })
  ]);

  if (!customer) return Response.json({ error:"Customer not found in this workspace" },{ status:404 });
  if (!service) return Response.json({ error:"Service not found in this workspace" },{ status:404 });
  if (resourceId && !resourceResult.data) {
    return Response.json({ error:"Resource not found in this workspace" },{ status:404 });
  }

  try {
    const booking = await provider.createBooking({
      businessId,
      customerId,
      serviceId,
      resourceId,
      startsAt,
      endsAt,
      notes:body?.notes ? String(body.notes).slice(0,2000) : undefined
    });

    return Response.json({ booking });
  } catch (error) {
    return Response.json({
      error:error instanceof Error ? error.message : "Could not create booking"
    },{ status:422 });
  }
}


export async function PATCH(request: Request) {
  const access = await requireAuthenticatedWorkspace();
  if (!access) return Response.json({ error:"Unauthorized" },{ status:401 });

  const body = await request.json();
  const action = String(body?.action || "");
  const bookingId = String(body?.bookingId || "");
  if (!bookingId) return Response.json({ error:"bookingId is required" },{ status:400 });

  try {
    if (action === "cancel") {
      const booking = await provider.cancelBooking({
        businessId:access.current.business.id,
        bookingId,
        reason:body?.reason ? String(body.reason).slice(0,1000) : undefined
      });
      return Response.json({ booking });
    }

    return Response.json({ error:"Unsupported booking action" },{ status:400 });
  } catch (error) {
    return Response.json({
      error:error instanceof Error ? error.message : "Could not update booking"
    },{ status:422 });
  }
}
