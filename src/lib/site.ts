/* Canonical site origin, used by sitemap, robots, canonical URLs and OG tags.

   Falls back to the Vercel-provided host so preview deployments produce
   correct absolute URLs without configuration. Set NEXT_PUBLIC_SITE_URL to the
   real domain in production. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:8000";
}

/** True once a real domain is configured — gates indexing. */
export function isPublicSite(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SITE_URL);
}
