import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import Link from "next/link";
import { listAdminProducts, listCategorySlugs, logoutAction } from "../actions";
import { AdminNav, PageShell } from "../ui";
import { BulkForm } from "./BulkForm";

export const dynamic = "force-dynamic";

/* Массовое редактирование идёт ПО КАТЕГОРИЯМ, а не по всему каталогу сразу.

   Экран рисует на каждую строку два поля и отправляет всё одним запросом, а
   серверный цикл делает на строку до пяти обращений к БД последовательно. На
   19 товарах разницы нет; на 200 это сотни полей в одной форме и запрос,
   который упрётся в таймаут функции — причём на середине, оставив часть цен
   изменённой, а часть нет. Категория держит пачку в разумном размере. */

export default async function BulkPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const { category } = await searchParams;
  const categories = await listCategorySlugs();
  const active = category && categories.includes(category) ? category : categories[0];
  const rows = active ? await listAdminProducts(undefined, { categorySlug: active }) : [];

  return (
    <PageShell
      title="Цены и наличие"
      width="wide"
      nav={
        <AdminNav current="bulk" role={admin.role} username={admin.username} logoutAction={logoutAction} />
      }
    >
      <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {categories.map((c) => (
          <Link
            key={c}
            href={`/bulk?category=${c}`}
            className="flex-none rounded-md px-3 font-sans leading-[44px]"
            style={{
              fontSize: "var(--text-body-s)",
              background: c === active ? "var(--action-primary-bg)" : "transparent",
              color: c === active ? "var(--action-primary-text)" : "var(--text-secondary)",
              border: c === active ? "none" : "1px solid var(--border-control)",
              textDecoration: "none",
            }}
          >
            {c}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <BulkForm rows={rows} />
      </div>
    </PageShell>
  );
}
