/* Сжатие фотографии в браузере — до отправки на сервер.

   Зачем это вообще нужно.

   Фото делают телефоном на складе: 12 мегапикселей, 3-8 МБ. Server Action
   принимает тело до 4 МБ (`next.config.ts`), а жёсткий потолок Vercel на запрос
   — 4.5 МБ. Снимок туда не проходит, и обрывается запрос ДО входа в экшен,
   поэтому серверная проверка размера не успевает показать внятную ошибку —
   пользователь видит только «что-то пошло не так».

   Сервер всё равно ужмёт картинку до 1600px (@vita/core/image), так что
   отправлять оригинал бессмысленно: тот же результат, но в десять раз больше
   трафика и с риском не доехать.

   Побочная выгода — HEIC. iPhone отдаёт снимки в HEIC, а sharp на Linux
   собран без libheif (лицензия), то есть на Vercel такой файл упал бы в
   обработке. Здесь его декодирует системный кодек Safari, а на сервер уходит
   уже WebP или JPEG. */

/** Сервер всё равно ресайзит до 1600 — больше отправлять незачем. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

/** Потолок на отправку. Ниже лимита Server Action (4 МБ), потому что FormData
    добавляет накладные расходы и в запрос идёт не один файл. */
export const MAX_UPLOAD_BYTES = 3_500_000;

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * Уменьшает снимок и переводит в WebP.
 *
 * Возвращает исходный файл, если сжать не удалось: пусть лучше попробует
 * сервер (там sharp), чем пользователь получит отказ на ровном месте.
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    /* `imageOrientation: "from-image"` обязателен. Canvas отбрасывает EXIF, и
       без этой опции портретный снимок приезжает лежащим на боку — а серверный
       `.rotate()` уже ничего не исправит, потому что ориентации в файле не
       останется. */
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // HEIC в браузере без системного кодека (обычно десктопный Chrome).
    return file;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // WebP поддерживают все актуальные браузеры; JPEG — страховка для старых.
    let blob = await canvasToBlob(canvas, "image/webp");
    let ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await canvasToBlob(canvas, "image/jpeg");
      ext = "jpg";
    }
    if (!blob) return file;

    // Если «сжатие» вышло больше оригинала (бывает на маленьких картинках) —
    // отправляем оригинал.
    if (blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } finally {
    bitmap.close();
  }
}
