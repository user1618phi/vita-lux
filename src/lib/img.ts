/* Placeholder imagery. Uses the same Unsplash source as the Vita Lux macket so
   the site is populated with real photos until brand photography is shot. When
   real assets land, swap these URLs for the CDN paths — call sites don't change. */

export function img(id: string, w = 800, h = 800): string {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=80`;
}
