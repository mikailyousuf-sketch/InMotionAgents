import { InMotionBookingProvider } from "@/lib/booking/inmotion-provider";
import { getBusinessContext } from "@/lib/business-context";

const provider = new InMotionBookingProvider();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const serviceId = url.searchParams.get("serviceId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const resourceId = url.searchParams.get("resourceId") ?? undefined;

  if (!serviceId || !from || !to) {
    return Response.json({ error: "serviceId, from and to are required" }, { status: 400 });
  }

  const context = await getBusinessContext("northstar-dental");
  const slots = await provider.getAvailability({
    businessId: context.business.id,
    serviceId,
    from,
    to,
    resourceId
  });

  return Response.json({ slots });
}

export async function POST(request: Request) {
  const body = await request.json();
  const context = await getBusinessContext("northstar-dental");

  const booking = await provider.createBooking({
    businessId: context.business.id,
    customerId: body.customerId,
    serviceId: body.serviceId,
    resourceId: body.resourceId,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    notes: body.notes
  });

  return Response.json({ booking });
}
