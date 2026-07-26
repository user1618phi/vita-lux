/* Официальный знак Kaspi.kz — /public/kaspi.png.

   Исходник прислан как SVG, но внутри лежал растр 120×120; здесь он обрезан по
   краю диска и приведён к квадрату 91×91. Пиксели не менялись. Для знака 22–26 px
   это запас 3.5× даже на экранах с высокой плотностью.

   Товарный знак не перекрашивается и не искажается. Поэтому на красной кнопке
   Kaspi используется вариант `onColor`: логотип как есть, но на белом кружке —
   так партнёрские марки и размещают на цветных поверхностях. Раньше здесь был
   белый силуэт, то есть перекрашенный чужой знак, чего делать нельзя.

   Если Kaspi пришлют настоящий вектор — замените public/kaspi.png на .svg и
   поправьте src; API компонента и все места использования останутся прежними. */

export function KaspiGlyph({
  size = 24,
  variant = "plain",
  title,
}: {
  size?: number;
  /** `plain` — знак на светлом фоне. `onColor` — знак на белом кружке, для красной кнопки. */
  variant?: "plain" | "onColor";
  /** Задайте, если знак стоит без поясняющего текста рядом. */
  title?: string;
}) {
  // Кружок-подложка чуть больше самого знака, чтобы у диска остался воздух.
  const pad = variant === "onColor" ? Math.round(size * 0.18) : 0;
  const box = size + pad * 2;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "none",
        width: box,
        height: box,
        borderRadius: "50%",
        background: variant === "onColor" ? "#fff" : undefined,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/kaspi.png"
        alt={title ?? ""}
        aria-hidden={title ? undefined : true}
        width={size}
        height={size}
        style={{ display: "block", width: size, height: size }}
      />
    </span>
  );
}
