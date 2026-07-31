import "server-only";
import { cookies, headers } from "next/headers";
import { and, count, eq, gt, isNull, lt } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { hashEphemeral, hashToken, newSessionToken, verifyPassword } from "@vita/core/crypto";
import type { AdminRole } from "@vita/core/permissions";

// Re-exported so callers need only one import for auth + permissions.
export { can, OWNER_ONLY_CAPABILITIES, type AdminRole, type Capability } from "@vita/core/permissions";

/* Admin authentication.

   Deliberately small: username + password for two or three people, a random
   256-bit session token in an httpOnly cookie, and a row per session so a
   login can be revoked. No OAuth framework, no magic links (needs email
   infrastructure), no SMS OTP (needs a provider contract) — those buy nothing
   here and add a lot to maintain.

   Accounts are created by scripts/create-admin.ts. There is no self-registration. */

const { adminUser, adminSession, loginAttempt } = schema;

export const SESSION_COOKIE = "vl_admin";
const SESSION_TTL_DAYS = 30;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export interface AdminIdentity {
  id: string;
  username: string;
  role: AdminRole;
}

/* Троттлинг входа — в БД.

   Раньше счётчик жил в `Map` внутри процесса. На Vercel это не ограничивало
   ничего: каждый холодный старт даёт функции пустую карту, и перебор просто
   раскладывался по инстансам. Комментарий на месте прежнего кода честно
   предупреждал «move to a login_attempt table if horizontally scaled» —
   ровно это и произошло при переезде на serverless.

   Два лимита. Основной — по ПАРЕ (логин, IP): если считать только по логину,
   любой желающий заблокирует чужую учётку пятью неверными паролями с улицы.
   Второй, более щедрый, — по одному IP: он ловит перебор многих логинов с
   одного хоста, который парный счётчик пропустил бы.

   Цена — два запроса на попытку входа. На трёх пользователях это бесплатно. */
const MAX_ATTEMPTS_PER_IP = 20;

/* Подставной хеш для случая «такого логина нет».

   Важна ДЛИНА: `verifyPassword` берёт keylen из самой строки, и прежняя
   заглушка (`…$AAAA`) заставляла scrypt посчитать 3 байта вместо 64. Проверка
   несуществующего пользователя выходила заметно дешевле настоящей, и по времени
   ответа можно было перебрать, какие логины существуют, — ровно то, что этот
   приём должен был предотвращать.

   Это честный scrypt-хеш от случайной строки: подобрать к нему пароль нельзя,
   а стоит он столько же, сколько реальный. */
const DUMMY_HASH =
  "scrypt$16384$8$1$B3PiCRxnsMQEtafVXx6qVg==$FK0vUWrCNkC+ZXzc7YoEW4nL5jLHSg0At42JmDN9PwDUDbpNWLw8w5nv8OWZ75D4ZGxLcN2di6bLE3Jlp1w7MQ==";

async function throttled(usernameKey: string, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS);

  const [pair] = await db()
    .select({ value: count() })
    .from(loginAttempt)
    .where(
      and(
        eq(loginAttempt.usernameKey, usernameKey),
        eq(loginAttempt.ipHash, ipHash),
        gt(loginAttempt.at, since),
      ),
    );
  if ((pair?.value ?? 0) >= MAX_ATTEMPTS) return true;

  const [byIp] = await db()
    .select({ value: count() })
    .from(loginAttempt)
    .where(and(eq(loginAttempt.ipHash, ipHash), gt(loginAttempt.at, since)));
  return (byIp?.value ?? 0) >= MAX_ATTEMPTS_PER_IP;
}

async function recordFailure(usernameKey: string, ipHash: string): Promise<void> {
  await db().insert(loginAttempt).values({ usernameKey, ipHash });
  // Оппортунистическая чистка — тем же приёмом, что и для протухших сессий.
  await db().delete(loginAttempt).where(lt(loginAttempt.at, new Date(Date.now() - ATTEMPT_WINDOW_MS * 4)));
}

async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return hashEphemeral(ip);
}

export type LoginResult =
  | { ok: true; identity: AdminIdentity }
  | { ok: false; reason: "invalid" | "throttled" };

/** Verify credentials and open a session. Wrong username and wrong password are
    reported identically so the form cannot be used to enumerate accounts. */
export async function login(username: string, password: string): Promise<LoginResult> {
  const key = username.trim().toLowerCase();
  const ipHash = await clientIpHash();
  if (await throttled(key, ipHash)) return { ok: false, reason: "throttled" };

  const [user] = await db()
    .select()
    .from(adminUser)
    .where(eq(adminUser.username, key))
    .limit(1);

  // Verify against a dummy hash when the user is missing so both paths cost
  // roughly the same and the response time does not leak existence.
  const stored = user?.passwordHash ?? DUMMY_HASH;
  const valid = await verifyPassword(password, stored);

  /* Отключённая учётка ведёт себя как несуществующая — тот же ответ, тот же
     счётчик. Сообщать «вас отключили» на форме входа незачем: это подсказка
     тому, кто подбирает. */
  if (!user || !valid || user.disabledAt) {
    await recordFailure(key, ipHash);
    return { ok: false, reason: "invalid" };
  }

  // Успешный вход обнуляет счётчик этой пары — иначе несколько опечаток подряд
  // продолжали бы висеть и мешать следующему входу.
  await db()
    .delete(loginAttempt)
    .where(and(eq(loginAttempt.usernameKey, key), eq(loginAttempt.ipHash, ipHash)));

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db().insert(adminSession).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
    ipHash,
  });

  await db().update(adminUser).set({ lastLoginAt: new Date() }).where(eq(adminUser.id, user.id));

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    /* Раньше здесь было "/admin" — путь, по которому админка жила внутри
       витрины. Теперь это отдельное приложение на своём домене, и его страницы
       начинаются с "/": с прежним значением браузер просто не прислал бы куку
       обратно, и вход молча не работал бы. */
    path: "/",
    expires: expiresAt,
  });

  // Opportunistic cleanup — keeps the table from growing without a cron.
  await db().delete(adminSession).where(lt(adminSession.expiresAt, new Date()));

  return { ok: true, identity: { id: user.id, username: user.username, role: user.role } };
}

/** The signed-in admin, or null. Safe to call from any server component. */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const [row] = await db()
      .select({
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
      })
      .from(adminSession)
      .innerJoin(adminUser, eq(adminUser.id, adminSession.userId))
      .where(
        and(
          eq(adminSession.tokenHash, hashToken(token)),
          gt(adminSession.expiresAt, new Date()),
          /* Отключённый администратор вылетает на СЛЕДУЮЩЕМ же запросе, даже
             если его кука ещё жива. Без этого условия отключение означало бы
             «не сможет войти заново», а не «больше не имеет доступа». */
          isNull(adminUser.disabledAt),
        ),
      )
      .limit(1);
    return row ?? null;
  } catch {
    // Database unreachable — treat as signed out rather than crashing the page.
    return null;
  }
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db().delete(adminSession).where(eq(adminSession.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/** Record who changed what. Never throws — an audit failure must not roll back
    the edit the admin just made. */
export async function audit(
  adminUserId: string | null,
  entity: string,
  entityId: string | null,
  action: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  try {
    await db().insert(schema.auditLog).values({
      adminUserId,
      entity,
      entityId,
      action,
      beforeJson: before ?? null,
      afterJson: after ?? null,
    });
  } catch {
    // ignore
  }
}
