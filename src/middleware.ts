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
} from "./lib/attribution";

const intlMiddleware = createMiddleware(routing);

/* Locale routing, plus first-touch attribution.

   Attribution is stamped here because middleware runs before any page render,
   so it catches the landing request itself — including one that immediately
   redirects from / to /ru. First touch is written once and never overwritten;
   the order action reads it back when a sale happens. */

export default function middleware(request: NextRequest) {
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
  // Пропускаем API, админку, внутренние маршруты Next и файлы с расширением.
  // `admin` обязателен: без него next-intl перепишет /admin → /ru/admin,
  // а админка живёт вне [locale] и всегда на русском.
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
