import type { FlushType, MountType, OutletType, SeatMaterial } from "@vita/core/catalog";
import type { CatalogSlug } from "@vita/data/content/nav";

/* Контент каталога Vita Lux: названия, разделы, характеристики, описания.

   ИСТОЧНИКИ. Габариты, материал сиденья, тип смыва, тип выпуска и цвет взяты из
   официального прайс-листа «Прайс нов 22.09» — 55 позиций с артикулами. Всё,
   чего в прайсе нет, определено по фотографии товара, которую синк скачал из
   X2pos (apps/worker/public/uploads/x2pos/<external_id>/). Ничего не
   додумано: где характеристика неизвестна, поля просто нет, и строка в таблице
   не выводится.

   ЧЕГО ЗДЕСЬ НЕТ И НЕ БУДЕТ. Цен и остатков. Прайсу десять месяцев, цены в нём
   в долларах, а пометки «нет в наличии» давно неверны. Единственный источник
   правды по деньгам и складу — X2pos (см. CLAUDE.md). Скрипт наполнения даже
   не импортирует таблицу `price`.

   ТИП — это TypeScript, а не CSV, намеренно: `pnpm typecheck` доказывает, что
   каждый раздел существует, каждый `flushType` — реальный ключ enum'а, и у
   каждой строки есть оба названия, ДО того как что-то коснётся базы. */

export interface BackfillRow {
  /** `product.base_article`. Не уникален — см. resolve в backfill-catalog.ts. */
  article: string;
  /** X2pos `product_id`. Единственный по-настоящему уникальный ключ. */
  externalId: string;
  category: CatalogSlug;
  nameRu: string;
  nameKk: string;
  descriptionRu: string;
  descriptionKk: string;
  /** Ключ из `Filters.finishes`. Проверяется скриптом до записи. */
  finish?: string;
  outletType?: OutletType;
  mountType?: MountType;
  flushType?: FlushType;
  seatMaterial?: SeatMaterial;
  widthMm?: number;
  depthMm?: number;
  heightMm?: number;
}

type Dims = [w: number, d: number, h: number];

const BRAND = "Vita Lux";

/* --- Словарь характеристик для описаний ---------------------------------- */

const FLUSH_RU: Record<FlushType, string> = {
  shower: "душевой смыв",
  rimless: "безободковый смыв",
  tornado: "смыв Tornado",
};
const FLUSH_KK: Record<FlushType, string> = {
  shower: "душ тәрізді шаю",
  rimless: "жиексіз шаю",
  tornado: "Tornado шаюы",
};
const SEAT_RU: Record<SeatMaterial, string> = {
  pp: "сиденье из полипропилена",
  duroplast: "сиденье из дюропласта",
};
const SEAT_KK: Record<SeatMaterial, string> = {
  pp: "полипропилен отырғыш",
  duroplast: "дюропласт отырғыш",
};

/** «700 × 380 × 670 мм» для текста описания. Пусто, если известны не все три. */
function dimsPhrase(dims: Dims | undefined, unit: string): string | null {
  if (!dims) return null;
  return `${dims[0]} × ${dims[1]} × ${dims[2]} ${unit}`;
}

/** Собирает абзац из непустых кусков, первая буква заглавная. */
function sentence(parts: (string | null | undefined)[]): string {
  const text = parts.filter(Boolean).join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

/* --- Конструкторы по типам товара ----------------------------------------
   Правило именования живёт здесь и только здесь: тип + бренд + артикул +
   ключевая характеристика. Повторять его 92 раза значило бы получить 92
   возможности разойтись. */

interface ToiletOpts {
  dims?: Dims;
  flush?: FlushType;
  seat?: SeatMaterial;
  finish?: string;
  /** Уточнение в названии: «детский», «золото», «мрамор». */
  ru?: string;
  kk?: string;
}

function monoblock(article: string, externalId: string, o: ToiletOpts = {}): BackfillRow {
  const suffixRu = [o.ru, o.flush && FLUSH_RU[o.flush]].filter(Boolean).join(", ");
  const suffixKk = [o.kk, o.flush && FLUSH_KK[o.flush]].filter(Boolean).join(", ");
  return {
    article,
    externalId,
    category: "toilets",
    nameRu: `Унитаз-моноблок ${BRAND} ${article}${suffixRu ? `, ${suffixRu}` : ""}`,
    nameKk: `${BRAND} ${article} моноблок унитазы${suffixKk ? `, ${suffixKk}` : ""}`,
    descriptionRu: sentence([
      `Напольный унитаз-моноблок ${BRAND} ${article} из санфаянса`,
      dimsPhrase(o.dims, "мм"),
      "горизонтальный выпуск",
      o.flush && FLUSH_RU[o.flush],
      o.seat && SEAT_RU[o.seat],
    ]),
    descriptionKk: sentence([
      `${BRAND} ${article} — санфаянстан жасалған еденге орнатылатын моноблок унитаз`,
      dimsPhrase(o.dims, "мм"),
      "көлденең шығару",
      o.flush && FLUSH_KK[o.flush],
      o.seat && SEAT_KK[o.seat],
    ]),
    finish: o.finish ?? "white-gloss",
    outletType: "horizontal",
    mountType: "floor",
    flushType: o.flush,
    seatMaterial: o.seat,
    widthMm: o.dims?.[0],
    depthMm: o.dims?.[1],
    heightMm: o.dims?.[2],
  };
}

function wallToilet(article: string, externalId: string, o: ToiletOpts = {}): BackfillRow {
  const suffixRu = [o.ru, o.flush && FLUSH_RU[o.flush]].filter(Boolean).join(", ");
  const suffixKk = [o.kk, o.flush && FLUSH_KK[o.flush]].filter(Boolean).join(", ");
  return {
    article,
    externalId,
    category: "toilets",
    nameRu: `Унитаз подвесной ${BRAND} ${article}${suffixRu ? `, ${suffixRu}` : ""}`,
    nameKk: `${BRAND} ${article} аспалы унитазы${suffixKk ? `, ${suffixKk}` : ""}`,
    descriptionRu: sentence([
      `Подвесной унитаз ${BRAND} ${article} из санфаянса`,
      dimsPhrase(o.dims, "мм"),
      "монтируется на инсталляцию",
      o.flush && FLUSH_RU[o.flush],
      o.seat && SEAT_RU[o.seat],
    ]),
    descriptionKk: sentence([
      `${BRAND} ${article} — санфаянстан жасалған аспалы унитаз`,
      dimsPhrase(o.dims, "мм"),
      "инсталляцияға орнатылады",
      o.flush && FLUSH_KK[o.flush],
      o.seat && SEAT_KK[o.seat],
    ]),
    finish: o.finish ?? "white-gloss",
    mountType: "wall",
    flushType: o.flush,
    seatMaterial: o.seat,
    widthMm: o.dims?.[0],
    depthMm: o.dims?.[1],
    heightMm: o.dims?.[2],
  };
}

/** Напольная чаша (генуя). Устанавливается в пол, сиденья не имеет. */
function squatPan(article: string, externalId: string, dims?: Dims): BackfillRow {
  return {
    article,
    externalId,
    category: "toilets",
    nameRu: `Чаша генуя ${BRAND} ${article}`,
    nameKk: `${BRAND} ${article} унитаз-тостағаны`,
    descriptionRu: sentence([
      `Напольная чаша генуя ${BRAND} ${article} из санфаянса`,
      dimsPhrase(dims, "мм"),
      "монтаж в пол, S-образный выпуск",
    ]),
    descriptionKk: sentence([
      `${BRAND} ${article} — санфаянстан жасалған еденге орнатылатын унитаз-тостаған`,
      dimsPhrase(dims, "мм"),
      "еденге орнату, S тәрізді шығару",
    ]),
    finish: "white-gloss",
    mountType: "floor",
    widthMm: dims?.[0],
    depthMm: dims?.[1],
    heightMm: dims?.[2],
  };
}

function bidet(
  article: string,
  externalId: string,
  mount: MountType,
  o: { dims?: Dims; finish?: string; ru?: string; kk?: string } = {},
): BackfillRow {
  const kindRu = mount === "wall" ? "подвесное" : "напольное";
  const kindKk = mount === "wall" ? "аспалы" : "еденге орнатылатын";
  return {
    article,
    externalId,
    category: "bidets",
    nameRu: `Биде ${kindRu} ${BRAND} ${article}${o.ru ? `, ${o.ru}` : ""}`,
    nameKk: `${BRAND} ${article} ${kindKk} бидесі${o.kk ? `, ${o.kk}` : ""}`,
    descriptionRu: sentence([
      `${kindRu.charAt(0).toUpperCase()}${kindRu.slice(1)} биде ${BRAND} ${article} из санфаянса`,
      dimsPhrase(o.dims, "мм"),
      "одно отверстие под смеситель",
    ]),
    descriptionKk: sentence([
      `${BRAND} ${article} — санфаянстан жасалған ${kindKk} биде`,
      dimsPhrase(o.dims, "мм"),
      "араластырғышқа арналған бір саңылау",
    ]),
    finish: o.finish ?? "white-gloss",
    mountType: mount,
    widthMm: o.dims?.[0],
    depthMm: o.dims?.[1],
    heightMm: o.dims?.[2],
  };
}

/** Накладная раковина — ставится на столешницу. */
function counterSink(
  article: string,
  externalId: string,
  o: { dims?: Dims; shapeRu?: string; shapeKk?: string; finish?: string } = {},
): BackfillRow {
  return {
    article,
    externalId,
    category: "sinks",
    nameRu: `Раковина накладная ${BRAND} ${article}${o.shapeRu ? `, ${o.shapeRu}` : ""}`,
    nameKk: `${BRAND} ${article} үстіңгі қолжуғышы${o.shapeKk ? `, ${o.shapeKk}` : ""}`,
    descriptionRu: sentence([
      `Накладная раковина ${BRAND} ${article} из санфаянса`,
      dimsPhrase(o.dims, "мм"),
      "устанавливается на столешницу",
    ]),
    descriptionKk: sentence([
      `${BRAND} ${article} — санфаянстан жасалған үстіңгі қолжуғыш`,
      dimsPhrase(o.dims, "мм"),
      "үстелдің бетіне орнатылады",
    ]),
    finish: o.finish ?? "white-gloss",
    widthMm: o.dims?.[0],
    depthMm: o.dims?.[1],
    heightMm: o.dims?.[2],
  };
}

/** Раковина на пьедестале или полупьедестале («тюльпан»). */
function pedestalSink(
  article: string,
  externalId: string,
  o: { dims?: Dims; half?: boolean; finish?: string; ru?: string; kk?: string } = {},
): BackfillRow {
  const kindRu = o.half ? "с полупьедесталом" : "с пьедесталом";
  const kindKk = o.half ? "жартылай тұғырлы" : "тұғырлы";
  return {
    article,
    externalId,
    category: "sinks",
    nameRu: `Раковина ${kindRu} ${BRAND} ${article}${o.ru ? `, ${o.ru}` : ""}`,
    nameKk: `${BRAND} ${article} ${kindKk} қолжуғышы${o.kk ? `, ${o.kk}` : ""}`,
    descriptionRu: sentence([
      `Раковина ${kindRu} ${BRAND} ${article} из санфаянса`,
      dimsPhrase(o.dims, "мм"),
      "отверстие под смеситель и перелив",
    ]),
    descriptionKk: sentence([
      `${BRAND} ${article} — санфаянстан жасалған ${kindKk} қолжуғыш`,
      dimsPhrase(o.dims, "мм"),
      "араластырғышқа арналған саңылау және асып төгілу",
    ]),
    finish: o.finish ?? "white-gloss",
    mountType: "floor",
    widthMm: o.dims?.[0],
    depthMm: o.dims?.[1],
    heightMm: o.dims?.[2],
  };
}

/* --- Запчасти и комплектующие -------------------------------------------- */

function part(
  article: string,
  externalId: string,
  p: {
    nameRu: string;
    nameKk: string;
    descRu: string;
    descKk: string;
    dims?: Dims;
    /* У части позиций артикул в X2pos — это русское слово («Квадратный»,
       «Крышка овальная»), а не код. Подставлять такое в название значит
       получить «Сиденье для унитаза квадратное Vita Lux Квадратный». */
    noArticle?: boolean;
  },
): BackfillRow {
  const tail = p.noArticle ? "" : ` ${article}`;
  return {
    article,
    externalId,
    category: "spare-parts",
    nameRu: `${p.nameRu} ${BRAND}${tail}`,
    nameKk: `${BRAND}${tail} ${p.nameKk}`,
    descriptionRu: sentence([p.descRu, dimsPhrase(p.dims, "мм")]),
    descriptionKk: sentence([p.descKk, dimsPhrase(p.dims, "мм")]),
    finish: "white-gloss",
    widthMm: p.dims?.[0],
    depthMm: p.dims?.[1],
    heightMm: p.dims?.[2],
  };
}

const cistern = (article: string, externalId: string) =>
  part(article, externalId, {
    nameRu: "Сливной бачок",
    nameKk: "ағызу бачогы",
    descRu: `Керамический сливной бачок ${BRAND} ${article} для напольного унитаза`,
    descKk: `${BRAND} ${article} — еденге орнатылатын унитазға арналған керамикалық ағызу бачогы`,
  });

const installation = (article: string, externalId: string, dims?: Dims) =>
  part(article, externalId, {
    nameRu: "Инсталляция для подвесного унитаза",
    nameKk: "аспалы унитазға арналған инсталляциясы",
    descRu: `Рама-инсталляция ${BRAND} ${article} со скрытым бачком для подвесного унитаза, скрытый монтаж в стену`,
    descKk: `${BRAND} ${article} — аспалы унитазға арналған жасырын бачогы бар инсталляция рамасы, қабырғаға жасырын орнату`,
    dims,
  });

/* --- Каталог -------------------------------------------------------------
   Порядок — по разделам, внутри раздела по артикулу. */

export const rows: BackfillRow[] = [
  /* ---- Унитазы-моноблоки. Габариты и фасеты — из прайс-листа ---- */
  monoblock("VL-222", "7418534", { dims: [500, 285, 530], flush: "shower", seat: "pp", ru: "детский", kk: "балаларға арналған" }),
  monoblock("VL-009T", "7418499", { dims: [680, 370, 750], flush: "rimless", seat: "duroplast" }),
  monoblock("VL-1095", "7418500", { dims: [710, 375, 750], flush: "rimless", seat: "duroplast" }),
  monoblock("VL-1096", "7418501", { dims: [710, 375, 750], flush: "shower", seat: "pp" }),
  monoblock("VL-2008WS", "7418502", { dims: [680, 360, 780], flush: "rimless", seat: "duroplast", finish: "marble-white", ru: "белый мрамор", kk: "ақ мәрмәр" }),
  monoblock("VL-2049M07", "7418504", { dims: [680, 360, 780], flush: "shower", seat: "duroplast", finish: "marble-white", ru: "белый мрамор", kk: "ақ мәрмәр" }),
  monoblock("VL-3104", "7418506", { dims: [680, 360, 780], flush: "shower", seat: "duroplast" }),
  monoblock("VL-3204", "7418530", { dims: [700, 380, 670], flush: "shower", seat: "pp" }),
  monoblock("VL-3213", "7418507", { dims: [660, 380, 780], flush: "shower", seat: "pp" }),
  monoblock("VL-3215", "7418508", { dims: [700, 380, 830], flush: "shower", seat: "pp" }),
  monoblock("VL-3222", "7418509", { dims: [680, 360, 810], seat: "duroplast" }),
  monoblock("VL-3222G", "7418537", { dims: [680, 360, 810], seat: "duroplast", finish: "grey-gloss", ru: "серый", kk: "сұр" }),
  monoblock("VL-3223", "8473423", { seat: "duroplast" }),
  monoblock("VL-3228", "7418510", { dims: [670, 355, 820], seat: "duroplast" }),
  monoblock("VL-3228G", "7418538", { dims: [670, 355, 820], seat: "duroplast", finish: "grey-gloss", ru: "серый", kk: "сұр" }),
  monoblock("VL-6102", "7418511", { dims: [690, 420, 580], flush: "shower", seat: "duroplast" }),
  monoblock("VL-6102 G", "7418512", { dims: [690, 420, 580], flush: "rimless", seat: "duroplast", finish: "gold", ru: "золото", kk: "алтын" }),
  monoblock("VL-6102 GGL", "7418513", { dims: [690, 420, 580], flush: "shower", seat: "duroplast", finish: "grey-gloss", ru: "серый", kk: "сұр" }),
  monoblock("VL-6102 GL", "7418514", { dims: [690, 420, 580], flush: "shower", seat: "duroplast" }),
  monoblock("VL-6102 GR", "7418515", { dims: [690, 420, 580], flush: "shower", seat: "duroplast", finish: "gold", ru: "золото", kk: "алтын" }),
  monoblock("VL-6102BGL", "7418516", { dims: [690, 420, 580], flush: "rimless", seat: "duroplast", finish: "black-gloss", ru: "чёрный", kk: "қара" }),
  monoblock("VL-6281", "7418533", { dims: [650, 370, 775], flush: "tornado", seat: "duroplast" }),
  monoblock("VL-6303", "7418517", { dims: [640, 360, 800], flush: "rimless", seat: "duroplast" }),
  monoblock("VL-6380", "7418518", { dims: [690, 360, 790], flush: "tornado", seat: "duroplast" }),
  monoblock("VL-6380G", "7418519", { dims: [690, 360, 790], flush: "tornado", seat: "duroplast", finish: "gold", ru: "золото", kk: "алтын" }),
  monoblock("VL-6381", "7418520", { dims: [690, 370, 810], flush: "rimless", seat: "duroplast" }),
  monoblock("VL-6384", "7418521", { dims: [690, 375, 780], flush: "tornado", seat: "duroplast" }),
  monoblock("VL-6384 GL", "7418522", { dims: [690, 375, 780], flush: "tornado", seat: "duroplast" }),
  monoblock("VL-6384BMB", "7418528", { flush: "tornado", seat: "duroplast", finish: "marble-white", ru: "белый мрамор", kk: "ақ мәрмәр" }),
  monoblock("VL-6384GM", "7418523", { dims: [690, 375, 780], flush: "tornado", seat: "duroplast", finish: "marble-white", ru: "белый мрамор", kk: "ақ мәрмәр" }),
  monoblock("VL-6384GMB", "7418524", { dims: [690, 375, 780], flush: "tornado", seat: "duroplast", finish: "marble-white", ru: "белый мрамор", kk: "ақ мәрмәр" }),
  monoblock("VL-6385", "7418525", { dims: [685, 355, 775], flush: "rimless", seat: "duroplast" }),
  monoblock("VL-6385BMB", "7418531", { flush: "rimless", seat: "duroplast", finish: "marble-white", ru: "белый мрамор", kk: "ақ мәрмәр" }),
  monoblock("VL-6385GL", "7418526", { dims: [685, 355, 775], flush: "rimless", seat: "duroplast" }),
  monoblock("VL-6385MB", "7418532", { flush: "rimless", seat: "duroplast", finish: "marble-white", ru: "белый мрамор", kk: "ақ мәрмәр" }),
  monoblock("VL-8879", "7418529", { dims: [680, 360, 780], flush: "tornado", seat: "duroplast" }),
  monoblock("6281 BLACK", "7418527", { seat: "duroplast", finish: "black-gloss", ru: "чёрный", kk: "қара" }),

  /* ---- Унитазы подвесные ---- */
  wallToilet("VL-2285GL", "7418505", { dims: [520, 360, 360], flush: "tornado", seat: "duroplast" }),
  wallToilet("SM-9321", "7418536", { dims: [520, 350, 365], flush: "rimless", seat: "duroplast" }),
  wallToilet("VL-7107", "7441750", { seat: "duroplast" }),
  wallToilet("VL-7111", "8473387", { seat: "duroplast" }),
  wallToilet("VL-7112", "8473412", { seat: "duroplast" }),
  wallToilet("VL-7401", "7441720", { seat: "duroplast" }),

  /* ---- Чаши генуя ---- */
  squatPan("VL-837HA", "7418540"),
  squatPan("VL-850HA", "7418541"),
  squatPan("VL-878HA", "7418542"),
  squatPan("VL-887HA", "7418539"),
  squatPan("VL-888HA", "7418543", [650, 450, 240]),
  squatPan("VL-889H", "7418544"),

  /* ---- Биде ---- */
  bidet("VL-1303", "7418467", "wall", { dims: [515, 360, 300] }),
  bidet("VL-1381", "7418468", "wall", { dims: [480, 370, 300] }),
  bidet("VL-1303F", "7418464", "floor", { dims: [560, 340, 400] }),
  bidet("VL-1380F", "7418465", "floor", { dims: [560, 365, 400] }),
  bidet("VL-1381F", "7418466", "floor", { dims: [560, 365, 400] }),
  bidet("VL-1303FG", "7418462", "floor", { finish: "gold", ru: "золото", kk: "алтын" }),
  bidet("VL-1380FG", "7418463", "floor", { finish: "gold", ru: "золото", kk: "алтын" }),

  /* ---- Раковины накладные ---- */
  counterSink("VL-171", "7418478", { dims: [570, 410, 140], shapeRu: "овальная", shapeKk: "сопақ" }),
  counterSink("VL-314", "7418480", { dims: [490, 310, 130], shapeRu: "овальная", shapeKk: "сопақ" }),
  counterSink("VL-316", "7418481", { dims: [400, 350, 130], shapeRu: "овальная", shapeKk: "сопақ" }),
  counterSink("VL-5386", "7418482", { dims: [500, 405, 105], shapeRu: "овальная", shapeKk: "сопақ" }),
  counterSink("VL-5399", "7418494", { shapeRu: "овальная", shapeKk: "сопақ" }),
  counterSink("VL-5400C/D", "7418483", { dims: [570, 360, 140] }),
  counterSink("VL-5435", "7418484", { dims: [660, 430, 120], shapeRu: "овальная", shapeKk: "сопақ" }),
  counterSink("VL-5486B", "7418496", { shapeRu: "овальная", shapeKk: "сопақ" }),
  counterSink("VL-5504", "7418495", { shapeRu: "прямоугольная", shapeKk: "тікбұрышты" }),
  counterSink("VL-5538", "7418497", { shapeRu: "круглая рифлёная", shapeKk: "дөңгелек, қырлы" }),
  counterSink("VL-5555", "7418485", { dims: [600, 420, 130], shapeRu: "прямоугольная", shapeKk: "тікбұрышты" }),
  counterSink("VL-5594", "7418486", { shapeRu: "овальная", shapeKk: "сопақ" }),
  counterSink("VL-613", "7418492", { dims: [610, 350, 110], shapeRu: "прямоугольная", shapeKk: "тікбұрышты" }),
  counterSink("VL-6109 (600)", "7418487", { dims: [600, 470, 135], shapeRu: "прямоугольная", shapeKk: "тікбұрышты" }),
  counterSink("VL-6109 (800)", "7418488", { dims: [800, 470, 135], shapeRu: "прямоугольная", shapeKk: "тікбұрышты" }),
  counterSink("VL-6112B", "7418489", { dims: [500, 400, 130], shapeRu: "прямоугольная", shapeKk: "тікбұрышты" }),
  counterSink("VL-6119 (400)", "7418490", { dims: [400, 300, 130], shapeRu: "прямоугольная", shapeKk: "тікбұрышты" }),
  counterSink("VL-6119 (485)", "7418491", { dims: [485, 370, 140], shapeRu: "прямоугольная", shapeKk: "тікбұрышты" }),

  /* ---- Раковины с пьедесталом ---- */
  /* На фото размечены только ширина и глубина. Высоту не выдумываем — витрина
     выводит известные размеры отдельными строками (см. formatDimensions). */
  { ...pedestalSink("VL-2012", "7418472"), widthMm: 430, depthMm: 340 },
  pedestalSink("VL-3107", "7418479", { dims: [550, 440, 470], half: true }),
  pedestalSink("VL-5001", "7418474"),
  pedestalSink("VL-5001F", "7418473", { half: true }),
  pedestalSink("VL-5001G", "7418476", { finish: "gold", ru: "золото", kk: "алтын" }),
  pedestalSink("VL-5002", "7418475"),
  pedestalSink("VL-5002G", "7418477", { finish: "gold", ru: "золото", kk: "алтын" }),

  /* ---- Запчасти и комплектующие ---- */
  cistern("VL-5254", "7418459"),
  cistern("VL-5272", "7418460"),
  cistern("VL-5276", "7418461"),
  installation("VL-6601", "7441794"),
  installation("VL-6618", "7441824", [500, 193, 1112]),
  part("VL-01", "7418458", {
    nameRu: "Арматура для сливного бачка",
    nameKk: "ағызу бачогына арналған арматурасы",
    descRu: `Комплект арматуры ${BRAND} VL-01 для сливного бачка: наливной и сливной клапаны, кнопка двойного смыва`,
    descKk: `${BRAND} VL-01 — ағызу бачогына арналған арматура жинағы: құю және ағызу клапандары, қос шаю түймесі`,
  }),
  part("VL-005", "7441852", {
    nameRu: "Гофра для унитаза",
    nameKk: "унитазға арналған гофрасы",
    descRu: `Гофрированный выпуск ${BRAND} VL-005 для подключения напольного унитаза к канализации`,
    descKk: `${BRAND} VL-005 — еденге орнатылатын унитазды кәрізге қосуға арналған гофрленген шығару`,
  }),
  /* Материал и наличие микролифта по фотографии не определяются, поэтому в
     описании их нет: сиденье с микролифтом и без стоят по-разному, и обещание
     тут — обещание конкретной вещи, а не общее слово. */
  /* VL-8349 — единственная позиция, тип которой установить не удалось: в
     прайс-листе её нет, фотографию синк не привёз, а по артикулу семейство не
     читается. Название и описание не утверждают о товаре НИЧЕГО сверх артикула
     и бренда — придуманный тип на карточке в продаже стоит дороже, чем пустая
     строка характеристик. Раздел выбран как наименее обязывающий; после того
     как товар опознают, его переносят в админке одним действием. */
  {
    article: "VL-8349",
    externalId: "7418493",
    category: "spare-parts",
    nameRu: `${BRAND} VL-8349`,
    nameKk: `${BRAND} VL-8349`,
    descriptionRu:
      "Артикул VL-8349. Характеристики уточняются — напишите нам в WhatsApp, и мы пришлём параметры и фотографии.",
    descriptionKk:
      "VL-8349 артикулы. Сипаттамалары нақтылануда — бізге WhatsApp арқылы жазыңыз, параметрлері мен фотоларын жібереміз.",
  },

  /* У этой позиции в X2pos артикула нет вовсе (base_article = NULL), поэтому
     находится она только по external_id, а в названии артикулу взяться неоткуда. */
  part("(без артикула) крышка бачка", "7418471", {
    noArticle: true,
    nameRu: "Крышка сливного бачка",
    nameKk: "ағызу бачогының қақпағы",
    descRu: `Керамическая крышка сливного бачка ${BRAND} с отверстием под кнопку смыва`,
    descKk: `${BRAND} — шаю түймесіне арналған саңылауы бар ағызу бачогының керамикалық қақпағы`,
  }),
  part("Квадратный", "7418469", {
    noArticle: true,
    nameRu: "Сиденье для унитаза квадратное",
    nameKk: "унитазға арналған шаршы отырғышы",
    descRu: `Сменное сиденье с крышкой для унитаза ${BRAND}, квадратная форма чаши`,
    descKk: `${BRAND} унитазына арналған қақпағы бар ауыстырмалы отырғыш, тостағанның шаршы пішіні`,
  }),
  part("Крышка овальная", "7418470", {
    noArticle: true,
    nameRu: "Сиденье для унитаза овальное",
    nameKk: "унитазға арналған сопақ отырғышы",
    descRu: `Сменное сиденье с крышкой для унитаза ${BRAND}, овальная форма чаши`,
    descKk: `${BRAND} унитазына арналған қақпағы бар ауыстырмалы отырғыш, тостағанның сопақ пішіні`,
  }),
];
