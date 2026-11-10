import "server-only";

import {
  getStore,
  type Document,
  type ProductPhoto,
  type Quote,
  type User,
} from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { superplanMissing, type SuperplanItem } from "@/lib/superplan-rfq";
import { audit } from "./audit";
import { storePhotoDocument, type PhotoSource } from "./documents";
import { notifyWellmix } from "./notifications";
import { supplierDielineView } from "./packaging-brief";
import { hdPhotosOf, knownTerms } from "./superplan-rfq";

/*
 * Etapa "Die Cut" do fornecedor escolhido (pedido do dono, 10/11/2026): na
 * mesma etapa ele envia o die-cut (a faca da caixa) e a foto em alta e
 * informa ou valida o pedido mínimo (MOQ) e o prazo de entrega. São os mesmos
 * quatro itens da cotação aberta do Superplan (docs/SUPERPLAN.md, seção 11),
 * agora também na cotação escolhida e no pedido de qualquer solicitação.
 *
 * Onde fica cada um: o die-cut no briefing da embalagem (como sempre); a foto
 * em alta na ficha da cotação escolhida (`product_photos` do tipo "hd"); o
 * MOQ e o prazo na própria cotação (`quotes.moq`, `quotes.leadTimeDays`).
 * Nenhuma coluna nova. Só o fornecedor da cotação escolhida (ou a Wellmix no
 * lugar dele) vê e envia.
 */

export class DieCutStepError extends Error {}

export type DieCutFrom = { quoteId: string } | { orderId: string };

export interface DieCutStepView {
  briefId: string;
  quoteId: string;
  requestId: string;
  orderId: string | null;
  productName: string;
  dueAt: string | null;
  dieline: Document | null;
  hdPhotos: { photo: ProductPhoto; document: Document | null }[];
  /** Confirmado pelo fornecedor (nulo até ele confirmar). */
  moq: number | null;
  /** Informado na cotação (ou confirmado aqui). */
  leadTimeDays: number | null;
  /** O que já se sabe do produto com este fornecedor, para só confirmar. */
  suggested: { moq: number | null; leadTimeDays: number | null };
  missing: SuperplanItem[];
}

/** A cotação escolhida da tela de onde a etapa é aberta (cotação ou pedido). */
async function selectedQuote(from: DieCutFrom): Promise<Quote | null> {
  const store = getStore();
  if ("quoteId" in from) {
    const quote = await store.get("quotes", from.quoteId);
    return quote?.status === "selected" ? quote : null;
  }
  const order = await store.get("orders", from.orderId);
  if (!order) return null;
  const request = await store.get("requests", order.requestId);
  if (!request?.selectedQuoteId) return null;
  const quote = await store.get("quotes", request.selectedQuoteId);
  // A cotação escolhida é a do fornecedor do pedido.
  return quote && quote.supplierId === order.supplierId ? quote : null;
}

/**
 * Os quatro itens da etapa. Nulo para quem não é o fornecedor da embalagem
 * (nem a Wellmix), sem briefing vivo ou sem o die-cut entre os entregáveis.
 */
export async function dieCutStepView(
  user: User,
  from: DieCutFrom,
): Promise<DieCutStepView | null> {
  const dielineView = await supplierDielineView(user, from);
  if (!dielineView) return null;
  const quote = await selectedQuote(from);
  if (!quote) return null;
  // Isolamento entre fornecedores: só o dono da cotação escolhida.
  if (!isWellmix(user) && user.partyId !== quote.supplierId) return null;
  const store = getStore();
  const request = await store.get("requests", quote.requestId);
  if (!request) return null;
  const [hdPhotos, suggested] = await Promise.all([
    hdPhotosOf(quote.id),
    request.productId
      ? knownTerms(request.productId, quote.supplierId)
      : Promise.resolve({ moq: null, leadTimeDays: null }),
  ]);
  const moq = quote.moq ?? null;
  return {
    briefId: dielineView.briefId,
    quoteId: quote.id,
    requestId: request.id,
    orderId: "orderId" in from ? from.orderId : null,
    productName: dielineView.productName,
    dueAt: dielineView.dueAt,
    dieline: dielineView.document,
    hdPhotos,
    moq,
    leadTimeDays: quote.leadTimeDays,
    suggested,
    missing: superplanMissing({
      dieline: !!dielineView.document,
      moq,
      leadTimeDays: quote.leadTimeDays,
      hd: hdPhotos.length > 0,
    }),
  };
}

export interface SendDieCutStepInput {
  moq: number | null;
  leadTimeDays: number | null;
  hdPhotos: PhotoSource[];
}

/**
 * O fornecedor (ou a Wellmix no lugar dele) envia a foto em alta e/ou
 * confirma o pedido mínimo e o prazo. Pode mandar aos poucos. A Wellmix é
 * avisada quando os quatro itens ficam completos e quando o MOQ ou o prazo
 * mudam em relação ao que estava valendo. O die-cut continua subindo pelo
 * briefing da embalagem (`uploadPackagingItem`).
 */
export async function sendDieCutStep(
  user: User,
  from: DieCutFrom,
  input: SendDieCutStepInput,
): Promise<{ missing: SuperplanItem[] }> {
  const store = getStore();
  const view = await dieCutStepView(user, from);
  if (!view) throw new ForbiddenError();
  if (input.moq !== null && !(Number.isInteger(input.moq) && input.moq > 0))
    throw new DieCutStepError("invalid_moq");
  if (
    input.leadTimeDays !== null &&
    !(
      Number.isInteger(input.leadTimeDays) &&
      input.leadTimeDays > 0 &&
      input.leadTimeDays <= 720
    )
  )
    throw new DieCutStepError("invalid_lead_time");

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
        orderId: view.quoteId,
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
  // O que estava valendo antes: o confirmado ou, na primeira vez, o sugerido.
  const before = {
    moq: view.moq ?? view.suggested.moq,
    leadTimeDays: view.leadTimeDays ?? view.suggested.leadTimeDays,
  };
  const patch: Partial<Quote> = {};
  if (input.moq !== null && input.moq !== view.moq) patch.moq = input.moq;
  if (input.leadTimeDays !== null && input.leadTimeDays !== view.leadTimeDays)
    patch.leadTimeDays = input.leadTimeDays;
  if (Object.keys(patch).length)
    await store.update("quotes", view.quoteId, patch);
  const merged = {
    moq: patch.moq ?? view.moq,
    leadTimeDays: patch.leadTimeDays ?? view.leadTimeDays,
  };
  const missing = superplanMissing({
    dieline: !!view.dieline,
    moq: merged.moq,
    leadTimeDays: merged.leadTimeDays,
    hd: view.hdPhotos.length + input.hdPhotos.length > 0,
  });
  const changed =
    (patch.moq !== undefined &&
      before.moq !== null &&
      before.moq !== patch.moq) ||
    (patch.leadTimeDays !== undefined &&
      before.leadTimeDays !== null &&
      before.leadTimeDays !== patch.leadTimeDays);
  await audit(
    user,
    "diecut.items",
    "quote",
    view.quoteId,
    [
      input.hdPhotos.length ? `foto em alta (${input.hdPhotos.length})` : null,
      patch.moq !== undefined
        ? `MOQ ${before.moq ?? "—"} → ${patch.moq}`
        : input.moq !== null
          ? `MOQ confirmado: ${input.moq}`
          : null,
      patch.leadTimeDays !== undefined
        ? `prazo ${before.leadTimeDays ?? "—"} → ${patch.leadTimeDays} dias`
        : input.leadTimeDays !== null
          ? `prazo confirmado: ${input.leadTimeDays} dias`
          : null,
      missing.length ? `falta: ${missing.join(", ")}` : "completo",
    ]
      .filter(Boolean)
      .join("; "),
    before,
    merged,
  );
  const completedNow = !missing.length && view.missing.length > 0;
  if (completedNow || changed)
    await notifyWellmix({
      kind: changed ? "alert" : "done",
      link: view.orderId
        ? `/app/orders/${view.orderId}`
        : `/app/requests/${view.requestId}`,
      text: (t) => ({
        subject: t(
          completedNow ? "notif.dieCut.subject" : "notif.dieCut.changedSubject",
          { product: view.productName },
        ),
        body: [
          t("notif.dieCut.body", {
            moq: merged.moq?.toLocaleString(t.intl) ?? "—",
            days: merged.leadTimeDays ?? "—",
          }),
          changed
            ? t("notif.dieCut.changed", {
                moq: before.moq?.toLocaleString(t.intl) ?? "—",
                days: before.leadTimeDays ?? "—",
              })
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      }),
    });
  return { missing };
}
