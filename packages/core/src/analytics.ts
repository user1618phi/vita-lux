/* Analytics dispatch — thin, provider-agnostic wrapper.
   GA4 (dataLayer) + PostHog are the two sinks the brief calls for. Neither SDK
   is wired yet, so every call is a safe no-op until the snippets land; the event
   contract (names + params) is what matters and is fixed here.

   NB: `purchase` is ALSO sent server-side via the GA4 Measurement Protocol —
   client sends get eaten by ad-blockers (см. бриф). This module is client-only. */

export type AnalyticsEvent =
  | "view_item"
  | "view_item_list"
  | "select_item"
  | "add_to_cart"
  | "view_cart"
  | "begin_checkout"
  | "add_payment_info"
  | "purchase"
  | "whatsapp_click"
  | "kaspi_click"
  | "catalog_filter_used"
  | "bundle_added"
  | "language_switch"
  | "wholesale_lead";

type Params = Record<string, string | number | boolean | null | undefined | string[]>;

interface DataLayerWindow extends Window {
  dataLayer?: unknown[];
  posthog?: { capture: (event: string, props?: Params) => void };
}

export function track(event: AnalyticsEvent, params: Params = {}): void {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;

  // GA4 via dataLayer (gtag pushes an event object).
  w.dataLayer?.push({ event, ...params });

  // PostHog.
  w.posthog?.capture(event, params);

  if (process.env.NODE_ENV !== "production") {
    // Visible in dev so the event contract can be verified without the SDKs.
    console.debug("[analytics]", event, params);
  }
}
