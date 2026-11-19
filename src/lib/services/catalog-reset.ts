import "server-only";

import {
  getStore,
  TABLES,
  type Party,
  type TableName,
  type User,
} from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { RESET_CONFIRM_WORD, countSalesRows } from "./data-reset";
import { cols, countRows } from "./reset-query";
import { STOCK_PARTY_ID } from "./stock-party";

/*
 * Limpar os cadastros que vêm do Sankhya (antes da migração; docs/SANKHYA.md):
 * fornecedores, clientes e transportadoras (parceiros), produtos, linhas de
 * produto, condições de pagamento e locais de estoque. Depois disso a carga
 * completa traz tudo de novo do Sankhya, que passa a ser a fonte.
 *
 * Só roda com as vendas já apagadas (Limpar dados de teste), para nada de
 * venda ficar apontando para um cadastro apagado. Fica: usuários (ativos e
 * ligados), o parceiro de quem tem usuário (a carga o liga ao Sankhya pelo
 * CNPJ ou nome), parceiros dos outros tipos (agência, despachante, armador,
 * jurídico, comex, logística, certificadora), o cliente "Estoque Wellmix" e
 * as configurações.
 *
 * O que fica e apontava para um cadastro apagado: coluna obrigatória → a
 * linha sai junto (ex.: variação do produto, fornecedor do produto);
 * opcional → só perde a ligação (ex.: item de sourcing, foto de documento).
 *
 * Pode rodar de novo: se parar no limite de tempo, continua de onde parou.
 */

/** Tipos de parceiro que o Sankhya tem (TGFPAR). */
const SANKHYA_PARTY_TYPES = new Set<Party["type"]>([
  "supplier",
  "customer",
  "carrier",
]);

type Target = "products" | "product_lines" | "parties" | "payment_conditions";

/** Coluna de ligação → cadastro apagado a que ela aponta. */
const REF_COLUMNS: Record<string, Target> = {
  productId: "products",
  lineId: "product_lines",
  supplierId: "parties",
  customerId: "parties",
  partyId: "parties",
  carrierId: "parties",
  responsiblePartyId: "parties",
  importerId: "parties",
  agencyId: "parties",
  brokerId: "parties",
  shippingLineId: "parties",
  paymentConditionId: "payment_conditions",
};

/** Cadastros apagados, nesta ordem (o que aponta antes do apontado). */
const TARGETS: TableName[] = [
  "products",
  "product_lines",
  "payment_conditions",
  "stock_locations",
  "parties",
];

/** Configurações da carga do Sankhya: recomeçam do zero. */
const LOAD_KEYS = [
  "sankhya.load.paymentConditions",
  "sankhya.load.partners",
  "sankhya.load.products",
  "sankhya.load.stockLocations",
  "sankhya.load.stockBalances",
  "sankhya.load.orders",
];

export interface CatalogResetPlan {
  /** Vendas ainda no portal: limpar antes (Limpar dados de teste). */
  salesLeft: number;
  remove: Partial<Record<TableName, number>>;
  unlink: number;
  /** Fornecedores/clientes mantidos porque têm usuário ligado. */
  partiesKept: number;
  total: number;
}

interface Work {
  plan: CatalogResetPlan;
  deletes: Array<{ table: TableName; id: string }>;
  updates: Array<{
    table: TableName;
    id: string;
    patch: Record<string, unknown>;
  }>;
}

/** Colunas de ligação de cada tabela (as que apontam para um cadastro). */
function refColumns(table: TableName) {
  return Object.entries(TABLES[table].columns).filter(([c]) => REF_COLUMNS[c]);
}

/**
 * Calcula o que sai. Com vendas no portal a limpeza não roda: a prévia só
 * conta os cadastros (sem ler as tabelas que apontam para eles, que com o
 * Sankhya passam de 700 mil linhas). Sem vendas, lê só as colunas de ligação.
 */
async function buildWork(): Promise<Work> {
  const salesLeft = await countSalesRows();
  if (salesLeft > 0) {
    const remove: CatalogResetPlan["remove"] = {};
    for (const t of TARGETS) {
      const n = await countRows(t);
      if (n) remove[t] = n;
    }
    return {
      plan: {
        salesLeft,
        remove,
        unlink: 0,
        partiesKept: 0,
        total: Object.values(remove).reduce((s, n) => s + (n ?? 0), 0),
      },
      deletes: [],
      updates: [],
    };
  }
  // Parceiro com usuário ligado fica (o login continua funcionando).
  const withUsers = new Set(
    (await cols("users", ["partyId", "importerId"]))
      .flatMap((u) => [u.partyId, u.importerId])
      .filter((v): v is string => typeof v === "string" && !!v),
  );
  let partiesKept = 0;
  const idsOf = async (t: TableName) =>
    new Set((await cols(t, [])).map((r) => r.id));
  const ids: Record<Target, Set<string>> = {
    products: await idsOf("products"),
    product_lines: await idsOf("product_lines"),
    payment_conditions: await idsOf("payment_conditions"),
    parties: new Set(
      (await cols("parties", ["type"]))
        .filter(
          (p) =>
            p.id !== STOCK_PARTY_ID &&
            SANKHYA_PARTY_TYPES.has(p.type as Party["type"]),
        )
        .filter((p) => {
          if (!withUsers.has(p.id)) return true;
          partiesKept++;
          return false;
        })
        .map((p) => p.id),
    ),
  };
  const locations = (await cols("stock_locations", [])).map((r) => r.id);
  const deletes: Work["deletes"] = [];
  const updates: Work["updates"] = [];
  const doomed = new Set<string>();

  for (const table of Object.keys(TABLES) as TableName[]) {
    if (TARGETS.includes(table)) continue;
    const refs = refColumns(table);
    if (!refs.length) continue;
    const rows = await cols(
      table,
      refs.map(([c]) => c),
    );
    for (const row of rows) {
      const hits = refs.filter(([c]) => {
        const v = row[c];
        return typeof v === "string" && ids[REF_COLUMNS[c]].has(v);
      });
      if (!hits.length) continue;
      const required = hits.some(([, def]) => def.required);
      // Foto de produto sem o produto não serve para nada.
      if (required || (table === "product_photos" && row.productId)) {
        deletes.push({ table, id: row.id });
        doomed.add(`${table}:${row.id}`);
        continue;
      }
      const patch: Record<string, unknown> = Object.fromEntries(
        hits.map(([c]) => [c, null]),
      );
      updates.push({ table, id: row.id, patch });
    }
  }
  for (const target of TARGETS) {
    const list =
      target === "stock_locations" ? locations : [...ids[target as Target]];
    for (const id of list) deletes.push({ table: target, id });
  }
  const remove: CatalogResetPlan["remove"] = {};
  for (const d of deletes) remove[d.table] = (remove[d.table] ?? 0) + 1;
  return {
    plan: {
      salesLeft,
      remove,
      unlink: updates.length,
      partiesKept,
      total: deletes.length + updates.length,
    },
    deletes,
    updates: updates.filter((u) => !doomed.has(`${u.table}:${u.id}`)),
  };
}

export async function planCatalogReset(user: User): Promise<CatalogResetPlan> {
  if (!isAdmin(user)) throw new Error("forbidden");
  return (await buildWork()).plan;
}

export const CATALOG_RESET_BUDGET_MS = 120_000;

/** Apaga os cadastros do Sankhya. Só admin, com a palavra, sem vendas. */
export async function resetCatalogData(
  user: User,
  confirm: string,
  { budgetMs = CATALOG_RESET_BUDGET_MS }: { budgetMs?: number } = {},
): Promise<CatalogResetPlan & { finished: boolean }> {
  if (!isAdmin(user)) throw new Error("forbidden");
  if (confirm.trim().toUpperCase() !== RESET_CONFIRM_WORD)
    throw new Error("reset_confirm");
  const work = await buildWork();
  if (work.plan.salesLeft > 0) throw new Error("sales_first");
  const store = getStore();
  const deadline = Date.now() + budgetMs;
  const tolerant = async (
    table: TableName,
    id: string,
    fn: () => Promise<unknown>,
  ) => {
    try {
      await fn();
    } catch (error) {
      if (await store.get(table, id)) throw error;
    }
  };
  const done = { unlinked: 0, deleted: 0 };
  let finished = true;
  for (const u of work.updates) {
    if (Date.now() > deadline) {
      finished = false;
      break;
    }
    await tolerant(u.table, u.id, () =>
      store.update(u.table, u.id, u.patch as never),
    );
    done.unlinked++;
  }
  // Dependentes primeiro; os cadastros por último, na ordem de TARGETS.
  const rank = (t: TableName) =>
    TARGETS.includes(t) ? 1 + TARGETS.indexOf(t) : 0;
  const deletes = [...work.deletes].sort(
    (a, b) => rank(a.table) - rank(b.table),
  );
  for (const d of finished ? deletes : []) {
    if (Date.now() > deadline) {
      finished = false;
      break;
    }
    await tolerant(d.table, d.id, () => store.remove(d.table, d.id));
    done.deleted++;
  }
  if (finished) {
    const settings = await cols("settings", ["key"], {
      filter: { key: LOAD_KEYS },
    });
    for (const s of settings)
      await tolerant("settings", s.id, () => store.remove("settings", s.id));
  }
  await audit(
    user,
    "data.reset",
    "system",
    "catalog",
    finished
      ? `Limpeza dos cadastros do Sankhya: ${done.deleted} registros apagados, ${done.unlinked} desligados, ${work.plan.partiesKept} parceiro(s) com usuário mantido(s)`
      : `Limpeza dos cadastros do Sankhya parou no limite de tempo: ${done.deleted} de ${work.deletes.length} apagados; continua na próxima rodada`,
    null,
    { planned: work.plan, ...done, finished },
  );
  return { ...work.plan, finished };
}
