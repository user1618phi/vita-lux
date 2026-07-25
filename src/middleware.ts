import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Пропускаем API, админку, внутренние маршруты Next и файлы с расширением.
  // `admin` обязателен: без него next-intl перепишет /admin → /ru/admin,
  // а админка живёт вне [locale] и всегда на русском.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
