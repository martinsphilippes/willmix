import { LOCALES, type Locale } from "@/lib/db/schema";
import { dictionaries, type DictionaryKey } from "./dictionaries";

export type Translate = ((
  key: DictionaryKey,
  params?: Record<string, string | number>,
) => string) & {
  /** Idioma em uso. */
  locale: Locale;
  /** Tag para Intl (datas e números): pt-BR, en-US, zh-CN. */
  intl: string;
};

export const INTL_TAG: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en-US",
  zh: "zh-CN",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function translator(locale: Locale): Translate {
  const dict = dictionaries[locale] ?? dictionaries.pt;
  const t = (key: DictionaryKey, params?: Record<string, string | number>) => {
    let text = dict[key] ?? dictionaries.pt[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
  return Object.assign(t, { locale, intl: INTL_TAG[locale] ?? "pt-BR" });
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
