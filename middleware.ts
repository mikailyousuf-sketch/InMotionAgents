import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options","nosniff");
  response.headers.set("X-Frame-Options","DENY");
  response.headers.set("Referrer-Policy","strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy","same-origin");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

const AUTH_REFRESH_PREFIXES = [
  "/automations",
  "/bookings",
  "/calls",
  "/conversations",
  "/custom-work",
  "/customers",
  "/dashboard",
  "/guardrails",
  "/improve",
  "/integrations",
  "/lab",
  "/more",
  "/notification-settings",
  "/notifications",
  "/onboarding",
  "/operations",
  "/receptionist",
  "/settings",
  "/team",
  "/usage",
  "/whatsapp"
];

function shouldRefreshAuth(pathname: string) {
  return AUTH_REFRESH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Marketing/legal/login/API routes do not need a server-side session refresh.
  // Keeping Supabase off the public request path prevents an auth/network wobble
  // from taking the public website offline.
  if (!shouldRefreshAuth(request.nextUrl.pathname)) {
    return applySecurityHeaders(response);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return applySecurityHeaders(response);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Supabase auth refresh timed out")), 4000)
      )
    ]);
  } catch (error) {
    console.warn(
      "Middleware auth refresh skipped:",
      error instanceof Error ? error.message : String(error)
    );
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
