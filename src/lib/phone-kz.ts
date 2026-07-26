/* Kazakh mobile number normalisation.

   People type their number every way imaginable: 8 707…, +7 707…, 707…, with
   spaces, dashes and brackets. All of them are the same number, and a manager
   calling back does not care which form was typed — so normalise to a single
   canonical `7XXXXXXXXXX` and validate the operator prefix.

   The checkout form previously had no validation at all beyond `required`,
   which meant an unreachable phone number silently became an unfulfillable
   order. */

/** Mobile prefixes in use in Kazakhstan (after the leading 7). */
const MOBILE_PREFIXES = [
  "700", "701", "702", "703", "704", "705", "706", "707", "708", "709",
  "747", "750", "751", "760", "761", "762", "763", "764",
  "771", "775", "776", "777", "778",
];

export type PhoneResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: "empty" | "length" | "prefix" };

/**
 * Normalise a Kazakh mobile number.
 *
 * Accepts `8XXXXXXXXXX`, `7XXXXXXXXXX`, `+7XXXXXXXXXX` and bare `XXXXXXXXXX`,
 * with any separators. Returns the canonical 11-digit form.
 */
export function normalizeKzPhone(input: string): PhoneResult {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return { ok: false, reason: "empty" };

  let national: string;
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    national = digits.slice(1); // drop the country/trunk digit
  } else if (digits.length === 10) {
    national = digits; // typed without any leading digit
  } else {
    return { ok: false, reason: "length" };
  }

  if (!MOBILE_PREFIXES.includes(national.slice(0, 3))) {
    return { ok: false, reason: "prefix" };
  }

  return { ok: true, e164: `7${national}`, national };
}

/** Display form: +7 707 996 17 17 */
export function formatKzPhone(e164: string): string {
  const d = e164.replace(/\D/g, "");
  if (d.length !== 11) return e164;
  return `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9, 11)}`;
}
