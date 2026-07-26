/* Channel attribution.

   The commission on a sale has to be attributable to the site, so first touch
   is captured on the very first request and carried, unchanged, until an order
   is placed. Two cookies:

     vl_sid  — an opaque session id, stable across the visit
     vl_attr — first-touch UTM parameters, referrer and landing path, JSON

   Both are written by middleware (which runs before any page) and read by the
   order action. First touch is never overwritten: if someone arrives from
   Instagram, wanders off and comes back directly a day later, the sale still
   belongs to Instagram. */

export const SID_COOKIE = "vl_sid";
export const ATTR_COOKIE = "vl_attr";
export const ATTR_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export interface FirstTouch {
  /** utm_source */ s?: string;
  /** utm_medium */ m?: string;
  /** utm_campaign */ c?: string;
  /** utm_content */ ct?: string;
  /** utm_term */ t?: string;
  /** referrer host */ r?: string;
  /** landing path */ p?: string;
  /** first touch timestamp (ms) */ at?: number;
}

const MAX_LEN = 120;

function clip(v: string | null): string | undefined {
  if (!v) return undefined;
  const s = v.trim().slice(0, MAX_LEN);
  return s || undefined;
}

/** Build the first-touch record for a request. */
export function readFirstTouch(url: URL, referrer: string | null): FirstTouch {
  const q = url.searchParams;

  let referrerHost: string | undefined;
  if (referrer) {
    try {
      const host = new URL(referrer).host;
      // Same-site navigation is not a referral.
      if (host && host !== url.host) referrerHost = host.slice(0, MAX_LEN);
    } catch {
      // unparseable Referer header — ignore
    }
  }

  return {
    s: clip(q.get("utm_source")),
    m: clip(q.get("utm_medium")),
    c: clip(q.get("utm_campaign")),
    ct: clip(q.get("utm_content")),
    t: clip(q.get("utm_term")),
    r: referrerHost,
    p: url.pathname.slice(0, MAX_LEN),
    at: Date.now(),
  };
}

/** True when there is anything worth remembering. */
export function hasSignal(f: FirstTouch): boolean {
  return Boolean(f.s || f.m || f.c || f.ct || f.t || f.r);
}

export function encodeFirstTouch(f: FirstTouch): string {
  return encodeURIComponent(JSON.stringify(f));
}

export function decodeFirstTouch(raw: string | undefined): FirstTouch | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as FirstTouch) : null;
  } catch {
    return null;
  }
}

/** Coarse channel label derived from first touch — what a report groups by. */
export function channelOf(f: FirstTouch | null): string {
  if (!f) return "direct";
  const src = (f.s ?? f.r ?? "").toLowerCase();
  if (!src) return "direct";
  if (src.includes("instagram") || src.includes("ig")) return "instagram";
  if (src.includes("whatsapp") || src.includes("wa.me")) return "whatsapp";
  if (src.includes("kaspi")) return "kaspi";
  if (src.includes("google") || src.includes("yandex") || src.includes("bing")) return "search";
  if (src.includes("facebook") || src.includes("tiktok") || src.includes("telegram")) return "social";
  return src;
}
