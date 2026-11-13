import "server-only";
import { withoutPlaceholder } from "@/lib/placeholder-name";

import { getStore, type Order, type Requirement, type User } from "@/lib/db";
import {
  DOWN_PAYMENT_KEY,
  SKU_APPROVED_KEY,
  LANE_KEYS,
  baseKeyOf,
  blockedBy,
  itemIdOf,
} from "@/lib/purchase-lanes";
import { isPurchaseFlow } from "@/lib/workflow/stages";
import { audit } from "./audit";

/*
 * Itens que o sistema confere sozinho no pedido de compra (mapa do processo,
 * docs/PURCHASE_ORDER.md, "Sequência"). Ninguém marca à mão: cada um conclui
 * quando a área dona faz a parte dela na tela dela, e a etapa só anda depois.
 *
 * - NCM validado (P9/P16): a classificação fiscal validada na tela fiscal do
 *   produto, igual ao NCM do produto.
 * - Ficha mestre completa (P14): nada faltando na ficha do produto (medidas,
 *   pesos, caixa, CBM, Pantone e as fotos obrigatórias).
 * - Certificado (P8): a linha exige certificação e o produto já tem
 *   certificação válida de cada tipo exigido pelo período do pedido; senão o
 *   item fica com a certificadora (renovar, P15).
 * - Sinal ou conta corrente (P12?/P12): depois das duas assinaturas. A
 *   condição de pagamento do pedido sem parcela no marco "pedido gerado" é
 *   conta corrente (nada a pagar antes da produção); com ela, o sinal são
 *   essas parcelas, pagas (pela Wellmix) ou recebidas (confirmadas pelo
 *   fornecedor). Sem condição configurada, o item espera o financeiro.
 */

const DAY = 86_400_000;
const norm = (s: string) => s.trim().toLowerCase();

type Verdict = { done: true; value: string; note: string } | { done: false };

const closed = (order: Order) =>
  order.status === "CLOSED" || order.status === "CANCELLED";

/** NCM validado na tela fiscal e igual ao do produto. */
async function ncmVerdict(productId: string): Promise<Verdict> {
  const store = getStore();
  const product = await store.get("products", productId);
  if (!product?.ncm) return { done: false };
  const rows = await store
    .list("tax_classifications", {
      filter: { productId, status: "validated" },
    })
    .catch(() => []);
  const valid = rows.find((r) => r.ncm === product.ncm);
  return valid
    ? { done: true, value: valid.ncm, note: `NCM ${valid.ncm} validado` }
    : { done: false };
}

/** Ficha mestre do produto sem nada faltando. */
async function sheetVerdict(productId: string): Promise<Verdict> {
  const { productMasterMissing } = await import("./product-sheet");
  const missing = await productMasterMissing(productId);
  return missing && missing.length === 0
    ? { done: true, value: "complete", note: "Ficha mestre completa" }
    : { done: false };
}

/**
 * Certificação do produto válida por todo o período do pedido, para cada
 * tipo que a linha exige. Exporta para a tela e os testes.
 */
export async function certificationCoversHorizon(
  productId: string,
  now = Date.now(),
): Promise<{ covered: boolean; until: string | null; kinds: string[] }> {
  const store = getStore();
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings();
  const product = await store.get("products", productId);
  const line = product
    ? await store.get("product_lines", product.lineId)
    : null;
  const kinds = (line?.requiredCertifications ?? [])
    .map((k) => k.trim())
    .filter(Boolean);
  if (!kinds.length) return { covered: false, until: null, kinds };
  const certs = await store.list("certifications", {
    filter: { entity: "product", entityId: productId, status: "valid" },
  });
  const horizon = now + settings.certificationHorizonDays * DAY;
  let until: string | null = null;
  for (const kind of kinds) {
    const fit = certs.filter(
      (c) =>
        norm(c.kind) === norm(kind) &&
        (!c.validUntil || Date.parse(c.validUntil) >= horizon),
    );
    if (!fit.length) return { covered: false, until: null, kinds };
    for (const c of fit)
      if (c.validUntil && (!until || c.validUntil < until))
        until = c.validUntil;
  }
  return { covered: true, until, kinds };
}

async function certificateVerdict(productId: string): Promise<Verdict> {
  const check = await certificationCoversHorizon(productId);
  if (!check.covered) return { done: false };
  const until = check.until ? ` até ${check.until.slice(0, 10)}` : "";
  return {
    done: true,
    value: "valid",
    note: `Certificação ${check.kinds.join(", ")} válida pelo período do pedido${until}: sem renovação`,
  };
}

/** Sinal pago ou conta corrente, pela condição de pagamento do pedido. */
async function downPaymentVerdict(order: Order): Promise<Verdict> {
  const { orderPayable } = await import("./supplier-terms");
  const { schedule } = await orderPayable(order);
  if (schedule.legacySettled)
    return { done: true, value: "paid", note: "Pago pela etapa antiga" };
  if (!schedule.terms?.length) return { done: false };
  const upfront = schedule.installments.filter(
    (i) => i.base === "order_created",
  );
  if (!upfront.length)
    return {
      done: true,
      value: "current_account",
      note: "Conta corrente com o fornecedor: sem sinal antes da produção",
    };
  const paid = upfront.every(
    (i) => i.status === "paid" || i.status === "received",
  );
  return paid
    ? {
        done: true,
        value: "paid",
        note: `Sinal pago (${upfront.map((i) => `${i.percent}%`).join(" + ")} do FOB)`,
      }
    : { done: false };
}

/** Todos os SKUs do pedido aprovados pela Wellmix na inspeção (última rodada). */
async function skuVerdict(order: Order): Promise<Verdict> {
  const store = getStore();
  const [items, rows] = await Promise.all([
    store.list("order_items", { filter: { orderId: order.id } }),
    store
      .list("sku_inspections", { filter: { orderId: order.id } })
      .catch(() => []),
  ]);
  const { latestByItem } = await import("./production");
  const latest = latestByItem(rows);
  const ok =
    items.length > 0 &&
    items.every((i) => latest.get(i.id)?.result === "approved");
  return ok
    ? {
        done: true,
        value: "approved",
        note: "Todos os SKUs aprovados na inspeção",
      }
    : { done: false };
}

/** Itens automáticos ainda abertos do pedido, já liberados (o anterior feito). */
function openGates(requirements: Requirement[]) {
  const auto = new Set<string>([
    LANE_KEYS.ncmValidated,
    LANE_KEYS.sheetComplete,
    LANE_KEYS.certificate,
    DOWN_PAYMENT_KEY,
    SKU_APPROVED_KEY,
  ]);
  return requirements.filter((r) => {
    if (r.status === "done" || !auto.has(baseKeyOf(r.key))) return false;
    const siblings = requirements.filter((x) => x.stageId === r.stageId);
    return blockedBy(r.key, siblings).length === 0;
  });
}

/**
 * Confere os itens automáticos de um pedido de compra e conclui os que já
 * estão feitos; a etapa anda (e avisa a próxima área) quando todos fecham.
 * Nunca derruba quem chamou: erro vai para o log.
 */
export async function refreshPurchaseGates(
  orderId: string,
  user: User | null = null,
): Promise<number> {
  try {
    return await refresh(orderId, user);
  } catch (error) {
    console.error("refreshPurchaseGates", orderId, error);
    return 0;
  }
}

async function refresh(orderId: string, user: User | null): Promise<number> {
  const store = getStore();
  const order = await store.get("orders", orderId);
  if (!order || !isPurchaseFlow(order) || closed(order)) return 0;
  const [requirements, stages, items] = await Promise.all([
    store.list("requirements", { filter: { orderId } }),
    store.list("stages", { filter: { orderId } }),
    store.list("order_items", { filter: { orderId } }),
  ]);
  const gates = openGates(requirements).filter((r) => {
    const stage = stages.find((s) => s.id === r.stageId);
    return stage?.status === "active" || stage?.status === "blocked";
  });
  if (!gates.length) return 0;
  const touched = new Set<string>();
  let done = 0;
  for (const r of gates) {
    const base = baseKeyOf(r.key);
    let verdict: Verdict;
    if (base === DOWN_PAYMENT_KEY) verdict = await downPaymentVerdict(order);
    else if (base === SKU_APPROVED_KEY) verdict = await skuVerdict(order);
    else {
      const productId = items.find((i) => i.id === itemIdOf(r.key))?.productId;
      if (!productId) continue;
      verdict =
        base === LANE_KEYS.ncmValidated
          ? await ncmVerdict(productId)
          : base === LANE_KEYS.sheetComplete
            ? await sheetVerdict(productId)
            : await certificateVerdict(productId);
    }
    if (!verdict.done) continue;
    await store.update("requirements", r.id, {
      status: "done",
      value: verdict.value,
      note: verdict.note,
      submittedByUserId: user?.id ?? null,
      submittedAt: new Date().toISOString(),
    });
    await audit(
      user,
      "requirement.auto",
      "requirement",
      r.id,
      `${withoutPlaceholder(r.label)}: ${verdict.note}`,
      { status: r.status },
      { status: "done", value: verdict.value },
    );
    touched.add(r.stageId);
    done += 1;
    // O passo seguinte da raia fica sabendo (ex.: certificado → arte final).
    if (base === LANE_KEYS.certificate) {
      const { afterLaneStep } = await import("./purchase-order");
      await afterLaneStep(order, r.key, r.status);
    }
    if (base === DOWN_PAYMENT_KEY) {
      // Produção liberada: o início dela (e os follows) conta de hoje.
      const { applyProductionStart } = await import("./order-signature");
      await applyProductionStart(user, order.id);
      const { notifyProductionReleased } = await import("./purchase-order");
      await notifyProductionReleased(order, verdict.value);
    }
  }
  if (touched.size) {
    const { evaluateStage } = await import("@/lib/workflow/engine");
    for (const stageId of touched) await evaluateStage(user, stageId);
  }
  return done;
}

/** Pedidos de compra abertos com o produto: confere os itens automáticos de cada um. */
export async function refreshGatesForProduct(
  productId: string,
  user: User | null = null,
): Promise<void> {
  try {
    const items = await getStore().list("order_items", {
      filter: { productId },
    });
    for (const orderId of new Set(items.map((i) => i.orderId)))
      await refreshPurchaseGates(orderId, user);
  } catch (error) {
    console.error("refreshGatesForProduct", productId, error);
  }
}

/** Pedidos de compra abertos do fornecedor (a condição de pagamento mudou). */
export async function refreshGatesForSupplier(
  supplierId: string,
  user: User | null = null,
): Promise<void> {
  try {
    const orders = await getStore().list("orders", {
      filter: { supplierId, flow: "supplier_request" },
    });
    for (const o of orders)
      if (!closed(o)) await refreshPurchaseGates(o.id, user);
  } catch (error) {
    console.error("refreshGatesForSupplier", supplierId, error);
  }
}

/** Job diário: todos os pedidos de compra na Preparação ou no contrato. */
export async function refreshAllPurchaseGates(): Promise<number> {
  const orders = await getStore().list("orders", {
    filter: {
      flow: "supplier_request",
      status: ["PREPARATION", "PACKAGING", "INSPECTION"],
    },
  });
  let done = 0;
  for (const o of orders) done += await refreshPurchaseGates(o.id, null);
  return done;
}
