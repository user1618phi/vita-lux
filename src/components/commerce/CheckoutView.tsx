"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useCart } from "@/context/CartContext";
import { groupDigits } from "@/lib/format";
import { track } from "@/lib/analytics";

const FREE_FROM = 150000;
const DELIVERY_COST = 3900;
const tenge = (n: number) => `${groupDigits(n)} ₸`;

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

export function CheckoutView() {
  const t = useTranslations("Checkout");
  const tCat = useTranslations("Catalog");
  const { detailed, subtotal, clear, hydrated } = useCart();
  const names = tCat.raw("names") as Record<string, string>;

  const [delivery, setDelivery] = useState<Delivery>("courier");
  const [payment, setPayment] = useState<Payment>("card");
  const [done, setDone] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", city: "Алматы", address: "", comment: "" });
  const fired = useRef(false);

  useEffect(() => {
    if (hydrated && detailed.length && !fired.current) {
      fired.current = true;
      track("begin_checkout", { value: subtotal, item_count: detailed.length });
    }
  }, [hydrated, detailed.length, subtotal]);

  const deliveryCost = delivery === "pickup" ? 0 : subtotal >= FREE_FROM ? 0 : DELIVERY_COST;
  const total = subtotal + deliveryCost;

  if (!hydrated) return <div style={{ minHeight: "50vh" }} />;

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 lg:px-8 py-16 lg:py-24 text-center">
        <div className="grid place-items-center mx-auto mb-5 rounded-full" style={{ width: 80, height: 80, background: "var(--beige)" }}>
          <Icon name="check" size={40} color="var(--brass)" strokeWidth={2} />
        </div>
        <h1 className="m-0 font-display font-normal text-[28px] text-ink">{t("successTitle")}</h1>
        <p className="mt-3 mb-0 mx-auto max-w-[38ch] font-sans text-[15px] text-slate leading-[1.6]">
          {t("successDesc", { order: orderNo })}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="inline-block">
            <Button variant="primary" size="lg">{t("toHome")}</Button>
          </Link>
          <Link href="/catalog/toilets" className="inline-block">
            <Button variant="secondary" size="lg">{t("continue")}</Button>
          </Link>
        </div>
      </div>
    );
  }

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

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const no = "VL-" + String(Math.floor(100000 + Math.random() * 900000));
    setOrderNo(no);
    track("add_payment_info", { payment_type: payment });
    track("purchase", { transaction_id: no, value: total, item_count: detailed.length });
    clear();
    setDone(true);
    window.scrollTo(0, 0);
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 lg:px-8 py-6 lg:py-10">
      <Link href="/cart" className="inline-flex items-center gap-1.5 font-sans text-[14px] text-slate mb-4" style={{ textDecoration: "none" }}>
        <Icon name="chevron-left" size={16} color="var(--slate)" />
        {t("back")}
      </Link>
      <h1 className="m-0 mb-6 font-display text-ink" style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.15 }}>{t("title")}</h1>

      <form onSubmit={submit} className="grid lg:grid-cols-[1fr_360px] gap-6 lg:gap-8">
        <div className="flex flex-col gap-8">
          <Step n={1} title={t("deliveryStep")}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Choice active={delivery === "courier"} onClick={() => setDelivery("courier")} icon="truck" title={t("courier")} sub={t("courierSub")} />
              <Choice active={delivery === "pickup"} onClick={() => setDelivery("pickup")} icon="home" title={t("pickup")} sub={t("pickupSub")} />
            </div>
          </Step>

          <Step n={2} title={t("contactsStep")}>
            <div className="grid sm:grid-cols-2 gap-3">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("namePh")} style={inputStyle} />
              <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t("phonePh")} style={inputStyle} />
            </div>
          </Step>

          {delivery === "courier" ? (
            <Step n={3} title={t("addressStep")}>
              <div className="grid gap-3">
                <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={t("cityPh")} style={inputStyle} />
                <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t("addressPh")} style={inputStyle} />
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
                    <p className="m-0 truncate font-sans text-[13px] text-ink">{names[item.handle] ?? item.handle}</p>
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

            <div className="mt-5">
              <Button type="submit" variant="primary" size="lg" fullWidth>{t("submit")}</Button>
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
