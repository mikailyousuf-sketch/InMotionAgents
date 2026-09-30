import { isInternalWorkerRequest } from "@/lib/security/internal-worker";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  checkAvailability,
  createBookingFromAgent,
  findBookings,
  cancelBookingFromAgent,
  rescheduleBookingFromAgent
} from "@/lib/booking/agent-tools";
import {
  findOrCreateCustomerByIdentity,
  attachConversationToCustomer
} from "@/lib/crm/identity";
import { requestHumanHandover } from "@/lib/crm/conversations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isInternalWorkerRequest(request)) {
    return Response.json({ error:"Unauthorized" },{ status:401 });
  }

  const body = await request.json();
  const sessionId = String(body?.sessionId || "");
  const name = String(body?.name || "");
  const args = body?.arguments && typeof body.arguments === "object" ? body.arguments : {};

  if (!sessionId || !name) {
    return Response.json({ error:"sessionId and name are required" },{ status:400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: call, error } = await supabase
    .from("calls")
    .select("id,business_id,customer_id,conversation_id,from_number,status,customers(id,full_name,phone,email)")
    .eq("provider","openai_sip")
    .eq("external_call_id",sessionId)
    .maybeSingle();

  if (error) return Response.json({ error:error.message },{ status:500 });
  if (!call) return Response.json({ error:"Voice call not found" },{ status:404 });

  const customer = Array.isArray((call as any).customers)
    ? (call as any).customers[0]
    : (call as any).customers;

  try {
    let result: unknown;

    switch(name) {
      case "check_availability":
        result = await checkAvailability({
          businessId:call.business_id,
          serviceName:String(args.serviceName || ""),
          from:String(args.from || ""),
          to:String(args.to || "")
        });
        break;

      case "create_booking":
        result = await createBookingFromAgent({
          businessId:call.business_id,
          serviceName:String(args.serviceName || ""),
          customerName:String(args.customerName || customer?.full_name || "Caller"),
          startsAt:String(args.startsAt || ""),
          resourceId:args.resourceId ? String(args.resourceId) : undefined,
          phone:String(args.phone || customer?.phone || call.from_number || "") || undefined,
          email:String(args.email || customer?.email || "") || undefined
        });
        break;

      case "find_bookings":
        result = await findBookings({
          businessId:call.business_id,
          customerName:String(args.customerName || customer?.full_name || "") || undefined,
          phone:String(args.phone || customer?.phone || call.from_number || "") || undefined
        });
        break;

      case "cancel_booking":
        result = await cancelBookingFromAgent({
          businessId:call.business_id,
          bookingId:String(args.bookingId || ""),
          reason:args.reason ? String(args.reason) : undefined
        });
        break;

      case "reschedule_booking":
        result = await rescheduleBookingFromAgent({
          businessId:call.business_id,
          bookingId:String(args.bookingId || ""),
          startsAt:String(args.startsAt || ""),
          resourceId:args.resourceId ? String(args.resourceId) : undefined
        });
        break;

      case "capture_customer_identity": {
        const resolved = await findOrCreateCustomerByIdentity({
          businessId:call.business_id,
          identity:{
            fullName:args.fullName ? String(args.fullName) : null,
            phone:args.phone ? String(args.phone) : (customer?.phone || call.from_number || null),
            email:args.email ? String(args.email) : null
          }
        });

        await supabase
          .from("calls")
          .update({ customer_id:resolved.id, updated_at:new Date().toISOString() })
          .eq("id",call.id);

        if (call.conversation_id) {
          await attachConversationToCustomer({
            businessId:call.business_id,
            conversationId:call.conversation_id,
            customerId:resolved.id
          });
        }

        result = {
          customerId:resolved.id,
          fullName:resolved.full_name,
          phone:resolved.phone,
          email:resolved.email
        };
        break;
      }

      case "request_human_handover":
        if (!call.conversation_id) {
          throw new Error("This voice call has no linked conversation for handover");
        }

        await requestHumanHandover({
          businessId:call.business_id,
          conversationId:call.conversation_id,
          reason:args.reason ? String(args.reason) : "Caller requested human assistance"
        });

        result = {
          handoverRequested:true,
          transferTarget:process.env.VOICE_TRANSFER_SIP_URI || null
        };
        break;

      default:
        return Response.json({ error:`Unsupported voice tool: ${name}` },{ status:400 });
    }

    return Response.json({ ok:true, result });
  } catch (toolError) {
    const message = toolError instanceof Error ? toolError.message : String(toolError);
    return Response.json({ ok:false, error:message },{ status:422 });
  }
}
