import type { Order, OrderItem } from "@/lib/db";

/**
 * Contrato com o ERP Sankhya para o pedido do portal (docs/SANKHYA.md).
 * Chamado depois das duas assinaturas (docs/ORDER_SIGNATURE.md).
 */
export interface SankhyaAdapter {
  /** Envia o pedido ao ERP. Retorna o número no ERP ou "pending" quando não há integração. */
  createOrder(
    order: Order,
    items: OrderItem[],
  ): Promise<{ status: "synced"; erpNumber: string } | { status: "pending" }>;
}

/** Sem integração: marca ERP_SYNC_PENDING; o operador informa o número manualmente. */
export class MockSankhyaAdapter implements SankhyaAdapter {
  async createOrder() {
    return { status: "pending" as const };
  }
}

/**
 * Integração ligada (Configurações → Processos, "Execução no Sankhya"; fase 3):
 * pedido que já tem nota ligada (cotação/pre-order criadas pelas regras de
 * processo) devolve o número dela; sem nota, inclui o pedido com a TOP de
 * pedido da Integração. Fornecedor e produtos precisam do código do Sankhya;
 * sem ele, fica pendente e o motivo vai para o registro de eventos.
 */
export class LiveSankhyaAdapter implements SankhyaAdapter {
  async createOrder(order: Order) {
    const { getStore } = await import("@/lib/db");
    const { getSankhyaErpSettings } = await import("./sankhya-settings");
    const store = getStore();
    const fresh = (await store.get("orders", order.id)) ?? order;
    const erp = await getSankhyaErpSettings();
    const show = (nunota: string) =>
      erp.erpNumberField === "NUNOTA" ? nunota : (fresh.erpNumber ?? nunota);
    if (fresh.sankhyaCode)
      return { status: "synced" as const, erpNumber: show(fresh.sankhyaCode) };
    const request = await store.get("requests", fresh.requestId);
    if (request?.sankhyaCode) {
      await store.update("orders", fresh.id, {
        sankhyaCode: request.sankhyaCode,
      });
      return {
        status: "synced" as const,
        erpNumber: show(request.sankhyaCode),
      };
    }
    if (!erp.topOrder) return { status: "pending" as const };
    const { buildPortalNote } = await import("./sankhya-orders");
    const built = await buildPortalNote(erp, erp.topOrder, fresh, null);
    if (!built.ok) {
      await store.create("process_events", {
        event: "sync:order:create",
        requestId: fresh.requestId,
        orderId: fresh.id,
        stockAction: "none",
        sankhyaAction: "create_note",
        top: erp.topOrder,
        status: "error",
        detail: `Sankhya: pedido #${fresh.number}: ${built.reason}`,
        nunotaBefore: null,
        nunotaAfter: null,
        createdByUserId: null,
        entity: "order",
        entityId: fresh.id,
      });
      return { status: "pending" as const };
    }
    const { createNote } = await import("./sankhya-client");
    const { nunota } = await createNote(built.note);
    if (!nunota) return { status: "pending" as const };
    await store.update("orders", fresh.id, {
      sankhyaCode: nunota,
      sankhyaSyncedAt: new Date(Date.now() + 10_000).toISOString(),
    });
    return { status: "synced" as const, erpNumber: nunota };
  }
}

/** Real quando a execução no Sankhya está ligada; senão, manual (como antes). */
export function getSankhyaAdapter(): SankhyaAdapter {
  return {
    async createOrder(order) {
      const { getSankhyaErpSettings } = await import("./sankhya-settings");
      const erp = await getSankhyaErpSettings();
      return erp.ordersEnabled
        ? new LiveSankhyaAdapter().createOrder(order)
        : new MockSankhyaAdapter().createOrder();
    },
  };
}
