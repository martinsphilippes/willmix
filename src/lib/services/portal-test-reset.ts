import "server-only";

import { getStore, TABLES, type TableName, type User } from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { cols, colsWhereIn, wholeTable, type Row } from "./reset-query";
import { audit } from "./audit";
import { RESET_CONFIRM_WORD } from "./data-reset";

/*
 * Apagar os testes do portal, sem tocar no que veio do Sankhya (12/11/2026;
 * docs/SANKHYA.md "Limpar os testes do portal"). Serve para refazer os testes
 * e, no roll-out, para zerar o que foi criado na fase de testes.
 *
 * Sai tudo o que só nasce no portal:
 * - bookings (lotes, itens, convites), solicitações ao fornecedor,
 *   agrupamentos da seleção, carrinho e chat (conversas, assuntos, mensagens);
 * - produtos, pedidos e solicitações sem código do Sankhya (a solicitação de
 *   um pedido do Sankhya fica, mesmo sem código);
 * - o que depende deles: coluna obrigatória → sai junto; opcional → só perde a
 *   ligação. Documentos e fotos desses registros saem com o arquivo;
 * - avisos, histórico (auditoria) e confirmações de leitura dos registros
 *   apagados; a numeração de bookings, convites, solicitações ao fornecedor
 *   e solicitações (encomendas; decisão do dono de 19/11/2026) recomeça do 1.
 *
 * Nada lê uma tabela grande inteira (19/11/2026, memória da Vercel): raízes
 * por filtro no banco, dependentes e histórico pelos ids delas, em pedaços.
 *
 * Fica: tudo com código do Sankhya (pedidos, itens, títulos, produtos,
 * parceiros, linhas, condições, locais, saldos), usuários e parceiros (os
 * parceiros sem código têm usuário), configurações e a carga do Sankhya.
 * Nunca apaga linha com `sankhyaCode`: se uma delas aponta para algo apagado,
 * só perde a ligação.
 *
 * Só o administrador, com a palavra. Pode rodar de novo: se parar no limite de
 * tempo, continua de onde parou (documento sem ligação e sem ninguém apontando
 * para ele também sai).
 */

/** Tabelas que só têm dados criados no portal: saem inteiras. */
const PORTAL_ONLY: TableName[] = [
  "message_reads",
  "messages",
  "conversation_topics",
  "conversations",
  "cart_items",
  "request_drafts",
  "form_drafts",
  // Atendimentos ao cliente (carteira; docs/TRADE_COMERCIAL.md).
  "customer_attendances",
  "trade_activities",
  "booking_invites",
  "selection_groups",
  "supplier_requests",
  "booking_items",
  "booking_lots",
];

/** Coluna de ligação → tabelas a que ela pode apontar. */
const REFS: Record<string, TableName[]> = {
  productId: ["products"],
  // A ficha mestre de compra usa orderId = id do produto.
  orderId: ["orders", "products"],
  sourceOrderId: ["orders"],
  requestId: ["requests"],
  lotId: ["booking_lots"],
  bookingLotId: ["booking_lots"],
  bookingItemId: ["booking_items"],
  chosenItemId: ["booking_items"],
  supplierRequestId: ["supplier_requests"],
  conversationId: ["conversations"],
  conversationTopicId: ["conversation_topics"],
  messageId: ["messages"],
  orderItemId: ["order_items"],
  stageId: ["stages"],
  requirementId: ["requirements"],
  containerId: ["containers"],
  countId: ["stock_counts"],
  countItemId: ["stock_count_items"],
  variantId: ["product_variants"],
};

/** Ligações de documentos (sem nenhuma, o documento está solto). */
const DOC_LINKS = [
  "orderId",
  "requestId",
  "requirementId",
  "productId",
  "sourcingItemId",
  "kitId",
  "conversationTopicId",
  "supplierRequestId",
] as const;

/** Contadores que recomeçam do 1 (só do que é do portal). */
const COUNTERS = [
  "booking_lot_number",
  "booking_invite_number",
  "supplier_request_number",
  // Decisão do dono (19/11/2026): a numeração das solicitações também
  // recomeça do 1 depois de limpar os testes.
  "request_number",
];

/** Tabelas de histórico: saem as linhas dos registros apagados. */
const TRAIL: TableName[] = ["audit_log", "acknowledgements", "notifications"];

/** Entidades do histórico que só existem no portal. */
const PORTAL_ENTITIES = new Set([
  "booking_lot",
  "booking_item",
  "booking_invite",
  "supplier_request",
  "selection_group",
  "cart_item",
  "conversation",
  "message",
]);

export interface PortalResetPlan {
  remove: Partial<Record<TableName, number>>;
  /** Registros que ficam e só perdem a ligação. */
  unlink: number;
  /** Arquivos apagados do armazenamento (com os documentos). */
  files: number;
  total: number;
}

interface Work {
  plan: PortalResetPlan;
  deletes: Array<{ table: TableName; id: string }>;
  updates: Array<{ table: TableName; id: string; patch: Row | object }>;
  files: Map<string, string>;
  counterIds: string[];
}

const hasSankhyaCode = (row: Row) =>
  typeof row.sankhyaCode === "string" && row.sankhyaCode !== "";

/** Colunas do documento que as regras usam. */
const DOC_COLUMNS = [...DOC_LINKS, "storageKey", "previousDocumentId"];

/** Sem código do Sankhya: nulo ou vazio (dois filtros no banco). */
const NO_CODE = [{ sankhyaCode: null }, { sankhyaCode: "" }] as const;

async function withoutCode(table: TableName, columns: string[]) {
  const out: Row[] = [];
  for (const filter of NO_CODE)
    out.push(...(await cols(table, columns, { filter: { ...filter } })));
  return out;
}

/*
 * Nada aqui lê uma tabela grande inteira (19/11/2026: a tela e a ação
 * estouravam a memória da Vercel com ~16 mil pedidos e o histórico). As
 * raízes saem de filtros no banco (sem `sankhyaCode`, tabelas só do portal),
 * os dependentes e o histórico são buscados pelos ids delas, em pedaços, e
 * só nas colunas que as regras usam.
 */
async function buildWork(): Promise<Work> {
  const doomed = new Map<TableName, Set<string>>();
  const mark = (table: TableName, id: string) => {
    let set = doomed.get(table);
    if (!set) doomed.set(table, (set = new Set()));
    if (set.has(id)) return false;
    set.add(id);
    return true;
  };
  const isDoomed = (table: TableName, id: string) =>
    !!doomed.get(table)?.has(id);
  const doomedIds = (table: TableName) => [...(doomed.get(table) ?? [])];
  const patches = new Map<
    string,
    { table: TableName; id: string; patch: Row }
  >();

  // 1. Raízes: o que só nasce no portal.
  for (const table of PORTAL_ONLY)
    for (const row of await cols(table, [])) mark(table, row.id);
  for (const p of await withoutCode("products", [])) mark("products", p.id);
  for (const o of await withoutCode("orders", [])) mark("orders", o.id);
  // Solicitação sem código fica se é de um pedido do Sankhya (o pedido aponta
  // para ela, ou ela para o pedido).
  const requests = await withoutCode("requests", ["orderId"]);
  const sankhyaOrders = (
    await colsWhereIn(
      "orders",
      "id",
      requests
        .map((r) => r.orderId)
        .filter((v): v is string => typeof v === "string" && !!v),
      ["sankhyaCode"],
    )
  ).filter(hasSankhyaCode);
  const keptRequests = new Set<string>(
    (
      await colsWhereIn(
        "orders",
        "requestId",
        requests.map((r) => r.id),
        ["requestId", "sankhyaCode"],
      )
    )
      .filter(hasSankhyaCode)
      .map((o) => o.requestId)
      .filter((id): id is string => !!id),
  );
  const sankhyaOrderIds = new Set(sankhyaOrders.map((o) => o.id));
  for (const r of requests)
    if (
      !keptRequests.has(r.id) &&
      !(typeof r.orderId === "string" && sankhyaOrderIds.has(r.orderId))
    )
      mark("requests", r.id);

  // 2. Dependentes, até não aparecer mais nada (item do pedido → inspeção
  // do item…). Cada rodada só consulta as colunas que apontam para o que
  // acabou de entrar.
  let fresh = new Map(
    [...doomed].map(([t, s]) => [t, [...s]] as [TableName, string[]]),
  );
  for (let pass = 0; pass < 6 && fresh.size; pass++) {
    const next = new Map<TableName, string[]>();
    for (const table of Object.keys(TABLES) as TableName[]) {
      if (TRAIL.includes(table) || table === "documents") continue;
      const refCols = Object.entries(TABLES[table].columns).filter(
        ([c, def]) =>
          REFS[c] && def.type === "string" && REFS[c].some((t) => fresh.has(t)),
      );
      for (const [col, def] of refCols) {
        const ids = REFS[col].flatMap((t) => fresh.get(t) ?? []);
        for (const filter of wholeTable(table))
          for (const row of await colsWhereIn(
            table,
            col,
            ids,
            ["sankhyaCode"],
            filter,
          )) {
            if (isDoomed(table, row.id)) continue;
            const photoOfProduct =
              table === "product_photos" && col === "productId";
            if ((def.required || photoOfProduct) && !hasSankhyaCode(row)) {
              if (mark(table, row.id))
                next.set(table, [...(next.get(table) ?? []), row.id]);
              continue;
            }
            if (def.required) continue; // linha do Sankhya: nunca sai
            const key = `${table}:${row.id}`;
            const entry = patches.get(key) ?? {
              table,
              id: row.id,
              patch: {} as Row,
            };
            (entry.patch as Record<string, unknown>)[col] = null;
            patches.set(key, entry);
          }
      }
    }
    fresh = next;
  }

  // 3. Documentos: os ligados ao que sai, os que só o que sai usa (foto do
  // item do booking, planilha do lote) e os soltos que ninguém usa.
  const docCols = (Object.keys(TABLES) as TableName[]).flatMap((table) =>
    Object.entries(TABLES[table].columns)
      .filter(
        ([c, def]) =>
          def.type === "string" &&
          (c === "documentId" || c.endsWith("DocumentId")) &&
          !(table === "documents" && c === "previousDocumentId"),
      )
      .map(([c]) => ({ table, col: c })),
  );
  const usedByDoomed = new Set<string>();
  for (const { table, col } of docCols)
    for (const row of await colsWhereIn(table, "id", doomedIds(table), [col]))
      if (typeof row[col] === "string") usedByDoomed.add(row[col] as string);
  const candidatesById = new Map<string, Row>();
  const addCandidates = (rows: Row[]) => {
    for (const d of rows) candidatesById.set(d.id, d);
  };
  addCandidates(
    await colsWhereIn("documents", "id", usedByDoomed, DOC_COLUMNS),
  );
  for (const c of DOC_LINKS)
    addCandidates(
      await colsWhereIn(
        "documents",
        c,
        (REFS[c] ?? []).flatMap(doomedIds),
        DOC_COLUMNS,
      ),
    );
  // Soltos: nenhuma ligação (filtro no banco).
  addCandidates(
    await cols("documents", DOC_COLUMNS, {
      filter: Object.fromEntries(DOC_LINKS.map((c) => [c, null])),
    }),
  );
  const candidates = [...candidatesById.values()];
  // Documento que algo que fica ainda usa não sai (só perde a ligação).
  const stillUsed = new Set<string>();
  const candidateIds = candidates.map((d) => d.id);
  for (const { table, col } of docCols)
    for (const row of await colsWhereIn(table, col, candidateIds, [col]))
      if (!isDoomed(table, row.id)) stillUsed.add(row[col] as string);
  const settingsText = candidates.length
    ? JSON.stringify(await cols("settings", ["value"]))
    : "";
  const files = new Map<string, string>();
  for (const d of candidates) {
    if (stillUsed.has(d.id) || settingsText.includes(d.id)) {
      // Fica: só desliga do que sai.
      const patch: Record<string, unknown> = {};
      for (const c of DOC_LINKS) {
        const v = d[c];
        if (
          typeof v === "string" &&
          (REFS[c] ?? []).some((t) => isDoomed(t, v))
        )
          patch[c] = null;
      }
      if (Object.keys(patch).length)
        patches.set(`documents:${d.id}`, {
          table: "documents",
          id: d.id,
          patch: patch as Row,
        });
      continue;
    }
    mark("documents", d.id);
    if (typeof d.storageKey === "string" && d.storageKey)
      files.set(d.id, d.storageKey);
  }
  for (const d of await colsWhereIn(
    "documents",
    "previousDocumentId",
    doomedIds("documents"),
    ["previousDocumentId"],
  ))
    if (!isDoomed("documents", d.id)) {
      const key = `documents:${d.id}`;
      const entry = patches.get(key) ?? {
        table: "documents" as TableName,
        id: d.id,
        patch: {} as Row,
      };
      (entry.patch as Record<string, unknown>).previousDocumentId = null;
      patches.set(key, entry);
    }

  // 4. Histórico, confirmações e avisos do que saiu: pela entidade só do
  // portal (filtro no banco) e pelo id do que sai (em pedaços).
  const allDoomed = new Set([...doomed.values()].flatMap((s) => [...s]));
  for (const table of ["audit_log", "acknowledgements"] as const) {
    for (const row of await cols(table, [], {
      filter: { entity: [...PORTAL_ENTITIES] },
    }))
      mark(table, row.id);
    for (const row of await colsWhereIn(table, "entityId", allDoomed, []))
      mark(table, row.id);
  }
  // Aviso não guarda o id do registro, só o link: lê só essa coluna.
  for (const row of await cols("notifications", ["link"])) {
    const link = typeof row.link === "string" ? row.link : "";
    const path = link.split(/[?#]/)[0];
    const parts = path.split("/").filter(Boolean);
    if (
      parts.some((p) => allDoomed.has(p)) ||
      // Solicitações ao fornecedor e bookings: a tela inteira é do portal.
      (parts[0] === "app" &&
        ["supplier-requests", "booking"].includes(parts[1] ?? "") &&
        parts.length > 2)
    )
      mark("notifications", row.id);
  }

  const counterIds = (
    await cols("counters", ["key"], { filter: { key: COUNTERS } })
  ).map((c) => c.id);

  // Ordem: histórico e dependentes primeiro, raízes depois (na ordem de
  // PORTAL_ONLY, depois pedidos, solicitações e produtos), documentos por
  // último (a foto do item do booking aponta para o documento).
  const ROOTS: TableName[] = [...PORTAL_ONLY, "orders", "requests", "products"];
  const rank = (t: TableName) =>
    t === "documents" ? 100 : ROOTS.includes(t) ? 1 + ROOTS.indexOf(t) : 0;
  const deletes = [...doomed]
    .flatMap(([table, ids]) => [...ids].map((id) => ({ table, id })))
    .sort((a, b) => rank(a.table) - rank(b.table));
  const updates = [...patches.values()].filter((u) => !isDoomed(u.table, u.id));
  const remove: PortalResetPlan["remove"] = {};
  for (const d of deletes) remove[d.table] = (remove[d.table] ?? 0) + 1;
  return {
    plan: {
      remove,
      unlink: updates.length,
      files: files.size,
      total: deletes.length,
    },
    deletes,
    updates,
    files,
    counterIds,
  };
}

/** O que a limpeza vai fazer agora (tela de confirmação). Só admin. */
export async function planPortalTestReset(
  user: User,
): Promise<PortalResetPlan> {
  if (!isAdmin(user)) throw new Error("forbidden");
  return (await buildWork()).plan;
}

export const PORTAL_RESET_BUDGET_MS = 120_000;

/** Apaga os testes do portal (mantém o Sankhya). Só admin, com a palavra. */
export async function resetPortalTestData(
  user: User,
  confirm: string,
  { budgetMs = PORTAL_RESET_BUDGET_MS }: { budgetMs?: number } = {},
): Promise<PortalResetPlan & { finished: boolean }> {
  if (!isAdmin(user)) throw new Error("forbidden");
  if (confirm.trim().toUpperCase() !== RESET_CONFIRM_WORD)
    throw new Error("reset_confirm");
  const store = getStore();
  const work = await buildWork();
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
  const done = { unlinked: 0, deleted: 0, files: 0 };
  let finished = true;
  let failure: unknown = null;
  try {
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
    for (const d of finished ? work.deletes : []) {
      if (Date.now() > deadline) {
        finished = false;
        break;
      }
      const key = d.table === "documents" ? work.files.get(d.id) : undefined;
      if (key) {
        await store.removeFile(key);
        done.files++;
      }
      await tolerant(d.table, d.id, () => store.remove(d.table, d.id));
      done.deleted++;
    }
    if (finished)
      for (const id of work.counterIds)
        await tolerant("counters", id, () => store.remove("counters", id));
  } catch (error) {
    failure = error;
  }
  const summary = failure
    ? `Limpeza dos testes do portal falhou no meio: ${done.deleted} de ${work.plan.total} registros apagados; rode de novo para terminar`
    : finished
      ? `Limpeza dos testes do portal (Sankhya mantido): ${done.deleted} registros apagados, ${done.unlinked} desligados, ${done.files} arquivos`
      : `Limpeza dos testes do portal parou no limite de tempo: ${done.deleted} de ${work.plan.total} registros apagados; continua na próxima rodada`;
  try {
    await audit(user, "data.reset", "system", "portal_tests", summary, null, {
      planned: work.plan,
      ...done,
      finished,
      error: failure ? String((failure as Error)?.message ?? failure) : null,
    });
  } catch (auditError) {
    if (!failure) throw auditError;
  }
  if (failure) throw failure;
  return { ...work.plan, finished };
}
