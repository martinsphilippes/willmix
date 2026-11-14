import "server-only";

import {
  nameOfLabel,
  realName,
  withoutPlaceholder,
} from "@/lib/placeholder-name";
import { buildPurchaseRounds } from "@/lib/purchase-rounds";
import { assertCan } from "@/lib/auth/function-access";

import { assertWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  ORDER_EXTRA_DEFAULTS,
  REQUEST_EXTRA_DEFAULTS,
  type Order,
  type Party,
  type Product,
  type Requirement,
  type SupplierRequest,
  type User,
} from "@/lib/db";
import {
  LANE_KEYS,
  baseKeyOf,
  blockedBy,
  itemIdOf,
  laneKey,
  laneOf,
  type LaneSla,
} from "@/lib/purchase-lanes";
import {
  ROLE_PARTY_FIELD,
  artRole,
  isPurchaseFlow,
} from "@/lib/workflow/stages";
import { samplingApproved } from "@/lib/supplier-request-sampling";
import { audit } from "./audit";

/*
 * Pedido de compra (docs/PURCHASE_ORDER.md). Depois da solicitação ao
 * fornecedor aprovada e do produto vencedor cadastrado, a Wellmix junta num
 * pedido os produtos aprovados do mesmo fornecedor. O comprador é a própria
 * Wellmix (CODEMP do Sankhya, a WELLMIX - SC). O pedido nasce com o fluxo "supplier_request":
 * "Pedido criado" conclui na hora e a Preparação traz as três raias em
 * paralelo (fornecedor, agência de arte, certificadora); depois, o contrato
 * assinado e carimbado pelas duas partes.
 */

export class PurchaseOrderError extends Error {}

/** Produtos por pedido (cada um ganha os itens das três raias). */
export const PURCHASE_ORDER_MAX_ITEMS = 30;

export interface PurchaseCandidate {
  request: SupplierRequest;
  product: Product;
}

export interface PurchaseCandidateGroup {
  supplier: Party | null;
  supplierId: string;
  candidates: PurchaseCandidate[];
}

/**
 * Solicitações aprovadas com produto cadastrado e ainda fora de pedido,
 * agrupadas por fornecedor. `null`: tabelas sem publicar.
 */
export async function listPurchaseCandidates(
  user: User,
): Promise<PurchaseCandidateGroup[] | null> {
  assertWellmix(user);
  assertScreen(user, "orders");
  const store = getStore();
  let rows: SupplierRequest[];
  try {
    rows = await store.list("supplier_requests", {
      filter: { status: "approved" },
    });
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  // Só com a amostra aprovada (docs/SUPPLIER_SAMPLING.md).
  const open = rows.filter(
    (r) => r.productId && !r.orderId && samplingApproved(r),
  );
  if (!open.length) return [];
  const productIds = [...new Set(open.map((r) => r.productId!))];
  const supplierIds = [...new Set(open.map((r) => r.supplierId))];
  const [products, parties] = await Promise.all([
    store.list("products", { filter: { id: productIds } }),
    store.list("parties", { filter: { id: supplierIds } }),
  ]);
  const groups = new Map<string, PurchaseCandidateGroup>();
  for (const request of [...open].sort((a, b) => a.number - b.number)) {
    const product = products.find((p) => p.id === request.productId);
    if (!product) continue;
    const group = groups.get(request.supplierId) ?? {
      supplierId: request.supplierId,
      supplier: parties.find((p) => p.id === request.supplierId) ?? null,
      candidates: [],
    };
    group.candidates.push({ request, product });
    groups.set(request.supplierId, group);
  }
  return [...groups.values()].sort((a, b) =>
    (a.supplier?.name ?? "").localeCompare(b.supplier?.name ?? "", "pt"),
  );
}

/**
 * O comprador (cliente do pedido): a própria Wellmix, a empresa que emite o
 * pedido de compra no Sankhya (CODEMP, hoje 3: WELLMIX - SC). É o cadastro
 * de cliente com esse código do Sankhya. Clientes terceiros só virão com a
 * vitrine.
 */
export async function purchaseOrderCustomer(): Promise<Party | null> {
  const { getSankhyaErpSettings } =
    await import("@/lib/integrations/sankhya-settings");
  const codEmp = (await getSankhyaErpSettings()).codEmp ?? 3;
  const rows = await getStore().list("parties", {
    filter: { type: "customer", sankhyaCode: String(codEmp) },
  });
  return (
    rows
      .filter((p) => p.active)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null
  );
}

export interface PurchaseOrderLine {
  requestId: string;
  /** Peças; vazio = a quantidade da solicitação. */
  quantity: number | null;
}

/**
 * Gera o pedido de compra com os produtos aprovados de um fornecedor. Preço,
 * moeda, MOQ e prazo vêm da resposta negociada; todos na mesma moeda.
 */
export async function createPurchaseOrder(
  user: User,
  lines: PurchaseOrderLine[],
): Promise<Order> {
  assertWellmix(user);
  assertScreen(user, "orders");
  assertCan(user, "purchaseOrder.generate");
  if (!lines.length)
    throw new PurchaseOrderError("purchase_order_choose_items");
  if (lines.length > PURCHASE_ORDER_MAX_ITEMS)
    throw new PurchaseOrderError("purchase_order_too_many");
  const store = getStore();
  const ids = [...new Set(lines.map((l) => l.requestId))];
  const requests = await store.list("supplier_requests", {
    filter: { id: ids },
  });
  if (requests.length !== ids.length) throw new PurchaseOrderError("not_found");
  for (const r of requests) {
    if (r.status !== "approved" || !r.productId)
      throw new PurchaseOrderError("purchase_order_not_ready");
    if (!samplingApproved(r))
      throw new PurchaseOrderError("purchase_order_sampling_pending");
    if (r.orderId) throw new PurchaseOrderError("purchase_order_taken");
  }
  const supplierId = requests[0].supplierId;
  if (requests.some((r) => r.supplierId !== supplierId))
    throw new PurchaseOrderError("purchase_order_one_supplier");
  const currency = requests[0].supplierCurrency ?? requests[0].item.currency;
  if (
    requests.some(
      (r) => (r.supplierCurrency ?? r.item.currency) !== currency,
    ) ||
    !currency
  )
    throw new PurchaseOrderError("purchase_order_currency_mixed");
  const customer = await purchaseOrderCustomer();
  if (!customer)
    throw new PurchaseOrderError("purchase_order_customer_missing");
  const products = await store.list("products", {
    filter: { id: requests.map((r) => r.productId!) },
  });

  const ordered = ids.map((id) => {
    const request = requests.find((r) => r.id === id)!;
    const product = products.find((p) => p.id === request.productId)!;
    // Com programação de compra, o total é a soma das rodadas (não se ajusta aqui).
    const asked = request.schedule?.items.length
      ? null
      : (lines.find((l) => l.requestId === id)?.quantity ?? null);
    const quantity = Math.round(asked ?? request.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9)
      throw new PurchaseOrderError("purchase_order_qty_invalid");
    const unitPrice = request.supplierPrice ?? request.item.price ?? null;
    return { request, product, quantity, unitPrice };
  });
  if (ordered.some((o) => !o.product))
    throw new PurchaseOrderError("purchase_order_not_ready");
  // Programação de compra (docs/PURCHASE_SCHEDULE.md): o pedido vira o pai e
  // cada rodada nasce como pedido filho no dia combinado.
  const planned = buildPurchaseRounds(
    ordered.map((o) => ({
      productId: o.product.id,
      schedule: o.request.schedule ?? null,
    })),
  );
  if ("error" in planned) throw new PurchaseOrderError(planned.error);
  const rounds = planned.rounds;
  const fobTotal = ordered.every((o) => o.unitPrice !== null)
    ? ordered.reduce((sum, o) => sum + o.unitPrice! * o.quantity, 0)
    : null;
  const first = ordered[0];
  const summary = ordered
    .map((o) =>
      // Produto ainda sem nome real: só o número da solicitação.
      withoutPlaceholder(`nº ${o.request.number} (${o.product.name})`),
    )
    .join(", ");

  // A solicitação do pedido (o pedido sempre tem uma): já nasce "pedido".
  const backing = await store.create("requests", {
    ...REQUEST_EXTRA_DEFAULTS,
    customerId: customer.id,
    createdByUserId: user.id,
    productId: first.product.id,
    productName: first.product.name,
    description: `Pedido de compra das solicitações ao fornecedor ${summary}`,
    specification: null,
    quantity: first.quantity,
    unit: "pcs",
    deadline: null,
    status: "ORDERED",
    orderId: null,
    sellPrice: null,
    sellCurrency: null,
    downPaymentAmount: null,
    notes: null,
    origin: "supplier_request",
    ownerUserId: user.id,
  });
  const order = await store.create("orders", {
    ...ORDER_EXTRA_DEFAULTS,
    number: await store.nextNumber("order_number"),
    requestId: backing.id,
    customerId: customer.id,
    supplierId,
    lineId: first.product.lineId ?? null,
    status: "ORDER_CREATED",
    currentStageId: null,
    fobTotal,
    fobCurrency: currency,
    sellPrice: null,
    sellCurrency: null,
    erpSyncStatus: "pending",
    erpNumber: null,
    agencyId: null,
    brokerId: null,
    shippingLineId: null,
    carrierId: null,
    closedAt: null,
    notes: null,
    ownerUserId: user.id,
    flow: "supplier_request",
    ...(rounds ? { purchaseRounds: rounds } : {}),
  });
  await store.update("requests", backing.id, { orderId: order.id });
  for (const o of ordered)
    await store.create("order_items", {
      orderId: order.id,
      productId: o.product.id,
      name: o.product.name,
      quantity: o.quantity,
      unit: "pcs",
      unitPrice: o.unitPrice,
    });
  for (const o of ordered)
    await store.update("supplier_requests", o.request.id, {
      orderId: order.id,
    });
  const { snapshotOrderPaymentTerms } = await import("./supplier-terms");
  await snapshotOrderPaymentTerms(order);
  const { assignDefaultPartners } = await import("./requests");
  await assignDefaultPartners(order);
  // Compra EXW quando algum produto é EXW (mapa R17?; dono, 14/11/2026).
  await syncPurchaseIncoterm(order.id);
  await audit(
    user,
    "order.create_purchase",
    "order",
    order.id,
    `Pedido de compra #${order.number}: ${ordered.length} produto(s) de ${supplierId}, ${summary}${rounds ? `; pedido pai de ${rounds.length} rodadas (${rounds.map((r) => r.expectedAt).join(", ")})` : ""}`,
  );
  const { createStagesForOrder } = await import("@/lib/workflow/engine");
  const fresh = (await store.get("orders", order.id)) ?? order;
  await createStagesForOrder(fresh);
  await notifySalesOfPurchase(fresh);
  return (await store.get("orders", order.id)) ?? fresh;
}

/* ------------------------------------------------------------------------ */
/* Avisos das raias                                                          */
/* ------------------------------------------------------------------------ */

type Target =
  | { role: "admin" | "operator" | ("admin" | "operator")[] }
  | { role: Requirement["role"]; partyId: string };

/** Quem age num requisito: o parceiro do pedido ou, sem ele, a Wellmix. */
function targetOf(order: Order, role: Requirement["role"]): Target {
  const field = ROLE_PARTY_FIELD[role];
  const partyId = field ? order[field] : null;
  if (role === "operator" || role === "admin" || !partyId)
    return { role: ["admin", "operator"] };
  return { role, partyId };
}

async function send(
  order: Order,
  role: Requirement["role"],
  subjectKey: string,
  bodyKey: string,
  vars: Record<string, string | number>,
) {
  const { notify } = await import("./notifications");
  await notify(targetOf(order, role) as Parameters<typeof notify>[0], {
    kind: "action",
    link: `/app/orders/${order.id}`,
    text: (t) => {
      // Produto sem nome real: o aviso diz isso, em vez de ficar em branco.
      const values = {
        n: order.number,
        ...vars,
        ...("product" in vars && !vars.product
          ? { product: t("productName.unnamed") }
          : {}),
        ...("products" in vars && !vars.products
          ? { products: t("productName.unnamed") }
          : {}),
      };
      return {
        subject: t(subjectKey as never, values),
        body: t(bodyKey as never, values),
      };
    },
  }).catch((error) => console.error("notify(purchase_order)", error));
}

/**
 * As raias abrem juntas: fornecedor, cadastro e fiscal (Wellmix) e, com a
 * linha exigindo certificação, a certificadora. A agência é avisada quando a
 * faca e a foto em alta chegam (a arte espera por elas).
 */
export async function notifyLanesOpen(
  order: Order,
  pending: Array<Pick<Requirement, "key" | "role" | "status">>,
): Promise<void> {
  const byLane = new Map<string, Requirement["role"]>();
  for (const r of pending) {
    const lane = laneOf(r.key);
    if (lane === "art" && baseKeyOf(r.key) !== LANE_KEYS.art) continue;
    // Só o que já está liberado (a arte espera a faca).
    if (blockedBy(r.key, pending).length) continue;
    // Cadastro e fiscal: avisado depois da conferência automática (só o que falta).
    if (lane === "registration") continue;
    if (!byLane.has(lane)) byLane.set(lane, r.role);
  }
  for (const [lane, role] of byLane)
    await send(
      order,
      role,
      `purchaseOrder.notify.lane.${lane}.subject`,
      `purchaseOrder.notify.lane.${lane}.body`,
      {},
    );
}

/**
 * Depois de um passo da raia: arte enviada → a Wellmix valida; arte validada
 * e certificado na mão → quem faz a arte faz a arte final com o selo.
 */
export async function afterLaneStep(
  order: Order,
  key: string,
  /** Status do item antes do envio (o Die Cut só avisa na primeira vez). */
  statusBefore?: Requirement["status"],
): Promise<void> {
  const item = itemIdOf(key);
  if (!item) return;
  const base = baseKeyOf(key);
  const store = getStore();
  // Die Cut: com os quatro itens do produto feitos, a Wellmix é avisada.
  if (laneOf(key) === "supplier") {
    const { afterDieCutItem } = await import("./die-cut-step");
    await afterDieCutItem(order, key, statusBefore);
    // Faca e foto em alta na mão: quem faz a arte começa (P4 → P5).
    if (
      statusBefore !== "done" &&
      (base === LANE_KEYS.dieCut || base === LANE_KEYS.hdPhoto)
    ) {
      const all = await store.list("requirements", {
        filter: { orderId: order.id },
      });
      const artKey = laneKey(LANE_KEYS.art, item);
      const art = all.find((r) => r.key === artKey);
      if (art && art.status !== "done" && !blockedBy(artKey, all).length)
        await send(
          order,
          art.role,
          "purchaseSequence.notify.artUnlocked.subject",
          "purchaseSequence.notify.artUnlocked.body",
          { product: productOf(art) },
        );
    }
    return;
  }
  const requirements = await store.list("requirements", {
    filter: { orderId: order.id },
  });
  const named = requirements.find((r) => r.key === key);
  const product = named ? productOf(named) : "";
  if (base === LANE_KEYS.art) {
    await send(
      order,
      "operator",
      "purchaseOrder.notify.review.subject",
      "purchaseOrder.notify.review.body",
      { product },
    );
    return;
  }
  if (base === LANE_KEYS.artReview || base === LANE_KEYS.certificate) {
    const finalKey = laneKey(LANE_KEYS.artFinal, item);
    const final = requirements.find((r) => r.key === finalKey);
    if (!final || final.status === "done") return;
    if (blockedBy(finalKey, requirements).length) return;
    await send(
      order,
      final.role,
      "purchaseOrder.notify.final.subject",
      "purchaseOrder.notify.final.body",
      { product },
    );
  }
}

/**
 * O produto do rótulo do item da raia ("Arte · Copo" → "Copo"); vazio sem
 * produto ou com o nome de exemplo ("Produto novo XPTO").
 */
const productOf = (r: Pick<Requirement, "label">) => nameOfLabel(r.label);

/**
 * Pedido de compra gerado (P2 → V1): o comercial fica sabendo do que vem, com
 * os produtos e as quantidades. Vai para quem tem a ação "Receber o aviso de
 * pedido de compra" (Equipe → Funções e acessos; padrão: quem abre Pós-venda).
 */
export async function notifySalesOfPurchase(order: Order): Promise<void> {
  try {
    const store = getStore();
    const [users, items] = await Promise.all([
      store.list("users", {
        filter: { role: ["admin", "operator"], active: true },
      }),
      store.list("order_items", { filter: { orderId: order.id } }),
    ]);
    const { holdersOf } = await import("@/lib/auth/function-access");
    const { loadFunctionDefs } = await import("./team-functions");
    const holders = holdersOf(
      users,
      "purchaseOrder.salesNotice",
      await loadFunctionDefs(),
    );
    // Ninguém com a ação: os administradores ficam sabendo (como no recebimento).
    const sales = holders.length
      ? holders
      : users.filter((u) => u.role === "admin");
    if (!sales.length) return;
    const { notify } = await import("./notifications");
    await notify(
      { userIds: sales.map((u) => u.id) },
      {
        kind: "info",
        link: `/app/orders/${order.id}`,
        text: (t) => ({
          subject: t("purchaseSequence.notify.sales.subject", {
            n: order.number,
          }),
          body: t("purchaseSequence.notify.sales.body", {
            // Nome de exemplo ("Produto novo XPTO") vira "Produto sem nome".
            items: items
              .map(
                (i) =>
                  `${realName(i.name) ?? t("productName.unnamed")} (${i.quantity} ${i.unit})`,
              )
              .join(", "),
          }),
        }),
      },
    );
  } catch (error) {
    console.error("notify(purchase_order_sales)", error);
  }
}

/**
 * Contrato assinado pelas duas partes: o financeiro confere o sinal (ou a
 * conta corrente) para liberar a produção (P11 → P12?).
 */
export async function notifyDownPaymentDue(order: Order): Promise<void> {
  await send(
    order,
    "operator",
    "purchaseSequence.notify.downPayment.subject",
    "purchaseSequence.notify.downPayment.body",
    {},
  );
}

/**
 * Cadastro e fiscal: o que a conferência automática não fechou (NCM sem
 * validação, ficha incompleta) vira aviso à Wellmix, com os produtos.
 */
export async function notifyRegistrationOpen(order: Order): Promise<void> {
  const requirements = await getStore().list("requirements", {
    filter: { orderId: order.id },
  });
  const open = requirements.filter(
    (r) => laneOf(r.key) === "registration" && r.status !== "done",
  );
  if (!open.length) return;
  const products = [...new Set(open.map(productOf))].filter(Boolean).join(", ");
  await send(
    order,
    "operator",
    "purchaseSequence.notify.registration.subject",
    "purchaseSequence.notify.registration.body",
    { products },
  );
}

/** Sinal pago ou conta corrente: o fornecedor pode começar a produção (P12 → R1). */
export async function notifyProductionReleased(
  order: Order,
  how: string,
): Promise<void> {
  await send(
    order,
    "supplier",
    "purchaseSequence.notify.production.subject",
    how === "current_account"
      ? "purchaseSequence.notify.production.bodyAccount"
      : "purchaseSequence.notify.production.body",
    {},
  );
}

/** Prazos de cada passo do pedido de compra (Configurações → SLA). */
export async function purchaseLaneSla(): Promise<LaneSla> {
  const { getSettings } = await import("@/lib/settings");
  const s = await getSettings();
  return {
    artDays: s.purchaseArtSlaDays,
    reviewDays: s.purchaseArtReviewSlaDays,
    dieCutDays: s.purchaseDieCutSlaDays,
    certDays: s.purchaseCertSlaDays,
    finalDays: s.purchaseArtFinalSlaDays,
    registrationDays: s.purchaseRegistrationSlaDays,
    signatureDays: s.purchaseSignatureSlaDays,
    downPaymentDays: s.purchaseDownPaymentSlaDays,
    inspectionMediaDays: s.purchaseInspectionMediaSlaDays,
    inspectionReviewDays: s.purchaseInspectionReviewSlaDays,
  };
}

/**
 * Parceiro designado ou trocado depois (Parceiros do pedido): os itens das
 * raias ainda abertos passam para quem faz agora. O certificado vai para a
 * certificadora; a arte e a arte final com o selo, para a agência quando é
 * ela quem faz a arte. Sem o parceiro, voltam para a Wellmix. O que já foi
 * feito fica como está (o histórico de quem fez não muda) e nada é criado de
 * novo: a pendência aberta só troca de dono.
 */
export async function syncLaneRoles(user: User, order: Order): Promise<number> {
  if (!isPurchaseFlow(order)) return 0;
  const store = getStore();
  const { getSettings } = await import("@/lib/settings");
  const art = artRole(order, (await getSettings()).agencyValidationEnabled);
  // Certificado: do despachante (dono, 13/11/2026); sem ele, da Wellmix.
  const ocp = order.brokerId ? "broker" : "operator";
  const open = (
    await store.list("requirements", { filter: { orderId: order.id } })
  ).filter((r) => r.status !== "done");
  let moved = 0;
  for (const r of open) {
    const base = baseKeyOf(r.key);
    const role =
      base === LANE_KEYS.certificate
        ? ocp
        : base === LANE_KEYS.art || base === LANE_KEYS.artFinal
          ? art
          : null;
    if (!role || r.role === role) continue;
    await store.update("requirements", r.id, { role });
    moved++;
  }
  if (moved)
    await audit(
      user,
      "order.lanes_reassigned",
      "order",
      order.id,
      `Raias do pedido de compra: ${moved} item(ns) aberto(s) da arte e do certificado com o novo responsável`,
    );
  return moved;
}

/**
 * Incoterm do pedido de compra pelo dos produtos (ficha mestre de cada um):
 * EXW se algum é EXW, FOB se algum é FOB; sem incoterm nos produtos, fica
 * como está. Decisão do dono (14/11/2026): a Wellmix pode trocar no pedido.
 */
export async function incotermFromProducts(
  orderId: string,
): Promise<"EXW" | "FOB" | null> {
  const store = getStore();
  const items = await store.list("order_items", { filter: { orderId } });
  const ids = [
    ...new Set(items.map((i) => i.productId).filter(Boolean)),
  ] as string[];
  if (!ids.length) return null;
  const sheets = await store
    .list("purchase_sheets", { filter: { orderId: ids } })
    .catch(() => []);
  const terms = sheets
    .filter((s) => s.productId && s.orderId === s.productId)
    .map((s) => s.incoterm);
  if (terms.includes("EXW")) return "EXW";
  if (terms.includes("FOB")) return "FOB";
  return null;
}

export async function syncPurchaseIncoterm(orderId: string) {
  const incoterm = await incotermFromProducts(orderId);
  if (!incoterm) return;
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (order && order.incoterm !== incoterm)
    await store.update("orders", orderId, { incoterm });
}

/** A Wellmix troca o incoterm do pedido de compra (FOB ou EXW). */
export async function setPurchaseIncoterm(
  user: User,
  orderId: string,
  incoterm: "EXW" | "FOB",
) {
  assertWellmix(user);
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || order.flow !== "supplier_request") throw new Error("not_found");
  if (order.incoterm === incoterm) return;
  await store.update("orders", orderId, { incoterm });
  await audit(
    user,
    "order.incoterm",
    "order",
    orderId,
    `Incoterm do pedido #${order.number}: ${order.incoterm ?? "—"} → ${incoterm}`,
  );
}
