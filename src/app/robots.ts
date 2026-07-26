import type { MetadataRoute } from "next";
import { isPublicSite, siteUrl } from "@/lib/site";

/* Until NEXT_PUBLIC_SITE_URL names a real domain, everything is disallowed.

   That is deliberate: the catalog still carries placeholder products and
   prices, and a fake price indexed today outlives the fix by months. Set the
   variable when the real assortment is in, and indexing switches on. */

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  if (!isPublicSite()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private or worthless-to-index surfaces.
        disallow: ["/admin", "/api", "/ru/order/", "/kk/order/", "/ru/cart", "/kk/cart", "/ru/checkout", "/kk/checkout"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
