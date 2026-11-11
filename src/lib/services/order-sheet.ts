import "server-only";

import { getStore, type Order } from "@/lib/db";
import type { OrderDocument, OrderSignature } from "./order-signature";

/*
 * Folha do pedido no formato do modelo da Wellmix (o pedido de compra que o
 * fornecedor assina): cabeçalho com os dados do pedido, cada item em duas
 * faixas (identificação e, embaixo, embalagem, medidas, pesos, quantidades e
 * valores), os totais e a página de procedimentos. Serve à página do
 * documento e ao PDF (docs/ORDER_SIGNATURE.md).
 *
 * É a apresentação: o que as partes assinam (a "versão", impressão digital)
 * continua sendo o `OrderDocument`. Campo sem dado no portal fica em branco:
 * nada é inventado (EAN, DUN, comissão e LI ainda não existem no cadastro).
 */

export interface OrderSheetHeader {
  company: string;
  issuedBy: string | null;
  /** ISO. */
  issuedAt: string;
  lot: string;
  partner: string;
  forwardingAgent: string | null;
  incoterm: string | null;
  paymentCondition: string | null;
  /** AAAA-MM-DD. */
  etd: string | null;
  /** Número do pedido no ERP (Sankhya), quando já existe. */
  purchaseOrder: string | null;
  wellmixNumber: number;
  /** Assinatura da Wellmix: quando o pedido foi enviado ao fornecedor (ISO). */
  sentToPartnerAt: string | null;
}

export interface OrderSheetItem {
  n: number;
  contact: string | null;
  artwork: string | null;
  pantone: string | null;
  factoryCode: string | null;
  wellmixCode: string | null;
  description: string;
  descriptionPt: string | null;
  batteries: string | null;
  ncm: string | null;
  packing: string | null;
  /** Medidas da peça, em metros. */
  lengthM: number | null;
  widthM: number | null;
  heightM: number | null;
  cbmCarton: number | null;
  totalCbm: number | null;
  netKg: number | null;
  totalNetKg: number | null;
  grossKg: number | null;
  totalGrossKg: number | null;
  piecesPerInner: number | null;
  piecesPerMaster: number | null;
  masterCartons: number | null;
  quantity: number;
  unit: string;
  /** A quantidade está em peças (caixas e totais valem). */
  pieces: boolean;
  price: number | null;
  total: number | null;
  comments: string | null;
  factory: string | null;
}

export interface OrderSheet {
  header: OrderSheetHeader;
  currency: string;
  items: OrderSheetItem[];
  totals: {
    cbm: number | null;
    netKg: number | null;
    grossKg: number | null;
    value: number | null;
  };
  /** Do documento assinado: pedido mínimo e prazo. */
  moq: number | null;
  leadTimeDays: number | null;
  /** Fábrica que produz, quando não é o fornecedor do pedido (trading). */
  manufacturers: string[];
}

const round = (n: number, digits: number) =>
  Math.round(n * 10 ** digits) / 10 ** digits;
const clean = (v: string | null | undefined) => v?.trim() || null;
const cmToM = (cm: number | null | undefined) =>
  cm === null || cm === undefined ? null : round(cm / 100, 3);
const times = (a: number | null, b: number | null, digits: number) =>
  a === null || b === null ? null : round(a * b, digits);
/** Soma só quando todos os itens têm o valor (total parcial enganaria). */
const sumAll = (values: Array<number | null>, digits: number) =>
  values.length && values.every((v) => v !== null)
    ? round(
        values.reduce<number>((s, v) => s + (v ?? 0), 0),
        digits,
      )
    : null;
const isPieces = (unit: string) =>
  /^(un|und|unid|unidade|unidades|pc|pcs|pç|pçs|peça|peças|piece|pieces)\.?$/i.test(
    unit.trim(),
  );

/**
 * Monta a folha do pedido. Quem chama já conferiu que o usuário pode ver o
 * documento (`canViewOrderDocument`): a folha tem o preço de compra.
 */
export async function buildOrderSheet(
  order: Order,
  doc: OrderDocument,
  wellmixSignature: Pick<OrderSignature, "at"> | null,
): Promise<OrderSheet> {
  const store = getStore();
  const [items, [sheet], supplier, agent, [track], request, owner] =
    await Promise.all([
      store.list("order_items", { filter: { orderId: order.id } }),
      store.list("purchase_sheets", {
        filter: { orderId: order.id },
        limit: 1,
      }),
      store.get("parties", order.supplierId),
      order.logisticsId ? store.get("parties", order.logisticsId) : null,
      store
        .list("production_tracks", { filter: { orderId: order.id }, limit: 1 })
        // Tabela ainda não publicada: sem ETD, como pedido sem produção.
        .catch(() => []),
      store.get("requests", order.requestId),
      order.ownerUserId ? store.get("users", order.ownerUserId) : null,
    ]);
  const productIds = [
    ...new Set(
      items.map((i) => i.productId).filter((id): id is string => !!id),
    ),
  ];
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  const productOf = new Map(products.map((p) => [p.id, p]));
  const { describeTerms } = await import("@/components/supplier-terms-text");
  const { translator } = await import("@/i18n");
  const t = translator("en");

  const sorted = [...items].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const rows: OrderSheetItem[] = sorted.map((item, index) => {
    const product = item.productId ? productOf.get(item.productId) : null;
    const variant = item.variant ?? null;
    const priced = doc.items[index];
    const piecesPerMaster =
      variant?.masterBoxQty ??
      sheet?.masterCartonQty ??
      product?.masterBoxQty ??
      null;
    const cbmCarton =
      variant?.cbm ?? sheet?.cbmPerCarton ?? product?.cbm ?? null;
    const netKg =
      variant?.netWeightKg ??
      sheet?.netWeightPcKg ??
      product?.netWeightKg ??
      null;
    const grossKg =
      variant?.grossWeightKg ??
      sheet?.grossWeightPcKg ??
      product?.grossWeightKg ??
      null;
    // Caixas e totais só para quantidade em peças (em outra unidade a conta
    // de caixas não vale).
    const pieces = isPieces(item.unit) ? item.quantity : null;
    const masterCartons =
      pieces !== null && piecesPerMaster
        ? Math.ceil(pieces / piecesPerMaster)
        : null;
    const color =
      clean(variant?.colorAssortment) ??
      clean(sheet?.colorAssortment) ??
      clean(product?.color);
    // Códigos Pantone escolhidos; o que o texto da cor já diz não repete.
    const pantones = (sheet?.colorPantones ?? product?.colorPantones ?? [])
      .map((c) => c.code)
      .filter(
        (code) =>
          !!code && !(color ?? "").toLowerCase().includes(code.toLowerCase()),
      )
      .join(", ");
    const power = sheet?.powerSource ?? null;
    const name = variant ? `${item.name} - ${variant.name}` : item.name;
    const requestText = clean(request?.description);
    return {
      n: index + 1,
      contact:
        [clean(sheet?.supplierStore), clean(sheet?.supplierPhone)]
          .filter(Boolean)
          .join(" · ") || null,
      artwork: null,
      pantone: [color, pantones].filter(Boolean).join(" · ") || null,
      factoryCode:
        clean(variant?.factoryItemCode) ??
        clean(sheet?.factoryItemCode) ??
        clean(product?.supplierSku),
      wellmixCode: clean(product?.sku),
      description: name,
      descriptionPt:
        clean(sheet?.ecommerceDescription) ??
        (requestText && requestText !== item.name ? requestText : null),
      batteries:
        power === null
          ? null
          : power === "battery"
            ? `YES${clean(sheet?.powerDetail) ? ` - ${clean(sheet?.powerDetail)}` : ""}`
            : "NO",
      ncm: clean(sheet?.ncm) ?? clean(product?.ncm),
      packing: clean(variant?.packageType) ?? clean(sheet?.packageType),
      lengthM: cmToM(variant?.lengthCm ?? sheet?.lengthCm ?? product?.lengthCm),
      widthM: cmToM(variant?.widthCm ?? sheet?.widthCm ?? product?.widthCm),
      heightM: cmToM(variant?.heightCm ?? sheet?.heightCm ?? product?.heightCm),
      cbmCarton,
      totalCbm: times(masterCartons, cbmCarton, 4),
      netKg,
      totalNetKg: times(pieces, netKg, 3),
      grossKg,
      totalGrossKg: times(pieces, grossKg, 3),
      piecesPerInner:
        variant?.innerBoxQty ?? sheet?.innerQty ?? product?.innerBoxQty ?? null,
      piecesPerMaster,
      masterCartons,
      quantity: item.quantity,
      unit: item.unit,
      pieces: pieces !== null,
      price: priced?.unitPrice ?? null,
      total: priced?.total ?? null,
      comments: clean(sheet?.notes),
      factory: clean(track?.factoryName),
    };
  });

  const etd = clean(track?.etd)?.slice(0, 10) ?? null;
  const year = (etd ?? order.createdAt).slice(0, 4);
  return {
    header: {
      company: doc.buyerName,
      issuedBy: owner?.name ?? null,
      issuedAt: order.createdAt,
      lot: `${order.number}-${year}`,
      partner: doc.supplierName || supplier?.name || "",
      forwardingAgent: agent
        ? [agent.name, clean(agent.email)].filter(Boolean).join(" · ")
        : null,
      incoterm: doc.incoterm,
      paymentCondition: doc.paymentTerms.length
        ? describeTerms(t, doc.paymentTerms)
        : null,
      etd,
      purchaseOrder: clean(order.erpNumber),
      wellmixNumber: order.number,
      sentToPartnerAt: wellmixSignature?.at ?? null,
    },
    currency: doc.currency,
    items: rows,
    totals: {
      cbm: sumAll(
        rows.map((r) => r.totalCbm),
        4,
      ),
      netKg: sumAll(
        rows.map((r) => r.totalNetKg),
        3,
      ),
      grossKg: sumAll(
        rows.map((r) => r.totalGrossKg),
        3,
      ),
      value: doc.total,
    },
    moq: doc.moq,
    leadTimeDays: doc.leadTimeDays,
    manufacturers: doc.manufacturers ?? [],
  };
}
