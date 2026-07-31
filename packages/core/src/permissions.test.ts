import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OWNER_ONLY_CAPABILITIES, can, canByRole, rolesEnforced } from "./permissions.ts";

/* A silent permission regression is the kind that is only noticed after
   someone has already changed something they should not have.

   Разграничение сейчас ВЫКЛЮЧЕНО: пользователь один, и это администратор,
   которому нужно всё. Но само правило проверяется по-прежнему — через
   `canByRole`. Иначе к тому дню, когда появится хозяин и разграничение
   включат обратно, оно успеет сгнить, и никто об этом не узнает. */

describe("canByRole — правило разграничения", () => {
  it("lets an owner do everything", () => {
    for (const capability of OWNER_ONLY_CAPABILITIES) {
      assert.equal(canByRole("owner", capability), true, `owner should be allowed ${capability}`);
    }
  });

  it("keeps a manager out of settings — the whole storefront reads them", () => {
    assert.equal(canByRole("manager", "settings"), false);
  });

  /* Отдельным тестом, а не только внутри цикла: тот, кто заводит учётные
     записи, раздаёт доступ. Менеджер, способный создать себе владельца,
     обходит разграничение целиком — и это должно упасть громко, если кто-то
     переставит `accounts` из owner-only. */
  it("keeps a manager out of accounts — otherwise he can grant himself owner", () => {
    assert.equal(canByRole("manager", "accounts"), false);
  });

  it("denies a manager every owner-only capability, including ones added later", () => {
    for (const capability of OWNER_ONLY_CAPABILITIES) {
      assert.equal(canByRole("manager", capability), false, `manager should be denied ${capability}`);
    }
  });
});

describe("can — то, что спрашивают экраны", () => {
  it("сейчас пускает всех: разграничение выключено осознанно", () => {
    assert.equal(rolesEnforced(), false, "если включили роли — этот тест надо переписать");
    for (const capability of OWNER_ONLY_CAPABILITIES) {
      assert.equal(can("manager", capability), true);
      assert.equal(can("owner", capability), true);
    }
  });
});
