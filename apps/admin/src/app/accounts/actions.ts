"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { count, eq, gt, and } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db, schema } from "@vita/db/client";
import { hashPassword } from "@vita/core/crypto";
import { can, audit, currentAdmin } from "@/lib/auth";

/* Учётные записи администраторов.

   Раньше их можно было завести только скриптом с чьего-то ноутбука. Владельцу
   магазина это недоступно, поэтому на практике все работали под одной учёткой —
   а тогда журнал действий перестаёт отвечать на вопрос «кто это сделал». */

const { adminUser, adminSession } = schema;

async function requireOwner() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");
  // Серверный гейт, а не спрятанная вкладка: прямой POST должен отклоняться.
  if (!can(admin.role, "accounts")) redirect("/products?denied=1");
  return admin;
}

export interface AccountRow {
  id: string;
  username: string;
  role: "owner" | "manager";
  lastLoginAt: Date | null;
  disabledAt: Date | null;
  sessions: number;
}

export async function listAccounts(): Promise<AccountRow[]> {
  await requireOwner();
  const rows = await db()
    .select({
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
      lastLoginAt: adminUser.lastLoginAt,
      disabledAt: adminUser.disabledAt,
      sessions: count(adminSession.id),
    })
    .from(adminUser)
    .leftJoin(
      adminSession,
      and(eq(adminSession.userId, adminUser.id), gt(adminSession.expiresAt, new Date())),
    )
    .groupBy(adminUser.id)
    .orderBy(adminUser.username);
  return rows as AccountRow[];
}

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Логин — минимум 3 символа")
    .max(40)
    .regex(/^[a-z0-9._-]+$/, "Только латиница, цифры, точка, дефис и подчёркивание"),
  role: z.enum(["owner", "manager"]),
});

export async function createAccountAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string; username?: string; password?: string }> {
  const admin = await requireOwner();

  const parsed = createSchema.safeParse({
    username: String(formData.get("username") ?? ""),
    role: String(formData.get("role") ?? "manager"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };

  const [clash] = await db()
    .select({ id: adminUser.id })
    .from(adminUser)
    .where(eq(adminUser.username, parsed.data.username))
    .limit(1);
  if (clash) return { error: `Логин «${parsed.data.username}» уже занят` };

  /* Пароль генерируем сами и показываем ОДИН раз. Так он не проходит через
     чужую переписку и заведомо не окажется словарным. */
  const password = randomBytes(18).toString("base64url");
  await db().insert(adminUser).values({
    username: parsed.data.username,
    role: parsed.data.role,
    passwordHash: await hashPassword(password),
  });

  await audit(admin.id, "admin_user", parsed.data.username, "create", null, { role: parsed.data.role });
  revalidatePath("/accounts");
  return { ok: true, username: parsed.data.username, password };
}

const idSchema = z.string().uuid();

export async function setAccountRoleAction(formData: FormData): Promise<void> {
  const admin = await requireOwner();
  const id = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!idSchema.safeParse(id).success) return;
  if (role !== "owner" && role !== "manager") return;

  await db().update(adminUser).set({ role }).where(eq(adminUser.id, id));
  await audit(admin.id, "admin_user", id, "role", null, { role });
  revalidatePath("/accounts");
}

export async function toggleAccountAction(formData: FormData): Promise<void> {
  const admin = await requireOwner();
  const id = String(formData.get("userId") ?? "");
  if (!idSchema.safeParse(id).success) return;

  /* Себя отключить нельзя — иначе владелец одним нажатием запирает себя
     снаружи, и вернуться можно будет только скриптом с ноутбука. */
  if (id === admin.id) return;

  const [row] = await db()
    .select({ disabledAt: adminUser.disabledAt })
    .from(adminUser)
    .where(eq(adminUser.id, id))
    .limit(1);
  if (!row) return;

  const next = row.disabledAt ? null : new Date();
  await db().update(adminUser).set({ disabledAt: next }).where(eq(adminUser.id, id));

  // Отключение обязано закрыть живые сессии — иначе доступ пропадёт только
  // через 30 дней, когда истечёт кука.
  if (next) await db().delete(adminSession).where(eq(adminSession.userId, id));

  await audit(admin.id, "admin_user", id, next ? "disable" : "enable", null, null);
  revalidatePath("/accounts");
}

export async function revokeSessionsAction(formData: FormData): Promise<void> {
  const admin = await requireOwner();
  const id = String(formData.get("userId") ?? "");
  if (!idSchema.safeParse(id).success) return;

  await db().delete(adminSession).where(eq(adminSession.userId, id));
  await audit(admin.id, "admin_user", id, "revoke-sessions", null, null);
  revalidatePath("/accounts");
}
