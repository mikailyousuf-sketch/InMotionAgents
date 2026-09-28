import { getPrimaryUserBusiness } from "@/lib/auth/access";

export async function GET() {
  const current = await getPrimaryUserBusiness();
  return Response.json({
    business: current.business,
    role: current.role
  });
}
