import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Пропускаем API, внутренние маршруты Next и файлы с расширением.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
