import "server-only";

import { getStore, type TableName, type User } from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { audit } from "./audit";
import { isSchemaMissing } from "./packaging-brief";

/*
 * Limpar dados de teste: apaga as VENDAS (solicitações, cotações, pedidos,
 * pagamentos, containers, inspeções, documentos e arquivos de venda,
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
  "quotes",
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
  // Mensagens (chat): conversas, assuntos, mensagens e leituras de teste.
  "messages",
  "message_reads",
  "conversation_topics",
  "conversations",
  // Aprovações do pré-custo das solicitações de teste.
  "approvals",
  // Produção (follow, ETD) e inspeção por SKU dos pedidos de teste.
  "production_tracks",
  "sku_inspections",
] as const satisfies readonly TableName[];

/** Tabelas que podem ainda não existir no Appwrite (esquema não publicado). */
const OPTIONAL_TABLES = new Set<TableName>([
  "approvals",
  "production_tracks",
  "sku_inspections",
  "messages",
  "message_reads",
  "conversation_topics",
  "conversations",
]);

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
]);

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
  quotes: 8,
  requests: 9,
};
/** Demais tabelas de venda (itens, etapas, pagamentos…): antes dos pais. */
const DEFAULT_ORDER = 5;

const deleteRank = (t: TableName) => DELETE_ORDER[t] ?? DEFAULT_ORDER;

/** Separa os apagamentos (já ordenados) em grupos da mesma ordem. */
function deleteGroups(deletes: Work["deletes"]) {
  const groups: Array<Work["deletes"]> = [];
  let last: number | null = null;
  for (const d of deletes) {
    const r = deleteRank(d.table);
    if (r !== last) groups.push([]);
    groups[groups.length - 1].push(d);
    last = r;
  }
  return groups;
}

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
    quotes: number;
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

/** Calcula o que sai e o que perde a ligação, sem mudar nada. */
async function buildWork(): Promise<Work> {
  const store = getStore();
  const list = <K extends TableName>(table: K) =>
    OPTIONAL_TABLES.has(table)
      ? store.list(table).catch((error: unknown) => {
          if (isSchemaMissing(error)) return [];
          throw error;
        })
      : store.list(table);
  const [
    sales,
    documents,
    photos,
    sheets,
    measurements,
    reviews,
    acks,
    auditRows,
    products,
    certifications,
    sourcing,
    lookups,
    schedules,
    productSuppliers,
    importBatches,
    counters,
    readings,
    cards,
  ] = await Promise.all([
    Promise.all(SALES_TABLES.map((t) => list(t))),
    list("documents"),
    list("product_photos"),
    list("purchase_sheets"),
    list("measurements"),
    list("review_items"),
    list("acknowledgements"),
    list("audit_log"),
    list("products"),
    list("certifications"),
    list("sourcing_items"),
    list("product_lookups"),
    list("purchase_schedules"),
    list("product_suppliers"),
    list("import_batches"),
    list("counters"),
    list("sheet_readings"),
    list("manufacturer_cards"),
  ]);

  const deletes: Work["deletes"] = [];
  const updates: Work["updates"] = [];
  const deleted = new Set<string>();
  const drop = (table: TableName, id: string) => {
    deletes.push({ table, id });
    deleted.add(id);
  };
  const byTable = Object.fromEntries(
    SALES_TABLES.map((t, i) => [t, sales[i] as Array<{ id: string }>]),
  ) as Record<(typeof SALES_TABLES)[number], Array<{ id: string }>>;
  for (const table of SALES_TABLES)
    for (const row of byTable[table]) drop(table, row.id);

  const saleIds = (t: (typeof SALES_TABLES)[number]) =>
    new Set(byTable[t].map((r) => r.id));
  const requestIds = saleIds("requests");
  const quoteIds = saleIds("quotes");
  const orderIds = saleIds("orders");
  const productIds = new Set(products.map((p) => p.id));
  // Ligação com venda: pedido/solicitação/cotação que existe (ou existia) e
  // não é produto do catálogo (a ficha mestre usa orderId = id do produto).
  const isSale = (id: string | null | undefined) =>
    !!id && (requestIds.has(id) || quoteIds.has(id) || orderIds.has(id));

  // Fichas de compra: só existem as do produto (mestre, orderId = id do
  // produto), da cotação e do pedido. Tudo que não é mestre sai (mesmo que a
  // cotação ou o pedido já tenham sido apagados numa rodada anterior).
  for (const s of sheets)
    if (!productIds.has(s.orderId)) drop("purchase_sheets", s.id);

  // Sourcing sob demanda: item que uma solicitação de teste CRIOU (origem
  // "sourcing_demand", nascido junto com ela) e que não virou produto sai
  // junto, com fotos e documentos. Item cadastrado pela equipe e só ligado
  // depois a uma solicitação fica (perde a ligação).
  const requestById = new Map(
    (
      byTable.requests as Array<{
        id: string;
        origin?: string | null;
        createdAt: string;
      }>
    ).map((rq) => [rq.id, rq]),
  );
  const createdByRequest = (s: (typeof sourcing)[number]) => {
    const rq = s.requestId ? requestById.get(s.requestId) : undefined;
    if (!rq || rq.origin !== "sourcing_demand") return false;
    const gap = Math.abs(Date.parse(s.createdAt) - Date.parse(rq.createdAt));
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
      SALES_ENTITIES.has(m.entity) ||
      isSale(m.entityId) ||
      (m.entity === "sourcing_item" && sourcingGone.has(m.entityId))
    )
      drop("measurements", m.id);
  for (const r of reviews)
    if (r.orderId || SALES_ENTITIES.has(r.entity) || isSale(r.entityId))
      drop("review_items", r.id);

  // Fotos: só as do pedido (sem produto nem item de sourcing); as do catálogo
  // tiradas num pedido ficam e perdem a ligação com ele.
  const keptPhotos = [];
  const droppedPhotoDocs = new Set<string>();
  for (const p of photos) {
    const fromSale = p.orderId && !p.productId && !p.sourcingItemId;
    const fromGoneSourcing =
      !!p.sourcingItemId && sourcingGone.has(p.sourcingItemId) && !p.productId;
    if (fromSale || fromGoneSourcing) {
      drop("product_photos", p.id);
      if (p.documentId) droppedPhotoDocs.add(p.documentId);
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
  const keptReadings = [];
  for (const r of readings) {
    if (productIds.has(r.sheetKey)) keptReadings.push(r);
    else {
      drop("sheet_readings", r.id);
      droppedPhotoDocs.add(r.documentId);
    }
  }

  // Cartões do fabricante: os do produto ficam (quem fabrica, catálogo) e só
  // perdem a ligação com a cotação de teste; os de cotação sem produto saem.
  const keptCards = [];
  for (const c of cards) {
    if (c.productId) {
      keptCards.push(c);
      if (c.quoteId)
        updates.push({
          table: "manufacturer_cards",
          id: c.id,
          patch: { quoteId: null },
        });
    } else {
      drop("manufacturer_cards", c.id);
      droppedPhotoDocs.add(c.documentId);
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
    ].filter((id): id is string => !!id),
  );
  const files = new Map<string, string>();
  const keptDocs = [];
  for (const d of documents) {
    // De venda: ligado a pedido/solicitação/requisito/kit, foto de cotação
    // (o documento fica sem ligação, só a foto aponta para ele) ou de item de
    // sourcing que sai.
    const sale =
      !!(d.orderId || d.requestId || d.requirementId || d.kitId) ||
      // Anexo do chat (sai junto com as mensagens).
      !!d.conversationTopicId ||
      droppedPhotoDocs.has(d.id) ||
      (!!d.sourcingItemId && sourcingGone.has(d.sourcingItemId));
    // Do catálogo: usado por algo que fica, ou do produto/sourcing que fica
    // (arte de kit também tem o produto, mas é da venda do kit).
    const catalog =
      catalogDocs.has(d.id) ||
      (!d.kitId &&
        (!!d.productId ||
          (!!d.sourcingItemId && !sourcingGone.has(d.sourcingItemId))));
    if (sale && !catalog) {
      drop("documents", d.id);
      if (d.storageKey) files.set(d.id, d.storageKey);
    } else keptDocs.push(d);
  }
  for (const d of keptDocs) {
    const patch: Record<string, unknown> = {};
    if (d.orderId) patch.orderId = null;
    if (d.requestId) patch.requestId = null;
    if (d.requirementId) patch.requirementId = null;
    if (d.kitId) patch.kitId = null;
    if (d.previousDocumentId && deleted.has(d.previousDocumentId))
      patch.previousDocumentId = null;
    if (Object.keys(patch).length)
      updates.push({ table: "documents", id: d.id, patch });
  }

  // Confirmações de leitura e histórico do que saiu.
  for (const a of acks)
    if (deleted.has(a.entityId) || SALES_ENTITIES.has(a.entity))
      drop("acknowledgements", a.id);
  for (const row of auditRows)
    if (deleted.has(row.entityId) || SALES_ENTITIES.has(row.entity))
      drop("audit_log", row.id);

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
  for (const link of productSuppliers)
    if (
      link.lastQuoteId ||
      link.quoteCount ||
      link.selectedCount ||
      link.lastSelectedAt
    )
      updates.push({
        table: "product_suppliers",
        id: link.id,
        // Código, preço, moeda, MOQ e prazo ficam; o histórico de cotações sai.
        patch: {
          lastQuoteId: null,
          lastQuotedAt: null,
          quoteCount: 0,
          selectedCount: 0,
          lastSelectedAt: null,
        },
      });

  // Dependente antes do que é dependido (ver DELETE_ORDER).
  deletes.sort((a, b) => deleteRank(a.table) - deleteRank(b.table));

  const counterIds = counters
    .filter((c) => COUNTERS.includes(c.key))
    .map((c) => c.id);

  const count = (table: TableName) =>
    deletes.filter((d) => d.table === table).length;
  const remove = {
    requests: count("requests"),
    quotes: count("quotes"),
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
  const named = Object.values(remove).reduce((s, n) => s + n, 0);
  remove.other = deletes.length - named;
  return {
    plan: { remove, unlink: updates.length, total: deletes.length },
    deletes,
    updates,
    files,
    counterIds,
  };
}

/** O que a limpeza vai fazer agora (tela de confirmação). Só admin. */
export async function planSalesReset(user: User): Promise<ResetPlan> {
  if (!isAdmin(user)) throw new Error("forbidden");
  return (await buildWork()).plan;
}

/**
 * Roda em lotes (o Appwrite apaga uma linha por vez). Para antes do lote
 * seguinte se o tempo acabou; devolve se terminou tudo.
 */
async function inBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<unknown>,
  deadline = Infinity,
) {
  for (let i = 0; i < items.length; i += size) {
    if (Date.now() >= deadline) return false;
    // Espera o lote inteiro antes de acusar a falha: nada fica rodando depois.
    const results = await Promise.allSettled(items.slice(i, i + size).map(fn));
    const failed = results.find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
  }
  return true;
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
    for (const group of deleteGroups(work.deletes)) {
      if (!finished) break;
      finished = await inBatches(
        group,
        10,
        async (d) => {
          const key =
            d.table === "documents" ? work.files.get(d.id) : undefined;
          if (key) await store.removeFile(key);
          await tolerant(d.table, d.id, () => store.remove(d.table, d.id));
          done.deleted++;
        },
        deadline,
      );
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
