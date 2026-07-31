import { themeBootScript } from "./theme";

/* Sets data-theme on <html> before the first paint. Rendered inside <head> so
   it runs ahead of the body, otherwise a dark-theme visitor gets one white
   frame on every navigation that reloads the document. */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />;
}
