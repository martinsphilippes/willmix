import { after } from "next/server";
import type { TableName } from "./schema";

/*
 * Atualização por evento dos resumos dos pedidos (docs/RESUMOS.md). Toda
 * gravação passa pelo CachedStore, que avisa aqui; o pedido afetado fica
 * marcado e o resumo dele é recalculado depois da resposta (`after`) ou, se
 * a mesma instância ler os resumos antes disso, logo antes da leitura (a
 * tela que abre depois de uma ação já vem certa).
 *
 * Fora de uma requisição (testes, scripts) `after` não existe: as marcas
 * ficam para a próxima leitura dos resumos.
 */

/** Tabelas com `orderId` que entram no resumo do pedido. */
const ORDER_TABLES = new Set<TableName>([
  "stages",
  "requirements",
  "order_items",
  "payments",
  "import_steps",
  "production_tracks",
  "sku_inspections",
  "shipping_docs",
  "real_media",
  "showroom_receipts",
  "art_issues",
  "receivings",
  // Multas: quadrado de multa e exceção do pedido.
  "penalties",
]);
/**
 * Tabelas pequenas que entram nos indicadores sem ser de pedido (bookings,
 * solicitações ao fornecedor e do cliente, certificações, containers,
 * configurações): só refazem o agregado (src/lib/services/tower-kpis.ts).
 */
const KPI_TABLES = new Set<TableName>([
  "booking_lots",
  // Convites de book concorrente (Cotações do Overview do Produto novo).
  "booking_invites",
  "supplier_requests",
  "requests",
  "certifications",
  "containers",
  "container_items",
  "settings",
]);
/**
 * Tabelas que mudam a situação dos marcos fora do motor das etapas (fase 5c,
 * docs/MILESTONES.md): passos do embarque, da certificação, das amostras e
 * da origem, o acompanhamento da produção e o recebimento no CD. A gravação
 * pede a sincronização dos marcos do pedido (`queueMilestoneSync`), para
 * `order_milestones` acompanhar o que as telas mostram.
 */
const MILESTONE_TABLES = new Set<TableName>([
  "import_steps",
  "production_tracks",
  "receivings",
]);
/** Campos do parceiro que entram no resumo (nome e condição de pagamento do fornecedor). */
const PARTY_FIELDS = ["name", "paymentTerms"];

const pending = {
  orders: new Set<string>(),
  parties: new Set<string>(),
  kpi: false,
  /** Marco com prazo gravado (fase 5c): refaz o "no prazo" do SLA. */
  sla: false,
  /** Pedidos cujos marcos mudaram fora do motor (MILESTONE_TABLES). */
  milestones: new Set<string>(),
};
let scheduled = false;
let chain: Promise<void> = Promise.resolve();

/** A remoção precisa ler a linha antes (para saber o pedido)? */
export const removalNeedsRow = (table: TableName) =>
  ORDER_TABLES.has(table) || table === "review_items";

/**
 * Uma gravação: `row` é a linha gravada (ou a lida antes de apagar), `patch`
 * o que mudou numa atualização.
 */
export function noteWrite(
  table: TableName,
  id: string,
  row: object | null,
  patch?: object,
) {
  if (table === "orders") pending.orders.add(id);
  else if (table === "parties") {
    // Parceiro novo não tem pedido; só nome e condição mudam o resumo.
    if (!patch || !PARTY_FIELDS.some((f) => f in patch)) return;
    pending.parties.add(id);
  } else if (ORDER_TABLES.has(table)) {
    const orderId = (row as { orderId?: unknown } | null)?.orderId;
    if (typeof orderId !== "string" || !orderId) return;
    pending.orders.add(orderId);
    if (MILESTONE_TABLES.has(table)) pending.milestones.add(orderId);
    // O "no prazo" do SLA sai dos marcos desde a fase 5c: a conclusão da
    // etapa sincroniza os marcos, e a gravação deles marca o SLA
    // (`noteMilestoneWrite`).
  } else if (table === "review_items") {
    // Revisão: do pedido dela (orderId ou, nos antigos, a entidade "order").
    const r = row as {
      orderId?: string | null;
      entity?: string;
      entityId?: string;
    } | null;
    const orderId = r?.orderId ?? (r?.entity === "order" ? r.entityId : null);
    if (orderId) pending.orders.add(orderId);
    pending.kpi = true;
  } else if (table === "sales_orders") {
    // Frete da ordem de venda: entra no custo do pedido de compra ligado
    // (docs/SALES_ORDERS.md).
    const orderId = (row as { purchaseOrderId?: unknown } | null)
      ?.purchaseOrderId;
    if (typeof orderId !== "string" || !orderId) return;
    pending.orders.add(orderId);
  } else if (KPI_TABLES.has(table)) pending.kpi = true;
  else return;
  schedule();
}

/**
 * Marcos do pedido gravados (fase 5c, `syncMilestones`): o resumo do pedido
 * lê o prazo gravado; `sla`: uma linha com prazo mudou (o "no prazo" do
 * painel de SLA sai dos marcos concluídos).
 */
export function noteMilestoneWrite(orderId: string, sla: boolean) {
  pending.orders.add(orderId);
  if (sla) pending.sla = true;
  schedule();
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  try {
    after(() => flushSummaryChanges());
  } catch {
    // Fora de uma requisição: fica para a próxima leitura dos resumos.
    scheduled = false;
  }
}

/**
 * Recalcula o que está marcado. Chamadas ao mesmo tempo entram em fila: quem
 * espera vê também o que a anterior recalculou.
 */
export function flushSummaryChanges(): Promise<void> {
  scheduled = false;
  chain = chain.then(async () => {
    // Fase 5c: os marcos pedidos nesta requisição são gravados antes do
    // resumo (o resumo lê o prazo gravado em `order_milestones`).
    try {
      const { flushMilestoneSync, queueMilestoneSync, queuedMilestoneSyncs } =
        await import("@/lib/services/order-milestones");
      const changed = [...pending.milestones];
      pending.milestones.clear();
      for (const id of changed) queueMilestoneSync(id);
      if (queuedMilestoneSyncs().length) await flushMilestoneSync();
    } catch (error) {
      console.error("[milestones] sincronização antes do resumo falhou", error);
    }
    if (pending.sla) {
      pending.sla = false;
      try {
        const { rebuildSlaDone } = await import("@/lib/services/sla-panel");
        await rebuildSlaDone();
      } catch (error) {
        console.error("[sla] indicador por evento falhou", error);
      }
    }
    while (pending.orders.size || pending.parties.size || pending.kpi) {
      const changes = {
        orders: [...pending.orders],
        parties: [...pending.parties],
        kpi: pending.kpi,
      };
      pending.orders.clear();
      pending.parties.clear();
      pending.kpi = false;
      try {
        const { applySummaryChanges } =
          await import("@/lib/services/order-summary");
        await applySummaryChanges(changes);
      } catch (error) {
        // O job noturno reconstrói tudo; a tela não cai por isso.
        console.error("[order-summary] recálculo por evento falhou", error);
      }
    }
  });
  return chain;
}

/** Para testes: o que está marcado. */
export function pendingSummaryChanges() {
  return {
    orders: [...pending.orders],
    parties: [...pending.parties],
    kpi: pending.kpi,
    sla: pending.sla,
    milestones: [...pending.milestones],
  };
}
