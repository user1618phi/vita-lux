#!/usr/bin/env node
/* Guards the "Двуязычность ru/kk — КРИТИЧНО" rule in CLAUDE.md.
   Wired to a PostToolUse hook for edits under messages/, and runnable directly:
     node scripts/check-kk-glyphs.mjs

   Fails the edit when a Kazakh catalog is broken in a way that is easy to miss
   by eye: lost key parity, mangled glyphs, empty strings. Prints warnings for
   things that are usually — but not always — wrong. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Локали переехали в packages/i18n — путь ведёт туда.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "i18n");

/* The glyphs that distinguish Kazakh Cyrillic from Russian. If a transform
   strips them, the text silently degrades into broken Russian. */
const KK_GLYPHS = "әөұүқңғһі";

/** Values that are legitimately identical across locales — brand and channel
    names, latin model names, shared abbreviations. Not flagged as untranslated. */
const SHARED_OK = /^[\s\d.,·%×+—–-]*$|Vita Lux|Kaspi|WhatsApp|Halyk|Visa|Mastercard|FEEL THE QUALITY|^(Aura|Standart|Bronze|Хит)$/i;

const errors = [];
const warnings = [];

function load(locale) {
  const path = join(root, "messages", `${locale}.json`);
  try {
    return { path, data: JSON.parse(readFileSync(path, "utf8")) };
  } catch (err) {
    errors.push(`${locale}.json не читается или содержит невалидный JSON: ${err.message}`);
    return null;
  }
}

/** Flatten to dotted paths so parity and value checks can report a location. */
function flatten(node, prefix = "", out = new Map()) {
  if (typeof node === "string") {
    out.set(prefix, node);
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const ru = load("ru");
const kk = load("kk");

if (ru && kk) {
  const ruFlat = flatten(ru.data);
  const kkFlat = flatten(kk.data);

  // 1. Key parity — a missing kk key renders the raw key id to a real user.
  const missing = [...ruFlat.keys()].filter((k) => !kkFlat.has(k));
  const extra = [...kkFlat.keys()].filter((k) => !ruFlat.has(k));
  if (missing.length) errors.push(`нет в kk.json (${missing.length}): ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? " …" : ""}`);
  if (extra.length) errors.push(`лишние ключи в kk.json (${extra.length}): ${extra.slice(0, 8).join(", ")}${extra.length > 8 ? " …" : ""}`);

  // 2. Mojibake — U+FFFD means an encoding step already destroyed the text.
  for (const [locale, flat] of [["ru", ruFlat], ["kk", kkFlat]]) {
    for (const [key, value] of flat) {
      if (value.includes("�")) errors.push(`${locale}.json ${key}: символ-заменитель � — текст испорчен при перекодировке`);
    }
  }

  // 3. Dropped translations. An empty value is fine when Russian is empty too
  //    (spec rows with no unit) — only a kk blank against a filled ru is a bug.
  for (const [key, value] of kkFlat) {
    if (value.trim() === "" && (ruFlat.get(key) ?? "").trim() !== "") {
      errors.push(`kk.json ${key}: пусто, хотя в ru.json значение есть`);
    }
  }

  // 4. Kazakh glyphs must survive. A catalog this size without them means the
  //    file was normalized against Russian.
  const glyphHits = [...kkFlat.values()].join("").split("").filter((ch) => KK_GLYPHS.includes(ch.toLowerCase())).length;
  if (glyphHits < 50) {
    errors.push(`kk.json: специфичных казахских глифов ${KK_GLYPHS} найдено всего ${glyphHits} — вероятно, они потеряны`);
  }

  // 5. Untranslated leftovers (warning only — some values are shared by design).
  const same = [...kkFlat.entries()].filter(([key, value]) => {
    const ruValue = ruFlat.get(key);
    return ruValue && ruValue === value && value.length > 3 && !SHARED_OK.test(value);
  });
  if (same.length) {
    warnings.push(`kk.json: ${same.length} значений совпадают с русскими — проверь, что это не забытый перевод: ${same.slice(0, 5).map(([k]) => k).join(", ")}${same.length > 5 ? " …" : ""}`);
  }

  // 6. Kazakh runs 10–20% longer; flag the strings most likely to break layout.
  const overflow = [...kkFlat.entries()].filter(([key, value]) => {
    const ruValue = ruFlat.get(key);
    return ruValue && ruValue.length >= 12 && value.length > ruValue.length * 1.45;
  });
  if (overflow.length) {
    warnings.push(`kk.json: ${overflow.length} строк более чем на 45% длиннее русских — проверь верстку на 390px: ${overflow.slice(0, 5).map(([k]) => k).join(", ")}${overflow.length > 5 ? " …" : ""}`);
  }
}

for (const w of warnings) console.warn(`⚠︎  ${w}`);

if (errors.length) {
  console.error("\n✗ Проверка казахской локали не пройдена:\n");
  for (const e of errors) console.error(`   ${e}`);
  console.error("");
  process.exit(1);
}

console.log(`✓ ru/kk локали согласованы${warnings.length ? ` (предупреждений: ${warnings.length})` : ""}`);
