import type { MetadataRoute } from "next";
import { listCategories, listHandles } from "@/lib/repo";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

/* Every public page in both locales, cross-linked with hreflang so Google
   serves the Kazakh version to Kazakh readers instead of treating the two as
   duplicates. */

export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const locales = routing.locales;

  /** One entry per locale, each listing the others as alternates. */
  const withAlternates = (path: string, priority: number, changeFrequency: Entry["changeFrequency"]): Entry[] =>
    locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [l, `${base}/${l}${path}`])),
      },
    }));

  const entries: Entry[] = [...withAlternates("", 1, "weekly")];

  try {
    for (const { slug } of await listCategories()) {
      entries.push(...withAlternates(`/catalog/${slug}`, 0.8, "daily"));
    }
    for (const handle of await listHandles()) {
      entries.push(...withAlternates(`/products/${handle}`, 0.7, "weekly"));
    }
  } catch {
    // Catalog source unreachable — still publish the static pages.
  }

  entries.push(...withAlternates("/privacy", 0.2, "yearly"));

  return entries;
}
