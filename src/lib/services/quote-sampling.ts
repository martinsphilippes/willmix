import "server-only";

import { assertCan } from "@/lib/auth/function-access";
import { isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  type PurchaseQuote,
  type PurchaseQuoteResponse,
  type SamplingEvent,
  type SamplingFile,
  type SupplierRequestSampling,
  type User,
} from "@/lib/db";
import {
  SAMPLING_MAX_FILES,
  samplingCanReview,
  samplingCanSubmit,
  samplingCanUpload,
  samplingKind,
  samplingRoundFiles,
} from "@/lib/supplier-request-sampling";
import { quoteNeedsSampling, quoteSamplingOf } from "@/lib/quote-sampling";
import { quoteItemHref } from "@/lib/quote-item-href";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { audit } from "./audit";
import { notify } from "./notifications";
import { PurchaseQuoteError, ownResponse } from "./purchase-quote";
import { soldBeforeProducts } from "./supplier-sheets";

/*
 * Amostragem dentro da cotação de compra (dono, 22/11/2026;
 * docs/SUPPLIER_SAMPLING.md, "Amostragem desde a cotação"). O fornecedor
 * que não é conhecido do produto envia as fotos e os vídeos da amostra desde
 * o convite; a Wellmix aprova ou reprova (com o motivo; reprovada, ele manda
 * outra rodada). As mesmas regras da amostragem da solicitação, gravadas na
 * resposta dele (`purchase_quote_responses.sampling`, por produto). Os
 * arquivos são documentos sem pedido nem solicitação: só a Wellmix e quem
 * enviou abrem.
 */

const clip = (s: string | null | undefined) => {
  const v = (s ?? "").trim();
  return v ? v.slice(0, 2000) : null;
};

/** Produtos da cotação de que este fornecedor é conhecido (já vendeu à Wellmix). */
export async function knownQuoteProducts(
  quote: Pick<PurchaseQuote, "items">,
  supplierId: string,
): Promise<Set<string>> {
  return soldBeforeProducts(
    supplierId,
    quote.items.map((i) => i.productId),
  ).catch(() => new Set<string>());
}

async function load(
  user: User,
  quoteId: string,
  productId: string,
  responseId: string | null,
) {
  assertScreen(user, "quotes");
  const store = getStore();
  const quote = await store.get("purchase_quotes", quoteId);
  if (!quote) throw new PurchaseQuoteError("not_found");
  const item = quote.items.find((i) => i.productId === productId);
  if (!item) throw new PurchaseQuoteError("not_found");
  const wellmix = isWellmix(user);
  const response = wellmix
    ? responseId
      ? await store.get("purchase_quote_responses", responseId)
      : null
    : await ownResponse(user, quoteId);
  if (!response || response.quoteId !== quote.id)
    throw new PurchaseQuoteError("not_found");
  // Amostragem enquanto a cotação corre (aberta ou com a vencedora escolhida,
  // esperando a aprovação).
  if (quote.status !== "open" && quote.status !== "chosen")
    throw new PurchaseQuoteError("quote_closed");
  const known = (await knownQuoteProducts(quote, response.supplierId)).has(
    productId,
  );
  // Sem "Necessita amostragem" (dono, 27/11/2026), não há amostra a enviar.
  const sampling = quoteNeedsSampling(quote, response)
    ? quoteSamplingOf(response, productId, known)
    : null;
  if (!sampling) throw new PurchaseQuoteError("sampling_not_open");
  return { quote, item, response, sampling, wellmix };
}

function assertSupplier(wellmix: boolean) {
  if (wellmix) throw new PurchaseQuoteError("sampling_supplier_only");
}

const step = (
  user: User,
  sampling: SupplierRequestSampling,
  fields: Pick<SamplingEvent, "kind" | "side"> &
    Partial<Pick<SamplingEvent, "text" | "files">>,
): SamplingEvent => ({
  id: crypto.randomUUID(),
  at: new Date().toISOString(),
  byUserId: user.id,
  round: sampling.round,
  ...fields,
});

const save = (
  response: PurchaseQuoteResponse,
  productId: string,
  sampling: SupplierRequestSampling,
) =>
  getStore().update("purchase_quote_responses", response.id, {
    sampling: { ...(response.sampling ?? {}), [productId]: sampling },
  });

/** Foto ou vídeo da amostra de um produto (no formulário ou já subido). */
export async function addQuoteSamplingFile(
  user: User,
  quoteId: string,
  productId: string,
  input: { file: File | null; uploadedFileId: string | null },
): Promise<PurchaseQuoteResponse> {
  const { quote, response, sampling, wellmix } = await load(
    user,
    quoteId,
    productId,
    null,
  );
  assertSupplier(wellmix);
  if (!samplingCanUpload(sampling))
    throw new PurchaseQuoteError("sampling_closed");
  if (samplingRoundFiles(sampling).length >= SAMPLING_MAX_FILES)
    throw new PurchaseQuoteError("sampling_too_many");
  const docs = await import("./documents");
  const target = {
    type: "photo" as const,
    visibility: "internal" as const,
    video: true,
  };
  let doc;
  if (input.file && input.file.size > 0) {
    if (!samplingKind(input.file.type))
      throw new PurchaseQuoteError("sampling_file_type");
    doc = await docs.uploadDocument(user, input.file, target);
  } else if (input.uploadedFileId) {
    doc = await docs.registerUploadedDocument(
      user,
      input.uploadedFileId,
      target,
    );
  } else throw new PurchaseQuoteError("sampling_file_missing");
  const kind = samplingKind(doc.mime);
  if (!kind) throw new PurchaseQuoteError("sampling_file_type");
  const file: SamplingFile = {
    documentId: doc.id,
    fileName: doc.name,
    mime: doc.mime,
    kind,
    round: sampling.round,
    at: new Date().toISOString(),
    byUserId: user.id,
  };
  const updated = await save(response, productId, {
    ...sampling,
    files: [...sampling.files, file],
  });
  await audit(
    user,
    "sampling.file",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: amostragem, ${kind === "video" ? "vídeo" : "foto"} ${doc.name}`,
  );
  return updated;
}

/** Tira da rodada um arquivo ainda não enviado. */
export async function removeQuoteSamplingFile(
  user: User,
  quoteId: string,
  productId: string,
  documentId: string,
): Promise<PurchaseQuoteResponse> {
  const { response, sampling, wellmix } = await load(
    user,
    quoteId,
    productId,
    null,
  );
  assertSupplier(wellmix);
  if (!samplingCanUpload(sampling))
    throw new PurchaseQuoteError("sampling_closed");
  const file = sampling.files.find(
    (f) => f.documentId === documentId && f.round === sampling.round,
  );
  if (!file) throw new PurchaseQuoteError("not_found");
  return save(response, productId, {
    ...sampling,
    files: sampling.files.filter((f) => f !== file),
  });
}

/** O fornecedor envia a rodada para a Wellmix validar. */
export async function submitQuoteSampling(
  user: User,
  quoteId: string,
  productId: string,
  note: string | null,
): Promise<PurchaseQuoteResponse> {
  const { quote, item, response, sampling, wellmix } = await load(
    user,
    quoteId,
    productId,
    null,
  );
  assertSupplier(wellmix);
  if (!samplingCanUpload(sampling))
    throw new PurchaseQuoteError("sampling_closed");
  if (!samplingCanSubmit(sampling))
    throw new PurchaseQuoteError("sampling_file_missing");
  const files = samplingRoundFiles(sampling).length;
  const updated = await save(response, productId, {
    ...sampling,
    status: "submitted",
    submittedAt: new Date().toISOString(),
    history: [
      ...sampling.history,
      step(user, sampling, {
        kind: "submit",
        side: "supplier",
        text: clip(note),
        files,
      }),
    ],
  });
  await audit(
    user,
    "sampling.submit",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: amostragem de ${item.name} enviada (rodada ${sampling.round}, ${files} arquivos)`,
  );
  await notifyTo(quote, response, "wellmix", "submitted", item.name, {
    files,
  });
  return updated;
}

/** A Wellmix aprova ou reprova a amostra (motivo obrigatório para reprovar). */
export async function reviewQuoteSampling(
  user: User,
  quoteId: string,
  productId: string,
  responseId: string,
  decision: "approve" | "reject",
  note: string | null,
): Promise<PurchaseQuoteResponse> {
  const { quote, item, response, sampling, wellmix } = await load(
    user,
    quoteId,
    productId,
    responseId,
  );
  if (!wellmix) throw new PurchaseQuoteError("not_found");
  assertCan(user, "sampling.validate");
  if (!samplingCanReview(sampling))
    throw new PurchaseQuoteError("sampling_not_submitted");
  const text = clip(note);
  if (decision === "reject" && !text)
    throw new PurchaseQuoteError("sampling_reason_required");
  const updated = await save(response, productId, {
    ...sampling,
    status: decision === "approve" ? "approved" : "rejected",
    round: decision === "approve" ? sampling.round : sampling.round + 1,
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: user.id,
    history: [
      ...sampling.history,
      step(user, sampling, { kind: decision, side: "wellmix", text }),
    ],
  });
  await audit(
    user,
    `sampling.${decision}`,
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: amostragem de ${item.name} ${decision === "approve" ? "aprovada" : "reprovada"} (rodada ${sampling.round})`,
  );
  await notifyTo(
    quote,
    response,
    "supplier",
    decision === "approve" ? "approved" : "rejected",
    item.name,
    { reason: text ?? "" },
  );
  return updated;
}

async function notifyTo(
  quote: PurchaseQuote,
  response: PurchaseQuoteResponse,
  to: "wellmix" | "supplier",
  key: "submitted" | "approved" | "rejected",
  product: string,
  vars: Record<string, string | number> = {},
) {
  await notify(
    to === "wellmix"
      ? { userIds: [quote.openedByUserId] }
      : { role: "supplier", partyId: response.supplierId },
    {
      link:
        to === "wellmix"
          ? quoteItemHref(quote.id, null)
          : `/app/purchase-quotes/${quote.id}#amostragem`,
      kind: key === "approved" ? "done" : "action",
      ...(to === "wellmix" ? { actor: "wellmix" as const } : {}),
      text: (t) => ({
        subject: t(`quoteSampling.notify.${key}.subject` as DictionaryKey, {
          n: quote.number,
          product,
          ...vars,
        }),
        body: t(`sampling.notify.${key}.body` as DictionaryKey, {
          n: quote.number,
          product,
          ...vars,
        }),
      }),
    },
  ).catch((error) => console.error(`notify(quoteSampling.${key})`, error));
}

/**
 * O fornecedor foi convidado para uma cotação de compra com este produto
 * (e não recusou): ele abre as fotos do cadastro do produto, que servem de
 * referência para a amostra.
 */
/**
 * Item de book na cotação de compra (dono, 26/11/2026): o convidado vê a
 * foto do item e a arte de exemplo do SKU que cota.
 */
export async function supplierQuotesBookFile(
  supplierId: string,
  documentId: string,
): Promise<boolean> {
  const store = getStore();
  const responses = (
    await store
      .list("purchase_quote_responses", { filter: { supplierId } })
      .catch(() => [] as PurchaseQuoteResponse[])
  ).filter((r) => r.status !== "declined");
  if (!responses.length) return false;
  const quotes = await store.list("purchase_quotes", {
    filter: { id: [...new Set(responses.map((r) => r.quoteId))] },
  });
  return quotes.some(
    (q) =>
      q.status !== "cancelled" &&
      q.items.some(
        (i) =>
          !!i.book &&
          (i.book.snapshot.photoDocumentId === documentId ||
            i.book.variant?.artDocumentId === documentId),
      ),
  );
}

export async function supplierQuotesProduct(
  supplierId: string,
  productId: string,
): Promise<boolean> {
  const store = getStore();
  const responses = (
    await store
      .list("purchase_quote_responses", { filter: { supplierId } })
      .catch(() => [] as PurchaseQuoteResponse[])
  ).filter((r) => r.status !== "declined");
  if (!responses.length) return false;
  const quotes = await store.list("purchase_quotes", {
    filter: { id: [...new Set(responses.map((r) => r.quoteId))] },
  });
  return quotes.some(
    (q) =>
      q.status !== "cancelled" &&
      q.items.some((i) => i.productId === productId),
  );
}

/**
 * "Necessita amostragem" da cotação de compra (dono, 27/11/2026): só a
 * Wellmix que escolhe a vencedora marca ou desmarca, enquanto a cotação
 * corre (aberta ou com a vencedora escolhida). Marcada, cada convidado vê e
 * envia a amostra, e a vencedora precisa dela aprovada; desmarcada, nada
 * espera a amostra e o que já foi enviado fica guardado.
 */
export async function setQuoteSamplingNeed(
  user: User,
  quoteId: string,
  need: boolean,
): Promise<PurchaseQuote> {
  assertScreen(user, "quotes");
  if (!isWellmix(user)) throw new PurchaseQuoteError("forbidden");
  assertCan(user, "purchaseQuote.choose");
  const store = getStore();
  const quote = await store.get("purchase_quotes", quoteId);
  if (!quote) throw new PurchaseQuoteError("not_found");
  if (quote.status !== "open" && quote.status !== "chosen")
    throw new PurchaseQuoteError("quote_closed");
  const updated = await store.update("purchase_quotes", quote.id, {
    samplingNeed: need ? "yes" : "no",
  });
  await audit(
    user,
    "purchase_quote.sampling_need",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: necessita amostragem = ${need ? "sim" : "não"}`,
    { samplingNeed: quote.samplingNeed ?? null },
    { samplingNeed: need ? "yes" : "no" },
  );
  return updated;
}
