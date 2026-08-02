"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@vita/db/client";
import { hashPassword, hashToken, verifyPassword } from "@vita/core/crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, audit, currentAdmin } from "@/lib/auth";

/* Смена собственного пароля.

   До этого пароль менялся только запуском scripts/create-admin.ts с чьего-то
   ноутбука — то есть требовал доступа к репозиторию и к строке подключения. Для
   человека, который просто заподозрил, что пароль подсмотрели, это недостижимо. */

const { adminUser, adminSession } = schema;

const schemaPw = z
  .object({
    current: z.string().min(1, "Введите текущий пароль").max(200),
    next: z.string().min(12, "Новый пароль — минимум 12 символов").max(200),
    repeat: z.string(),
  })
  .refine((v) => v.next === v.repeat, { message: "Пароли не совпадают" })
  .refine((v) => v.next !== v.current, { message: "Новый пароль совпадает с текущим" });

export async function changePasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");

  const parsed = schemaPw.safeParse({
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    repeat: String(formData.get("repeat") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Проверьте поля" };

  const [row] = await db()
    .select({ hash: adminUser.passwordHash })
    .from(adminUser)
    .where(eq(adminUser.id, admin.id))
    .limit(1);
  if (!row) return { error: "Пользователь не найден" };

  if (!(await verifyPassword(parsed.data.current, row.hash))) {
    return { error: "Текущий пароль неверен" };
  }

  await db()
    .update(adminUser)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(adminUser.id, admin.id));

  /* Все прочие сессии закрываются. Смена пароля обычно означает «я подозреваю,
     что кто-то ещё внутри» — если чужая сессия переживёт смену, действие теряет
     смысл. Текущая сохраняется, иначе человек выкинет сам себя. */
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await db()
    .delete(adminSession)
    .where(
      token
        ? and(eq(adminSession.userId, admin.id), ne(adminSession.tokenHash, hashToken(token)))
        : eq(adminSession.userId, admin.id),
    );

  // В журнал — только факт. Ни старого, ни нового пароля, ни их хешей.
  await audit(admin.id, "admin_user", admin.id, "password-change", null, null);

  return { ok: true };
}
