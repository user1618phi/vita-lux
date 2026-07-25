import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { listAdminProducts, logoutAction } from "../actions";
import { AdminNav, StockChip, inputStyle } from "../ui";
import { groupDigits } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");

  const { q } = await searchParams;
  const rows = await listAdminProducts(q);

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-5 pb-24">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="m-0 font-display text-[22px] text-ink">Товары</h1>
          <p className="m-0 mt-0.5 font-sans text-[13px] text-slate">
            {admin.username} · {admin.role === "owner" ? "владелец" : "менеджер"}
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md px-3 font-sans text-[13px]"
            style={{ height: 40, background: "transparent", border: "1px solid var(--border-control)", color: "var(--slate)", cursor: "pointer" }}
          >
            Выйти
          </button>
        </form>
      </header>

      <AdminNav current="products" />

      <form className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Поиск по названию или артикулу"
          style={inputStyle}
        />
        <Link
          href="/admin/products/new"
          className="flex-none grid place-items-center rounded-md px-4 font-sans text-[15px]"
          style={{ height: 48, background: "var(--ink)", color: "var(--glaze)", textDecoration: "none" }}
        >
          + Товар
        </Link>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-center font-sans text-[15px] text-slate">
          {q ? "Ничего не найдено" : "Товаров пока нет — добавьте первый"}
        </p>
      ) : (
        <ul className="mt-4 m-0 p-0 list-none flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.productId}>
              <Link
                href={`/admin/products/${r.productId}`}
                className="flex items-center gap-3 rounded-lg p-2.5"
                style={{
                  background: "var(--surface-card)",
                  border: "0.5px solid var(--border)",
                  textDecoration: "none",
                  opacity: r.status === "active" ? 1 : 0.55,
                }}
              >
                <span
                  className="flex-none grid place-items-center rounded-md overflow-hidden"
                  style={{ width: 56, height: 56, background: "var(--porcelain)" }}
                >
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span className="font-sans text-[11px] text-slate">нет фото</span>
                  )}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block truncate font-sans text-[15px] text-ink">{r.name}</span>
                  <span className="block mt-0.5 vl-mono text-[12px] text-slate">
                    {r.sku ?? "—"} · {r.categorySlug}
                    {r.status !== "active" ? " · скрыт" : ""}
                  </span>
                </span>

                <span className="flex-none text-right">
                  <span className="block vl-mono text-[15px] text-ink">
                    {r.retailKzt === null ? "по запросу" : `${groupDigits(r.retailKzt)} ₸`}
                  </span>
                  <span className="block mt-1">
                    <StockChip state={r.stock} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
