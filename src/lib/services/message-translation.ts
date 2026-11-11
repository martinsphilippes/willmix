import "server-only";

import { z } from "zod";
import {
  getStore,
  LOCALES,
  MESSAGE_MAX_LENGTH,
  type Locale,
  type Message,
  type MessageTranslation,
} from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { aiErrorCode, getAiAdapter } from "@/lib/integrations/ai";
import { translationPrompt } from "@/lib/ai/prompts";
import { baseLang, hasWords } from "@/lib/message-translation";
import { isSchemaMissing } from "@/lib/db/errors";

/*
 * Tradução automática das mensagens do chat (o fornecedor escreve em chinês,
 * a Wellmix lê em português, e o contrário). Depois do envio, a IA descobre o
 * idioma e traduz para os outros idiomas do portal (pt, en, zh); o resultado
 * fica gravado na própria mensagem (coluna `translation`) e serve a todos que
 * a leem. Quem lê sempre pode ver o original.
 *
 * IA desligada (modo manual): nada é traduzido e todos veem o original. Modo
 * mock: tradução de exemplo, rotulada como tal na tela. Falha da IA: grava o
 * motivo, quem lê vê o original e pode tentar de novo. Coluna ainda não
 * publicada no banco: não grava e não derruba o envio.
 */

/** Limite da resposta: a mensagem mais longa (4.000 caracteres) em até três idiomas. */
const MAX_TOKENS = 8000;

/** Tamanho máximo de cada tradução gravada. */
const MAX_TEXT = MESSAGE_MAX_LENGTH * 2;

const responseSchema = z.object({
  lang: z.string().trim().min(2).max(16),
  translations: z.record(z.string(), z.unknown()).default({}),
});

/** Mensagens sendo traduzidas neste servidor (a tela que se atualiza não pede de novo). */
const inFlight = new Set<string>();

/**
 * Coluna `translation` ainda não publicada: até esta hora a IA não é chamada
 * (cada tela aberta pediria de novo uma tradução que não dá para gravar).
 */
let schemaMissingUntil = 0;
const SCHEMA_RETRY_MS = 10 * 60_000;

/** Só o anexo: o texto é o nome do arquivo (não se traduz). */
export const isAttachmentOnly = (
  m: Pick<Message, "body" | "attachmentDocumentId">,
) => !!m.attachmentDocumentId && m.body.startsWith("📎 ");

/** A resposta da IA vira tradução gravável; null = resposta que não serve. */
export function parseTranslation(
  json: Record<string, unknown> | null,
  by: "api" | "mock",
  at: string,
): MessageTranslation | null {
  const parsed = responseSchema.safeParse(json ?? {});
  if (!parsed.success) return null;
  const lang = baseLang(parsed.data.lang);
  if (!/^[a-z]{2,3}$/.test(lang)) return null;
  const texts: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALES) {
    if (locale === lang) continue;
    const value = parsed.data.translations[locale];
    if (typeof value === "string" && value.trim())
      texts[locale] = value.trim().slice(0, MAX_TEXT);
  }
  // Sem nenhuma tradução para os idiomas do portal: não serve.
  if (!Object.keys(texts).length) return null;
  return { status: "done", lang, texts, by, at };
}

/**
 * Traduz a mensagem (se ainda não tiver tradução) e grava o resultado. Devolve
 * a tradução gravada, ou null quando não há o que fazer (sem palavras, só
 * anexo, IA desligada, coluna ainda não publicada).
 */
export async function translateMessage(
  messageId: string,
): Promise<MessageTranslation | null> {
  if (inFlight.has(messageId) || Date.now() < schemaMissingUntil) return null;
  inFlight.add(messageId);
  try {
    return await translateNow(messageId);
  } finally {
    inFlight.delete(messageId);
  }
}

async function translateNow(
  messageId: string,
): Promise<MessageTranslation | null> {
  const store = getStore();
  const message = await store.get("messages", messageId);
  if (!message) return null;
  if (message.translation?.status === "done") return message.translation;
  if (isAttachmentOnly(message) || !hasWords(message.body)) return null;
  const adapter = getAiAdapter(await getSettings());
  if (adapter.mode === "manual") return null;
  const at = new Date().toISOString();
  let translation: MessageTranslation;
  try {
    const result = await adapter.complete(
      translationPrompt(message.body),
      null,
      { maxTokens: MAX_TOKENS },
    );
    translation = parseTranslation(
      result?.json ?? null,
      adapter.mode === "mock" ? "mock" : "api",
      at,
    ) ?? { status: "failed", error: "unknown", at };
  } catch (error) {
    translation = { status: "failed", error: aiErrorCode(error), at };
  }
  try {
    await store.update("messages", message.id, { translation });
  } catch (error) {
    // Coluna `translation` ainda não publicada: fica sem tradução (e a IA
    // descansa um pouco antes de tentar de novo).
    if (isSchemaMissing(error)) {
      schemaMissingUntil = Date.now() + SCHEMA_RETRY_MS;
      return null;
    }
    throw error;
  }
  return translation;
}

/** A IA está ligada (api ou mock)? Desligada: as telas não oferecem tradução. */
export async function translationOn(): Promise<boolean> {
  return getAiAdapter(await getSettings()).mode !== "manual";
}
