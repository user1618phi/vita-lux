import kk from "../messages/kk.json";
import ru from "../messages/ru.json";

/* Единственный способ прочитать локаль.

   Раньше каждый потребитель тянул `messages/*.json` своим относительным путём:
   витрина через `../../messages`, мок-каталог через `../../../messages`,
   seed-скрипт через `../messages`. При переезде файла любой из них молча
   ломался — а в мок-каталоге чтение ещё и обёрнуто в try/catch, так что
   поломка выглядела не как ошибка, а как товары, у которых вместо названия
   стал показываться хендл.

   Импорт статический, а не `import(\`../messages/${locale}.json\`)`, по двум
   причинам. Практическая: webpack не смог построить контекст динамического
   импорта, когда файл переехал в воркспейс-пакет, и сборка падала на
   «Can't resolve '../messages/'». Содержательная: локалей две, и статический
   импорт превращает пропавший файл в ошибку СБОРКИ, а не в пустой словарь на
   проде. Добавляя локаль, добавь сюда строку — компилятор напомнит. */

export type Messages = { [key: string]: string | Messages };

const MESSAGES = {
  ru: ru as unknown as Messages,
  kk: kk as unknown as Messages,
} satisfies Record<string, Messages>;

export type AppLocale = keyof typeof MESSAGES;

export const LOCALES = Object.keys(MESSAGES) as AppLocale[];

export function isAppLocale(value: string): value is AppLocale {
  return value in MESSAGES;
}

/* Асинхронна намеренно: next-intl ждёт промис, и сигнатура переживёт возврат к
   ленивой загрузке, если локалей станет много. */
export async function loadMessages(locale: string): Promise<Messages> {
  return isAppLocale(locale) ? MESSAGES[locale] : MESSAGES.ru;
}

