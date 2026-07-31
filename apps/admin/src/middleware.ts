import { NextResponse, type NextRequest } from "next/server";
import { adminEnabled } from "@/lib/admin-flag";

/* Единственный рубеж, который закрывает админку целиком.

   Теперь это отдельное приложение, поэтому обычно его просто не деплоят туда,
   где оно не нужно. Флаг остаётся вторым замком: превью-деплой, случайно
   поднятый форк, локальный `next start` в чужой сети — во всех этих случаях
   без ADMIN_ENABLED=1 приложение ведёт себя так, будто его нет.

   Проверка обязана быть здесь, а не в layout: Server Actions диспатчатся по id
   через POST и выполняются ДО рендера layout, поэтому `notFound()` в layout
   мутацию не остановит. Блокировка запроса — единственное, что закрывает и то
   и другое. */

export default function middleware(_request: NextRequest) {
  if (!adminEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.next();
}

export const config = {
  // Всё приложение — это админка, поэтому под гейт попадает каждый маршрут,
  // кроме внутренних путей Next и файлов с расширением.
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
