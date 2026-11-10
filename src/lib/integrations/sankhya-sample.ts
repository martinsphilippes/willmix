import "server-only";
import { getStore } from "@/lib/db";
import { executeQuery, type SankhyaRow } from "./sankhya-client";
import {
  ENTITY_MAPS,
  SANKHYA_ENTITIES,
  convert,
  mapRow,
  missingColumns,
  sampleSql,
  type MappedValue,
  type SankhyaEntityKey,
} from "./sankhya-mapping";

/*
 * Amostra da carga do Sankhya (aba Carga do Sankhya; só leitura nos dois
 * lados): as últimas N notas de importação e, a partir delas, os parceiros,
 * itens, produtos, grupos, estoque e financeiro. Para cada registro, o valor
 * que iria para o portal e se já existe um cadastro equivalente no portal.
 */

export interface PortalMatch {
  id: string;
  label: string;
  href: string;
}

export interface SampleRecord {
  key: string;
  raw: SankhyaRow;
  mapped: MappedValue[];
  match: PortalMatch | null;
}

export interface EntitySample {
  entity: SankhyaEntityKey;
  sql: string;
  /** Colunas do mapeamento que o ERP não tem (o SQL foi refeito com *). */
  missing: string[];
  /** Colunas que o ERP devolveu (para corrigir o mapeamento). */
  columns: string[];
  records: SampleRecord[];
  error: string | null;
}

const errorText = (error: unknown) => {
  const e = error as { code?: string; detail?: string; message?: string };
  return `${e.code ?? "error"}: ${e.detail ?? e.message ?? String(error)}`;
};

/** Roda o SQL do mapeamento; se faltar coluna, refaz com * para mostrar o que existe. */
export async function fetchEntity(
  entity: SankhyaEntityKey,
  ids: Array<number | string | null | undefined>,
) {
  const sql = sampleSql(entity, ids);
  try {
    const table = await executeQuery(sql);
    return { sql, table, missing: [] as string[], error: null };
  } catch (first) {
    const star = sampleSql(entity, ids, true);
    try {
      const table = await executeQuery(star);
      return {
        sql: star,
        table,
        missing: missingColumns(entity, table.columns),
        error: errorText(first),
      };
    } catch {
      return { sql, table: null, missing: [], error: errorText(first) };
    }
  }
}

const keyOf = (entity: SankhyaEntityKey, row: SankhyaRow) =>
  ENTITY_MAPS[entity].key_
    .split(",")
    .map((k) => String(row[k.trim()] ?? ""))
    .join(" / ");

const firstN = <T>(list: T[], n: number) => list.slice(0, n);

const distinct = (rows: SankhyaRow[], column: string, n: number) =>
  firstN(
    [...new Set(rows.map((r) => r[column]).filter((v) => v != null))],
    n,
  ) as Array<string | number>;

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

/** Cadastro equivalente já existente no portal (para não duplicar na carga). */
async function portalMatches(entity: SankhyaEntityKey, rows: SankhyaRow[]) {
  const store = getStore();
  const out = new Map<SankhyaRow, PortalMatch | null>();
  if (entity === "partners") {
    const parties = await store.list("parties");
    for (const row of rows) {
      const tax = String(convert("digits", row.CGC_CPF, row) ?? "");
      const name = norm(row.NOMEPARC);
      const hit = parties.find(
        (p) =>
          (tax && (p.taxId ?? "").replace(/\D/g, "") === tax) ||
          (name && norm(p.name) === name),
      );
      out.set(
        row,
        hit
          ? {
              id: hit.id,
              label: `${hit.name} (${hit.type})`,
              href:
                hit.type === "customer"
                  ? `/app/customers/${hit.id}`
                  : `/app/suppliers/${hit.id}`,
            }
          : null,
      );
    }
  } else if (entity === "products") {
    const skus = rows
      .map((r) => String(r.REFFORN ?? "").trim())
      .filter(Boolean);
    const products = skus.length
      ? await store.list("products", { filter: { sku: skus } })
      : [];
    for (const row of rows) {
      const sku = String(row.REFFORN ?? "")
        .trim()
        .toUpperCase();
      const hit = products.find((p) => (p.sku ?? "").toUpperCase() === sku);
      out.set(
        row,
        hit
          ? {
              id: hit.id,
              label: `${hit.sku} ${hit.name}`,
              href: `/app/products/${hit.id}`,
            }
          : null,
      );
    }
  } else if (entity === "productGroups") {
    const lines = await store.list("product_lines");
    for (const row of rows) {
      const hit = lines.find((l) => norm(l.name) === norm(row.DESCRGRUPOPROD));
      out.set(
        row,
        hit ? { id: hit.id, label: hit.name, href: `/app/lines` } : null,
      );
    }
  } else if (entity === "orders") {
    const numbers = rows.map((r) => String(r.NUNOTA ?? "")).filter(Boolean);
    const orders = numbers.length
      ? await store.list("orders", { filter: { erpNumber: numbers } })
      : [];
    for (const row of rows) {
      const hit = orders.find((o) => o.erpNumber === String(row.NUNOTA));
      out.set(
        row,
        hit
          ? {
              id: hit.id,
              label: `#${hit.number}`,
              href: `/app/orders/${hit.id}`,
            }
          : null,
      );
    }
  }
  return out;
}

async function build(
  entity: SankhyaEntityKey,
  fetched: Awaited<ReturnType<typeof fetchEntity>>,
  n: number,
): Promise<EntitySample> {
  const rows = firstN(fetched.table?.rows ?? [], n);
  const matches = await portalMatches(entity, rows).catch(
    () => new Map<SankhyaRow, PortalMatch | null>(),
  );
  return {
    entity,
    sql: fetched.sql,
    missing: fetched.missing,
    columns: fetched.table?.columns ?? [],
    error: fetched.table
      ? fetched.missing.length
        ? fetched.error
        : null
      : fetched.error,
    records: rows.map((row) => ({
      key: keyOf(entity, row),
      raw: row,
      mapped: mapRow(entity, row),
      match: matches.get(row) ?? null,
    })),
  };
}

/** Amostra coerente de 1 a 5 registros por entidade. */
export async function loadSankhyaSample(size: number): Promise<EntitySample[]> {
  const n = Math.min(5, Math.max(1, Math.trunc(size) || 1));
  const orders = await fetchEntity("orders", []);
  const orderRows = firstN(orders.table?.rows ?? [], n);
  const nunotas = orderRows.map((r) => r.NUNOTA as number);

  const [partners, items, financial] = await Promise.all([
    fetchEntity("partners", distinct(orderRows, "CODPARC", n)),
    fetchEntity("orderItems", nunotas),
    fetchEntity("financial", nunotas),
  ]);
  const itemRows = firstN(items.table?.rows ?? [], n);
  const products = await fetchEntity(
    "products",
    distinct(itemRows, "CODPROD", n),
  );
  const productRows = firstN(products.table?.rows ?? [], n);
  const [groups, stock] = await Promise.all([
    fetchEntity("productGroups", distinct(productRows, "CODGRUPOPROD", n)),
    fetchEntity(
      "stock",
      productRows.map((r) => r.CODPROD as number),
    ),
  ]);

  const byEntity: Record<
    SankhyaEntityKey,
    Awaited<ReturnType<typeof fetchEntity>>
  > = {
    orders,
    partners,
    orderItems: items,
    products,
    productGroups: groups,
    stock,
    financial,
  };
  return Promise.all(
    SANKHYA_ENTITIES.map((entity) => build(entity, byEntity[entity], n)),
  );
}

/**
 * Conjunto completo para gravar a amostra no portal: as N últimas notas e
 * todos os itens, produtos, grupos, parceiros, empresas e títulos delas.
 */
export async function fetchImportSet(size: number) {
  const n = Math.min(5, Math.max(1, Math.trunc(size) || 1));
  const orders = await fetchEntity("orders", []);
  if (!orders.table) throw new Error(orders.error ?? "sankhya_orders");
  const orderRows = firstN(orders.table.rows, n);
  const nunotas = orderRows.map((r) => r.NUNOTA as number);
  const all = (rows: SankhyaRow[], column: string) =>
    distinct(rows, column, Number.MAX_SAFE_INTEGER);
  const [partners, items, financial, companies] = await Promise.all([
    fetchEntity("partners", all(orderRows, "CODPARC")),
    fetchEntity("orderItems", nunotas),
    fetchEntity("financial", nunotas),
    executeQuery(
      `SELECT CODEMP, NOMEFANTASIA FROM TSIEMP WHERE CODEMP IN (${
        all(orderRows, "CODEMP")
          .map(Number)
          .filter(Number.isInteger)
          .join(", ") || "-1"
      })`,
    ).catch(() => null),
  ]);
  const itemRows = items.table?.rows ?? [];
  const products = await fetchEntity("products", all(itemRows, "CODPROD"));
  const productRows = products.table?.rows ?? [];
  const groups = await fetchEntity(
    "productGroups",
    all(productRows, "CODGRUPOPROD"),
  );
  return {
    orders: orderRows,
    partners: partners.table?.rows ?? [],
    items: itemRows,
    products: productRows,
    groups: groups.table?.rows ?? [],
    financial: financial.table?.rows ?? [],
    companies: companies?.rows ?? [],
  };
}

export type ImportSet = Awaited<ReturnType<typeof fetchImportSet>>;
