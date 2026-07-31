import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  channelOf,
  decodeFirstTouch,
  encodeFirstTouch,
  hasSignal,
  readFirstTouch,
} from "./attribution.ts";

/* Attribution is what makes a commission provable, so the encode/decode pair
   and the channel mapping are worth pinning down. */

describe("readFirstTouch", () => {
  it("captures UTM parameters from the landing URL", () => {
    const url = new URL("https://vitalux.kz/ru?utm_source=instagram&utm_medium=bio&utm_campaign=launch");
    const f = readFirstTouch(url, null);
    assert.equal(f.s, "instagram");
    assert.equal(f.m, "bio");
    assert.equal(f.c, "launch");
    assert.equal(f.p, "/ru");
  });

  it("records an external referrer host", () => {
    const url = new URL("https://vitalux.kz/ru");
    const f = readFirstTouch(url, "https://www.instagram.com/santehnika.vita_lux/");
    assert.equal(f.r, "www.instagram.com");
  });

  it("ignores a same-site referrer — that is navigation, not a referral", () => {
    const url = new URL("https://vitalux.kz/ru/cart");
    const f = readFirstTouch(url, "https://vitalux.kz/ru/catalog/toilets");
    assert.equal(f.r, undefined);
  });

  it("survives an unparseable Referer header", () => {
    const f = readFirstTouch(new URL("https://vitalux.kz/ru"), "not a url");
    assert.equal(f.r, undefined);
  });

  it("clips absurdly long values so a crafted link cannot bloat the cookie", () => {
    const url = new URL(`https://vitalux.kz/ru?utm_source=${"x".repeat(500)}`);
    assert.ok((readFirstTouch(url, null).s ?? "").length <= 120);
  });
});

describe("hasSignal", () => {
  it("is false for a plain direct visit", () => {
    assert.equal(hasSignal(readFirstTouch(new URL("https://vitalux.kz/ru"), null)), false);
  });

  it("is true when any campaign parameter or referrer is present", () => {
    assert.equal(hasSignal(readFirstTouch(new URL("https://vitalux.kz/ru?utm_source=ig"), null)), true);
    assert.equal(hasSignal(readFirstTouch(new URL("https://vitalux.kz/ru"), "https://google.com/")), true);
  });
});

describe("encode/decode round trip", () => {
  it("preserves every field", () => {
    const original = readFirstTouch(
      new URL("https://vitalux.kz/ru?utm_source=instagram&utm_medium=bio&utm_campaign=акция&utm_content=story"),
      "https://l.instagram.com/",
    );
    const round = decodeFirstTouch(encodeFirstTouch(original));
    // Absent parameters are `undefined` on the source object and are dropped
    // entirely by JSON — that is intended, so compare against the JSON view.
    assert.deepEqual(round, JSON.parse(JSON.stringify(original)));
  });

  it("keeps a Cyrillic campaign name intact", () => {
    const round = decodeFirstTouch(encodeFirstTouch({ c: "весенняя-акция" }));
    assert.equal(round?.c, "весенняя-акция");
  });

  it("returns null rather than throwing on corrupt input", () => {
    assert.equal(decodeFirstTouch("not-json"), null);
    assert.equal(decodeFirstTouch(undefined), null);
    assert.equal(decodeFirstTouch("%E0%A4%A"), null); // malformed percent-encoding
  });
});

describe("channelOf", () => {
  it("maps the channels this business actually sells through", () => {
    assert.equal(channelOf({ s: "instagram" }), "instagram");
    assert.equal(channelOf({ r: "www.instagram.com" }), "instagram");
    assert.equal(channelOf({ s: "kaspi" }), "kaspi");
    assert.equal(channelOf({ r: "www.google.com" }), "search");
    assert.equal(channelOf({ r: "wa.me" }), "whatsapp");
  });

  it("calls an unknown or absent source direct", () => {
    assert.equal(channelOf(null), "direct");
    assert.equal(channelOf({}), "direct");
  });

  it("passes an unrecognised source through rather than losing it", () => {
    assert.equal(channelOf({ s: "olx" }), "olx");
  });
});
