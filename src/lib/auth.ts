import "server-only";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { hashEphemeral, hashToken, newSessionToken, verifyPassword } from "@/lib/crypto";

/* Admin authentication.

   Deliberately small: username + password for two or three people, a random
   256-bit session token in an httpOnly cookie, and a row per session so a
   login can be revoked. No OAuth framework, no magic links (needs email
   infrastructure), no SMS OTP (needs a provider contract) — those buy nothing
   here and add a lot to maintain.

   Accounts are created by scripts/create-admin.ts. There is no self-registration. */

const { adminUser, adminSession } = schema;

export const SESSION_COOKIE = "vl_admin";
const SESSION_TTL_DAYS = 30;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export interface AdminIdentity {
  id: string;
  username: string;
  role: "owner" | "manager";
}

/* In-memory login throttle. Good enough for a single instance and three users;
   move to a `login_attempt` table if the app is ever horizontally scaled. */
const attempts = new Map<string, { count: number; first: number }>();

function throttled(key: string): boolean {
  const rec = attempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.first > ATTEMPT_WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.first > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
  } else {
    rec.count += 1;
  }
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
  if (throttled(key)) return { ok: false, reason: "throttled" };

  const [user] = await db()
    .select()
    .from(adminUser)
    .where(eq(adminUser.username, key))
    .limit(1);

  // Verify against a dummy hash when the user is missing so both paths cost
  // roughly the same and the response time does not leak existence.
  const stored = user?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA";
  const valid = await verifyPassword(password, stored);

  if (!user || !valid) {
    recordFailure(key);
    return { ok: false, reason: "invalid" };
  }

  attempts.delete(key);

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db().insert(adminSession).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt,
    ipHash: await clientIpHash(),
  });

  await db().update(adminUser).set({ lastLoginAt: new Date() }).where(eq(adminUser.id, user.id));

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
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
      .where(and(eq(adminSession.tokenHash, hashToken(token)), gt(adminSession.expiresAt, new Date())))
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
