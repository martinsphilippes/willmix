import "server-only";

import { getStore, type QuoteStatus, type User } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";

/*
 * Lista de cotações: o fornecedor vê só as dele (para responder, enviadas,
 * escolhidas e não escolhidas), e sempre consegue voltar a uma cotação já
 * enviada. A Wellmix vê todas, com o fornecedor. Os demais papéis não têm
 * cotações.
 */

export interface QuoteRow {
  id: string;
  status: QuoteStatus;
  productName: string;
  requestNumber: number | null;
  quantity: number;
  unit: string;
  price: number | null;
  currency: string | null;
  leadTimeDays: number | null;
  validUntil: string | null;
  answeredAt: string | null;
  createdAt: string;
  /** Só para a Wellmix (o fornecedor já sabe quem é). */
  supplierName: string | null;
  /** Solicitação cancelada ou excluída: a cotação fica entre as não escolhidas. */
  requestCancelled: boolean;
}

/** Ordem da lista: para responder (pelo prazo), enviadas, escolhidas, não escolhidas. */
const ORDER: Record<QuoteStatus, number> = {
  invited: 0,
  answered: 1,
  selected: 2,
  rejected: 3,
};

export async function quotesForUser(user: User): Promise<QuoteRow[]> {
  const wellmix = isWellmix(user);
  if (!wellmix && (user.role !== "supplier" || !user.partyId)) return [];
  const store = getStore();
  const quotes = await store.list(
    "quotes",
    wellmix ? {} : { filter: { supplierId: user.partyId! } },
  );
  if (!quotes.length) return [];
  const requestIds = [...new Set(quotes.map((q) => q.requestId))];
  const supplierIds = wellmix
    ? [...new Set(quotes.map((q) => q.supplierId))]
    : [];
  const [requests, suppliers] = await Promise.all([
    store.list("requests", { filter: { id: requestIds } }),
    supplierIds.length
      ? store.list("parties", { filter: { id: supplierIds } })
      : Promise.resolve([]),
  ]);
  const rows: QuoteRow[] = [];
  for (const quote of quotes) {
    const request = requests.find((r) => r.id === quote.requestId);
    if (!request) continue;
    const requestCancelled = request.status === "CANCELLED";
    rows.push({
      id: quote.id,
      // Solicitação cancelada/excluída: nenhuma cotação dela vira pedido.
      status: requestCancelled ? "rejected" : quote.status,
      productName: request.productName,
      requestNumber: request.number ?? null,
      quantity: request.quantity,
      unit: request.unit,
      price: quote.price,
      currency: quote.currency,
      leadTimeDays: quote.leadTimeDays,
      validUntil: quote.validUntil,
      answeredAt: quote.answeredAt,
      createdAt: quote.createdAt,
      supplierName: wellmix
        ? (suppliers.find((p) => p.id === quote.supplierId)?.name ?? null)
        : null,
      requestCancelled,
    });
  }
  const time = (v: string | null) => (v ? Date.parse(v) : NaN);
  return rows.sort((a, b) => {
    if (ORDER[a.status] !== ORDER[b.status])
      return ORDER[a.status] - ORDER[b.status];
    if (a.status === "invited") {
      // Prazo mais perto primeiro; sem prazo por último.
      const da = time(a.validUntil);
      const db = time(b.validUntil);
      if (Number.isNaN(da) !== Number.isNaN(db))
        return Number.isNaN(da) ? 1 : -1;
      if (da !== db && !Number.isNaN(da)) return da - db;
    }
    // As mais recentes primeiro.
    const ra = time(a.answeredAt ?? a.createdAt);
    const rb = time(b.answeredAt ?? b.createdAt);
    return (Number.isNaN(rb) ? 0 : rb) - (Number.isNaN(ra) ? 0 : ra);
  });
}
