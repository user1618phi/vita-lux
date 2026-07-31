import { redirect } from "next/navigation";
import { db, schema } from "@vita/db/client";
import { can, currentAdmin } from "@/lib/auth";
import { logoutAction } from "../actions";
import { AdminNav, PageShell } from "../ui";
import { SettingsForm, type SettingGroup } from "./SettingsForm";

export const dynamic = "force-dynamic";

/* Everything the storefront used to hardcode. Contacts sit here rather than in
   messages/*.json so a phone number can change without a deploy. Значения
   отсюда сильнее кодовых умолчаний — поменяв номер здесь, менять его в
   packages/data не нужно. */
const LAYOUT: { title: string; hint?: string; fields: { key: string; label: string; hint?: string }[] }[] = [
  {
    title: "Контакты",
    hint: "Показываются в шапке, футере и в ссылках WhatsApp.",
    fields: [
      { key: "contact.phonePrimary", label: "Основной телефон", hint: "Только цифры, например 77079961717" },
      { key: "contact.phoneSecondary", label: "Второй телефон", hint: "Можно оставить пустым" },
      { key: "contact.city", label: "Город", hint: "Например: Шымкент" },
      { key: "contact.address", label: "Адрес склада" },
    ],
  },
  {
    title: "Доставка",
    fields: [
      { key: "delivery.freeFromKzt", label: "Бесплатная доставка от, ₸" },
      { key: "delivery.costKzt", label: "Стоимость доставки, ₸" },
    ],
  },
  /* Группы «Цены» здесь больше нет.

     Она писала ключи pricing.fxRateUsdKzt / defaultMarkupBp / roundToKzt,
     которых нет в KEYS (packages/data/src/settings.ts) — то есть их не читал
     никто, и автопересчёта цен из оптовых долларовых в проекте не существует.
     Владелец вводил курс доллара и ждал, что цены поедут; они не ехали.
     Появится пересчёт — вернуть группу вместе с читателем. */
  {
    title: "Рассрочка",
    fields: [
      { key: "installment.months", label: "Срок рассрочки, месяцев" },
      { key: "installment.enabled", label: "Показывать рассрочку", hint: "1 — да, 0 — нет" },
    ],
  },
];

export default async function SettingsPage() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");
  // Курс и наценка меняют цену всего каталога разом — только владелец.
  if (!can(admin.role, "settings")) redirect("/products?denied=1");

  const rows = await db().select().from(schema.setting);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  const groups: SettingGroup[] = LAYOUT.map((g) => ({
    title: g.title,
    hint: g.hint,
    fields: g.fields.map((f) => {
      const raw = byKey.get(f.key);
      return { ...f, value: raw === null || raw === undefined ? "" : String(raw) };
    }),
  }));

  return (
    <PageShell
      title="Настройки"
      nav={
        <AdminNav current="settings" role={admin.role} username={admin.username} logoutAction={logoutAction} />
      }
    >
      <SettingsForm groups={groups} />
    </PageShell>
  );
}
