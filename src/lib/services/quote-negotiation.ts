import "server-only";

import {
  getStore,
  type PurchaseQuote,
  type PurchaseQuoteResponse,
  type User,
} from "@/lib/db";
import {
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  type QuoteNegotiationEvent,
} from "@/lib/db/schema";
import { assertCan, canSeePurchasePrice } from "@/lib/auth/function-access";
import { isWellmix } from "@/lib/auth/permissions";
import {
  appendQuoteEvent,
  canCounterQuote,
  canMessageQuote,
} from "@/lib/quote-negotiation";
import { audit } from "./audit";
import { notify } from "./notifications";
import { PurchaseQuoteError, ownResponse } from "./purchase-quote";
import { quoteItemHref } from "@/lib/quote-item-href";

/*
 * Negociação dentro da cotação de compra (dono, 22/11/2026;
 * docs/QUOTATION.md). A cotação e a negociação são o mesmo passo: com as
 * respostas no quadro comparativo, a Wellmix devolve com contraproposta a um
 * ou a vários fornecedores de uma vez (por produto) e conversa com cada um.
 * O fornecedor vê só a própria linha: a contraproposta aparece na cotação
 * dele, que ele corrige e reenvia (ganha um prazo novo para isso).
 */

const HOUR = 3_600_000;

const clip = (text: string | null | undefined) =>
  (text ?? "").trim().slice(0, 4000) || null;

const event = (
  user: User,
  side: "wellmix" | "supplier",
  now: Date,
  data: Partial<QuoteNegotiationEvent> & Pick<QuoteNegotiationEvent, "kind">,
): QuoteNegotiationEvent => ({
  id: crypto.randomUUID(),
  at: now.toISOString(),
  side,
  byUserId: user.id,
  ...data,
});

export interface QuoteCounterInput {
  responseIds: string[];
  productId: string;
  price: number | null;
  currency: string | null;
  moq: number | null;
  leadTimeDays: number | null;
  incoterm: string | null;
  text: string | null;
}

/**
 * A Wellmix devolve com contraproposta, a um ou a vários fornecedores de uma
 * vez: comentário obrigatório e ao menos um valor. Só para quem respondeu,
 * com a cotação aberta. Cada fornecedor ganha um prazo novo (as horas da
 * cotação) para corrigir a resposta; quem já respondeu continua respondido.
 */
export async function proposeQuoteCounter(
  user: User,
  quoteId: string,
  input: QuoteCounterInput,
  now = new Date(),
): Promise<PurchaseQuoteResponse[]> {
  if (!isWellmix(user)) throw new PurchaseQuoteError("forbidden");
  assertCan(user, "purchaseQuote.choose");
  const store = getStore();
  const quote = await store.get("purchase_quotes", quoteId);
  if (!quote) throw new PurchaseQuoteError("not_found");
  if (quote.status !== "open") throw new PurchaseQuoteError("quote_closed");
  const item = quote.items.find((i) => i.productId === input.productId);
  if (!item) throw new PurchaseQuoteError("not_found");
  // Sem "Ver preço de compra", a Wellmix propõe MOQ, prazo e FOB/EXW.
  if (!canSeePurchasePrice(user))
    input = { ...input, price: null, currency: null };
  const text = clip(input.text);
  if (!text) throw new PurchaseQuoteError("supplier_request_comment_required");
  if (
    input.price === null &&
    input.moq === null &&
    input.leadTimeDays === null &&
    !input.incoterm
  )
    throw new PurchaseQuoteError("supplier_request_offer_empty");
  if (
    input.currency &&
    !(SHEET_CURRENCIES as readonly string[]).includes(input.currency)
  )
    throw new PurchaseQuoteError("invalid_input");
  if (
    input.incoterm &&
    !(SHEET_INCOTERMS as readonly string[]).includes(input.incoterm)
  )
    throw new PurchaseQuoteError("invalid_input");
  const ids = [...new Set(input.responseIds)];
  if (!ids.length) throw new PurchaseQuoteError("quote_counter_none");
  const responses = (
    await store.list("purchase_quote_responses", { filter: { quoteId } })
  ).filter((r) => ids.includes(r.id));
  if (responses.length !== ids.length)
    throw new PurchaseQuoteError("not_found");
  if (responses.some((r) => !canCounterQuote(quote.status, r)))
    throw new PurchaseQuoteError("quote_counter_not_answered");
  const newDue = new Date(now.getTime() + quote.hours * HOUR).toISOString();
  const out: PurchaseQuoteResponse[] = [];
  for (const r of responses) {
    const e = event(user, "wellmix", now, {
      kind: "proposal",
      productId: input.productId,
      price: input.price,
      currency:
        input.price === null ? null : (input.currency ?? r.currency ?? "USD"),
      moq: input.moq,
      leadTimeDays: input.leadTimeDays,
      incoterm: input.incoterm,
      text,
    });
    out.push(
      await store.update("purchase_quote_responses", r.id, {
        negotiation: appendQuoteEvent(r, e),
        ...(r.dueAt < newDue ? { dueAt: newDue } : {}),
      }),
    );
    await notify(
      { partyId: r.supplierId, role: "supplier" },
      {
        kind: "action",
        link: `/app/purchase-quotes/${quote.id}`,
        actor: "wellmix",
        text: (t) => ({
          subject: t("quotation.notify.counter.subject", {
            n: String(quote.number),
          }),
          body: t("quotation.notify.counter.body", { product: item.name }),
        }),
      },
    ).catch((error) => console.error("notify(quote.counter)", error));
  }
  await audit(
    user,
    "purchase_quote.counter",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: contraproposta de ${item.name} a ${responses.length} fornecedor(es)`,
  );
  return out;
}

/**
 * Mensagem da conversa do par fornecedor × produto na cotação. A Wellmix
 * escreve para uma resposta; o fornecedor, só na própria.
 */
export async function postQuoteMessage(
  user: User,
  quoteId: string,
  input: {
    responseId: string | null;
    productId: string | null;
    text: string;
    file?: File | null;
  },
  now = new Date(),
): Promise<PurchaseQuoteResponse> {
  const store = getStore();
  const quote = await store.get("purchase_quotes", quoteId);
  if (!quote) throw new PurchaseQuoteError("not_found");
  const wellmix = isWellmix(user);
  const response = wellmix
    ? input.responseId
      ? await store.get("purchase_quote_responses", input.responseId)
      : null
    : await ownResponse(user, quoteId);
  if (!response || response.quoteId !== quote.id)
    throw new PurchaseQuoteError("not_found");
  if (!canMessageQuote(quote.status, response))
    throw new PurchaseQuoteError("quote_closed");
  const text = clip(input.text);
  const file = input.file && input.file.size > 0 ? input.file : null;
  if (!text && !file)
    throw new PurchaseQuoteError("supplier_request_message_empty");
  const item = input.productId
    ? quote.items.find((i) => i.productId === input.productId)
    : null;
  if (input.productId && !item) throw new PurchaseQuoteError("not_found");
  // Anexo (foto, PDF ou Excel; também a imagem colada): só a Wellmix e o
  // fornecedor desta resposta abrem (`supplierSeesQuoteFile`).
  let attachment: Pick<
    QuoteNegotiationEvent,
    "documentId" | "fileName" | "mime"
  > = {};
  if (file) {
    const { NEGOTIATION_MIME } = await import("./supplier-request-negotiation");
    if (!NEGOTIATION_MIME.includes((file.type || "").toLowerCase()))
      throw new PurchaseQuoteError("supplier_request_file_type");
    const { uploadDocument } = await import("./documents");
    const doc = await uploadDocument(user, file, {
      type: "attachment",
      visibility: "internal",
    });
    attachment = { documentId: doc.id, fileName: doc.name, mime: doc.mime };
  }
  const updated = await store.update("purchase_quote_responses", response.id, {
    negotiation: appendQuoteEvent(
      response,
      event(user, wellmix ? "wellmix" : "supplier", now, {
        kind: "message",
        productId: item?.productId ?? null,
        text,
        ...attachment,
      }),
    ),
  });
  await audit(
    user,
    "purchase_quote.message",
    "purchase_quote",
    quote.id,
    `Cotação de compra nº ${quote.number}: mensagem`,
  );
  await notifyMessage(
    quote,
    updated,
    wellmix,
    item?.productId ?? null,
    text ?? attachment.fileName ?? "",
  );
  return updated;
}

async function notifyMessage(
  quote: PurchaseQuote,
  response: PurchaseQuoteResponse,
  fromWellmix: boolean,
  productId: string | null,
  text: string,
) {
  // Para a Wellmix: quem já falou com este fornecedor na cotação; sem
  // ninguém, quem abriu a cotação.
  const wellmixIds = [
    ...new Set(
      (response.negotiation ?? [])
        .filter((e) => e.side === "wellmix")
        .map((e) => e.byUserId),
    ),
  ];
  await notify(
    fromWellmix
      ? { partyId: response.supplierId, role: "supplier" }
      : { userIds: wellmixIds.length ? wellmixIds : [quote.openedByUserId] },
    {
      kind: "action",
      link: fromWellmix
        ? `/app/purchase-quotes/${quote.id}`
        : quoteItemHref(quote.id, productId),
      ...(fromWellmix ? { actor: "wellmix" as const } : {}),
      text: (t) => ({
        subject: t("quotation.notify.message.subject", {
          n: String(quote.number),
        }),
        body: text.slice(0, 200),
      }),
    },
  ).catch((error) => console.error("notify(quote.message)", error));
}

/** O fornecedor abre o anexo de uma mensagem da conversa da cotação dele. */
export async function supplierSeesQuoteFile(
  supplierId: string,
  documentId: string,
): Promise<boolean> {
  const responses = await getStore()
    .list("purchase_quote_responses", { filter: { supplierId } })
    .catch(() => [] as PurchaseQuoteResponse[]);
  return responses.some((r) =>
    (r.negotiation ?? []).some((e) => e.documentId === documentId),
  );
}
