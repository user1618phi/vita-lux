import { redirect } from "next/navigation";
import { formatTenge, groupDigits } from "@vita/core/format";
import { currentAdmin } from "@/lib/auth";
import { listAccounts, listCustomers, listDocs, mirrorAge, salesSummary } from "@/lib/x2pos-read";
import { AppShell, Empty, Panel, Section } from "@/components/AppShell";
import { DataTable, Muted, type Column } from "@/components/DataTable";
import { StatRow, StatTile } from "@/components/StatTile";
import type { Account, Customer, Doc } from "@/lib/x2pos-read";

export const dynamic = "force-dynamic";

/* Склад: зеркало X2pos, только чтение.

   Здесь не редактируют — X2pos обслуживает ещё и магазин, и бухгалтерия
   владельца не должна меняться из панели сайта. Задача экрана — дать полную
   картину: что лежит, что приехало, кто должен, где деньги. */

const DOC_STATUS: Record<string, { label: string; tone: string }> = {
  completed: { label: "Проведён", tone: "var(--state-success)" },
  draft: { label: "Черновик", tone: "var(--brass-text)" },
  canceled: { label: "Отменён", tone: "var(--text-secondary)" },
  waiting_to_confirm: { label: "Ждёт подтверждения", tone: "var(--brass-text)" },
};

export default async function WarehousePage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  /* Всё из своей базы: справочники сюда зеркалит воркер, экран в X2pos не
     ходит и потому не может из-за него упасть. */
  const [accounts, customers, docs, sales, age] = await Promise.all([
    listAccounts(),
    listCustomers(),
    listDocs(),
    salesSummary(),
    mirrorAge(),
  ]);

  const money = accounts.reduce((a, x) => a + x.amount, 0);
  const debt = customers.reduce((a, c) => a + c.debt, 0);
  const debtors = customers.filter((c) => c.debt > 0);
  const drafts = docs.filter((d) => d.status === "draft");

  const accountCols: Column<Account>[] = [
    { key: "name", header: "Счёт", render: (a) => a.name },
    { key: "type", header: "Тип", secondary: true, render: (a) => <Muted>{a.type}</Muted> },
    { key: "amount", header: "Остаток", numeric: true, render: (a) => formatTenge(a.amount) },
  ];

  const customerCols: Column<Customer>[] = [
    { key: "name", header: "Клиент", render: (c) => c.name },
    { key: "city", header: "Город", secondary: true, render: (c) => <Muted>{c.city ?? "—"}</Muted> },
    { key: "phone", header: "Телефон", secondary: true, render: (c) => <Muted>{c.phone ?? "—"}</Muted> },
    {
      key: "debt",
      header: "Долг",
      numeric: true,
      render: (c) =>
        c.debt > 0 ? (
          <span style={{ color: "var(--state-danger)" }}>{formatTenge(c.debt)}</span>
        ) : (
          <Muted>—</Muted>
        ),
    },
  ];

  const docCols: Column<Doc>[] = [
    { key: "date", header: "Дата", width: 110, render: (d) => d.date || "—" },
    { key: "action", header: "Документ", render: (d) => d.action },
    { key: "supplier", header: "Поставщик", secondary: true, render: (d) => <Muted>{d.supplier ?? "—"}</Muted> },
    { key: "items", header: "Позиций", numeric: true, width: 90, render: (d) => groupDigits(d.items) },
    { key: "amount", header: "Сумма", numeric: true, render: (d) => (d.amount ? formatTenge(d.amount) : <Muted>—</Muted>) },
    {
      key: "status",
      header: "Статус",
      width: 150,
      render: (d) => {
        const st = DOC_STATUS[d.status] ?? { label: d.status, tone: "var(--text-secondary)" };
        return <span style={{ color: st.tone }}>{st.label}</span>;
      },
    },
  ];

  return (
    <AppShell
      title="Склад"
      subtitle={
        age.empty
          ? "Обмена со складом ещё не было — запустите его на экране «Обмен»."
          : `Данные X2pos, только просмотр · ${age.label}. Изменения делаются в самом X2pos — он обслуживает ещё и магазин.`
      }
    >
      <StatRow>
        <StatTile
          label="Деньги на счетах"
          value={accounts.length ? formatTenge(money) : "—"}
          unavailable={accounts.length === 0}
          tone="success"
        />
        <StatTile
          label="Долг по карточкам клиентов"
          value={customers.length ? formatTenge(debt) : "—"}
          unavailable={customers.length === 0}
          tone="danger"
          caption={customers.length ? `должников ${debtors.length} из ${customers.length}` : undefined}
        />
        <StatTile
          label="Не оплачено по продажам"
          value={age.empty ? "—" : formatTenge(sales.unpaid)}
          unavailable={age.empty}
          tone="danger"
          caption="другой счётчик — см. пояснение ниже"
        />
        <StatTile
          label="Приёмки в черновиках"
          value={age.empty ? "—" : String(drafts.length)}
          unavailable={age.empty}
          tone="brass"
          caption={drafts.length > 0 ? "товар по ним НЕ оприходован" : "все документы проведены"}
        />
      </StatRow>

      {/* Расхождение двух счётчиков долга — не баг панели, и молчать о нём
          нельзя: цифры разные, обе взяты из X2pos, свести их снаружи нечем. */}
      <div
        className="mt-4 rounded-lg px-4 py-3"
        style={{ background: "var(--tint-info)", border: "1px solid var(--tint-info-border)" }}
      >
        <div style={{ fontSize: "var(--text-body-s)", color: "var(--text-primary)" }}>
          Почему два разных долга
        </div>
        <div className="mt-1" style={{ fontSize: "var(--text-caption)", color: "var(--text-secondary)" }}>
          «Не оплачено по продажам» — это сумма отгрузок минус поступившие по ним платежи.
          «Долг по карточкам клиентов» — баланс, который X2pos считает сам. Значения расходятся,
          потому что погашения долга не всегда привязаны к конкретной продаже. Свести их снаружи
          нельзя, поэтому показаны обе цифры, а не одна выбранная.
        </div>
      </div>

      <Section title="Деньги" hint="Остатки по счетам в X2pos на сейчас.">
        <DataTable
          columns={accountCols}
          rows={accounts}
          rowKey={(a) => a.id}
          empty={<Empty title="Счетов нет" hint="Появятся после первого обмена со складом." />}
        />
      </Section>

      <Section
        title="Поступления и документы"
        hint="Приёмки, списания, перемещения и ревизии. Приехавший товар — повод завести карточки на сайте."
      >
        <DataTable
          columns={docCols}
          rows={docs}
          rowKey={(d) => d.id}
          empty={<Empty title="Документов нет" hint="Появятся после первого обмена со складом." />}
        />
      </Section>

      <Section title="Клиенты" hint="Все клиенты компании и их баланс. Отсортированы по величине долга.">
        <DataTable
          columns={customerCols}
          rows={customers}
          rowKey={(c) => c.id}
          empty={<Empty title="Клиентов нет" hint="Появятся после первого обмена со складом." />}
        />
      </Section>
    </AppShell>
  );
}
