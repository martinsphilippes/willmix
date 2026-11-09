import type { Translate } from "@/i18n";
import { aiErrorText } from "@/i18n/ai-error";
import { LOCALES, type Locale, type MessageTranslation } from "@/lib/db/schema";

/*
 * Tradução automática das mensagens: o que cada pessoa vê. Quem lê vê a
 * mensagem do outro lado no próprio idioma (com "Ver original"); quem
 * escreveu vê o que escreveu e "Traduzido automaticamente para …" (com "Ver
 * tradução"). Sem tradução ainda: "Traduzindo…" logo depois do envio e, depois
 * disso, o botão "Traduzir". Funções puras (o serviço traduz e grava; a tela
 * só mostra).
 */

/** Idioma em que a Wellmix lê (o dono pediu tudo em português do lado dela). */
export const WELLMIX_LOCALE: Locale = "pt";

/** Mensagem nova sem tradução ainda: está sendo traduzida (logo depois do envio). */
export const TRANSLATION_PENDING_MS = 2 * 60_000;

/** Há palavras para traduzir? Só números, sinais, emojis ou links: não. */
export function hasWords(text: string): boolean {
  const withoutLinks = text.replace(/\bhttps?:\/\/\S+/gi, " ");
  return /\p{L}/u.test(withoutLinks);
}

/** Código do idioma sem a região ("zh-CN" → "zh", "PT_br" → "pt"). */
export function baseLang(code: string): string {
  return code.trim().toLowerCase().split(/[-_]/)[0] ?? "";
}

export const isLocale = (code: string): code is Locale =>
  (LOCALES as readonly string[]).includes(code);

/** Situação da tradução de uma mensagem para quem a vê. */
export type MessageTranslationState =
  /** Mensagem do outro lado, mostrada no idioma de quem lê. */
  | { state: "translated"; text: string; lang: string; by: "api" | "mock" }
  /** Mensagem de quem lê: em que idiomas o outro lado a recebe. */
  | {
      state: "sent";
      lang: string;
      texts: { lang: Locale; text: string }[];
      by: "api" | "mock";
    }
  | { state: "pending" }
  | { state: "failed"; error: string }
  /** Sem tradução (mensagem antiga ou que não traduziu): botão "Traduzir". */
  | { state: "available" };

export interface TranslationInput {
  body: string;
  translation: MessageTranslation | null | undefined;
  createdAt: string;
  /** Quem vê é quem escreveu. */
  mine: boolean;
  /** Idioma do portal de quem escreveu (pista para mensagens sem tradução). */
  authorLocale: Locale | null;
  /** Só o anexo (o texto é o nome do arquivo). */
  attachmentOnly: boolean;
}

export interface TranslationViewer {
  locale: Locale;
  /** A IA está ligada (modo api ou mock)? Desligada: só o original, sem botões. */
  aiOn: boolean;
  now: number;
  /** Idiomas de quem está do outro lado da conversa. */
  counterpartLocales: Locale[];
}

/**
 * O que mostrar da tradução de uma mensagem para quem a vê. null = nada (mesmo
 * idioma, só números ou anexo, IA desligada sem tradução gravada).
 */
export function translationState(
  m: TranslationInput,
  viewer: TranslationViewer,
): MessageTranslationState | null {
  if (m.attachmentOnly || !hasWords(m.body)) return null;
  const tr = m.translation;
  if (tr?.status === "done") {
    const all = LOCALES.filter((l) => l !== tr.lang && tr.texts[l]).map(
      (l) => ({ lang: l, text: tr.texts[l]! }),
    );
    if (m.mine) {
      // O que o outro lado lê (todos os idiomas, se não se sabe quem lê).
      const theirs = all.filter((x) =>
        viewer.counterpartLocales.includes(x.lang),
      );
      const texts = viewer.counterpartLocales.length ? theirs : all;
      return texts.length
        ? { state: "sent", lang: tr.lang, texts, by: tr.by }
        : null;
    }
    if (tr.lang === viewer.locale) return null;
    const text = tr.texts[viewer.locale];
    // Tradução sem o idioma de quem lê (resposta incompleta): fica o original.
    return text
      ? { state: "translated", text, lang: tr.lang, by: tr.by }
      : null;
  }
  if (!viewer.aiOn) return null;
  // Sem tradução gravada, só aparece algo quando é provável que o outro
  // lado leia em outro idioma (pelo idioma do portal de quem escreveu): numa
  // conversa toda em português não há "Traduzindo…" nem botão.
  const written = m.authorLocale ?? (m.mine ? viewer.locale : null);
  const otherLanguage = m.mine
    ? viewer.counterpartLocales.some((l) => l !== written)
    : written !== viewer.locale;
  if (!otherLanguage) return null;
  if (tr?.status === "failed") return { state: "failed", error: tr.error };
  const age = viewer.now - Date.parse(m.createdAt);
  if (age >= 0 && age < TRANSLATION_PENDING_MS) return { state: "pending" };
  // Mensagem antiga (ou que não chegou a traduzir): botão "Traduzir".
  return { state: "available" };
}

/** Texto pronto para a tela (o painel lateral recebe isto já montado). */
export interface TranslationDisplay {
  state: MessageTranslationState["state"];
  /** Texto principal no lugar do original (a tradução para quem lê). */
  text: string | null;
  /** Linha pequena embaixo da mensagem; vazia = só o botão. */
  note: string;
  /** "Ver original" / "Ver tradução" e o que aparece ao abrir. */
  details: {
    label: string;
    items: { label: string | null; text: string }[];
  } | null;
  /** Botão "Traduzir" / "Tentar de novo"; null = sem botão. */
  retry: string | null;
  tone: "muted" | "warn";
}

/** Nome do idioma no idioma da tela ("zh" → "chinês"); código, se não souber. */
export function langName(t: Pick<Translate, "intl">, code: string): string {
  try {
    const name = new Intl.DisplayNames([t.intl], { type: "language" }).of(code);
    if (name && name.toLowerCase() !== code.toLowerCase()) return name;
  } catch {
    // Código inválido: fica o próprio código.
  }
  return code.toUpperCase();
}

function listOf(t: Pick<Translate, "intl">, names: string[]): string {
  try {
    return new Intl.ListFormat(t.intl, {
      style: "long",
      type: "conjunction",
    }).format(names);
  } catch {
    return names.join(", ");
  }
}

/** Linha "Traduzido automaticamente…" e botões, no idioma de quem lê. */
export function translationDisplay(
  t: Translate,
  state: MessageTranslationState | null,
  original: string,
  opts: { wellmix: boolean; mine: boolean },
): TranslationDisplay | null {
  if (!state) return null;
  switch (state.state) {
    case "translated":
      return {
        state: state.state,
        text: state.text,
        note: t(
          state.by === "mock" ? "messages.tr.fromMock" : "messages.tr.from",
          { lang: langName(t, state.lang) },
        ),
        details: {
          label: t("messages.tr.showOriginal"),
          items: [{ label: null, text: original }],
        },
        retry: null,
        tone: "muted",
      };
    case "sent":
      return {
        state: state.state,
        text: null,
        note: t(state.by === "mock" ? "messages.tr.toMock" : "messages.tr.to", {
          langs: listOf(
            t,
            state.texts.map((x) => langName(t, x.lang)),
          ),
        }),
        details: {
          label: t("messages.tr.showTranslation"),
          items: state.texts.map((x) => ({
            label: state.texts.length > 1 ? langName(t, x.lang) : null,
            text: x.text,
          })),
        },
        retry: null,
        tone: "muted",
      };
    case "pending":
      return {
        state: state.state,
        text: null,
        note: t("messages.tr.pending"),
        details: null,
        retry: null,
        tone: "muted",
      };
    case "failed": {
      // O motivo (ex.: IA sem crédito) só para a Wellmix, que pode resolver.
      const why = opts.wellmix ? aiErrorText(t, state.error) : null;
      const reason = why ? ` (${why})` : "";
      return {
        state: state.state,
        text: null,
        note:
          t(opts.mine ? "messages.tr.failedMine" : "messages.tr.failed") +
          reason,
        details: null,
        retry: t("messages.tr.retry"),
        tone: "warn",
      };
    }
    case "available":
      return {
        state: state.state,
        text: null,
        note: "",
        details: null,
        retry: t("messages.tr.translate"),
        tone: "muted",
      };
  }
}

/** As mensagens com os textos da tradução já montados (tela e painel lateral). */
export function withTranslationText<
  M extends {
    body: string;
    mine: boolean;
    translation: MessageTranslationState | null;
  },
>(
  t: Translate,
  messages: M[],
  wellmix: boolean,
): (M & { tr: TranslationDisplay | null })[] {
  return messages.map((m) => ({
    ...m,
    tr: translationDisplay(t, m.translation, m.body, {
      wellmix,
      mine: m.mine,
    }),
  }));
}
