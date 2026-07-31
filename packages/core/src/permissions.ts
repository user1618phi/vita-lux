/* Who may do what.

   Kept separate from auth.ts on purpose: that module pulls in next/headers and
   the database, so it cannot be imported by a plain test. The rule itself is
   pure, and a permission regression is exactly the kind of bug that is only
   noticed after someone has already changed something they should not have.

   The split follows the money. A manager runs the catalog day to day: prices,
   stock, photos, hiding a product. All of that is reversible in a minute and
   recorded in audit_log. Settings are different — they hold contacts and
   delivery terms that the whole storefront reads, and there is nobody above the
   manager to catch a wrong number.

   `accounts` — по той же логике, но резче: тот, кто заводит учётные записи,
   раздаёт доступ. Менеджер, способный создать себе второго администратора с
   ролью owner, обходит всё разграничение целиком. */

export type AdminRole = "owner" | "manager";

export const OWNER_ONLY_CAPABILITIES = ["settings", "accounts"] as const;
export type Capability = (typeof OWNER_ONLY_CAPABILITIES)[number];

export function can(role: AdminRole, capability: Capability): boolean {
  if (role === "owner") return true;
  return !OWNER_ONLY_CAPABILITIES.includes(capability);
}
