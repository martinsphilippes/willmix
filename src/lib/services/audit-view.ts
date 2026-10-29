import "server-only";

import { getStore, type AuditEntry, type User } from "@/lib/db";
import { isAdmin, isWellmix } from "@/lib/auth/permissions";

/*
 * Tela de auditoria (Fase G, docs/DASHBOARDS.md): quem fez o quê, quando, em
 * qual pedido/solicitação, com o antes e o depois. Só admin e diretorias
 * (compras e executiva). A camada de dados filtra só por igualdade: busca as
 * entradas mais recentes (até o teto) e filtra o resto em memória.
 */

/** Teto de entradas lidas por consulta. */
export const AUDIT_SCAN_LIMIT = 3000;
export const AUDIT_PAGE = 100;

export function canSeeAudit(user: User): boolean {
  if (isAdmin(user)) return true;
  if (!isWellmix(user)) return false;
  const fns = user.functions ?? [];
  return (
    fns.includes("purchasing_director") || fns.includes("executive_director")
  );
}

/** Módulos (prefixo da ação) para o filtro. */
export const AUDIT_MODULES = [
  "request",
  "quote",
  "approval",
  "order",
  "payment",
  "document",
  "dumping",
  "production",
  "import",
  "receiving",
  "artwork",
  "team",
  "settings",
] as const;
export type AuditModule = (typeof AUDIT_MODULES)[number];

export interface AuditQuery {
  from?: string | null;
  to?: string | null;
  module?: AuditModule | null;
  userId?: string | null;
  orderNumber?: number | null;
  text?: string | null;
  page?: number;
}

export interface AuditResult {
  rows: AuditEntry[];
  total: number;
  /** A busca chegou ao teto: entradas mais antigas não entraram. */
  capped: boolean;
  page: number;
  pages: number;
}

export async function searchAudit(
  user: User,
  q: AuditQuery,
): Promise<AuditResult> {
  if (!canSeeAudit(user)) throw new Error("forbidden");
  const store = getStore();
  // Pedido pelo número: as entradas do pedido e da solicitação dele.
  let entityIds: string[] | null = null;
  if (q.orderNumber) {
    const [order] = await store.list("orders", {
      filter: { number: q.orderNumber },
      limit: 1,
    });
    entityIds = order ? [order.id, order.requestId] : [];
    if (!entityIds.length)
      return { rows: [], total: 0, capped: false, page: 1, pages: 1 };
  }
  const scanned = await store.list("audit_log", {
    filter: {
      ...(q.userId ? { userId: q.userId } : {}),
      ...(entityIds ? { entityId: entityIds } : {}),
    },
    orderBy: "createdAt",
    direction: "desc",
    limit: AUDIT_SCAN_LIMIT,
  });
  const from = q.from ? `${q.from}T00:00:00` : null;
  const to = q.to ? `${q.to}T23:59:59.999` : null;
  const text = q.text?.trim().toLowerCase() || null;
  const rows = scanned.filter((e) => {
    if (from && e.createdAt < from) return false;
    if (to && e.createdAt > to) return false;
    if (q.module && !e.action.startsWith(q.module)) return false;
    if (
      text &&
      !e.summary.toLowerCase().includes(text) &&
      !e.action.toLowerCase().includes(text)
    )
      return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(rows.length / AUDIT_PAGE));
  const page = Math.min(Math.max(1, q.page ?? 1), pages);
  return {
    rows: rows.slice((page - 1) * AUDIT_PAGE, page * AUDIT_PAGE),
    total: rows.length,
    capped: scanned.length >= AUDIT_SCAN_LIMIT,
    page,
    pages,
  };
}

/** Link da entrada (pedido/solicitação/cotação), quando houver tela. */
export function auditLink(e: Pick<AuditEntry, "entity" | "entityId">) {
  switch (e.entity) {
    case "order":
      return `/app/orders/${e.entityId}`;
    case "request":
      return `/app/requests/${e.entityId}`;
    case "quote":
      return `/app/quotes/${e.entityId}`;
    case "product":
      return `/app/products/${e.entityId}`;
    case "party":
      return `/app/parties/${e.entityId}`;
    default:
      return null;
  }
}
