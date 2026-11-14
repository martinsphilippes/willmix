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
  isRoutedLaneKey,
  laneOf,
  type LaneSla,
} from "@/lib/purchase-lanes";
import { ROLE_PARTY_FIELD, isPurchaseFlow } from "@/lib/workflow/stages";
import { samplingApproved } from "@/lib/supplier-request-sampling";
import { audit } from "./audit";
import type { NotifyTarget } from "./notifications";

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

/**
 * Arte, validação, certificado e arte final: o aviso vai para quem recebe a
 * tarefa (o designer, quem valida, a certificadora; cert-art-routing.ts).
 */
async function laneTarget(
  order: Order,
  key: string,
  siblings: ReadonlyArray<Pick<Requirement, "key" | "submittedByUserId">> = [],
): Promise<NotifyTarget | null> {
  const { laneRoute, loadRoutingContext, notifyTargetOf } =
    await import("./cert-art-routing");
  const route = laneRoute(key, order, await loadRoutingContext(), siblings);
  return route ? notifyTargetOf(route) : null;
}

async function send(
  order: Order,
  /** O papel de quem age (o parceiro do pedido ou a Wellmix) ou o destino exato. */
  who: Requirement["role"] | NotifyTarget,
  subjectKey: string,
  bodyKey: string,
  vars: Record<string, string | number>,
) {
  const { notify } = await import("./notifications");
  const target = typeof who === "string" ? targetOf(order, who) : who;
  await notify(target as Parameters<typeof notify>[0], {
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
  for (const [lane, role] of byLane) {
    // Arte e certificado: o login que recebe (o designer, a certificadora).
    const first = pending.find(
      (r) => laneOf(r.key) === lane && isRoutedLaneKey(r.key),
    );
    const target = first ? await laneTarget(order, first.key) : null;
    await send(
      order,
      target ?? role,
      `purchaseOrder.notify.lane.${lane}.subject`,
      `purchaseOrder.notify.lane.${lane}.body`,
      {},
    );
  }
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
          (await laneTarget(order, artKey, all)) ?? art.role,
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
      (await laneTarget(
        order,
        laneKey(LANE_KEYS.artReview, item),
        requirements,
      )) ?? "operator",
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
      (await laneTarget(order, finalKey, requirements)) ?? final.role,
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
 * Papel gravado nas tarefas abertas da arte, da validação e do certificado,
 * coerente com quem as recebe (`laneRoleFor`, src/lib/services/
 * cert-art-routing.ts): ao trocar o designer, a agência ou a certificadora,
 * e na correção dos pedidos abertos. Só atualiza no lugar (sem duplicar);
 * o que já foi feito não muda.
 */
export async function syncLaneRoles(
  user: User | null,
  order: Order,
): Promise<number> {
  if (!isPurchaseFlow(order)) return 0;
  const store = getStore();
  const { isRoutedLaneKey, laneRoleFor, loadRoutingContext } =
    await import("./cert-art-routing");
  const ctx = await loadRoutingContext();
  const open = (
    await store.list("requirements", { filter: { orderId: order.id } })
  ).filter((r) => r.status !== "done" && isRoutedLaneKey(r.key));
  let moved = 0;
  for (const r of open) {
    const role = laneRoleFor(r.key, order, ctx);
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
      `Raias do pedido de compra: ${moved} item(ns) aberto(s) da arte, da validação e do certificado com o novo responsável`,
    );
  return moved;
}

/** Última passada geral sem nada a ajustar (nesta instância do servidor). */
let lanesQuietSince = 0;
const LANES_QUIET_MS = 10 * 60_000;

/**
 * Pedidos de compra abertos com o papel gravado das tarefas de arte e
 * certificado diferente de quem as recebe (antes de 14/11/2026 tudo ficava
 * com a Wellmix): um pedido (página do pedido) ou todos os abertos
 * (Pendências, a cada 10 minutos; job diário com `force`). Nunca derruba a
 * tela: falha vai para o log.
 */
export async function normalizeLaneRoles(
  orderId?: string,
  opts: { force?: boolean } = {},
): Promise<number> {
  if (!orderId && !opts.force && Date.now() - lanesQuietSince < LANES_QUIET_MS)
    return 0;
  try {
    const store = getStore();
    const orders = orderId
      ? [await store.get("orders", orderId)].filter((o): o is Order => !!o)
      : await store.list("orders", {
          // As raias ficam na Preparação; o contrato vem logo depois.
          filter: {
            flow: "supplier_request",
            status: ["ORDER_CREATED", "PREPARATION", "PACKAGING"],
          },
        });
    let changed = 0;
    for (const order of orders) {
      if (!isPurchaseFlow(order)) continue;
      if (order.status === "CLOSED" || order.status === "CANCELLED") continue;
      changed += await syncLaneRoles(null, order);
    }
    if (!orderId) lanesQuietSince = changed === 0 ? Date.now() : 0;
    return changed;
  } catch (error) {
    console.error("[purchase-order] papéis das raias não ajustados", error);
    return 0;
  }
}
