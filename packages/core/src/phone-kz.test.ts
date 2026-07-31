import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatKzPhone, normalizeKzPhone } from "./phone-kz.ts";

describe("normalizeKzPhone", () => {
  it("accepts every way a customer actually types the same number", () => {
    const forms = [
      "+7 707 996 17 17",
      "8 (707) 996-17-17",
      "87079961717",
      "77079961717",
      "7079961717",
      "+7-707-996-1717",
    ];
    for (const f of forms) {
      const r = normalizeKzPhone(f);
      assert.ok(r.ok, `expected ${f} to parse`);
      assert.equal(r.e164, "77079961717", `${f} normalised wrong`);
    }
  });

  it("keeps the real Vita Lux numbers valid", () => {
    for (const n of ["+7 707 996 17 17", "+7 747 853 70 14"]) {
      assert.ok(normalizeKzPhone(n).ok, `${n} should be valid`);
    }
  });

  it("rejects a landline prefix — a manager needs to reach a mobile", () => {
    const r = normalizeKzPhone("+7 727 300 00 00"); // 727 = Almaty landline
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "prefix");
  });

  it("rejects wrong lengths", () => {
    for (const bad of ["7707996171", "770799617177", "123"]) {
      const r = normalizeKzPhone(bad);
      assert.equal(r.ok, false, `${bad} should be rejected`);
    }
  });

  it("reports an empty input distinctly so the message can differ", () => {
    const r = normalizeKzPhone("");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "empty");
  });

  it("ignores stray letters and punctuation", () => {
    const r = normalizeKzPhone("тел: +7 (707) 996-17-17 ");
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.e164, "77079961717");
  });
});

describe("formatKzPhone", () => {
  it("renders the canonical display form", () => {
    assert.equal(formatKzPhone("77079961717"), "+7 707 996 17 17");
  });

  it("passes through anything it cannot format", () => {
    assert.equal(formatKzPhone("123"), "123");
  });
});
