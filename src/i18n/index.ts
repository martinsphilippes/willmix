import { LOCALES, type Locale } from "@/lib/db/schema";
import { dictionaries, type DictionaryKey } from "./dictionaries";

export type Translate = (
  key: DictionaryKey,
  params?: Record<string, string | number>,
) => string;

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function translator(locale: Locale): Translate {
  const dict = dictionaries[locale] ?? dictionaries.pt;
  return (key, params) => {
    let text = dict[key] ?? dictionaries.pt[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

/** Rótulo de requisito traduzido quando a chave é conhecida; senão o rótulo salvo. */
export function requirementLabel(
  t: Translate,
  requirement: { key: string; label: string },
) {
  const key = `req.${requirement.key}` as DictionaryKey;
  const translated = t(key);
  return translated === key ? requirement.label : translated;
}

export const LOCALE_NAMES: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  zh: "中文",
};
