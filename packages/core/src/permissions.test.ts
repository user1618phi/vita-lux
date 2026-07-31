import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OWNER_ONLY_CAPABILITIES, can } from "./permissions.ts";

/* A silent permission regression is the kind that is only noticed after
   someone has already changed something they should not have. */

describe("can", () => {
  it("lets an owner do everything", () => {
    for (const capability of OWNER_ONLY_CAPABILITIES) {
      assert.equal(can("owner", capability), true, `owner should be allowed ${capability}`);
    }
  });

  it("keeps a manager out of settings — the whole storefront reads them", () => {
    assert.equal(can("manager", "settings"), false);
  });

  /* Отдельным тестом, а не только внутри цикла: тот, кто заводит учётные
     записи, раздаёт доступ. Менеджер, способный создать себе владельца,
     обходит разграничение целиком — и это должно упасть громко, если кто-то
     переставит `accounts` из owner-only. */
  it("keeps a manager out of accounts — otherwise he can grant himself owner", () => {
    assert.equal(can("manager", "accounts"), false);
  });

  it("denies a manager every owner-only capability, including ones added later", () => {
    for (const capability of OWNER_ONLY_CAPABILITIES) {
      assert.equal(can("manager", capability), false, `manager should be denied ${capability}`);
    }
  });
});
