import type { NextConfig } from "next";

/* Админка НЕ подключает next-intl: она только на русском, и это осознанно —
   людям, которые ей пользуются, казахский интерфейс не нужен, а вторая локаль
   означала бы вторую копию всех строк админки без единого читателя.
   Именно поэтому раньше она жила вне сегмента `[locale]`. */

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Пакеты воркспейса отдают исходный TypeScript, без шага сборки.
  transpilePackages: ["@vita/core", "@vita/data", "@vita/db", "@vita/i18n", "@vita/ui"],
};

export default nextConfig;
