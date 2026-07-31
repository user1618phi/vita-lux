import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  ATTR_COOKIE,
  ATTR_MAX_AGE,
  SID_COOKIE,
  encodeFirstTouch,
  hasSignal,
  readFirstTouch,
} from "@vita/core/attribution";

const intlMiddleware = createMiddleware(routing);

/* Locale routing, plus first-touch attribution.

   Attribution is stamped here because middleware runs before any page render,
   so it catches the landing request itself — including one that immediately
   redirects from / to /ru. First touch is written once and never overwritten;
   the order action reads it back when a sale happens. */

export default function middleware(request: NextRequest) {
  /* Гейта админки здесь больше нет: она стала отдельным приложением
     (`apps/admin`) со своим middleware и своим деплоем. В этой сборке
     маршрута /admin просто не существует — закрывать нечего. */
  const response = intlMiddleware(request);

  if (!request.cookies.get(SID_COOKIE)) {
    response.cookies.set(SID_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ATTR_MAX_AGE,
    });
  }

  // Only the first touch that actually carries a signal is stored, so a direct
  // visit does not overwrite a campaign arrival that came earlier.
  if (!request.cookies.get(ATTR_COOKIE)) {
    const firstTouch = readFirstTouch(request.nextUrl, request.headers.get("referer"));
    if (hasSignal(firstTouch)) {
      response.cookies.set(ATTR_COOKIE, encodeFirstTouch(firstTouch), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ATTR_MAX_AGE,
      });
    }
  }

  return response;
}

export const config = {
  // Пропускаем API, внутренние маршруты Next и файлы с расширением.
  // Исключать `admin` больше не нужно и не следует: в этом приложении такого
  // маршрута нет — админка уехала в apps/admin.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
