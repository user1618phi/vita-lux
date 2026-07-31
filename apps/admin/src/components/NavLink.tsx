"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Пункт меню, который сам знает, активен ли он.

   Раньше активную вкладку каждая страница передавала строкой (`current="orders"`),
   и добавление раздела означало правку и в меню, и во всех страницах этого
   раздела. Здесь достаточно пути. */

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  /* «/» активен только сам по себе — иначе Сводка подсвечивалась бы всегда. */
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex-none rounded-md px-3 leading-[40px] md:mx-2"
      style={{
        fontSize: "var(--text-body-s)",
        textDecoration: "none",
        background: active ? "var(--action-primary-bg)" : "transparent",
        color: active ? "var(--action-primary-text)" : "var(--text-secondary)",
      }}
    >
      {label}
    </Link>
  );
}
