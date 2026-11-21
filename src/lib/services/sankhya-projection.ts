import "server-only";
import { getStore, type SankhyaProjectionRow, type User } from "@/lib/db";
import { ForbiddenError, isAdmin } from "@/lib/auth/permissions";

/*
 * Ensaio da reconstrução dos pedidos de compra do Sankhya (21/11/2026;
 * docs/SANKHYA_INTEGRACAO.md, seção 9, etapa 3). A tabela
 * `sankhya_projection` é montada no banco por scripts/sankhya-projection.sql a
 * partir da cópia bruta das views (sankhya_stage_rows). Aqui só se lê, para a
 * tela de conferência (Configurações → Sankhya → Pedidos do Sankhya), só o
 * administrador. Nada disso alimenta pedidos, pendências ou regras.
 */

export const PROJECTION_SITUATIONS = [
  "in_progress",
  "awaiting_definition",
  "closed",
  "interrupted",
  "legacy_path",
] as const;
export type ProjectionSituation = (typeof PROJECTION_SITUATIONS)[number];

export interface ProjectionFilters {
  kind?: "order" | "shipment";
  situation?: string | null;
  milestone?: string | null;
  reason?: string | null;
  /** NUNOTA (da ponta ou de qualquer documento da cadeia) ou nome do fornecedor. */
  search?: string | null;
}

export interface ProjectionCounts {
  computedAt: string | null;
  orders: Record<string, number>;
  shipments: Record<string, number>;
  /** Pedidos em andamento por marco. */
  milestones: Record<string, number>;
  /** "Aguardando definição" por motivo. */
  reasons: Record<string, number>;
}

const LIMIT = 100;

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

const bump = (map: Record<string, number>, key: string | null | undefined) => {
  const k = key ?? "—";
  map[k] = (map[k] ?? 0) + 1;
};

/** Quantos pedidos e embarques em cada situação, marco e motivo. */
export async function projectionCounts(user: User): Promise<ProjectionCounts> {
  assertAdmin(user);
  const { listColumns } = await import("@/lib/db/lookup");
  const rows = await listColumns(
    getStore(),
    "sankhya_projection",
    ["kind", "situation", "milestone", "computedAt", "data"],
    { jsonKeys: { data: ["reason"] } },
  );
  const out: ProjectionCounts = {
    computedAt: null,
    orders: {},
    shipments: {},
    milestones: {},
    reasons: {},
  };
  for (const r of rows) {
    if (r.computedAt && (!out.computedAt || r.computedAt > out.computedAt))
      out.computedAt = r.computedAt;
    if (r.kind === "shipment") {
      bump(out.shipments, r.situation);
      continue;
    }
    bump(out.orders, r.situation);
    if (r.situation === "in_progress") bump(out.milestones, r.milestone);
    if (r.situation === "awaiting_definition")
      bump(out.reasons, (r.data as { reason?: string } | null)?.reason);
  }
  return out;
}

const chainHas = (row: SankhyaProjectionRow, text: string) => {
  const chain = (row.data?.chain ?? []) as Array<{ nunota?: unknown }>;
  return chain.some((d) => String(d.nunota ?? "") === text);
};

/** Pedidos ou embarques do ensaio pelos filtros (até 100, os mais novos). */
export async function listProjection(
  user: User,
  filters: ProjectionFilters,
): Promise<{ rows: SankhyaProjectionRow[]; total: number; limited: boolean }> {
  assertAdmin(user);
  const kind = filters.kind ?? "order";
  const filter: Partial<Record<keyof SankhyaProjectionRow, unknown>> = {
    kind,
  };
  if (filters.situation) filter.situation = filters.situation;
  if (filters.milestone) filter.milestone = filters.milestone;
  const search = filters.search?.trim() ?? "";
  let rows = await getStore().list("sankhya_projection", {
    filter: filter as never,
    ...(search && !/^\d+$/.test(search)
      ? { search: { column: "supplierName", text: search } }
      : {}),
  });
  if (/^\d+$/.test(search))
    rows = rows.filter((r) => r.key === search || chainHas(r, search));
  if (filters.reason)
    rows = rows.filter(
      (r) => (r.data as { reason?: string } | null)?.reason === filters.reason,
    );
  rows.sort((a, b) => Number(b.key) - Number(a.key));
  return {
    rows: rows.slice(0, LIMIT),
    total: rows.length,
    limited: rows.length > LIMIT,
  };
}

/** Um pedido ou embarque do ensaio, com os embarques ou pedidos ligados. */
export async function projectionDetail(
  user: User,
  kind: "order" | "shipment",
  key: string,
): Promise<{
  row: SankhyaProjectionRow | null;
  related: SankhyaProjectionRow[];
}> {
  assertAdmin(user);
  const store = getStore();
  const row = await store.get("sankhya_projection", `${kind}:${key}`);
  if (!row) return { row: null, related: [] };
  const ids =
    kind === "order"
      ? ((row.data?.shipments ?? []) as unknown[]).map(
          (n) => `shipment:${String(n)}`,
        )
      : [
          ...new Set(
            // Pedido por track (21/11/2026): o track do documento de origem.
            (
              (row.data?.orders ?? []) as Array<{
                order?: unknown;
                track?: unknown;
              }>
            ).map((o) => `order:${String(o.track ?? o.order)}`),
          ),
        ];
  const related = ids.length
    ? await store.list("sankhya_projection", { filter: { id: ids } as never })
    : [];
  return { row, related };
}
