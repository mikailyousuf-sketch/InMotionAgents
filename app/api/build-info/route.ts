export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    app: "InMotion Agents",
    git_sha: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    git_ref: process.env.VERCEL_GIT_COMMIT_REF || "local",
    vercel_env: process.env.VERCEL_ENV || "local",
    deployment_url: process.env.VERCEL_URL || null,
    ui_revision: "agent-command-center-2026-10-04",
    built_at: new Date().toISOString()
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store"
    }
  });
}
