import "server-only";

import type { Translate } from "@/i18n";
import { formatAmount } from "@/lib/workflow/money";
import { quotedQuantity } from "./purchase-sheet-calc";
import {
  getStore,
  type FreightQuote,
  type Order,
  type Product,
  type PurchaseSheet,
  type Request,
  type User,
} from "@/lib/db";
import { boxCbm } from "@/lib/logistics/cbm";
import {
  ForbiddenError,
  assertWellmix,
  isWellmix,
} from "@/lib/auth/permissions";
import { totalCbmFor } from "@/lib/pricing";
import { audit } from "./audit";
import { notify, notifyWellmix } from "./notifications";

/*
 * Cotação de frete pela companhia marítima, pelo PEDIDO (até 11/11/2026 era
 * pela cotação do fornecedor, que saiu). A Wellmix pede o frete no pedido:
 * cada companhia marítima ativa recebe um pedido de frete (pendência +
 * notificação) com a carga somada dos itens do pedido: CBM, caixas, peso,
 * medidas, incoterm e local (da ficha de compra do pedido e do cadastro).
 * Quem informa o valor é ela. Preço do fornecedor, fornecedor e cliente não
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
  request: Pick<Request, "quantity" | "unit">,
  sheet: Partial<PurchaseSheet> | null,
): Cargo {
  // A mesma quantidade do preço ao cliente: a da programação (se em peças).
  const qty = quotedQuantity(request, sheet as PurchaseSheet | null);
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

const positive = (n: number | null | undefined) =>
  typeof n === "number" && n > 0 ? n : null;

/**
 * Carga de um item para o pedido de frete: a da ficha de compra; o que
 * faltar nela vem do cadastro (variação pedida > produto). Assim a companhia
 * marítima recebe o pedido mesmo sem a ficha.
 */
export function itemCargo(
  request: Pick<Request, "quantity" | "unit" | "variant">,
  sheet: Partial<PurchaseSheet> | null,
  product: Pick<
    Product,
    | "masterBoxQty"
    | "cbm"
    | "boxLengthCm"
    | "boxWidthCm"
    | "boxHeightCm"
    | "grossWeightKg"
  > | null,
): Cargo {
  const variant = request.variant ?? null;
  const qty = quotedQuantity(request, sheet as PurchaseSheet | null);
  const sheetPer = positive(sheet?.masterCartonQty);
  const sheetCbm = positive(sheet?.cbmPerCarton);
  const catalogPer =
    positive(variant?.masterBoxQty) ?? positive(product?.masterBoxQty);
  const catalogCbm =
    positive(variant?.cbm) ?? (product ? positive(boxCbm(product)) : null);
  const fromSheet = sheetPer !== null && sheetCbm !== null;
  const perCarton = fromSheet ? sheetPer : (sheetPer ?? catalogPer);
  const cbmPerCarton = fromSheet ? sheetCbm : (sheetCbm ?? catalogCbm);
  const cbm = totalCbmFor(qty, perCarton, cbmPerCarton);
  const grossPc =
    positive(sheet?.grossWeightPcKg) ??
    positive(variant?.grossWeightKg) ??
    positive(product?.grossWeightKg);
  return {
    totalCbm: cbm !== null ? Math.round(cbm * 10000) / 10000 : null,
    cartons: perCarton ? Math.ceil(qty / perCarton) : null,
    grossWeightKg: grossPc ? Math.round(qty * grossPc * 100) / 100 : null,
  };
}

const sameCargo = (a: Cargo, b: Cargo) =>
  a.totalCbm === b.totalCbm &&
  a.cartons === b.cartons &&
  a.grossWeightKg === b.grossWeightKg;

/** Soma das cargas (nulo quando nenhum item tem o valor). */
function sumCargo(list: Cargo[]): Cargo {
  const sum = (k: keyof Cargo, digits: number) => {
    const known = list.map((c) => c[k]).filter((v): v is number => v !== null);
    if (!known.length) return null;
    const f = 10 ** digits;
    return Math.round(known.reduce((a, b) => a + b, 0) * f) / f;
  };
  return {
    totalCbm: sum("totalCbm", 4),
    cartons: sum("cartons", 0),
    grossWeightKg: sum("grossWeightKg", 2),
  };
}

/**
 * Carga do pedido: cada item com a ficha de compra do pedido (quando ele tem
 * um item só, como os pedidos de uma solicitação) e o cadastro do produto.
 */
export async function orderCargo(order: Pick<Order, "id">): Promise<Cargo> {
  const store = getStore();
  const [items, [sheet]] = await Promise.all([
    store.list("order_items", { filter: { orderId: order.id } }),
    store.list("purchase_sheets", { filter: { orderId: order.id }, limit: 1 }),
  ]);
  const productIds = [
    ...new Set(
      items.map((i) => i.productId).filter((id): id is string => !!id),
    ),
  ];
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  return sumCargo(
    items.map((item) =>
      itemCargo(
        {
          quantity: item.quantity,
          unit: item.unit,
          variant: (item.variant as Request["variant"]) ?? null,
        },
        items.length === 1 ? (sheet ?? null) : null,
        products.find((p) => p.id === item.productId) ?? null,
      ),
    ),
  );
}

/** Nome do pedido para a companhia (sem preço, fornecedor nem cliente). */
async function orderLabel(order: Order): Promise<string> {
  const items = await getStore().list("order_items", {
    filter: { orderId: order.id },
  });
  const names = items.map((i) => i.name);
  return `#${order.number}${names.length ? ` ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}` : ""}`;
}

/**
 * A Wellmix pede (ou pede de novo) o frete do pedido a cada companhia
 * marítima ativa. Se a carga mudou, o frete já informado volta a pendente
 * para a companhia revisar. Sem volume nem caixas conhecidos (nem na ficha,
 * nem no cadastro) não há o que cotar.
 */
export async function inviteFreightForOrder(
  user: User,
  orderId: string,
): Promise<number> {
  assertWellmix(user);
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || order.status === "CANCELLED")
    throw new FreightError("not_found");
  const [cargo, carriers, existing, label] = await Promise.all([
    orderCargo(order),
    store.list("parties", { filter: { type: "shipping_line", active: true } }),
    store.list("freight_quotes", { filter: { orderId } }),
    orderLabel(order),
  ]);
  if (!carriers.length) throw new FreightError("no_carriers");
  if (cargo.totalCbm === null && cargo.cartons === null)
    throw new FreightError("no_cargo");
  let invited = 0;
  for (const carrier of carriers) {
    const current = existing.find((f) => f.carrierId === carrier.id);
    const cargoText = (t: Translate) =>
      t("notif.freightQuote.cargo", {
        cbm: String(cargo.totalCbm ?? "?"),
        cartons: String(cargo.cartons ?? "?"),
        kg: String(cargo.grossWeightKg ?? "?"),
      });
    if (!current || current.status === "cancelled") {
      const fq = current
        ? await store.update("freight_quotes", current.id, {
            ...cargo,
            status: "invited",
            amount: null,
            currency: null,
            transitDays: null,
            validUntil: null,
            notes: null,
            answeredByUserId: null,
            answeredAt: null,
          })
        : await store.create("freight_quotes", {
            requestId: order.requestId,
            orderId,
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
        {
          kind: "action",
          link: `/app/freight/${fq.id}`,
          text: (t) => ({
            subject: t("notif.freightQuote.subject", { product: label }),
            body: t("notif.freightQuote.body", { cargo: cargoText(t) }),
          }),
        },
      );
      invited++;
    } else if (!sameCargo(current, cargo)) {
      await store.update("freight_quotes", current.id, {
        ...cargo,
        status: "invited",
      });
      await notify(
        { role: "shipping_line", partyId: carrier.id },
        {
          kind: "action",
          link: `/app/freight/${current.id}`,
          text: (t) => ({
            subject: t("notif.freightChanged.subject", { product: label }),
            body: t("notif.freightChanged.body", { cargo: cargoText(t) }),
          }),
        },
      );
      invited++;
    }
  }
  await audit(
    user,
    "freight.invite",
    "order",
    orderId,
    invited
      ? `Frete pedido a ${invited} companhia(s) marítima(s)`
      : "Frete pedido de novo: nada mudou na carga",
  );
  return invited;
}

/** Pedidos de frete do pedido (todas as companhias), só para a Wellmix. */
export async function freightForOrder(
  user: User,
  orderId: string,
): Promise<FreightQuote[]> {
  if (!isWellmix(user)) return [];
  return getStore().list("freight_quotes", {
    filter: { orderId },
    orderBy: "createdAt",
  });
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
  const order = await store.get("orders", fq.orderId);
  if (!order || order.status === "CANCELLED") throw new FreightError("closed");
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
  await notifyWellmix({
    kind: "action",
    subject: `Frete informado: pedido #${order.number}`,
    body: `${formatAmount(input.amount, input.currency)}${input.transitDays ? `, ${input.transitDays} dias` : ""}.`,
    link: `/app/orders/${order.id}#freight`,
  });
  return updated;
}

/** Pedido cancelado: encerra os pedidos de frete em aberto dele. */
export async function cancelFreightForOrder(orderId: string) {
  const store = getStore();
  const rows = await store.list("freight_quotes", {
    filter: { orderId, status: ["invited", "answered"] },
  });
  for (const fq of rows)
    await store.update("freight_quotes", fq.id, { status: "cancelled" });
}

export interface FreightView {
  freight: FreightQuote;
  /** Número e itens do pedido (sem preço, fornecedor nem cliente). */
  orderNumber: number;
  items: Array<{ name: string; quantity: number; unit: string }>;
  sheet: PurchaseSheet | null;
  /** Pode responder agora (pedido de frete e pedido em aberto). */
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
  const [order, items, [sheet]] = await Promise.all([
    store.get("orders", freight.orderId),
    store.list("order_items", { filter: { orderId: freight.orderId } }),
    store.list("purchase_sheets", {
      filter: { orderId: freight.orderId },
      limit: 1,
    }),
  ]);
  if (!order) return null;
  return {
    freight,
    orderNumber: order.number,
    items: items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
    sheet: items.length === 1 ? (sheet ?? null) : null,
    canAnswer: freight.status !== "cancelled" && order.status !== "CANCELLED",
  };
}

/** Resumo do frete recém-informado, para a confirmação na lista de fretes. */
export interface SentFreightView {
  id: string;
  productName: string;
  amount: number | null;
  currency: string | null;
  transitDays: number | null;
  validUntil: string | null;
}

/**
 * Frete que o usuário acabou de informar (`/app/freight?sent=<id>`): só o da
 * companhia dele (`canViewFreight`) e já informado; senão nulo. Id que o banco
 * recusa não derruba a tela (o aviso é opcional).
 */
export async function sentFreightView(
  user: User,
  freightId: string,
): Promise<SentFreightView | null> {
  const store = getStore();
  const fq = await store.get("freight_quotes", freightId).catch(() => null);
  if (!fq || !canViewFreight(user, fq) || fq.status !== "answered") return null;
  const order = await store.get("orders", fq.orderId);
  if (!order) return null;
  return {
    id: fq.id,
    productName: await orderLabel(order),
    amount: fq.amount,
    currency: fq.currency,
    transitDays: fq.transitDays,
    validUntil: fq.validUntil,
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
