import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { listAdminProducts, logoutAction } from "../actions";
import { AdminNav, ErrorBox, PageShell, StockChip, inputStyle } from "../ui";
import { groupDigits } from "@vita/core/format";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; denied?: string }>;
}) {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const { q, denied } = await searchParams;
  const rows = await listAdminProducts(q);

  return (
    <PageShell
      title="Товары"
      width="wide"
      nav={
        <AdminNav
          current="products"
          role={admin.role}
          username={admin.username}
          logoutAction={logoutAction}
        />
      }
    >
      {/* ErrorBox из ui, а не рукописная копия того же блока. */}
      <ErrorBox>{denied ? "Настройки доступны только владельцу." : null}</ErrorBox>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Поиск по названию или артикулу"
          style={{ ...inputStyle, flex: "1 1 200px", width: "auto" }}
        />
        <Link
          href="/products/new"
          className="flex-none grid place-items-center rounded-md px-4 font-sans"
          style={{
            height: 48,
            fontSize: "var(--text-body-s)",
            background: "var(--action-primary-bg)",
            color: "var(--action-primary-text)",
            textDecoration: "none",
          }}
        >
          + Товар
        </Link>
      </form>

      {rows.length === 0 ? (
        <p
          className="mt-8 text-center font-sans"
          style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)" }}
        >
          {q ? "Ничего не найдено" : "Товаров пока нет — добавьте первый"}
        </p>
      ) : (
        <ul className="mt-4 m-0 p-0 list-none flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.productId}>
              <Link
                href={`/products/${r.productId}`}
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
                  style={{ width: 56, height: 56, background: "var(--surface-media)" }}
                >
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt="" className="vl-photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span className="font-sans text-[length:var(--text-micro)] text-slate">нет фото</span>
                  )}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block truncate font-sans text-[length:var(--text-body-s)] text-ink">{r.name}</span>
                  <span className="block mt-0.5 vl-mono text-[length:var(--text-caption)] text-slate">
                    {r.sku ?? "—"} · {r.categorySlug}
                    {r.status !== "active" ? " · скрыт" : ""}
                  </span>
                </span>

                <span className="flex-none text-right">
                  <span className="block vl-mono text-[length:var(--text-body-s)] text-ink">
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
    </PageShell>
  );
}
