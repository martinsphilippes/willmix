import "server-only";

import {
  getStore,
  type FreightQuote,
  type PurchaseSheet,
  type Request,
  type User,
} from "@/lib/db";
import { ForbiddenError, isWellmix } from "@/lib/auth/permissions";
import { totalCbmFor } from "@/lib/pricing";
import { audit } from "./audit";
import { notify, notifyWellmix } from "./notifications";
import { getQuoteSheet } from "./quote-sheet";

/*
 * Cotação de frete pela companhia marítima. Quando o fornecedor envia a
 * cotação com a ficha de compra, cada companhia marítima ativa recebe um
 * pedido de frete (pendência + notificação) com a carga: CBM, caixas, peso,
 * medidas, incoterm e local. Ela informa o valor; o valor entra no custo
 * importado do valor ao cliente. Preço do fornecedor, fornecedor e cliente não
 * aparecem para a companhia.
 */

export class FreightError extends Error {}

export function canViewFreight(
  user: User,
  fq: Pick<FreightQuote, "carrierId">,
) {
  if (isWellmix(user)) return true;
  return user.role === "shipping_line" && fq.carrierId === user.partyId;
}

export interface Cargo {
  totalCbm: number | null;
  cartons: number | null;
  grossWeightKg: number | null;
}

/** Carga da cotação: caixas master (para cima), CBM total e peso bruto total. */
export function cargoFor(
  request: Pick<Request, "quantity">,
  sheet: Partial<PurchaseSheet> | null,
): Cargo {
  const qty = request.quantity;
  const perCarton = sheet?.masterCartonQty ?? null;
  const cartons =
    perCarton && perCarton > 0 ? Math.ceil(qty / perCarton) : null;
  const cbm = totalCbmFor(qty, perCarton, sheet?.cbmPerCarton ?? null);
  const gross =
    sheet?.grossWeightPcKg && sheet.grossWeightPcKg > 0
      ? Math.round(qty * sheet.grossWeightPcKg * 100) / 100
      : null;
  return {
    totalCbm: cbm !== null ? Math.round(cbm * 10000) / 10000 : null,
    cartons,
    grossWeightKg: gross,
  };
}

const sameCargo = (a: Cargo, b: Cargo) =>
  a.totalCbm === b.totalCbm &&
  a.cartons === b.cartons &&
  a.grossWeightKg === b.grossWeightKg;

/**
 * Fornecedor enviou (ou reenviou) a cotação com a ficha: pede frete a cada
 * companhia marítima ativa. Se a carga mudou num reenvio, o frete já
 * informado volta a pendente para a companhia revisar.
 */
export async function inviteFreightForQuote(
  user: User | null,
  quoteId: string,
): Promise<number> {
  const store = getStore();
  const quote = await store.get("quotes", quoteId);
  if (!quote) return 0;
  const [request, sheet, carriers, existing] = await Promise.all([
    store.get("requests", quote.requestId),
    getQuoteSheet(quoteId),
    store.list("parties", { filter: { type: "shipping_line", active: true } }),
    store.list("freight_quotes", { filter: { quoteId } }),
  ]);
  if (!request || !sheet) return 0;
  const cargo = cargoFor(request, sheet);
  let invited = 0;
  for (const carrier of carriers) {
    const current = existing.find((f) => f.carrierId === carrier.id);
    const message = {
      subject: `Cotação de frete: ${request.productName}`,
      body: `${cargo.totalCbm ?? "?"} m³ · ${cargo.cartons ?? "?"} caixas · ${cargo.grossWeightKg ?? "?"} kg. Informe o valor do frete.`,
    };
    if (!current) {
      const fq = await store.create("freight_quotes", {
        requestId: request.id,
        quoteId,
        carrierId: carrier.id,
        status: "invited",
        ...cargo,
        amount: null,
        currency: null,
        transitDays: null,
        validUntil: null,
        notes: null,
        answeredByUserId: null,
        answeredAt: null,
      });
      await notify(
        { role: "shipping_line", partyId: carrier.id },
        { ...message, link: `/app/freight/${fq.id}` },
      );
      invited++;
    } else if (current.status !== "cancelled" && !sameCargo(current, cargo)) {
      await store.update("freight_quotes", current.id, {
        ...cargo,
        status: "invited",
      });
      await notify(
        { role: "shipping_line", partyId: carrier.id },
        {
          subject: `Carga alterada: ${request.productName}`,
          body: `${message.body} A ficha mudou; revise o frete.`,
          link: `/app/freight/${current.id}`,
        },
      );
      invited++;
    }
  }
  if (invited)
    await audit(
      user,
      "freight.invite",
      "quote",
      quoteId,
      `Frete pedido a ${invited} companhia(s) marítima(s)`,
    );
  return invited;
}

export interface FreightAnswerInput {
  amount: number;
  currency: string;
  transitDays: number | null;
  validUntil: string | null;
  notes: string | null;
}

/** Companhia marítima (ou a Wellmix por ela) informa o frete. */
export async function answerFreight(
  user: User,
  freightId: string,
  input: FreightAnswerInput,
) {
  const store = getStore();
  const fq = await store.get("freight_quotes", freightId);
  if (!fq) throw new FreightError("not_found");
  if (!canViewFreight(user, fq)) throw new ForbiddenError();
  if (fq.status === "cancelled") throw new FreightError("closed");
  const quote = await store.get("quotes", fq.quoteId);
  if (!quote || quote.status === "rejected") throw new FreightError("closed");
  if (!(input.amount > 0)) throw new FreightError("invalid_amount");
  const updated = await store.update("freight_quotes", freightId, {
    status: "answered",
    amount: input.amount,
    currency: input.currency,
    transitDays: input.transitDays,
    validUntil: input.validUntil,
    notes: input.notes,
    answeredByUserId: user.id,
    answeredAt: new Date().toISOString(),
  });
  await audit(
    user,
    "freight.answer",
    "freight_quote",
    freightId,
    `${input.currency} ${input.amount}`,
  );
  const request = await store.get("requests", fq.requestId);
  await notifyWellmix({
    subject: `Frete informado: ${request?.productName ?? ""}`,
    body: `${input.currency} ${input.amount.toFixed(2)}${input.transitDays ? `, ${input.transitDays} dias` : ""}.`,
    link: `/app/requests/${fq.requestId}`,
  });
  return updated;
}

/** Cancela pedidos de frete em aberto da solicitação (exceto o da cotação escolhida). */
export async function cancelFreightForRequest(
  requestId: string,
  keepQuoteId: string | null = null,
) {
  const store = getStore();
  const rows = await store.list("freight_quotes", {
    filter: { requestId, status: ["invited", "answered"] },
  });
  for (const fq of rows)
    if (fq.quoteId !== keepQuoteId)
      await store.update("freight_quotes", fq.id, { status: "cancelled" });
}

/** Fretes das cotações (todas as companhias), por cotação do fornecedor. */
export async function freightByQuote(quoteIds: string[]) {
  const map = new Map<string, FreightQuote[]>();
  if (quoteIds.length === 0) return map;
  const rows = await getStore().list("freight_quotes", {
    filter: { quoteId: quoteIds, status: ["invited", "answered"] },
  });
  for (const fq of rows) {
    const list = map.get(fq.quoteId) ?? [];
    list.push(fq);
    map.set(fq.quoteId, list);
  }
  return map;
}

export interface FreightView {
  freight: FreightQuote;
  request: Request;
  sheet: PurchaseSheet | null;
  /** Pode responder agora (pedido aberto e cotação do fornecedor não encerrada). */
  canAnswer: boolean;
}

/** Tela do pedido de frete: só a carga (sem preço, fornecedor ou cliente). */
export async function getFreightView(
  user: User,
  freightId: string,
): Promise<FreightView | null> {
  const store = getStore();
  const freight = await store.get("freight_quotes", freightId);
  if (!freight || !canViewFreight(user, freight)) return null;
  const [request, quote, sheet] = await Promise.all([
    store.get("requests", freight.requestId),
    store.get("quotes", freight.quoteId),
    getQuoteSheet(freight.quoteId),
  ]);
  if (!request) return null;
  return {
    freight,
    request,
    sheet,
    canAnswer:
      freight.status !== "cancelled" && !!quote && quote.status !== "rejected",
  };
}

/** Pedidos de frete da companhia (Wellmix vê todos). */
export async function listFreightFor(user: User) {
  const store = getStore();
  if (!isWellmix(user) && user.role !== "shipping_line") return [];
  const rows = await store.list("freight_quotes", {
    filter: isWellmix(user) ? undefined : { carrierId: user.partyId ?? "-" },
    orderBy: "createdAt",
    direction: "desc",
  });
  return rows.filter((r) => canViewFreight(user, r));
}
