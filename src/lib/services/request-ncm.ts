import "server-only";

import { after } from "next/server";
import {
  getStore,
  type NcmSuggestion,
  type Product,
  type Request,
  type RequestNcmSource,
  type User,
} from "@/lib/db";
import { assertWellmix } from "@/lib/auth/permissions";
import { formatNcm, normalizeNcm } from "@/lib/fiscal";
import { audit } from "./audit";
import {
  FiscalError,
  hasFiscalTable,
  lookupNcm,
  ncmsWithPrefix,
  type NcmRates,
} from "./fiscal";

/*
 * NCM da solicitação. Ordem:
 *   1. NCM confirmado na própria solicitação (pela Wellmix);
 *   2. NCM validado no cadastro do produto (vale direto, sem pedir de novo);
 *   3. sem nenhum: a IA (e a tabela, pelas palavras-chave) sugere; a Wellmix
 *      confirma. Sugestão nunca entra na conta sozinha (IA ≠ regra de negócio).
 * Com o NCM, II e IPI saem da tabela TEC/TIPI.
 */

export interface RequestNcm {
  ncm: string | null;
  /** confirmed: confirmado na solicitação; product: do cadastro; none: falta confirmar. */
  status: "confirmed" | "product" | "none";
  source: RequestNcmSource | null;
  rates: NcmRates | null;
}

export async function requestNcm(
  request: Pick<Request, "ncm" | "ncmSource" | "productId">,
  product?: Pick<Product, "ncm"> | null,
): Promise<RequestNcm> {
  const own = normalizeNcm(request.ncm);
  if (own)
    return {
      ncm: own,
      status: "confirmed",
      source: request.ncmSource ?? "manual",
      rates: await lookupNcm(own),
    };
  const catalog =
    product === undefined && request.productId
      ? await getStore().get("products", request.productId)
      : product;
  const fromProduct = normalizeNcm(catalog?.ncm);
  if (fromProduct)
    return {
      ncm: fromProduct,
      status: "product",
      source: "product",
      rates: await lookupNcm(fromProduct),
    };
  return { ncm: null, status: "none", source: null, rates: null };
}

export interface SuggestionView extends NcmSuggestion {
  /** Alíquotas na tabela; null = NCM não está na tabela (ou ela não foi carregada). */
  rates: NcmRates | null;
}

/** Fatos do produto para a IA: nome, descrição, especificação e o material da ficha. */
async function factsFor(request: Request) {
  const store = getStore();
  const quotes = await store.list("quotes", {
    filter: { requestId: request.id },
  });
  const sheets = quotes.length
    ? await store.list("purchase_sheets", {
        filter: { orderId: quotes.map((q) => q.id) },
      })
    : [];
  const sheet = sheets.find((s) => s.material) ?? sheets[0] ?? null;
  return {
    name: request.productName,
    description: request.description,
    specification: request.specification,
    material: sheet?.material ?? null,
    category: sheet?.ncm
      ? `HS/NCM informado pelo fornecedor: ${sheet.ncm}`
      : null,
  };
}

/** Código sugerido → NCMs de 8 dígitos (6 dígitos viram os subitens da tabela). */
async function expand(
  code: string,
  base: Omit<NcmSuggestion, "ncm">,
): Promise<NcmSuggestion[]> {
  const full = normalizeNcm(code);
  if (full) return [{ ...base, ncm: full }];
  const digits = code.replace(/\D/g, "");
  if (digits.length < 4) return [];
  const sub = await ncmsWithPrefix(digits, 4);
  return sub.map((r) => ({
    ...base,
    ncm: r.ncm,
    description: r.description ?? base.description,
  }));
}

/**
 * Pede sugestões de NCM (IA no modo API + palavras-chave × tabela) e guarda na
 * solicitação. Devolve o motivo quando a IA não está disponível.
 */
export async function suggestRequestNcm(
  user: User | null,
  requestId: string,
): Promise<{ count: number; aiError: string | null }> {
  if (user) assertWellmix(user);
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new Error("not_found");
  const facts = await factsFor(request);
  const out: NcmSuggestion[] = [];
  let aiError: string | null = null;

  const [{ getSettings }, { getAiAdapter, aiErrorCode }, { buildPrompt }] =
    await Promise.all([
      import("@/lib/settings"),
      import("@/lib/integrations/ai"),
      import("@/lib/ai/prompts"),
    ]);
  const adapter = getAiAdapter(await getSettings());
  if (adapter.mode === "api") {
    try {
      const result = await adapter.complete(
        buildPrompt("ncm", {
          product: facts,
          context:
            "Prefira o NCM completo de 8 dígitos (0000.00.00) da TEC vigente; use 6 dígitos só se não for possível decidir o item.",
        }),
      );
      const list = Array.isArray(result?.json?.candidates)
        ? (result.json.candidates as Array<Record<string, unknown>>)
        : [];
      for (const c of list.slice(0, 3)) {
        if (typeof c.ncm !== "string") continue;
        out.push(
          ...(await expand(c.ncm, {
            description:
              typeof c.description === "string"
                ? c.description.slice(0, 300)
                : null,
            reason:
              typeof c.reason === "string" ? c.reason.slice(0, 500) : null,
            source: "ai",
            model: adapter.model,
          })),
        );
      }
    } catch (error) {
      aiError = `ai_${aiErrorCode(error)}`;
    }
  } else aiError = "ai_not_configured";

  // Palavras-chave (sem IA): posição provável × subitens da tabela.
  const { suggestNcm } = await import("./taxes");
  for (const hint of suggestNcm({
    name: facts.name,
    material: facts.material,
    category: null,
    specification: [facts.description, facts.specification]
      .filter(Boolean)
      .join(" "),
  }).slice(0, 2))
    out.push(
      ...(await expand(hint.ncm, {
        description: hint.description,
        reason: `Palavras: ${[...new Set(hint.matched)].join(", ")}`,
        source: "table",
        model: null,
      })),
    );

  const unique = out.filter(
    (s, i) => out.findIndex((o) => o.ncm === s.ncm) === i,
  );
  await store.update("requests", requestId, {
    ncmSuggestions: unique.slice(0, 8),
  });
  return { count: unique.length, aiError };
}

/** Sugestões guardadas, com as alíquotas da tabela de cada uma. */
export async function suggestionsView(
  request: Pick<Request, "ncmSuggestions">,
): Promise<SuggestionView[]> {
  const list = request.ncmSuggestions ?? [];
  return Promise.all(
    list.map(async (s) => ({ ...s, rates: await lookupNcm(s.ncm) })),
  );
}

/**
 * Wellmix confirma o NCM da solicitação. Com tabela carregada, o NCM tem de
 * existir nela. Produto do catálogo sem NCM ganha a classificação validada.
 */
export async function confirmRequestNcm(
  user: User,
  requestId: string,
  raw: string,
  source: RequestNcmSource,
) {
  assertWellmix(user);
  const ncm = normalizeNcm(raw);
  if (!ncm) throw new FiscalError("ncm_invalid");
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new Error("not_found");
  if (request.status === "CANCELLED") throw new Error("request_closed");
  const rates = await lookupNcm(ncm);
  if (!rates && (await hasFiscalTable()))
    throw new FiscalError("ncm_not_in_table");
  await store.update("requests", requestId, {
    ncm,
    ncmSource: source,
    ncmConfirmedByUserId: user.id,
    ncmConfirmedAt: new Date().toISOString(),
  });
  await audit(
    user,
    "request.ncm",
    "request",
    requestId,
    `NCM ${formatNcm(ncm)} confirmado (${source})`,
    { ncm: request.ncm ?? null },
    { ncm, source, ii: rates?.ii ?? null, ipi: rates?.ipi ?? null },
  );
  // Leva o NCM ao cadastro do produto, se ele ainda não tiver.
  if (request.productId) {
    const product = await store.get("products", request.productId);
    if (product && !normalizeNcm(product.ncm)) {
      const { addTaxCandidate, validateTaxClassification } =
        await import("./taxes");
      const row = await addTaxCandidate(user, product.id, {
        ncm: formatNcm(ncm),
        description: rates?.description ?? null,
        taxes:
          rates && (rates.ii !== null || rates.ipi !== null)
            ? Object.fromEntries(
                [
                  ["II", rates.ii],
                  ["IPI", rates.ipi],
                ].filter(([, v]) => v !== null),
              )
            : null,
        source: source === "ai" ? "ai" : "manual",
        sourceRef: `Solicitação ${request.productName}`,
      });
      await validateTaxClassification(user, row.id);
    }
  }
  return { ncm, rates };
}

/**
 * Sugestão automática (uma vez por solicitação, depois que a página responde).
 * Só para a Wellmix e enquanto não há NCM; o botão refaz quando quiser.
 */
export function scheduleNcmSuggestion(requestId: string) {
  after(async () => {
    try {
      await suggestRequestNcm(null, requestId);
    } catch {
      // Sem sugestão automática; o botão "Sugerir com IA" continua disponível.
    }
  });
}
