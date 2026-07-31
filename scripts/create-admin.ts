/* Creates or updates an admin account. There is no self-registration.

   Usage:
     pnpm db:admin -- --user brother --role owner
     pnpm db:admin -- --user manager --role manager --password 'сложный-пароль'

   With no --password a strong one is generated and printed once. */

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@vita/db/client";
import { hashPassword } from "@vita/core/crypto";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  if (!process.env.APP_HASH_SALT) {
    console.error("APP_HASH_SALT is not set — sessions would not be hashable.");
    process.exit(1);
  }

  const username = arg("user")?.trim().toLowerCase();
  const role = (arg("role") ?? "manager") as "owner" | "manager";
  const phone = arg("phone");

  if (!username) {
    console.error("Usage: pnpm db:admin -- --user <username> [--role owner|manager] [--password <pw>] [--phone <phone>]");
    process.exit(1);
  }
  if (role !== "owner" && role !== "manager") {
    console.error(`--role must be "owner" or "manager", got "${role}"`);
    process.exit(1);
  }

  // 18 random bytes ≈ 24 base64url chars. Long enough that the 5-attempt
  // throttle makes guessing hopeless.
  const generated = !arg("password");
  const password = arg("password") ?? randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(password);

  const [existing] = await db()
    .select({ id: schema.adminUser.id })
    .from(schema.adminUser)
    .where(eq(schema.adminUser.username, username))
    .limit(1);

  if (existing) {
    await db()
      .update(schema.adminUser)
      .set({ passwordHash, role, phone: phone ?? null })
      .where(eq(schema.adminUser.id, existing.id));
    console.log(`✓ обновлён пользователь "${username}" (роль: ${role})`);
  } else {
    await db().insert(schema.adminUser).values({ username, passwordHash, role, phone: phone ?? null });
    console.log(`✓ создан пользователь "${username}" (роль: ${role})`);
  }

  if (generated) {
    console.log(`\n  Пароль: ${password}\n`);
    console.log("  Показан один раз — сохраните его в менеджере паролей.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ не удалось создать пользователя:", err);
  process.exit(1);
});
