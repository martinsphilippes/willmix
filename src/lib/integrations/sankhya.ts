import type { Order, OrderItem } from "@/lib/db";

/**
 * Contrato mínimo com o ERP Sankhya. Não inventa endpoints.
 * EXTERNAL DEPENDENCY PENDING: documentação e credenciais da API do Sankhya.
 */
export interface SankhyaAdapter {
  /** Envia o pedido ao ERP. Retorna o número no ERP ou "pending" quando não há integração. */
  createOrder(order: Order, items: OrderItem[]): Promise<{ status: "synced"; erpNumber: string } | { status: "pending" }>;
}

/** Sem integração: marca ERP_SYNC_PENDING; o operador informa o número manualmente. */
export class MockSankhyaAdapter implements SankhyaAdapter {
  async createOrder() {
    return { status: "pending" as const };
  }
}

export function getSankhyaAdapter(): SankhyaAdapter {
  return new MockSankhyaAdapter();
}
