import "server-only";

import {
  getStore,
  type Document,
  type ProductPhoto,
  type Quote,
  type Request,
  type User,
} from "@/lib/db";
import { ForbiddenError, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings";
import {
  computeSuperplan,
  superplanParams,
  type SuperplanInput,
  type SuperplanResult,
} from "@/lib/superplan";
import { formatAmount } from "@/lib/workflow/money";
import { superplanMissing, type SuperplanItem } from "@/lib/superplan-rfq";
import { audit } from "./audit";
import { storePhotoDocument, type PhotoSource } from "./documents";
import { notify, notifyWellmix } from "./notifications";
import type { PackagingUploadSource } from "./packaging-brief";

/*
 * Do Superplan à faca e à RFQ (docs/SUPERPLAN.md, seção 11). Com a
 * viabilidade feita, o administrador abre, do próprio Superplan, a
 * solicitação (origem "superplan") e a RFQ só com o fornecedor ganho, já com
 * o preço da simulação. O fornecedor envia quatro itens na cotação: faca
 * (die-cut), MOQ, prazo e foto em alta (HD). Enquanto faltar algum, a escolha
 * (proposta ao cliente ou aprovação do pré-custo) é recusada. Fluxo novo, ao
 * lado do que já existe: a solicitação comum não muda em nada.
 */

export class SuperplanRfqError extends Error {}

export interface OpenSuperplanRfqInput {
  productId: string;
  supplierId: string;
  /** Cliente da solicitação; nulo = compra para estoque (sem cliente). */
  customerId: string | null;
  /** Peças pedidas (padrão da tela: as do container da simulação). */
  quantity: number;
  /** A simulação da tela (o mesmo formato do "Gravar no Booking"). */
  input: SuperplanInput;
  businessType: string | null;
  container: string | null;
}

/**
 * A conta refeita no servidor. Os números da simulação (preço, caixa, fretes,
 * câmbio, despesas, tipo de negócio) vêm da tela; os parâmetros do sistema
 * (tributos da importação, AFRMM, fatores de preço, impostos da venda) vêm
 * sempre das Configurações, nunca do navegador.
 */
async function recompute(sent: SuperplanInput): Promise<{
  input: SuperplanInput;
  result: SuperplanResult;
}> {
  const settings = await getSettings();
  const params = superplanParams(settings.superplan);
  const input: SuperplanInput = {
    ...sent,
    insurancePct: settings.insurancePercent ?? 0,
    pisImportPct: settings.pisImportPercent ?? 0,
    cofinsImportPct: settings.cofinsImportPercent ?? 0,
    icmsImportPct: settings.icmsPercent ?? 0,
    freightFxPct: params.freightFxPct,
    afrmmPct: params.afrmmPct,
    afrmmFixedBrl: params.afrmmFixedBrl,
    grossEstimatePct: params.grossEstimatePct,
    priceFactors: params.priceFactors,
    saleTaxes: params.saleTaxes,
  };
  return { input, result: computeSuperplan(input) };
}

const brl = (n: number) => formatAmount(n, "BRL");
const pct = (n: number) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const VERDICT_TEXT = {
  viable: "verde (bate a meta)",
  below: "amarelo (lucro abaixo da meta)",
  loss: "vermelho (prejuízo)",
} as const;

/** Resumo da viabilidade que fica nas observações da solicitação. */
function summaryText(
  input: SuperplanInput,
  meta: { businessType: string | null; container: string | null },
  result: SuperplanResult,
): string {
  const { cost, prices, sale, target, verdict, container } = result;
  const day = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  return [
    `Superplan (${day}): viabilidade ${verdict ? VERDICT_TEXT[verdict] : "—"}.`,
    meta.businessType ? `Tipo de negócio: ${meta.businessType}.` : null,
    `Preço do fornecedor: ${input.unitPrice?.toLocaleString("pt-BR")} ${input.currency} por peça.`,
    container
      ? `${container.cartons.toLocaleString("pt-BR")} caixas, ${container.pieces.toLocaleString("pt-BR")} peças${meta.container ? ` no ${meta.container}` : ""}.`
      : null,
    cost ? `Custo por peça: ${brl(cost.perPiece)}.` : null,
    prices ? `Preço mínimo: ${brl(prices.minimum)}.` : null,
    sale && target
      ? `Lucro: ${pct(sale.profitPct)} (meta ${pct(target.pct)})${target.price !== null ? `; preço para a meta ${brl(Math.ceil(target.price * 100 - 1e-6) / 100)}` : ""}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/** A cotação do fornecedor ganho (a única da RFQ do Superplan). */
export async function superplanQuoteOf(
  requestId: string,
): Promise<Quote | null> {
  const quotes = await getStore().list("quotes", {
    filter: { requestId },
    orderBy: "createdAt",
  });
  return quotes.find((q) => q.status !== "rejected") ?? null;
}

/** Fornecedores para escolher no Superplan: os do produto primeiro (o principal no topo). */
export async function superplanSupplierOptions(productId: string | null) {
  const store = getStore();
  const suppliers = await store.list("parties", {
    filter: { type: "supplier", active: true },
    orderBy: "name",
  });
  if (!productId)
    return suppliers.map((s) => ({ id: s.id, name: s.name, linked: false }));
  const [product, links] = await Promise.all([
    store.get("products", productId),
    import("./product-suppliers").then((m) =>
      m.listProductSuppliers(productId),
    ),
  ]);
  const linked = new Set(links.map((l) => l.supplierId));
  if (product?.supplierId) linked.add(product.supplierId);
  const rank = (id: string) =>
    id === product?.supplierId ? 0 : linked.has(id) ? 1 : 2;
  return suppliers
    .map((s) => ({ id: s.id, name: s.name, linked: linked.has(s.id) }))
    .sort((a, b) => rank(a.id) - rank(b.id));
}

/** MOQ e prazo conhecidos do fornecedor no produto (para ele só confirmar). */
async function knownTerms(productId: string, supplierId: string) {
  const store = getStore();
  const [product, links] = await Promise.all([
    store.get("products", productId),
    import("./product-suppliers").then((m) =>
      m.listProductSuppliers(productId),
    ),
  ]);
  const link = links.find((l) => l.supplierId === supplierId);
  return {
    moq: link?.moq ?? product?.moq ?? null,
    leadTimeDays: link?.leadTimeDays ?? null,
  };
}

/**
 * Viabilidade feita: abre a solicitação, a RFQ só com o fornecedor ganho (com
 * o preço da simulação) e a faca no briefing da embalagem. Só o administrador
 * (a tela do Superplan é dele). A conta é refeita aqui: o que fica gravado é o
 * que o sistema calcula com os números da tela, não o que o navegador mandou.
 */
export async function openSuperplanRfq(
  user: User,
  input: OpenSuperplanRfqInput,
): Promise<{ request: Request; quote: Quote }> {
  if (!isAdmin(user)) throw new ForbiddenError();
  const store = getStore();
  const product = await store.get("products", input.productId);
  if (!product) throw new SuperplanRfqError("product_not_found");
  const { input: calcInput, result } = await recompute(input.input);
  // Conta incompleta ou com prejuízo: não há viabilidade para abrir.
  if (result.missing.length || !result.verdict)
    throw new SuperplanRfqError("simulation_incomplete");
  if (result.verdict === "loss") throw new SuperplanRfqError("not_viable");
  if (!Number.isInteger(input.quantity) || input.quantity < 1)
    throw new SuperplanRfqError("invalid_quantity");

  const { ensureStockParty, STOCK_PARTY_ID } = await import("./purchase-flow");
  let customerId = input.customerId;
  if (!customerId) {
    await ensureStockParty(user);
    customerId = STOCK_PARTY_ID;
  } else {
    const customer = await store.get("parties", customerId);
    if (!customer || customer.type !== "customer" || !customer.active)
      throw new SuperplanRfqError("invalid_customer");
  }

  const { createRequest, openRfq } = await import("./requests");
  const summary = summaryText(calcInput, input, result);
  const request = await createRequest(user, {
    customerId,
    productId: product.id,
    productName: product.name,
    description: "Aberta do Superplan com a viabilidade feita.",
    specification: null,
    quantity: input.quantity,
    unit: "un",
    deadline: null,
    notes: summary,
    origin: "superplan",
  });
  // RFQ só com o fornecedor ganho; o aviso dele é o do Superplan (abaixo).
  const [created] = await openRfq(user, request.id, [input.supplierId], {
    notify: false,
    packaging: { enabled: true, notify: true },
  });
  const quote = created ?? (await superplanQuoteOf(request.id));
  if (!quote) throw new SuperplanRfqError("quote_not_created");
  // A faca precisa de briefing com a faca obrigatória, seja qual for o
  // momento configurado para abrir a embalagem.
  await ensureDielineBrief(user, request);

  // Preço da simulação (o que ganhou o contrato). MOQ e prazo ficam vazios
  // até o fornecedor confirmar: a tela sugere o que já se sabe.
  const filled = await store.update("quotes", quote.id, {
    price: calcInput.unitPrice,
    currency: calcInput.currency === "RMB" ? "CNY" : "USD",
  });
  await audit(
    user,
    "superplan.rfq_open",
    "request",
    request.id,
    `Superplan: RFQ com o fornecedor ganho (${input.supplierId}), ${input.quantity} peças`,
    null,
    {
      quoteId: quote.id,
      supplierId: input.supplierId,
      quantity: input.quantity,
      businessType: input.businessType,
      container: input.container,
      input: calcInput,
      result: {
        verdict: result.verdict,
        container: result.container,
        costPerPiece: result.cost?.perPiece ?? null,
        containerCostBrl: result.cost?.totalBrl ?? null,
        prices: result.prices,
        profitPct: result.sale?.profitPct ?? null,
        target: result.target,
      },
    },
  );
  await notify(
    { role: "supplier", partyId: input.supplierId },
    {
      kind: "action",
      actor: "recipient",
      link: `/app/quotes/${quote.id}#superplan`,
      text: (t) => ({
        subject: t("notif.superplanRfq.subject", {
          product: request.productName,
          ref: request.number ? t("notif.ref", { number: request.number }) : "",
        }),
        body: t("notif.superplanRfq.body", {
          qty: request.quantity.toLocaleString(t.intl),
        }),
      }),
    },
  );
  return { request, quote: filled };
}

/** Briefing da embalagem com a faca obrigatória (abre se ainda não há). */
async function ensureDielineBrief(user: User, request: Request) {
  const pb = await import("./packaging-brief");
  const brief = await pb.openPackagingBriefSafe(user, request);
  if (brief && !brief.requiredKeys.includes("dieline"))
    await getStore().update("packaging_briefs", brief.id, {
      requiredKeys: [...brief.requiredKeys, "dieline"],
    });
}

export interface SuperplanQuoteView {
  quoteId: string;
  requestId: string;
  productName: string;
  briefId: string | null;
  dieline: Document | null;
  hdPhotos: { photo: ProductPhoto; document: Document | null }[];
  /** Confirmados pelo fornecedor (nulos até ele confirmar). */
  moq: number | null;
  leadTimeDays: number | null;
  /** O que já se sabe (cadastro e últimas cotações), para ele só confirmar. */
  suggested: { moq: number | null; leadTimeDays: number | null };
  price: number | null;
  currency: string | null;
  missing: SuperplanItem[];
  /** Ainda pode enviar (cotação não escolhida nem recusada). */
  open: boolean;
  /** Quem vê pode enviar (o fornecedor ganho ou a Wellmix no lugar dele). */
  canSend: boolean;
}

/** HD da cotação (fotos "hd" guardadas na ficha da cotação). */
async function hdPhotosOf(quoteId: string) {
  const store = getStore();
  const photos = await store.list("product_photos", {
    filter: { orderId: quoteId, kind: "hd" },
    orderBy: "createdAt",
  });
  return Promise.all(
    photos.map(async (photo) => ({
      photo,
      document: await store.get("documents", photo.documentId),
    })),
  );
}

/** Os quatro itens da cotação do Superplan; nulo fora desse fluxo ou sem acesso. */
export async function superplanQuoteView(
  user: User,
  quoteId: string,
): Promise<SuperplanQuoteView | null> {
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote) return null;
  const supplierOwn =
    user.role === "supplier" && user.partyId === quote.supplierId;
  if (!isWellmix(user) && !supplierOwn) return null;
  const request = await store.get("requests", quote.requestId);
  if (!request || request.origin !== "superplan") return null;
  const { briefForRequest } = await import("./packaging-brief");
  const brief = await briefForRequest(request.id);
  const dieline = brief?.dielineDocumentId
    ? await store.get("documents", brief.dielineDocumentId)
    : null;
  const hdPhotos = await hdPhotosOf(quote.id);
  const moq = quote.moq ?? null;
  const suggested = request.productId
    ? await knownTerms(request.productId, quote.supplierId)
    : { moq: null, leadTimeDays: null };
  const open =
    (quote.status === "invited" || quote.status === "answered") &&
    request.status !== "CANCELLED";
  return {
    quoteId: quote.id,
    requestId: request.id,
    productName: request.productName,
    briefId: brief && brief.status !== "cancelled" ? brief.id : null,
    dieline,
    hdPhotos,
    moq,
    leadTimeDays: quote.leadTimeDays,
    suggested,
    price: quote.price,
    currency: quote.currency,
    missing: superplanMissing({
      dieline: !!dieline,
      moq,
      leadTimeDays: quote.leadTimeDays,
      hd: hdPhotos.length > 0,
    }),
    open,
    canSend: open && (supplierOwn || isWellmix(user)),
  };
}

/**
 * Bloqueio da escolha: solicitação do Superplan só segue para a proposta (ou
 * a aprovação do pré-custo) com os quatro itens do fornecedor.
 */
export async function assertSuperplanItems(
  request: Pick<Request, "id" | "origin">,
  quote: Pick<Quote, "id" | "moq" | "leadTimeDays">,
) {
  if (request.origin !== "superplan") return;
  const store = getStore();
  const { briefForRequest } = await import("./packaging-brief");
  const brief = await briefForRequest(request.id);
  const hd = await store.list("product_photos", {
    filter: { orderId: quote.id, kind: "hd" },
    limit: 1,
  });
  const missing = superplanMissing({
    dieline: !!brief?.dielineDocumentId,
    moq: quote.moq ?? null,
    leadTimeDays: quote.leadTimeDays,
    hd: hd.length > 0,
  });
  if (missing.length) {
    const { RequestError } = await import("./requests");
    throw new RequestError("superplan_items_missing");
  }
}

export interface SendSuperplanItemsInput {
  moq: number | null;
  leadTimeDays: number | null;
  dieline: PackagingUploadSource | null;
  hdPhotos: PhotoSource[];
}

/**
 * O fornecedor ganho (ou a Wellmix no lugar dele) envia faca, MOQ, prazo e
 * foto em alta. Pode mandar aos poucos: cada envio grava o que veio. Com os
 * quatro, a cotação fica respondida e a Wellmix é avisada (com o que mudou de
 * MOQ e prazo, se mudou).
 */
export async function sendSuperplanItems(
  user: User,
  quoteId: string,
  input: SendSuperplanItemsInput,
): Promise<{ missing: SuperplanItem[] }> {
  const store = getStore();
  const view = await superplanQuoteView(user, quoteId);
  if (!view) throw new ForbiddenError();
  if (!view.canSend) throw new SuperplanRfqError("quote_closed");
  const quote = (await store.get("quotes", quoteId))!;
  const request = (await store.get("requests", quote.requestId))!;

  if (input.moq !== null && !(Number.isInteger(input.moq) && input.moq > 0))
    throw new SuperplanRfqError("invalid_moq");
  if (
    input.leadTimeDays !== null &&
    !(
      Number.isInteger(input.leadTimeDays) &&
      input.leadTimeDays > 0 &&
      input.leadTimeDays <= 720
    )
  )
    throw new SuperplanRfqError("invalid_lead_time");

  // Faca: pelo briefing da embalagem (versões, aviso a quem faz a arte).
  if (input.dieline) {
    if (!view.briefId) throw new SuperplanRfqError("no_brief");
    const { uploadPackagingItem } = await import("./packaging-brief");
    await uploadPackagingItem(user, view.briefId, "dieline", input.dieline);
  }
  // Foto em alta: na ficha da cotação, como as outras fotos dela.
  if (input.hdPhotos.length) {
    const now = new Date().toISOString();
    for (const file of input.hdPhotos.slice(0, 6)) {
      const doc = await storePhotoDocument(user, file, {
        type: "photo",
        visibility: "internal",
      });
      await store.create("product_photos", {
        productId: null,
        sourcingItemId: null,
        orderId: quoteId,
        documentId: doc.id,
        kind: "hd",
        caption: null,
        takenAt: now,
        takenByUserId: user.id,
        derivedFromPhotoId: null,
        isPrimary: false,
      });
    }
  }
  // Antes: o confirmado ou, na primeira vez, o sugerido (para mostrar a mudança).
  const before = {
    moq: quote.moq ?? view.suggested.moq,
    leadTimeDays: quote.leadTimeDays ?? view.suggested.leadTimeDays,
  };
  const current = { moq: quote.moq ?? null, leadTimeDays: quote.leadTimeDays };
  const patch: Partial<Quote> = {};
  if (input.moq !== null && input.moq !== current.moq) patch.moq = input.moq;
  if (
    input.leadTimeDays !== null &&
    input.leadTimeDays !== current.leadTimeDays
  )
    patch.leadTimeDays = input.leadTimeDays;
  const after = await superplanQuoteView(user, quoteId);
  const merged = {
    moq: patch.moq ?? current.moq,
    leadTimeDays: patch.leadTimeDays ?? current.leadTimeDays,
  };
  const missing = superplanMissing({
    dieline: !!after?.dieline,
    moq: merged.moq,
    leadTimeDays: merged.leadTimeDays,
    hd: (after?.hdPhotos.length ?? 0) > 0,
  });
  // Com os quatro itens a cotação fica respondida (a Wellmix pode escolher).
  // Só a confirmação do fornecedor conta: a Wellmix mandando no lugar dele
  // também confirma, como na faca.
  const completed = !missing.length && quote.status === "invited";
  if (completed) {
    patch.status = "answered";
    patch.answeredAt = new Date().toISOString();
  }
  if (Object.keys(patch).length) await store.update("quotes", quoteId, patch);
  if (completed && request.status === "RFQ_OPEN") {
    await store.update("requests", request.id, {
      status: "QUOTATION_RECEIVED",
    });
    const { emitProcessEvent } = await import("./process-engine");
    await emitProcessEvent(user, "request:QUOTATION_RECEIVED", {
      requestId: request.id,
    });
  }
  await audit(
    user,
    "superplan.items",
    "quote",
    quoteId,
    [
      input.dieline ? "faca" : null,
      input.hdPhotos.length ? `foto em alta (${input.hdPhotos.length})` : null,
      patch.moq !== undefined
        ? `MOQ ${before.moq ?? "—"} → ${patch.moq}`
        : null,
      patch.leadTimeDays !== undefined
        ? `prazo ${before.leadTimeDays ?? "—"} → ${patch.leadTimeDays} dias`
        : null,
      missing.length ? `falta: ${missing.join(", ")}` : "completo",
    ]
      .filter(Boolean)
      .join("; "),
    before,
    merged,
  );
  if (completed) {
    const changed =
      (before.moq !== null && before.moq !== merged.moq) ||
      (before.leadTimeDays !== null &&
        before.leadTimeDays !== merged.leadTimeDays);
    await notifyWellmix({
      kind: changed ? "alert" : "action",
      link: `/app/requests/${request.id}`,
      text: (t) => ({
        subject: t("notif.superplanItems.subject", {
          product: request.productName,
        }),
        body: [
          t("notif.superplanItems.body", {
            moq: (merged.moq ?? 0).toLocaleString(t.intl),
            days: merged.leadTimeDays ?? 0,
          }),
          changed
            ? t("notif.superplanItems.changed", {
                moq: (before.moq ?? 0).toLocaleString(t.intl),
                days: before.leadTimeDays ?? 0,
              })
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      }),
    });
  }
  return { missing };
}
