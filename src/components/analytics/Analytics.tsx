import Script from "next/script";

/* GA4 loader.

   src/lib/analytics.ts already emits the 14 typed events into window.dataLayer;
   nothing was ever listening. This mounts the tag so they land somewhere.

   Renders nothing unless NEXT_PUBLIC_GA_ID is set, so development and preview
   deployments stay out of the production property. */

export function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', { send_page_view: true });
        `}
      </Script>
    </>
  );
}
