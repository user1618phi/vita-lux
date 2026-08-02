import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/auth";
import { PanelChrome } from "@/components/PanelChrome";

/* Layout панели.

   Боковое меню живёт ЗДЕСЬ, а не внутри страниц, и это не вкусовщина.

   Раньше меню рисовал каждый экран через `AppShell`. Layout в App Router
   переживает переход между страницами, а страница — нет: при навигации Next
   размонтирует прежнюю страницу целиком и ждёт данных новой. Поскольку все
   экраны панели `force-dynamic` поверх сетевого Postgres и живых запросов в
   X2pos, меню исчезало на всё время загрузки и возвращалось только вместе с
   готовой страницей. Здесь оно остаётся на месте, а грузится только контент —
   ради этого рядом лежит `loading.tsx`.

   Проверка входа тоже переезжает сюда: она была скопирована в одиннадцати
   файлах, и каждый новый экран приходилось не забыть ею накрыть. Забыть
   layout нельзя — он в маршруте. Проверки внутри страниц оставлены как второй
   рубеж, они дешёвые.

   `/login` в эту группу не входит, поэтому меню на нём не появится. */

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  return <PanelChrome username={admin.username}>{children}</PanelChrome>;
}
