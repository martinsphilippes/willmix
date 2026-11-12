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
  "art_issues",
  "receivings",
]);
/** Campos do parceiro que entram no resumo (nome e condição de pagamento do fornecedor). */
const PARTY_FIELDS = ["name", "paymentTerms"];

const pending = { orders: new Set<string>(), parties: new Set<string>() };
let scheduled = false;
let chain: Promise<void> = Promise.resolve();

/** A remoção precisa ler a linha antes (para saber o pedido)? */
export const removalNeedsRow = (table: TableName) => ORDER_TABLES.has(table);

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
  } else return;
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
    while (pending.orders.size || pending.parties.size) {
      const changes = {
        orders: [...pending.orders],
        parties: [...pending.parties],
      };
      pending.orders.clear();
      pending.parties.clear();
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
  return { orders: [...pending.orders], parties: [...pending.parties] };
}
