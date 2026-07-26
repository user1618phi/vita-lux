import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/navigation/SiteHeader";
import { SiteFooter } from "@/components/navigation/SiteFooter";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { Link } from "@/i18n/navigation";
import { getSettings } from "@/lib/settings";
import { CONSENT_VERSION } from "@/lib/order/consent";

/* Consent is required by the same Kazakh personal-data law that governs where
   the data is stored, and the checkout now asks for it — so the page it links
   to has to exist. Written in plain Russian rather than boilerplate: it says
   what is actually collected and why, which is all the law needs and all a
   customer wants. */

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Privacy");
  const settings = await getSettings();
  const isRu = locale === "ru";

  const contact = settings.phonePrimary || "—";

  const sections = isRu
    ? [
        {
          h: "Какие данные мы собираем",
          p: "При оформлении заказа — имя, номер телефона, город и адрес доставки, а также комментарий, если вы его оставили. Больше ничего: мы не запрашиваем ИИН, дату рождения и адрес электронной почты.",
        },
        {
          h: "Зачем",
          p: "Только чтобы связаться с вами по заказу, доставить товар и выполнить гарантийные обязательства. Мы не продаём и не передаём эти данные третьим лицам для рекламы.",
        },
        {
          h: "Как мы их защищаем",
          p: "Имя, телефон и адрес хранятся в зашифрованном виде. Сотрудники видят их только в связи с конкретным заказом.",
        },
        {
          h: "Сколько храним",
          p: "Пока это нужно для исполнения заказа и гарантии. Вы можете попросить удалить ваши данные — напишите нам, и мы удалим их, если по заказу нет незакрытых обязательств.",
        },
        {
          h: "Ваши права",
          p: `Вы можете узнать, какие данные о вас у нас есть, исправить их или отозвать согласие. Для этого свяжитесь с нами по телефону ${contact}.`,
        },
      ]
    : [
        {
          h: "Қандай деректерді жинаймыз",
          p: "Тапсырыс рәсімдеу кезінде — атыңыз, телефон нөміріңіз, қала мен жеткізу мекенжайы, сондай-ақ қалдырсаңыз, пікіріңіз. Басқа ештеңе: ЖСН, туған күн және электрондық пошта сұралмайды.",
        },
        {
          h: "Не үшін",
          p: "Тек тапсырыс бойынша сізбен байланысу, тауарды жеткізу және кепілдік міндеттемелерін орындау үшін. Бұл деректерді жарнама үшін үшінші тұлғаларға сатпаймыз және бермейміз.",
        },
        {
          h: "Қалай қорғаймыз",
          p: "Аты-жөні, телефоны және мекенжайы шифрланған түрде сақталады. Қызметкерлер оларды нақты тапсырысқа байланысты ғана көреді.",
        },
        {
          h: "Қанша уақыт сақтаймыз",
          p: "Тапсырысты орындау және кепілдік үшін қажет болғанша. Деректеріңізді жоюды сұрай аласыз — бізге жазыңыз, тапсырыс бойынша жабылмаған міндеттеме болмаса, жоямыз.",
        },
        {
          h: "Сіздің құқықтарыңыз",
          p: `Бізде сіз туралы қандай деректер бар екенін білуге, оларды түзетуге немесе келісімді кері қайтаруға құқығыңыз бар. Ол үшін ${contact} телефоны арқылы хабарласыңыз.`,
        },
      ];

  return (
    <div className="min-h-screen bg-porcelain">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[720px] px-4 lg:px-8 py-8 lg:py-14 pb-24">
        <h1 className="m-0 mb-2 font-display text-ink" style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.15 }}>
          {t("title")}
        </h1>
        <p className="m-0 mb-8 vl-mono text-[12px] text-slate">
          {isRu ? "Редакция от" : "Редакциясы"} {CONSENT_VERSION}
        </p>

        {sections.map((s) => (
          <section key={s.h} className="mb-6">
            <h2 className="m-0 mb-2 font-sans font-medium text-[17px] text-ink">{s.h}</h2>
            <p className="m-0 font-sans text-[15px] text-slate leading-[1.6]">{s.p}</p>
          </section>
        ))}

        <Link href="/" className="inline-block mt-4 font-sans text-[14px] text-brass-text underline underline-offset-2">
          {t("back")}
        </Link>
      </main>

      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
