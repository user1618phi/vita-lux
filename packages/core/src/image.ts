import sharp from "sharp";

/* Обработка фотографии товара — одна на всех.

   Раньше конвейер жил внутри серверного экшена админки. Скрипты не могут
   импортировать код из `apps/*`, поэтому зеркалирование мок-картинок либо
   дублировало бы его, либо расходилось с ним: два места, где решают, каким
   получится фото на витрине. Здесь — единственная правда.

   Модуль зависит только от sharp, без Next и React, поэтому годится и
   серверному экшену, и Node-скрипту. */

/** Ширина основного изображения. Больше карточка товара не показывает. */
export const LARGE_PX = 1600;
/** Ширина миниатюры для списков и превью. */
export const THUMB_PX = 400;

export interface ProcessedPhoto {
  large: Buffer;
  thumb: Buffer;
  /** Размеры УЖЕ обработанного большого изображения, не исходника. */
  width: number;
  height: number;
}

/**
 * Что за файл на самом деле — по сигнатуре, а не по заявленному MIME-типу.
 *
 * `File.type` в браузере проставляет сам браузер, и в подделанном запросе там
 * может стоять что угодно. Единственный авторитет — содержимое.
 */
export async function readFormat(input: Buffer): Promise<{ format?: string }> {
  const { format } = await sharp(input, { failOn: "error" }).metadata();
  return { format };
}

/**
 * Приводит произвольный снимок к паре WebP: большой и миниатюра.
 *
 * `.rotate()` без аргументов применяет EXIF-ориентацию — без него портретные
 * фото с телефона приезжают лежащими на боку.
 *
 * ВАЖНО про размеры. Раньше в БД писали `width = min(исходная, 1600)`, а
 * `height` брали исходный, без пересчёта. Для снимка 4000×3000 в базу уходила
 * пара 1600×3000 — соотношение сторон, которого не существует ни у одного
 * файла. Любой расчёт вёрстки по `media.width/height` на таких данных врёт,
 * поэтому здесь оба числа читаются из метаданных готового буфера.
 */
export async function processPhoto(input: Buffer): Promise<ProcessedPhoto> {
  const large = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: LARGE_PX, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const thumb = await sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: THUMB_PX, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();

  const meta = await sharp(large).metadata();

  return {
    large,
    thumb,
    width: meta.width ?? LARGE_PX,
    height: meta.height ?? LARGE_PX,
  };
}
