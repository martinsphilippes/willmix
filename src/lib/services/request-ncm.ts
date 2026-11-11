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
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
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
 *   1. NCM confirmado na própria solicitação (pelo despachante ou pela Wellmix);
 *   2. NCM validado no cadastro do produto (vale direto, sem pedir de novo);
 *   3. sem nenhum: a IA (e a tabela, pelas palavras-chave) sugere; o
 *      despachante classifica (pendência dele) e a Wellmix também pode
 *      confirmar. Sugestão nunca entra na conta sozinha (IA ≠ regra de negócio).
 * Com o NCM, II e IPI saem da tabela TEC/TIPI.
 *
 * O despachante trabalha numa tela só do NCM (`ncmWorkFor`): vê o produto
 * (nome, descrição, especificação, material), nunca cliente, fornecedor,
 * quantidade nem preço.
 */

/** Quem classifica o NCM: o despachante (com empresa); a Wellmix também pode. */
export const canClassifyNcm = (user: Pick<User, "role" | "partyId">) =>
  isWellmix(user as User) || (user.role === "broker" && !!user.partyId);

export function assertNcmClassifier(user: Pick<User, "role" | "partyId">) {
  if (!canClassifyNcm(user)) throw new ForbiddenError();
}

/** Situações em que a solicitação ainda espera o NCM (antes do pedido). */
const NCM_OPEN_STATUSES = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
] as const;

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
  const sheets = request.orderId
    ? await store.list("purchase_sheets", {
        filter: { orderId: request.orderId },
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
    supplierHs: sheet?.ncm ?? null,
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
  if (user) assertNcmClassifier(user);
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new Error("not_found");
  if (user && !isWellmix(user) && !ncmOpenFor(request))
    throw new Error("ncm_closed");
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
          product: {
            name: facts.name,
            description: facts.description,
            specification: facts.specification,
            material: facts.material,
            category: facts.category,
          },
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
 * O despachante (ou a Wellmix) confirma o NCM da solicitação. Com tabela
 * carregada, o NCM tem de existir nela. Produto do catálogo sem NCM ganha a
 * classificação validada. O despachante só mexe antes do pedido; depois, os
 * dados aduaneiros são os da ficha do pedido.
 */
export async function confirmRequestNcm(
  user: User,
  requestId: string,
  raw: string,
  source: RequestNcmSource,
) {
  assertNcmClassifier(user);
  const ncm = normalizeNcm(raw);
  if (!ncm) throw new FiscalError("ncm_invalid");
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request) throw new Error("not_found");
  if (request.status === "CANCELLED") throw new Error("request_closed");
  if (!isWellmix(user) && !ncmOpenFor(request)) throw new Error("ncm_closed");
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
  // Classificado pelo despachante: o analista fica sabendo (o valor ao cliente mudou).
  if (!isWellmix(user)) {
    const { notify } = await import("./notifications");
    const { WELLMIX_ROLES } = await import("@/lib/auth/permissions");
    await notify(
      request.ownerUserId
        ? { userIds: [request.ownerUserId] }
        : { role: WELLMIX_ROLES },
      {
        kind: "done",
        subject: `NCM classificado pelo despachante: ${request.productName}`,
        body: `NCM ${formatNcm(ncm)}${request.number ? ` · solicitação nº ${request.number}` : ""}. II e IPI já entram no valor ao cliente.`,
        link: `/app/requests/${request.id}#ncm`,
      },
    ).catch(() => undefined);
  }
  return { ncm, rates };
}

/** A solicitação ainda aceita o NCM do despachante (aberta e sem pedido). */
function ncmOpenFor(request: Pick<Request, "status" | "orderId">) {
  return (
    !request.orderId &&
    (NCM_OPEN_STATUSES as readonly string[]).includes(request.status)
  );
}

/**
 * Solicitações abertas sem NCM (nem na solicitação, nem no cadastro do
 * produto): a fila do despachante.
 */
export async function ncmPendingRequests(): Promise<Request[]> {
  const store = getStore();
  const open = (
    await store.list("requests", {
      filter: { status: [...NCM_OPEN_STATUSES] },
    })
  ).filter((r) => !r.orderId && !normalizeNcm(r.ncm));
  const productIds = [
    ...new Set(open.map((r) => r.productId).filter((id): id is string => !!id)),
  ];
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  const withNcm = new Set(
    products.filter((p) => normalizeNcm(p.ncm)).map((p) => p.id),
  );
  return open.filter((r) => !r.productId || !withNcm.has(r.productId));
}

/** Despachantes que recebem a pendência do NCM: login ativo e com empresa. */
async function ncmBrokers(): Promise<User[]> {
  const brokers = await getStore().list("users", {
    filter: { role: "broker", active: true },
  });
  return brokers.filter((u) => !!u.partyId);
}

/** Há despachante com login ativo para receber a pendência do NCM? */
export async function hasNcmBroker(): Promise<boolean> {
  return (await ncmBrokers()).length > 0;
}

/**
 * Aviso aos despachantes: há produto novo para classificar. Um aviso por
 * envio (um lote de 30 produtos não vira 30 avisos). Nunca impede a
 * solicitação de nascer.
 */
export async function notifyNcmPending(created: Request[]) {
  try {
    const brokers = await ncmBrokers();
    if (!brokers.length) return;
    const ids = new Set(created.map((r) => r.id));
    const pending = (await ncmPendingRequests()).filter((r) => ids.has(r.id));
    if (!pending.length) return;
    const { notify } = await import("./notifications");
    const [first] = pending;
    await notify(
      { userIds: brokers.map((u) => u.id) },
      {
        kind: "action",
        link:
          pending.length === 1 ? `/app/requests/${first.id}/ncm` : "/app/tasks",
        text: (t) =>
          pending.length === 1
            ? {
                subject: t("ncm.notify.one.subject", {
                  product: first.productName,
                }),
                body: t("ncm.notify.one.body"),
              }
            : {
                subject: t("ncm.notify.many.subject", {
                  count: pending.length,
                }),
                body: t("ncm.notify.many.body"),
              },
      },
    );
  } catch (error) {
    console.error("[ncm] aviso ao despachante falhou", error);
  }
}

/** O que o despachante vê para classificar: só o produto, nada comercial. */
export interface NcmWork {
  requestId: string;
  number: number | null;
  productName: string;
  description: string | null;
  specification: string | null;
  /** Material da ficha do fornecedor ou do cadastro. */
  material: string | null;
  category: string | null;
  color: string | null;
  /** HS/NCM que o fornecedor informou na ficha (pista, não é a classificação). */
  supplierHs: string | null;
  ncm: RequestNcm;
  suggestions: SuggestionView[];
  /** Ainda não houve sugestão automática. */
  neverSuggested: boolean;
  hasTable: boolean;
  /** Ainda dá para classificar (aberta e sem pedido). */
  editable: boolean;
}

/**
 * Tela do NCM para quem classifica. Nulo quando a solicitação não existe ou
 * foi cancelada. Não devolve cliente, fornecedor, quantidade nem preço.
 */
export async function ncmWorkFor(
  user: User,
  requestId: string,
): Promise<NcmWork | null> {
  assertNcmClassifier(user);
  const store = getStore();
  const request = await store.get("requests", requestId);
  if (!request || request.status === "CANCELLED") return null;
  const [product, facts, hasTable] = await Promise.all([
    request.productId ? store.get("products", request.productId) : null,
    factsFor(request),
    hasFiscalTable(),
  ]);
  const ncm = await requestNcm(request, product);
  return {
    requestId: request.id,
    number: request.number ?? null,
    productName: request.productName,
    description: request.description ?? null,
    specification: request.specification ?? null,
    material: facts.material ?? product?.material ?? null,
    category: product?.category ?? null,
    color: product?.color ?? null,
    supplierHs: facts.supplierHs,
    ncm,
    suggestions: ncm.status === "none" ? await suggestionsView(request) : [],
    neverSuggested: ncm.status === "none" && request.ncmSuggestions == null,
    hasTable,
    editable: ncmOpenFor(request),
  };
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
