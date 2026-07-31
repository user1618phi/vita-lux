"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { WhatsAppAction } from "@/components/product/ChannelActions";
import { HERO_IMAGE, HOME_PHONE } from "@vita/data/content/home";
import { SITE_DOMAIN } from "@vita/core/site";

/* Hero — full-bleed photo with text overlaid (macket parity):
   - photo drifts down + scales on scroll, and shifts toward the cursor with
     spring-like inertia (pointer:fine only);
   - the copy rises and dissolves as you scroll past;
   - eyebrow / heading / subtitle / buttons cascade in on load (CSS).
   All motion is skipped under prefers-reduced-motion. No animation library —
   rAF + refs (no React re-renders) + CSS keyframes. */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function Hero() {
  const t = useTranslations("Home");
  const waMessage = t("waMessage", { site: SITE_DOMAIN });

  const heroRef = useRef<HTMLDivElement>(null);
  const imgOuterRef = useRef<HTMLDivElement>(null);
  const imgInnerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hero = heroRef.current;
    if (!hero) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    let raf = 0;
    let scrollTicking = false;
    let tx = 0, ty = 0, cx = 0, cy = 0, mouseActive = false;

    const applyScroll = () => {
      scrollTicking = false;
      const rect = hero.getBoundingClientRect();
      const p = clamp(-rect.top / (rect.height || 1), 0, 1);
      if (imgOuterRef.current) imgOuterRef.current.style.transform = `translateY(${p * 18}%) scale(${1.05 + p * 0.1})`;
      if (contentRef.current) {
        contentRef.current.style.transform = `translateY(${p * 40}%)`;
        contentRef.current.style.opacity = String(clamp(1 - p / 0.8, 0, 1));
      }
    };
    const onScroll = () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(applyScroll);
      }
    };

    const spring = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      if (imgInnerRef.current) imgInnerRef.current.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      if (mouseActive || Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        raf = requestAnimationFrame(spring);
      } else {
        raf = 0;
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(spring);
    };
    const onMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      tx = ((e.clientX - rect.left) / rect.width - 0.5) * -24;
      ty = ((e.clientY - rect.top) / rect.height - 0.5) * -24;
      mouseActive = true;
      kick();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      mouseActive = false;
      kick();
    };

    applyScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    if (fine) {
      hero.addEventListener("mousemove", onMove);
      hero.addEventListener("mouseleave", onLeave);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      hero.removeEventListener("mousemove", onMove);
      hero.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const rise = (delay: number): CSSProperties => ({
    animation: "vl-rise 0.7s cubic-bezier(0.22,1,0.36,1) both",
    animationDelay: `${delay}ms`,
  });

  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 lg:px-8 pt-4 lg:pt-6">
      <div ref={heroRef} className="relative overflow-hidden rounded-lg bg-basalt min-h-[460px] md:min-h-[560px] flex items-end">
        <div ref={imgOuterRef} className="absolute inset-0" style={{ willChange: "transform" }}>
          <div ref={imgInnerRef} className="absolute" style={{ inset: "-6%", willChange: "transform" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={HERO_IMAGE} alt={t("heroTitle")} loading="eager" className="vl-photo w-full h-full object-cover" />
          </div>
        </div>
        <div aria-hidden="true" className="absolute inset-0" style={{ background: "var(--scrim)" }} />

        <div ref={contentRef} className="relative p-6 md:p-12 max-w-xl text-on-dark" style={{ willChange: "transform, opacity" }}>
          <span
            className="inline-block mb-4 px-3 py-1 rounded-full font-sans"
            style={{ border: "1px solid rgba(255,255,255,0.3)", fontSize: "0.72rem", letterSpacing: "0.3em", ...rise(0) }}
          >
            {t("heroEyebrow")}
          </span>
          <h1 className="m-0 font-display text-on-dark" style={{ fontSize: "clamp(2rem, 6vw, 3.4rem)", lineHeight: 1.08, ...rise(80) }}>
            {t("heroTitle")}
          </h1>
          <p className="mt-4 mb-0 font-sans" style={{ fontSize: "1rem", lineHeight: 1.6, color: "rgba(255,255,255,0.82)", ...rise(160) }}>
            {t("heroSubtitle")}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3" style={rise(240)}>
            <div className="w-full sm:w-auto">
              <Link href="/catalog/toilets" className="block">
                <Button variant="onPhoto" size="lg" fullWidth iconRight={<Icon name="arrow-right" size={20} />}>
                  {t("heroCatalog")}
                </Button>
              </Link>
            </div>
            <div className="w-full sm:w-auto">
              <WhatsAppAction
                label={t("heroWhatsApp")}
                phone={HOME_PHONE}
                message={waMessage}
                variant="outline"
                size="lg"
                fullWidth
                style={{ color: "#fff", borderColor: "rgba(255,255,255,0.55)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
