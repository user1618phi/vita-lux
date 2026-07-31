import Link from "next/link";
import { redirect } from "next/navigation";
import { groupDigits } from "@vita/core/format";
import { currentAdmin } from "@/lib/auth";
import { AppShell, Empty } from "@/components/AppShell";
import { DataTable, Muted, type Column } from "@/components/DataTable";
import { ErrorBox, StockChip, inputStyle } from "../ui";
import { checksFor, listProducts, publishable, type ProductRow } from "./readiness";
import { ReadyMarks } from "./ReadyMarks";
import { PublishReady } from "./PublishReady";

export const dynamic = "force-dynamic";

/* Товары.

   Экран, за которым сидят дольше всего: 92 позиции из X2pos приехали
   черновиками, и превратить их в товар для витрины можно только руками.
   Поэтому таблица, а не список карточек, и колонка готовности, которая
   отвечает на единственный нужный вопрос — что ещё осталось сделать. */

const FILTERS = [
  { key: "", label: "Все" },
  { key: "status=draft", label: "Черновики" },
  { key: "status=active", label: "На сайте" },
  { key: "issue=ready", label: "Готовы к публикации" },
  { key: "issue=nophoto", label: "Без фото" },
  { key: "issue=noprice", label: "На складе, но без цены" },
] as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; issue?: string; denied?: string }>;
}) {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const { q, status, issue, denied } = await searchParams;
  const rows = await listProducts({ q, status, issue });

  const readyToPublish = rows.filter((p) => p.status === "draft" && publishable(checksFor(p)));
  const current = status ? `status=${status}` : issue ? `issue=${issue}` : "";

  const columns: Column<ProductRow>[] = [
    {
      key: "name",
      header: "Товар",
      render: (p) => (
        <Link
          href={`/products/${p.productId}`}
          className="block min-w-0 truncate"
          style={{ color: "var(--text-primary)", textDecoration: "none" }}
        >
          {/* У черновика имя — это заглушка, которую синк поставил из артикула.
              Печатать «VL-1303 VL-1303» незачем: показываем артикул один раз и
              честно говорим, что названия для витрины ещё нет. */}
          {checksFor(p).name ? (
            <>
              {p.name}
              {p.sku ? (
                <>
                  {" "}
                  <Muted>{p.sku}</Muted>
                </>
              ) : null}
            </>
          ) : (
            <>
              {p.sku ?? p.handle} <Muted>без названия</Muted>
            </>
          )}
        </Link>
      ),
    },
    { key: "cat", header: "Раздел", secondary: true, render: (p) => <Muted>{p.categorySlug}</Muted> },
    { key: "ready", header: "Готовность", width: 150, render: (p) => <ReadyMarks checks={checksFor(p)} /> },
    {
      key: "price",
      header: "Цена",
      numeric: true,
      render: (p) => (p.retailKzt === null ? <Muted>по запросу</Muted> : `${groupDigits(p.retailKzt)} ₸`),
    },
    {
      key: "wholesale",
      header: "Опт",
      numeric: true,
      secondary: true,
      render: (p) => (p.wholesaleKzt === null ? <Muted>—</Muted> : `${groupDigits(p.wholesaleKzt)} ₸`),
    },
    {
      key: "qty",
      header: "Остаток",
      numeric: true,
      width: 90,
      render: (p) => (p.qty === null ? <Muted>—</Muted> : groupDigits(p.qty)),
    },
    { key: "stock", header: "Наличие", width: 110, secondary: true, render: (p) => <StockChip state={p.stock} /> },
    {
      key: "status",
      header: "Статус",
      width: 110,
      render: (p) =>
        p.status === "active" ? (
          <span style={{ color: "var(--state-success)" }}>На сайте</span>
        ) : p.status === "archived" ? (
          <Muted>Архив</Muted>
        ) : (
          <span style={{ color: "var(--brass-text)" }}>Черновик</span>
        ),
    },
  ];

  return (
    <AppShell
      title="Товары"
      subtitle={`${rows.length} позиций${q || current ? " по фильтру" : ""} · из X2pos ${rows.filter((p) => p.fromX2pos).length}`}
      actions={
        <Link
          href="/products/new"
          className="rounded-md px-3 leading-[40px]"
          style={{
            fontSize: "var(--text-body-s)",
            textDecoration: "none",
            background: "var(--action-primary-bg)",
            color: "var(--action-primary-text)",
          }}
        >
          Добавить товар
        </Link>
      }
    >
      <ErrorBox>{denied ? "Раздел доступен не всем ролям." : null}</ErrorBox>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Название или артикул"
            style={{ ...inputStyle, height: 40, width: 260 }}
            aria-label="Поиск товара"
          />
        </form>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const on = current === f.key;
            return (
              <Link
                key={f.key || "all"}
                href={f.key ? `/products?${f.key}` : "/products"}
                className="rounded-md px-3 leading-[32px]"
                style={{
                  fontSize: "var(--text-caption)",
                  textDecoration: "none",
                  background: on ? "var(--action-primary-bg)" : "transparent",
                  color: on ? "var(--action-primary-text)" : "var(--text-secondary)",
                  border: `1px solid ${on ? "transparent" : "var(--border-control)"}`,
                }}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {readyToPublish.length > 0 ? (
        <div className="mb-4">
          <PublishReady ids={readyToPublish.map((p) => p.productId)} count={readyToPublish.length} />
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(p) => p.productId}
        empty={<Empty title="Ничего не нашлось" hint="Снимите фильтр или измените запрос." />}
        footer={
          <span style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
            Готовность: И — название, Р — раздел, Ф — фото, Ц — цена, О — остаток. Публиковать можно,
            когда закрыты И, Р, Ф и Ц: товар под заказ продавать законно, без имени или цены — нет.
          </span>
        }
      />
    </AppShell>
  );
}
