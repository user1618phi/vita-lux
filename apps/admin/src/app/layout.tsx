import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeScript } from "@vita/ui/theme/script";
import { adminEnabled } from "@/lib/admin-flag";
import "@/styles/globals.css";

/* Корневой layout админки — теперь это отдельное приложение, а не сегмент
   витрины. Русский язык единственный, поэтому next-intl здесь не подключён
   вовсе: раньше ради этого админку держали вне сегмента `[locale]`, теперь
   вопрос снят самой границей приложений. */

export const metadata: Metadata = {
  title: "Vita Lux — админка",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  /* Второй рубеж, за тем что в middleware. Server Action он остановить не может
     (тот выполняется до рендера layout) — это делает middleware. Нужен на
     случай, если матчер middleware когда-нибудь изменят. */
  if (!adminEnabled()) notFound();

  return (
    <html lang="ru">
      {/* Тема берётся та же, что на витрине: своего переключателя у админки нет,
          она просто следует выбору, сохранённому в localStorage. */}
      <head>
        <ThemeScript />
      </head>
      <body style={{ background: "var(--surface-page)", color: "var(--text-primary)" }}>{children}</body>
    </html>
  );
}
