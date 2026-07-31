import { randomInt } from "node:crypto";

/* Order reference codes.

   Generated on the server — the old checkout built one with Math.random() in
   the browser, which meant two customers could be given the same number and
   nothing tied it to a stored order.

   Crockford base32 without I, L, O and U: no character pair a customer can
   confuse when reading the code down the phone, and no accidental words.
   Five characters over a 32-symbol alphabet is ~33.5 million combinations,
   which is far beyond this shop's order volume; the unique index on
   `order.ref_code` is what actually guarantees uniqueness. */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 5;

export function newRefCode(): string {
  let out = "";
  for (let i = 0; i < LENGTH; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `VL-${out}`;
}

/** Normalise what a customer typed or pasted back to us. */
export function normalizeRefCode(input: string): string | null {
  const cleaned = (input ?? "")
    .toUpperCase()
    .replace(/^VL-?/, "")
    .replace(/[^0-9A-Z]/g, "")
    // The characters the alphabet deliberately omits, mapped to what a person
    // most likely meant when they wrote them down.
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");

  if (cleaned.length !== LENGTH) return null;
  if (![...cleaned].every((c) => ALPHABET.includes(c))) return null;
  return `VL-${cleaned}`;
}
