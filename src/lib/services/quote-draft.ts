import "server-only";

import { getStore, type User } from "@/lib/db";

/*
 * Rascunho da resposta da cotação de compra, guardado sozinho (dono,
 * 20/11/2026; docs/PURCHASE_DEMAND.md, "Rascunho automático da cotação"): o
 * fornecedor enviou a foto na balança e a página recarregou (entrou no ar uma
 * versão nova do portal), e tudo o que estava digitado sumiu. Agora o que ele
 * digita (preço, moeda, ficha técnica e condições) vai para o servidor a cada
 * pausa, por login, na tabela `form_drafts` (a mesma do Novo parceiro), e
 * volta quando a página abre de novo. Some quando ele envia ou recusa.
 *
 * O rascunho guarda os campos pelo nome do formulário (`price.<produto>`,
 * `sheet.<produto>.<campo>`, `currency`...), só texto. Só os campos e os
 * produtos desta cotação entram; o resto é ignorado.
 */

/** Campos da ficha técnica de cada produto (os nomes do formulário). */
export const QUOTE_DRAFT_SHEET_FIELDS = [
  "masterBoxQty",
  "innerBoxQty",
  "noInner",
  "boxLengthCm",
  "boxWidthCm",
  "boxHeightCm",
  "cbm",
  "netWeightKg",
  "grossWeightBoxKg",
  "material",
  "factoryItemCode",
  "noFactoryCode",
  "confirm",
  // Tela de 21/11/2026: "Sem peso" e os materiais do catálogo (ids
  // separados por vírgula). Os nomes antigos (inner e o material digitado)
  // continuam aceitos: um rascunho antigo mostra o material digitado para
  // ele escolher no catálogo.
  "grossUnknown",
  "materialIds",
] as const;

/** Condições comerciais (uma vez por resposta) e o tamanho de cada uma. */
const TERM_LIMITS: Record<string, number> = {
  currency: 3,
  incoterm: 3,
  leadTimeDays: 12,
  port: 120,
  moq: 20,
  note: 2000,
};

/** Tamanho dos campos de cada produto (os números, bem menos). */
const SHEET_LIMITS: Record<string, number> = {
  material: 200,
  factoryItemCode: 80,
  // Até 20 materiais do catálogo.
  materialIds: 1400,
};
const NUMBER_LIMIT = 24;

export class QuoteDraftError extends Error {}

/** A chave do rascunho na tabela (até 60 caracteres). */
const draftKey = (quoteId: string) => `quote:${quoteId}`;

/**
 * Só os campos desta cotação, como texto e no tamanho de cada um. Campo vazio
 * também entra: é o que estava na tela (apagado de propósito fica apagado).
 */
export function cleanQuoteDraft(
  values: Record<string, unknown>,
  productIds: readonly string[],
): Record<string, string> {
  const products = new Set(productIds);
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(values)) {
    if (typeof raw !== "string") continue;
    let limit: number | null = null;
    if (key in TERM_LIMITS) limit = TERM_LIMITS[key];
    else if (key.startsWith("price.")) {
      if (products.has(key.slice("price.".length))) limit = NUMBER_LIMIT;
    } else if (key.startsWith("sheet.")) {
      const rest = key.slice("sheet.".length);
      const dot = rest.lastIndexOf(".");
      const pid = rest.slice(0, dot);
      const field = rest.slice(dot + 1);
      if (
        dot > 0 &&
        products.has(pid) &&
        (QUOTE_DRAFT_SHEET_FIELDS as readonly string[]).includes(field)
      )
        limit = SHEET_LIMITS[field] ?? NUMBER_LIMIT;
    }
    if (limit !== null) out[key] = raw.slice(0, limit);
  }
  return out;
}

/** A cotação e a resposta do fornecedor que está no login (nulo se não é dele). */
async function ownQuote(user: User, quoteId: string) {
  if (user.role !== "supplier" || !user.partyId) return null;
  const store = getStore();
  const [response] = await store.list("purchase_quote_responses", {
    filter: { quoteId, supplierId: user.partyId },
    limit: 1,
  });
  if (!response) return null;
  const quote = await store.get("purchase_quotes", quoteId);
  return quote ? { quote, response } : null;
}

async function find(user: User, quoteId: string) {
  const [row] = await getStore().list("form_drafts", {
    filter: { userId: user.id, form: draftKey(quoteId) },
    limit: 1,
  });
  return row ?? null;
}

/** O rascunho do login nesta cotação (nulo sem rascunho ou se não é dele). */
export async function loadQuoteDraft(
  user: User,
  quoteId: string,
): Promise<{ values: Record<string, string>; savedAt: string } | null> {
  const own = await ownQuote(user, quoteId);
  if (!own) return null;
  const row = await find(user, quoteId);
  if (!row) return null;
  const values = cleanQuoteDraft(
    row.payload ?? {},
    own.quote.items.map((i) => i.productId),
  );
  return Object.keys(values).length ? { values, savedAt: row.updatedAt } : null;
}

/**
 * Guarda o que está na tela (sem nenhum campo desta cotação, apaga). Só o
 * fornecedor convidado, com a cotação aberta e no prazo; devolve a hora
 * gravada.
 */
export async function saveQuoteDraft(
  user: User,
  quoteId: string,
  values: Record<string, unknown>,
  now = new Date(),
): Promise<string | null> {
  const own = await ownQuote(user, quoteId);
  if (!own) throw new QuoteDraftError("not_found");
  if (own.quote.status !== "open") throw new QuoteDraftError("quote_closed");
  if (Date.parse(own.response.dueAt) <= now.getTime())
    throw new QuoteDraftError("quote_expired");
  const key = draftKey(quoteId);
  if (key.length > 60) throw new QuoteDraftError("invalid_input");
  const payload = cleanQuoteDraft(
    values,
    own.quote.items.map((i) => i.productId),
  );
  const store = getStore();
  const row = await find(user, quoteId);
  if (!Object.keys(payload).length) {
    if (row) await store.remove("form_drafts", row.id);
    return null;
  }
  const saved = row
    ? await store.update("form_drafts", row.id, { payload })
    : await store.create("form_drafts", {
        userId: user.id,
        form: key,
        payload,
      });
  return saved.updatedAt;
}

/** Apaga o rascunho do login nesta cotação (ao enviar ou recusar). */
export async function clearQuoteDraft(
  user: User,
  quoteId: string,
): Promise<void> {
  const row = await find(user, quoteId);
  if (row) await getStore().remove("form_drafts", row.id);
}
