import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { can, currentAdmin } from "@/lib/auth";
import { AdminNav } from "../ui";
import { SettingsForm, type SettingGroup } from "./SettingsForm";

export const dynamic = "force-dynamic";

/* Everything the storefront used to hardcode. Contacts sit here rather than in
   messages/*.json so a phone number can change without a deploy — and so the
   placeholder +7 700 000 00 00 gets replaced by whoever actually knows it. */
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
  {
    title: "Цены",
    hint: "Используются, когда цена считается из оптовой в долларах.",
    fields: [
      { key: "pricing.fxRateUsdKzt", label: "Курс USD → ₸" },
      { key: "pricing.defaultMarkupBp", label: "Наценка, базисные пункты", hint: "22000 = ×2.2" },
      { key: "pricing.roundToKzt", label: "Округлять до, ₸" },
    ],
  },
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
  if (!admin) redirect("/admin/login");
  // Курс и наценка меняют цену всего каталога разом — только владелец.
  if (!can(admin.role, "settings")) redirect("/admin/products?denied=1");

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
    <main className="mx-auto w-full max-w-[640px] px-4 py-5 pb-16">
      <h1 className="m-0 mb-4 font-display text-[22px] text-ink">Настройки</h1>
      <AdminNav current="settings" role={admin.role} />
      <div className="mt-5">
        <SettingsForm groups={groups} />
      </div>
    </main>
  );
}
