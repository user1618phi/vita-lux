import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* Пакеты воркспейса отдают исходный TypeScript, без шага сборки: одна сборка
     вместо двух, и правка в @vita/core сразу видна в dev без пересборки пакета.
     Расплата — Next обязан их транспилировать сам. */
  transpilePackages: ["@vita/core", "@vita/data", "@vita/db", "@vita/i18n", "@vita/ui", "@vita/x2pos"],
};

export default withNextIntl(nextConfig);
