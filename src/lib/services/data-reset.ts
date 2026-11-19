import "server-only";

import { getStore, type TableName, type User } from "@/lib/db";
import type { FilterValue } from "@/lib/db/store";
import { isAdmin } from "@/lib/auth/permissions";
import { audit } from "./audit";
import {
  cols,
  colsWhereIn,
  countTable,
  inBatches,
  sweepTable,
  type Row,
} from "./reset-query";

/*
 * Limpar dados de teste: apaga as VENDAS (solicitações, cotações, pedidos,
 * pagamentos, containers, inspeções, briefings de embalagem, documentos e
 * arquivos de venda,
 * notificações, mensagens do chat (com os anexos), sugestões da IA, kits de marketing e o histórico delas) e
 * recomeça a numeração de solicitações e pedidos do #1.
 *
 * Fica: catálogo de produtos (fichas mestres, fotos, fornecedores do
 * produto, certificações, NCM), sourcing (menos os itens que as solicitações
 * de teste criaram), programações de compra, clientes, fornecedores,
 * usuários, linhas de produto, configurações e tabela fiscal.
 * O que fica e apontava para uma venda apagada perde só a ligação (ex.: item
 * de sourcing pedido por uma solicitação, programação que virou pedido).
 *
 * Só o administrador, com confirmação digitada. Pode ser rodado de novo: se
 * parar no meio (limite de tempo ou falha), a próxima vez continua de onde
 * parou. Para isso apaga sempre o que depende antes do que é dependido
 * (documento antes da foto que aponta para ele, item de sourcing antes da
 * solicitação que o criou, pedido antes da solicitação), e cada regra de
 * "é de venda" não depende de o pai ainda existir.
 */

/** Palavra que o administrador digita para confirmar. */
export const RESET_CONFIRM_WORD = "APAGAR";

/** Tabelas de venda: tudo é apagado. */
const SALES_TABLES = [
  "requests",
  "orders",
  "order_items",
  "stages",
  "requirements",
  "payments",
  "notifications",
  "penalties",
  "purchase_snapshots",
  "containers",
  "container_items",
  "inspection_results",
  "after_sales",
  "freight_quotes",
  "marketing_kits",
  "ai_suggestions",
  "cart_items",
  "request_drafts",
  "form_drafts",
  // Atendimentos ao cliente (carteira; docs/TRADE_COMERCIAL.md).
  "customer_attendances",
  "trade_activities",
  // Mensagens (chat): conversas, assuntos, mensagens e leituras de teste.
  "messages",
  "message_reads",
  "conversation_topics",
  "conversations",
  // Produção (follow, ETD) e inspeção por SKU dos pedidos de teste.
  "production_tracks",
  "sku_inspections",
  // Embarque e desembaraço dos pedidos de teste.
  "import_steps",
  "shipping_docs",
  "real_media",
  "showroom_receipts",
  // Ofertas de amostras e produtos a clientes (Vendas).
  "sales_offers",
  "sales_orders",
  "sales_returns",
  "divergence_lots",
  "receivings",
  "art_issues",
  // Estoque de teste: baixas, inventários e perdas (o estoque vem dos containers apagados).
  "stock_movements",
  "stock_count_items",
  "stock_counts",
  "stock_reservations",
  // Eventos das regras de processo das vendas de teste.
  "process_events",
  // Marcos do pedido (fase 5b, docs/MILESTONES.md).
  "order_milestones",
  // Resumo dos pedidos (derivado; docs/RESUMOS.md).
  "order_summaries",
  "kpi_snapshots",
] as const satisfies readonly TableName[];

/** Entidades de venda no histórico (auditoria) e nas medições/revisões. */
const SALES_ENTITIES = new Set([
  "request",
  "quote",
  "order",
  "order_item",
  "requirement",
  "payment",
  "penalty",
  "container",
  "inspection",
  "after_sale",
  "freight_quote",
  "kit",
  "marketing_kit",
  "ai_suggestion",
  "purchase_snapshot",
  // Registros das tabelas de venda que também aparecem no histórico.
  "stage",
  "message",
  "conversation",
  "sales_order",
  "sales_offer",
  "sales_return",
  "customer_attendance",
  "trade_activity",
  "stock_count",
  "request_draft",
]);

/** Tabelas de venda sem repetir (saem inteiras, em páginas). */
const SWEEP_TABLES: TableName[] = [...new Set<TableName>(SALES_TABLES)];

/**
 * Ordem de apagar (menor primeiro): histórico e confirmações; documentos (com
 * o arquivo); fotos e buscas; fichas, medições e revisões; sourcing criado
 * pela solicitação; o que é do pedido; e por último pedidos, cotações e
 * solicitações. Se parar no meio, a próxima rodada ainda acha tudo.
 */
const DELETE_ORDER: Partial<Record<TableName, number>> = {
  audit_log: 0,
  acknowledgements: 0,
  documents: 1,
  product_photos: 2,
  product_lookups: 2,
  sheet_readings: 2,
  manufacturer_cards: 2,
  purchase_sheets: 3,
  measurements: 3,
  review_items: 3,
  sourcing_items: 4,
  containers: 6,
  orders: 7,
  requests: 9,
};
/** Demais tabelas de venda (itens, etapas, pagamentos…): antes dos pais. */
const DEFAULT_ORDER = 5;

const deleteRank = (t: TableName) => DELETE_ORDER[t] ?? DEFAULT_ORDER;

/** Contadores da numeração (#1 de novo). */
const COUNTERS = ["request_number", "order_number"];

/** Resultado de uma rodada da limpeza. */
export interface ResetResult extends ResetPlan {
  /** Apagou tudo o que estava previsto (false: parou no limite de tempo). */
  finished: boolean;
  /** A numeração recomeçou do #1 (não recomeça se surgiu venda nova). */
  countersReset: boolean;
}

export interface ResetPlan {
  /** Quantos registros de cada tipo vão ser apagados. */
  remove: {
    requests: number;
    orders: number;
    payments: number;
    containers: number;
    documents: number;
    notifications: number;
    aiSuggestions: number;
    kits: number;
    /** Itens de sourcing que as solicitações de teste criaram (sob demanda). */
    sourcing: number;
    /** Mensagens do chat (conversas, assuntos e leituras vão em "other"). */
    messages: number;
    /** Etapas, itens, fichas do pedido, medições, revisões, histórico… */
    other: number;
  };
  /** Registros que ficam e só perdem a ligação com uma venda apagada. */
  unlink: number;
  /** Total apagado (para o aviso e a auditoria). */
  total: number;
}

interface Work {
  plan: ResetPlan;
  deletes: Array<{ table: TableName; id: string }>;
  updates: Array<{
    table: TableName;
    id: string;
    patch: Record<string, unknown>;
  }>;
  /** Arquivo de cada documento apagado (sai junto com o documento). */
  files: Map<string, string>;
  counterIds: string[];
}

/** Ids de uma tabela (só id e datas). */
const ids = async (
  table: TableName,
  filter: Record<string, FilterValue> = {},
) => (await cols(table, [], { filter })).map((r) => r.id);

/**
 * Calcula o que sai e o que perde a ligação, sem mudar nada. As tabelas de
 * venda saem inteiras: aqui só a contagem (requisitos e etapas passam de 700
 * mil linhas); a limpeza as apaga em páginas (`sweepTable`). O resto é lido
 * só nas colunas que as regras usam.
 */
async function buildWork(): Promise<Work> {
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  const [
    salesCounts,
    requestIdList,
    orderIdList,
    demandRequests,
    documents,
    photos,
    sheets,
    measurements,
    reviews,
    products,
    certifications,
    sourcing,
    lookups,
    schedules,
    importBatches,
    counters,
    readings,
    cards,
  ] = await Promise.all([
    Promise.all(SWEEP_TABLES.map((t) => countTable(t))),
    ids("requests"),
    ids("orders"),
    cols("requests", ["origin"], { filter: { origin: "sourcing_demand" } }),
    cols("documents", [
      "orderId",
      "requestId",
      "requirementId",
      "kitId",
      "conversationTopicId",
      "sourcingItemId",
      "productId",
      "storageKey",
      "previousDocumentId",
    ]),
    cols("product_photos", [
      "orderId",
      "productId",
      "sourcingItemId",
      "documentId",
    ]),
    cols("purchase_sheets", ["orderId"]),
    cols("measurements", ["entity", "entityId", "photoDocumentId"]),
    cols("review_items", ["orderId", "entity", "entityId"]),
    cols("products", ["primaryPhotoDocumentId"]),
    cols("certifications", ["documentId"]),
    cols("sourcing_items", [
      "requestId",
      "productId",
      "status",
      "primaryPhotoDocumentId",
    ]),
    cols("product_lookups", ["requestId", "imageDocumentId"]),
    cols("purchase_schedules", ["requestId", "orderId", "status"]),
    cols("import_batches", ["fileDocumentId"]),
    cols("counters", ["key"], { filter: { key: COUNTERS } }),
    cols("sheet_readings", ["sheetKey", "documentId"]),
    cols("manufacturer_cards", ["productId", "documentId"]),
  ]);

  const deletes: Work["deletes"] = [];
  const updates: Work["updates"] = [];
  /** Ids apagados fora das tabelas de venda (documentos, fotos, fichas…). */
  const deleted = new Set<string>();
  const drop = (table: TableName, id: string) => {
    deletes.push({ table, id });
    deleted.add(id);
  };

  const requestIds = new Set(requestIdList);
  const orderIds = new Set(orderIdList);
  const productIds = new Set(products.map((p) => p.id));
  // Ligação com venda: pedido/solicitação que existe (ou existia) e
  // não é produto do catálogo (a ficha mestre usa orderId = id do produto).
  const isSale = (id: unknown) =>
    typeof id === "string" && (requestIds.has(id) || orderIds.has(id));

  // Fichas de compra: só existem as do produto (mestre, orderId = id do
  // produto), da cotação e do pedido. Tudo que não é mestre sai (mesmo que a
  // cotação ou o pedido já tenham sido apagados numa rodada anterior).
  for (const s of sheets)
    if (!productIds.has(String(s.orderId))) drop("purchase_sheets", s.id);

  // Sourcing sob demanda: item que uma solicitação de teste CRIOU (origem
  // "sourcing_demand", nascido junto com ela) e que não virou produto sai
  // junto, com fotos e documentos. Item cadastrado pela equipe e só ligado
  // depois a uma solicitação fica (perde a ligação).
  const requestById = new Map(demandRequests.map((rq) => [rq.id, rq]));
  const createdByRequest = (s: Row) => {
    const rq = str(s.requestId) ? requestById.get(s.requestId as string) : null;
    if (!rq) return false;
    const gap = Math.abs(
      Date.parse(String(s.createdAt)) - Date.parse(String(rq.createdAt)),
    );
    return Number.isFinite(gap) && gap < 60_000;
  };
  const sourcingGone = new Set(
    sourcing
      .filter(
        (s) => createdByRequest(s) && !s.productId && s.status !== "promoted",
      )
      .map((s) => s.id),
  );
  for (const id of sourcingGone) drop("sourcing_items", id);

  // Busca por foto/link que virou solicitação de teste (a foto é anexo dela).
  for (const l of lookups) if (l.requestId) drop("product_lookups", l.id);

  // Medições e revisões de venda.
  // (Também a medição do item de sourcing que sai: medições vêm antes do
  // sourcing na ordem de apagar, então a regra vale na rodada seguinte.)
  for (const m of measurements)
    if (
      SALES_ENTITIES.has(String(m.entity)) ||
      isSale(m.entityId) ||
      (m.entity === "sourcing_item" && sourcingGone.has(String(m.entityId)))
    )
      drop("measurements", m.id);
  for (const r of reviews)
    if (r.orderId || SALES_ENTITIES.has(String(r.entity)) || isSale(r.entityId))
      drop("review_items", r.id);

  // Fotos: só as do pedido (sem produto nem item de sourcing); as do catálogo
  // tiradas num pedido ficam e perdem a ligação com ele.
  const keptPhotos: Row[] = [];
  const droppedPhotoDocs = new Set<string>();
  for (const p of photos) {
    const fromSale = p.orderId && !p.productId && !p.sourcingItemId;
    const fromGoneSourcing =
      !!p.sourcingItemId &&
      sourcingGone.has(String(p.sourcingItemId)) &&
      !p.productId;
    if (fromSale || fromGoneSourcing) {
      drop("product_photos", p.id);
      if (str(p.documentId)) droppedPhotoDocs.add(p.documentId as string);
    } else {
      keptPhotos.push(p);
      if (p.orderId)
        updates.push({
          table: "product_photos",
          id: p.id,
          patch: { orderId: null },
        });
    }
  }

  // Fotos do quadro: as da ficha de cotação ou de pedido saem (com a foto);
  // as da ficha mestre do produto ficam (catálogo).
  const keptReadings: Row[] = [];
  for (const r of readings) {
    if (productIds.has(String(r.sheetKey))) keptReadings.push(r);
    else {
      drop("sheet_readings", r.id);
      if (str(r.documentId)) droppedPhotoDocs.add(r.documentId as string);
    }
  }

  // Cartões do fabricante: os do produto ficam (quem fabrica, catálogo); os
  // sem produto saem.
  const keptCards: Row[] = [];
  for (const c of cards) {
    if (c.productId) keptCards.push(c);
    else {
      drop("manufacturer_cards", c.id);
      if (str(c.documentId)) droppedPhotoDocs.add(c.documentId as string);
    }
  }

  // Documentos: os de venda saem (com o arquivo), menos os que o catálogo usa.
  const keptMeasurements = measurements.filter((m) => !deleted.has(m.id));
  const catalogDocs = new Set<string>(
    [
      ...keptPhotos.map((p) => p.documentId),
      ...products.map((p) => p.primaryPhotoDocumentId),
      ...certifications.map((c) => c.documentId),
      ...sourcing
        .filter((s) => !sourcingGone.has(s.id))
        .map((s) => s.primaryPhotoDocumentId),
      ...keptMeasurements.map((m) => m.photoDocumentId),
      ...importBatches.map((b) => b.fileDocumentId),
      ...keptReadings.map((r) => r.documentId),
      ...keptCards.map((c) => c.documentId),
      // Busca por foto/link que virou solicitação de teste sai com ela; a que
      // não virou solicitação fica.
      ...lookups.filter((l) => !l.requestId).map((l) => l.imageDocumentId),
    ].filter((id): id is string => typeof id === "string" && !!id),
  );
  const files = new Map<string, string>();
  const keptDocs: Row[] = [];
  for (const d of documents) {
    // De venda: ligado a pedido/solicitação/requisito/kit, foto de cotação
    // (o documento fica sem ligação, só a foto aponta para ele) ou de item de
    // sourcing que sai.
    const sale =
      !!(d.orderId || d.requestId || d.requirementId || d.kitId) ||
      // Anexo do chat (sai junto com as mensagens).
      !!d.conversationTopicId ||
      droppedPhotoDocs.has(d.id) ||
      (!!d.sourcingItemId && sourcingGone.has(String(d.sourcingItemId)));
    // Do catálogo: usado por algo que fica, ou do produto/sourcing que fica
    // (arte de kit também tem o produto, mas é da venda do kit).
    const catalog =
      catalogDocs.has(d.id) ||
      (!d.kitId &&
        (!!d.productId ||
          (!!d.sourcingItemId && !sourcingGone.has(String(d.sourcingItemId)))));
    if (sale && !catalog) {
      drop("documents", d.id);
      if (str(d.storageKey)) files.set(d.id, d.storageKey as string);
    } else keptDocs.push(d);
  }
  for (const d of keptDocs) {
    const patch: Record<string, unknown> = {};
    if (d.orderId) patch.orderId = null;
    if (d.requestId) patch.requestId = null;
    if (d.requirementId) patch.requirementId = null;
    if (d.kitId) patch.kitId = null;
    if (
      str(d.previousDocumentId) &&
      deleted.has(d.previousDocumentId as string)
    )
      patch.previousDocumentId = null;
    if (Object.keys(patch).length)
      updates.push({ table: "documents", id: d.id, patch });
  }

  // Confirmações de leitura e histórico do que saiu: pela entidade de venda
  // (filtro no banco) e pelo id do que sai (pedidos, solicitações e o que
  // saiu fora das tabelas de venda), em pedaços.
  const trailIds = [...requestIds, ...orderIds, ...deleted];
  for (const table of ["acknowledgements", "audit_log"] as const) {
    const seen = new Set<string>();
    const rows = [
      ...(await cols(table, [], {
        filter: { entity: [...SALES_ENTITIES] },
      })),
      ...(await colsWhereIn(table, "entityId", trailIds, [])),
    ];
    for (const row of rows)
      if (!seen.has(row.id)) {
        seen.add(row.id);
        deletes.push({ table, id: row.id });
      }
  }

  // O que fica e apontava para uma venda: só perde a ligação.
  for (const s of sourcing)
    if (s.requestId && !sourcingGone.has(s.id))
      updates.push({
        table: "sourcing_items",
        id: s.id,
        patch: { requestId: null },
      });
  for (const ps of schedules)
    if (ps.requestId || ps.orderId)
      updates.push({
        table: "purchase_schedules",
        id: ps.id,
        // Status que veio da venda de teste volta a planejada: "confirmed"
        // (virou solicitação), "ordered" e "cancelled" com pedido (pedido
        // criado ou cancelado). Cancelada à mão, sem pedido, fica.
        patch: {
          requestId: null,
          orderId: null,
          ...((ps.requestId && ps.status === "confirmed") ||
          (ps.orderId && (ps.status === "ordered" || ps.status === "cancelled"))
            ? { status: "planned" }
            : {}),
        },
      });

  // Dependente antes do que é dependido (ver DELETE_ORDER).
  deletes.sort((a, b) => deleteRank(a.table) - deleteRank(b.table));

  const swept = Object.fromEntries(
    SWEEP_TABLES.map((t, i) => [t, salesCounts[i]]),
  ) as Record<TableName, number>;
  const count = (table: TableName) =>
    (swept[table] ?? 0) + deletes.filter((d) => d.table === table).length;
  const remove = {
    requests: count("requests"),
    orders: count("orders"),
    payments: count("payments"),
    containers: count("containers"),
    documents: count("documents"),
    notifications: count("notifications"),
    aiSuggestions: count("ai_suggestions"),
    kits: count("marketing_kits"),
    sourcing: count("sourcing_items"),
    messages: count("messages"),
    other: 0,
  };
  const total = deletes.length + salesCounts.reduce((s, n) => s + n, 0);
  const named = Object.values(remove).reduce((s, n) => s + n, 0);
  remove.other = total - named;
  return {
    plan: { remove, unlink: updates.length, total },
    deletes,
    updates,
    files,
    counterIds: counters.map((c) => c.id),
  };
}

/** O que a limpeza vai fazer agora (tela de confirmação). Só admin. */
export async function planSalesReset(user: User): Promise<ResetPlan> {
  if (!isAdmin(user)) throw new Error("forbidden");
  return (await buildWork()).plan;
}

/** Há vendas no portal (alguma linha nas tabelas de venda)? */
export async function countSalesRows(): Promise<number> {
  let total = 0;
  for (const t of SWEEP_TABLES) total += await countTable(t);
  return total;
}

/**
 * Tempo de uma rodada. A página dá 300 s à ação (maxDuration); a rodada para
 * bem antes, para sobrar tempo de mostrar a tela com "ainda restam N".
 */
export const RESET_BUDGET_MS = 120_000;

/**
 * Apaga as vendas de teste. Só admin, com a palavra de confirmação.
 * Devolve o que foi feito (também gravado no histórico).
 */
export async function resetSalesData(
  user: User,
  confirm: string,
  { budgetMs = RESET_BUDGET_MS }: { budgetMs?: number } = {},
): Promise<ResetResult> {
  if (!isAdmin(user)) throw new Error("forbidden");
  if (confirm.trim().toUpperCase() !== RESET_CONFIRM_WORD)
    throw new Error("reset_confirm");
  const deadline = Date.now() + budgetMs;
  const store = getStore();
  // Linha criada depois daqui (venda nova durante a limpeza) fica.
  const startedAt = new Date().toISOString();
  const work = await buildWork();
  // Registro que já sumiu (outra limpeza rodando junto, ou uma rodada
  // anterior que parou no meio) não é erro: só segue.
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
  // O que de fato foi feito (para o histórico, mesmo se parar no meio).
  const done = { unlinked: 0, deleted: 0 };
  let finished = false;
  let countersReset = false;
  let failure: unknown = null;
  try {
    // Primeiro desliga o que fica, depois apaga (nada aponta para o que
    // sumiu), por fim a numeração.
    finished = await inBatches(
      work.updates,
      10,
      async (u) => {
        await tolerant(u.table, u.id, () =>
          store.update(u.table, u.id, u.patch as never),
        );
        done.unlinked++;
      },
      deadline,
    );
    // O arquivo sai junto com o documento (antes da linha): se parar no
    // meio, a próxima rodada ainda acha o documento e termina. Um grupo da
    // ordem (DELETE_ORDER) termina antes do próximo começar: um lote nunca
    // mistura o documento com a foto que aponta para ele.
    // Tabelas de venda: inteiras, em páginas (só os ids na memória), na
    // mesma ordem; o que nasceu depois do início da rodada fica.
    const removeRow = async (table: TableName, id: string) => {
      const key = table === "documents" ? work.files.get(id) : undefined;
      if (key) await store.removeFile(key);
      await tolerant(table, id, () => store.remove(table, id));
      done.deleted++;
    };
    const ranks = [
      ...new Set([
        ...work.deletes.map((d) => deleteRank(d.table)),
        ...SWEEP_TABLES.map(deleteRank),
      ]),
    ].sort((a, b) => a - b);
    for (const rank of ranks) {
      if (!finished) break;
      finished = await inBatches(
        work.deletes.filter((d) => deleteRank(d.table) === rank),
        10,
        (d) => removeRow(d.table, d.id),
        deadline,
      );
      for (const table of SWEEP_TABLES.filter((t) => deleteRank(t) === rank)) {
        if (!finished) break;
        finished = await sweepTable(
          table,
          startedAt,
          (id) => removeRow(table, id),
          deadline,
        );
      }
    }
    // A numeração só recomeça com tudo apagado e nenhuma venda nova criada
    // durante a limpeza (senão o próximo pedido repetiria um número).
    if (finished) {
      const [leftOrders, leftRequests] = await Promise.all([
        store.list("orders", { limit: 1 }),
        store.list("requests", { limit: 1 }),
      ]);
      if (!leftOrders.length && !leftRequests.length) {
        await inBatches(work.counterIds, 10, (id) =>
          tolerant("counters", id, () => store.remove("counters", id)),
        );
        countersReset = true;
      }
    }
  } catch (error) {
    failure = error;
  }
  // Histórico sempre, inclusive quando parou no meio ou falhou.
  const summary = failure
    ? `Limpeza dos dados de teste (vendas) falhou no meio: ${done.deleted} de ${work.plan.total} registros apagados; rode de novo para terminar`
    : finished
      ? `Limpeza dos dados de teste (vendas): ${done.deleted} registros apagados, ${done.unlinked} desligados${countersReset ? "" : "; numeração mantida (vendas novas durante a limpeza)"}`
      : `Limpeza dos dados de teste (vendas) parou no limite de tempo: ${done.deleted} de ${work.plan.total} registros apagados; continua na próxima rodada`;
  try {
    await audit(user, "data.reset", "system", "sales", summary, null, {
      planned: work.plan,
      ...done,
      finished,
      countersReset,
      error: failure ? String((failure as Error)?.message ?? failure) : null,
    });
  } catch (auditError) {
    // A falha da limpeza é a que importa; a do histórico não a esconde.
    if (!failure) throw auditError;
  }
  if (failure) throw failure;
  return { ...work.plan, finished, countersReset };
}
