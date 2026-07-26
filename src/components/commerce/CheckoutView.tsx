"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useCart } from "@/context/CartContext";
import { groupDigits } from "@/lib/format";
import { track } from "@/lib/analytics";
import { placeOrder } from "@/app/[locale]/checkout/actions";

/* Defaults only — the real values come from `setting` and are passed in by the
   page, so a threshold change does not need a deploy. */
const FREE_FROM = 150000;
const DELIVERY_COST = 3900;
const tenge = (n: number) => `${groupDigits(n)} ₸`;

/* Shymkent first — that is where the warehouse is, and it is the most likely
   answer. The field stays free-text: the list is a shortcut, not a restriction. */
const CITIES = [
  "Шымкент", "Сарыагаш", "Алматы", "Астана", "Тараз", "Түркістан",
  "Кызылорда", "Караганда", "Актобе", "Атырау", "Павлодар", "Усть-Каменогорск",
  "Семей", "Костанай", "Петропавловск", "Уральск", "Актау", "Кокшетау", "Талдыкорган",
];

type Delivery = "courier" | "pickup";
type Payment = "card" | "kaspi" | "install" | "cash";

const inputStyle = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  background: "var(--surface-control)",
  border: "1px solid transparent",
  borderRadius: "var(--radius-md)",
  outline: "none",
  fontFamily: "var(--font-sans)",
  fontSize: 16,
  color: "var(--ink)",
} as const;

export function CheckoutView({
  freeFrom = FREE_FROM,
  deliveryCostKzt = DELIVERY_COST,
}: {
  freeFrom?: number;
  deliveryCostKzt?: number;
} = {}) {
  const t = useTranslations("Checkout");
  const router = useRouter();
  const { detailed, subtotal, clear, hydrated, items } = useCart();

  const [delivery, setDelivery] = useState<Delivery>("courier");
  const [payment, setPayment] = useState<Payment>("card");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // The city used to default to "Алматы", which quietly mislabelled orders from
  // everywhere else.
  const [form, setForm] = useState({ name: "", phone: "", city: "", address: "", comment: "" });
  const fired = useRef(false);

  /* Stable per-cart key: a double submit (or a retried request) returns the
     same order instead of creating a second one. */
  const idempotencyKey = useMemo(
    () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (hydrated && detailed.length && !fired.current) {
      fired.current = true;
      track("begin_checkout", { value: subtotal, item_count: detailed.length });
    }
  }, [hydrated, detailed.length, subtotal]);

  /* A rejected field gets a red border so the message at the top has somewhere
     to point. */
  const fieldStyle = (name: string) =>
    fieldError === name
      ? { ...inputStyle, border: "1px solid var(--state-danger)" }
      : inputStyle;

  const deliveryCost = delivery === "pickup" ? 0 : subtotal >= freeFrom ? 0 : deliveryCostKzt;
  const total = subtotal + deliveryCost;

  if (!hydrated) return <div style={{ minHeight: "50vh" }} />;

  if (detailed.length === 0) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-20 text-center">
        <p className="font-sans text-slate">{t("emptyCart")}</p>
        <Link href="/catalog/toilets" className="mt-4 inline-block font-sans text-brass-text underline underline-offset-2">
          {t("back")}
        </Link>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setFieldError(null);

    track("add_payment_info", { payment_type: payment });

    let result: Awaited<ReturnType<typeof placeOrder>>;
    try {
      result = await placeOrder({
        // Handles and quantities only — the server re-prices everything.
        lines: items.map((l) => ({ handle: l.handle, qty: l.qty })),
        deliveryMethod: delivery,
        paymentMethod: payment,
        name: form.name,
        phone: form.phone,
        city: delivery === "courier" ? form.city : undefined,
        address: delivery === "courier" ? form.address : undefined,
        comment: form.comment || undefined,
        consent,
        idempotencyKey,
        honeypot: "",
      });
    } catch {
      // The request never reached a result — a dropped connection, a redeploy.
      // Without this the button would stay disabled forever.
      setPending(false);
      setError(t("errorGeneric"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!result.ok) {
      setPending(false);
      if (result.code === "VALIDATION") setFieldError(result.field);
      setError(result.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    track("purchase", { transaction_id: result.refCode, value: total, item_count: detailed.length });
    clear();
    router.replace(`/order/${result.refCode}`);
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-10">
      <Link href="/cart" className="inline-flex items-center gap-1.5 font-sans text-[14px] text-slate mb-4" style={{ textDecoration: "none" }}>
        <Icon name="chevron-left" size={16} color="var(--slate)" />
        {t("back")}
      </Link>
      <h1 className="m-0 mb-6 font-display text-ink" style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.15 }}>{t("title")}</h1>

      {error ? (
        <div
          role="alert"
          className="mb-5 flex items-start gap-3 rounded-lg p-4"
          style={{ background: "rgba(179,52,31,0.08)", border: "0.5px solid var(--state-danger)" }}
        >
          <Icon name="alert-circle" size={20} color="var(--state-danger)" />
          <div className="flex-1 min-w-0">
            <p className="m-0 font-sans text-[14px]" style={{ color: "var(--state-danger)" }}>{error}</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={submit} className="grid lg:grid-cols-[1fr_360px] gap-6 lg:gap-8">
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
        />
        <div className="flex flex-col gap-8">
          <Step n={1} title={t("deliveryStep")}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Choice active={delivery === "courier"} onClick={() => setDelivery("courier")} icon="truck" title={t("courier")} sub={t("courierSub")} />
              <Choice active={delivery === "pickup"} onClick={() => setDelivery("pickup")} icon="home" title={t("pickup")} sub={t("pickupSub")} />
            </div>
          </Step>

          <Step n={2} title={t("contactsStep")}>
            <div className="grid sm:grid-cols-2 gap-3">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("namePh")} style={fieldStyle("name")} aria-invalid={fieldError === "name"} />
              <input required type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t("phonePh")} style={fieldStyle("phone")} aria-invalid={fieldError === "phone"} />
            </div>
          </Step>

          {delivery === "courier" ? (
            <Step n={3} title={t("addressStep")}>
              <div className="grid gap-3">
                <input required list="vl-cities" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={t("cityPh")} style={fieldStyle("city")} aria-invalid={fieldError === "city"} />
                <datalist id="vl-cities">
                  {CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t("addressPh")} style={fieldStyle("address")} aria-invalid={fieldError === "address"} />
                <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder={t("commentPh")} rows={2} style={{ ...inputStyle, height: "auto", padding: "12px 14px" }} />
              </div>
            </Step>
          ) : null}

          <Step n={delivery === "courier" ? 4 : 3} title={t("paymentStep")}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Choice active={payment === "card"} onClick={() => setPayment("card")} icon="credit-card" title={t("payCard")} sub={t("payCardSub")} />
              <Choice active={payment === "kaspi"} onClick={() => setPayment("kaspi")} icon="credit-card" title={t("payKaspi")} sub={t("payKaspiSub")} />
              <Choice active={payment === "install"} onClick={() => setPayment("install")} icon="credit-card" title={t("payInstall")} sub={t("payInstallSub")} />
              <Choice active={payment === "cash"} onClick={() => setPayment("cash")} icon="truck" title={t("payCash")} sub={t("payCashSub")} />
            </div>
          </Step>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-6 h-fit">
          <div className="rounded-lg border-[0.5px] border-line bg-glaze p-5">
            <h3 className="m-0 mb-3 font-sans font-medium text-[16px] text-ink">{t("yourOrder")}</h3>
            <div className="vl-noscroll flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 224 }}>
              {detailed.map(({ item, qty }) => (
                <div key={item.handle} className="flex gap-3">
                  <div className="flex-none rounded-md overflow-hidden bg-porcelain" style={{ width: 56, height: 56 }}>
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 truncate font-sans text-[13px] text-ink">{item.name}</p>
                    <p className="m-0 mt-0.5 font-sans text-[12px] text-slate vl-mono">{qty} × {tenge(item.price)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[0.5px] border-line mt-4 pt-4 flex flex-col gap-2.5 font-sans text-[14px]">
              <div className="flex justify-between"><span className="text-slate">{t("goods")}</span><span className="vl-mono text-ink">{tenge(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate">{t("delivery")}</span><span className="vl-mono text-ink">{deliveryCost === 0 ? t("free") : tenge(deliveryCost)}</span></div>
              <div className="flex justify-between border-t border-[0.5px] border-line pt-3">
                <span className="font-medium text-ink">{t("total")}</span>
                <span className="vl-mono font-medium text-[22px] text-ink">{tenge(total)}</span>
              </div>
            </div>

            {/* Consent is required by the Kazakh personal-data law, and until
                now the site asked for none at all. */}
            <label className="mt-5 flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
                style={{ width: 20, height: 20, marginTop: 1, accentColor: "var(--brass)", flex: "none" }}
              />
              <span className="font-sans text-[12px] text-slate leading-[1.45]">
                {t("consentLabel")}{" "}
                <Link href="/privacy" className="text-brass-text underline underline-offset-2">
                  {t("consentLink")}
                </Link>
              </span>
            </label>

            <div className="mt-4">
              <Button type="submit" variant="primary" size="lg" fullWidth disabled={pending || !consent}>
                {pending ? t("submitting") : t("submit")}
              </Button>
            </div>
            <p className="flex items-center justify-center gap-1.5 mt-3 mb-0 font-sans text-[12px] text-slate">
              <Icon name="shield-check" size={15} color="var(--brass)" />
              {t("secure")}
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="grid place-items-center rounded-full text-porcelain" style={{ width: 28, height: 28, background: "var(--basalt)", fontSize: 13 }}>{n}</span>
        <h2 className="m-0 font-sans font-medium text-[17px] text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Choice({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: IconName; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center gap-3 p-4 rounded-lg text-left"
      style={{ border: active ? "1px solid var(--brass)" : "1px solid var(--border-control)", background: active ? "var(--beige)" : "transparent", cursor: "pointer" }}
    >
      <Icon name={icon} size={24} color="var(--brass)" />
      <div className="min-w-0">
        <p className="m-0 font-sans font-medium text-[14px] text-ink">{title}</p>
        <p className="m-0 mt-0.5 font-sans text-[12px] text-slate">{sub}</p>
      </div>
      {active ? (
        <span className="absolute top-2 right-2 grid place-items-center rounded-full" style={{ width: 20, height: 20, background: "var(--brass)" }}>
          <Icon name="check" size={12} color="#fff" strokeWidth={2} />
        </span>
      ) : null}
    </button>
  );
}
