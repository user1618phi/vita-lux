/* Whether this deployment serves the admin panel at all.

   Fail-closed on purpose: the flag must be set explicitly, so a deployment that
   forgets it — a demo, a preview, a fresh environment — ships the storefront
   without an admin login exposed on the public internet. Missing configuration
   should cost an admin a 404, never leak the back office.

   Read at call time rather than module scope. Under `next start` that is a real
   runtime read — verified: the same build serves 404s with the variable absent
   and the panel with it set. On Vercel the middleware runs on the Edge runtime,
   where the value is bound when the deployment is created, so flipping the flag
   there needs a redeploy, not just an env change.

   Not marked `server-only`: the middleware bundle is neither server nor client
   in that sense, and it is the one place that must consult this. */
export function adminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "1";
}
