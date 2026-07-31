# Воркер синхронизации с X2pos (apps/worker) для Railway.
#
# Dockerfile, а не Nixpacks: автодетект берёт Node 18 и pnpm 9, а монорепо
# требует ровно ту версию pnpm, что записана в packageManager (иначе ломается
# разрешение workspace:*-зависимостей), и Node 22 для tsx.
#
# Пакеты отдают исходный TypeScript без шага сборки — это осознанное решение
# проекта, поэтому здесь нет компиляции: код запускается через tsx.

FROM node:22-slim

# sharp тянет нативные бинарники; на slim нужен только libc, но пакеты
# скачиваются заранее, поэтому build-essential не требуется.
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Сначала манифесты — так слой с зависимостями переиспользуется, пока они
# не менялись, и деплой после правки кода занимает секунды.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY packages/core/package.json ./packages/core/
COPY packages/data/package.json ./packages/data/
COPY packages/db/package.json ./packages/db/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/ui/package.json ./packages/ui/
COPY packages/x2pos/package.json ./packages/x2pos/

# Воркеру не нужны Next и React из витрины с админкой — ставим только его
# ветку дерева зависимостей вместе с пакетами, на которые она ссылается.
RUN pnpm install --frozen-lockfile --filter @vita/worker...

COPY packages ./packages
COPY apps/worker ./apps/worker

ENV NODE_ENV=production
EXPOSE 8080
CMD ["pnpm", "--filter", "@vita/worker", "start"]
