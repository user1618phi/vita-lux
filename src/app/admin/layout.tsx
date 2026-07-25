import type { Metadata } from "next";
import "@/styles/globals.css";

/* Admin shell. Lives outside [locale] on purpose: it is Russian-only (the
   people using it do not need Kazakh), and keeping it out of the locale segment
   means the storefront's generateStaticParams and next-intl routing are
   untouched. The middleware matcher excludes /admin for the same reason. */

export const metadata: Metadata = {
  title: "Vita Lux — админка",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body style={{ background: "var(--surface-page)", color: "var(--text-primary)" }}>{children}</body>
    </html>
  );
}
