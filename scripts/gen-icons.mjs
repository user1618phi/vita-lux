/* Пересобирает растровые иконки из public/favicon.svg — единственного
   источника знака в вебе (сам знак живёт ещё и в components/ui/Logo.tsx).
   Запуск: node scripts/gen-icons.mjs

   Почему два разных силуэта: у apple-icon углы прямые — iOS накладывает свою
   маску, и скруглённая плашка под ней даёт двойную рамку. */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(join(root, "public/favicon.svg"), "utf8");

const targets = [
  { file: "icon-512.png", size: 512, square: false },
  { file: "apple-icon.png", size: 180, square: true },
];

for (const { file, size, square } of targets) {
  const svg = square ? source.replace(/ rx="18"/, "") : source;
  const png = await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(join(root, "public", file), png);
  console.log(`${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} КБ`);
}
