import type { CatalogEntry } from "@/lib/repo";
import { siteUrl } from "@/lib/site";

/* Product structured data.

   Two reasons it matters here: price and availability in a search result are
   the difference between a click and a scroll past, and answer engines quote
   structured data far more readily than prose.

   No `aggregateRating` — the site has no reviews yet, and inventing one is both
   against policy and against the tone the reviews empty state sets. */

const AVAILABILITY: Record<string, string> = {
  in: "https://schema.org/InStock",
  order: "https://schema.org/PreOrder",
  out: "https://schema.org/OutOfStock",
};

export function ProductJsonLd({
  item,
  locale,
  brandName = "Vita Lux",
}: {
  item: CatalogEntry;
  locale: string;
  brandName?: string;
}) {
  const base = siteUrl();
  const url = `${base}/${locale}/products/${item.handle}`;

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.name,
    sku: item.sku,
    url,
    brand: { "@type": "Brand", name: brandName },
    ...(item.image ? { image: item.gallery?.length ? item.gallery : [item.image] } : {}),
    ...(item.material ? { material: item.material } : {}),
  };

  // A product priced "on request" gets no Offer — quoting ₸0 would be worse
  // than quoting nothing.
  if (!item.priceOnRequest) {
    data.offers = {
      "@type": "Offer",
      url,
      priceCurrency: "KZT",
      price: item.price,
      availability: AVAILABILITY[item.stock] ?? AVAILABILITY.order,
      seller: { "@type": "Organization", name: "Vita Lux" },
    };
  }

  return (
    <script
      type="application/ld+json"
      // Server-rendered from our own data; no user input reaches this string.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
