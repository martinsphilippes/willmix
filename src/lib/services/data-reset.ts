import "server-only";

import { getStore, type TableName, type User } from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { audit } from "./audit";

/*
 * Limpar dados de teste: apaga as VENDAS (solicitações, cotações, pedidos,
 * pagamentos, containers, inspeções, documentos e arquivos de venda,
 * notificações, sugestões da IA, kits de marketing e o histórico delas) e
 * recomeça a numeração de solicitações e pedidos do #1.
 *
 * Fica: catálogo de produtos (fichas mestres, fotos, fornecedores do
 * produto, certificações, NCM), sourcing, programações de compra, clientes,
 * fornecedores, usuários, linhas de produto, configurações e tabela fiscal.
 * O que fica e apontava para uma venda apagada perde só a ligação (ex.: item
 * de sourcing pedido por uma solicitação, programação que virou pedido).
 *
 * Só o administrador, com confirmação digitada. Pode ser rodado de novo: se
 * parar no meio (tempo da requisição), a próxima vez continua de onde parou.
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
]);

/** Contadores da numeração (#1 de novo). */
const COUNTERS = ["request_number", "order_number"];

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
  files: string[];
  counterIds: string[];
}

/** Calcula o que sai e o que perde a ligação, sem mudar nada. */
async function buildWork(): Promise<Work> {
  const store = getStore();
  const list = <K extends TableName>(table: K) => store.list(table);
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

  // Fichas de compra: só as de pedido e cotação (a mestre é do produto).
  for (const s of sheets)
    if (!productIds.has(s.orderId) && (isSale(s.orderId) || !s.productId))
      drop("purchase_sheets", s.id);

  // Medições e revisões de venda.
  for (const m of measurements)
    if (SALES_ENTITIES.has(m.entity) || isSale(m.entityId))
      drop("measurements", m.id);
  for (const r of reviews)
    if (r.orderId || SALES_ENTITIES.has(r.entity) || isSale(r.entityId))
      drop("review_items", r.id);

  // Fotos: só as do pedido (sem produto nem item de sourcing); as do catálogo
  // tiradas num pedido ficam e perdem a ligação com ele.
  const keptPhotos = [];
  for (const p of photos) {
    if (p.orderId && !p.productId && !p.sourcingItemId)
      drop("product_photos", p.id);
    else {
      keptPhotos.push(p);
      if (p.orderId)
        updates.push({
          table: "product_photos",
          id: p.id,
          patch: { orderId: null },
        });
    }
  }

  // Documentos: os de venda saem (com o arquivo), menos os que o catálogo usa.
  const keptMeasurements = measurements.filter((m) => !deleted.has(m.id));
  const catalogDocs = new Set<string>(
    [
      ...keptPhotos.map((p) => p.documentId),
      ...products.map((p) => p.primaryPhotoDocumentId),
      ...certifications.map((c) => c.documentId),
      ...sourcing.map((s) => s.primaryPhotoDocumentId),
      ...keptMeasurements.map((m) => m.photoDocumentId),
      ...importBatches.map((b) => b.fileDocumentId),
      ...lookups.map((l) => l.imageDocumentId),
    ].filter((id): id is string => !!id),
  );
  const files: string[] = [];
  const keptDocs = [];
  for (const d of documents) {
    const sale = !!(d.orderId || d.requestId || d.requirementId || d.kitId);
    const catalog =
      !!(d.productId || d.sourcingItemId) || catalogDocs.has(d.id);
    if (sale && !catalog) {
      drop("documents", d.id);
      if (d.storageKey) files.push(d.storageKey);
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
    if (s.requestId)
      updates.push({
        table: "sourcing_items",
        id: s.id,
        patch: { requestId: null },
      });
  for (const l of lookups)
    if (l.requestId)
      updates.push({
        table: "product_lookups",
        id: l.id,
        patch: { requestId: null },
      });
  for (const ps of schedules)
    if (ps.requestId || ps.orderId)
      updates.push({
        table: "purchase_schedules",
        id: ps.id,
        // Volta a planejada (o "pedido"/"cancelada" vinha da venda de teste).
        patch: {
          requestId: null,
          orderId: null,
          ...(ps.status === "ordered" || ps.status === "cancelled"
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

/** Roda em lotes (o Appwrite apaga uma linha por vez). */
async function inBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<unknown>,
) {
  for (let i = 0; i < items.length; i += size)
    await Promise.all(items.slice(i, i + size).map(fn));
}

/**
 * Apaga as vendas de teste. Só admin, com a palavra de confirmação.
 * Devolve o que foi feito (também gravado no histórico).
 */
export async function resetSalesData(
  user: User,
  confirm: string,
): Promise<ResetPlan> {
  if (!isAdmin(user)) throw new Error("forbidden");
  if (confirm.trim().toUpperCase() !== RESET_CONFIRM_WORD)
    throw new Error("reset_confirm");
  const store = getStore();
  const work = await buildWork();
  // Primeiro desliga o que fica, depois apaga (nada aponta para o que sumiu),
  // por fim os arquivos e a numeração.
  await inBatches(work.updates, 10, (u) =>
    store.update(u.table, u.id, u.patch as never),
  );
  await inBatches(work.deletes, 10, (d) => store.remove(d.table, d.id));
  await inBatches(work.files, 10, (key) => store.removeFile(key));
  await inBatches(work.counterIds, 10, (id) => store.remove("counters", id));
  await audit(
    user,
    "data.reset",
    "system",
    "sales",
    `Limpeza dos dados de teste (vendas): ${work.plan.total} registros apagados, ${work.plan.unlink} desligados`,
    null,
    { ...work.plan },
  );
  return work.plan;
}
