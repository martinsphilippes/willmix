import "server-only";
import { assertCan } from "@/lib/auth/function-access";

import { assertWellmix, isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  type BookingItem,
  type BookingLot,
  type Party,
  type SheetCurrency,
  type SheetIncoterm,
  type SupplierRequestEvent,
  type SupplierRequest,
  type User,
  type YesNo,
} from "@/lib/db";
import {
  itemSearchText,
  matchesItemSearch,
  pendingProposal,
  requestGroupKey,
  searchWords,
  sheetQuantity,
  supplierCanAnswer,
  supplierRequestActive,
  supplierRequestDecisions,
  supplierRequestItemOf,
} from "@/lib/supplier-requests";
import {
  SELECTION_STATUSES,
  lotMatchesFilters,
  type SelectionFilters,
} from "@/lib/booking-selection";
import { audit } from "./audit";

/*
 * Seleção de itens e solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md).
 * A Wellmix compara itens parecidos dos bookings fechados, escolhe um e abre
 * a solicitação ao fornecedor dele (os parecidos ficam como alternativas). O
 * fornecedor vê só as próprias solicitações, sem as alternativas nem a
 * análise do Superplan, e responde se faz o que a Wellmix precisa e em que
 * condições. Nenhum produto, cliente ou estoque nasce aqui.
 */

export class SupplierRequestError extends Error {}

const COUNTER = "supplier_request_number";
/** Bookings cujos itens entram na seleção (fechados ou já em andamento). */
const SELECTABLE_LOTS = ["closed", "in_progress", "done"] as const;
/** Itens mostrados de uma vez na seleção. */
export const SELECTION_MAX = 200;
const MAX_ALTERNATIVES = 30;

const clip = (s: string | null | undefined, max: number) => {
  const v = (s ?? "").trim();
  return v ? v.slice(0, max) : null;
};

async function withSchema<T>(fn: () => Promise<T>): Promise<T> {
  const { isSchemaMissing } = await import("@/lib/db/errors");
  try {
    return await fn();
  } catch (error) {
    if (isSchemaMissing(error))
      throw new SupplierRequestError("schema_outdated");
    throw error;
  }
}

/* ------------------------------------------------------------------------ */
/* Seleção de itens                                                          */
/* ------------------------------------------------------------------------ */

export interface SelectionRow {
  item: BookingItem;
  lot: BookingLot;
  supplier: Party | null;
  /** Solicitação em andamento (aberta ou respondida) deste item. */
  activeRequest: SupplierRequest | null;
}

export interface SelectionResult {
  rows: SelectionRow[];
  /** Itens que combinam com a busca (pode passar do que é mostrado). */
  total: number;
  /** Os que combinam, até SELECTION_SCAN (para os blocos sugeridos). */
  all: SelectionRow[];
  /** Opções dos filtros: fornecedores e origens dos bookings. */
  suppliers: Array<{ id: string; name: string }>;
  origins: string[];
}

/** Itens olhados para os blocos sugeridos. */
export const SELECTION_SCAN = 2000;

export interface SelectionOptions {
  filters?: SelectionFilters;
  /** Grupo para comparar: só estes itens (os filtros não valem). */
  ids?: string[];
}

/**
 * Itens dos bookings (rascunho, fechado, em andamento, concluído; o
 * cancelado só pelo filtro) que combinam com a busca (cada palavra em algum
 * lugar: descrição, nome, código, material, fornecedor, origem, nº do
 * booking…) e os filtros, ordenados pela descrição para os parecidos
 * ficarem juntos. `null`: tabelas sem publicar.
 */
export async function listSelectionItems(
  user: User,
  query: string,
  options: SelectionOptions = {},
): Promise<SelectionResult | null> {
  assertWellmix(user);
  assertScreen(user, "booking");
  const store = getStore();
  const filters = options.filters ?? {
    statuses: [],
    from: null,
    to: null,
    supplierId: null,
    origin: null,
  };
  let lots: BookingLot[];
  let items: BookingItem[];
  let requests: SupplierRequest[];
  try {
    lots = await store.list("booking_lots", {
      filter: { status: [...SELECTION_STATUSES] },
    });
    const shown = options.ids
      ? lots
      : lots.filter((l) => lotMatchesFilters(l, filters));
    items = options.ids
      ? options.ids.length
        ? await store.list("booking_items", { filter: { id: options.ids } })
        : []
      : shown.length
        ? await store.list("booking_items", {
            filter: { lotId: shown.map((l) => l.id) },
          })
        : [];
    requests = items.length
      ? await store.list("supplier_requests", {
          filter: { status: ["open", "answered"] },
        })
      : [];
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  const lotOf = new Map(lots.map((l) => [l.id, l]));
  const supplierIds = [
    ...new Set(lots.map((l) => l.supplierId).filter((s): s is string => !!s)),
  ];
  const suppliers = supplierIds.length
    ? await store.list("parties", { filter: { id: supplierIds } })
    : [];
  const partyOf = new Map(suppliers.map((p) => [p.id, p]));
  const activeOf = new Map(requests.map((r) => [r.bookingItemId, r]));
  const words = searchWords(query);
  const rowOf = (item: BookingItem): SelectionRow | null => {
    const lot = lotOf.get(item.lotId);
    if (!lot) return null;
    return {
      item,
      lot,
      supplier: lot.supplierId ? (partyOf.get(lot.supplierId) ?? null) : null,
      activeRequest: activeOf.get(item.id) ?? null,
    };
  };
  const matched = items
    .map(rowOf)
    .filter((r): r is SelectionRow => !!r)
    .filter((r) =>
      matchesItemSearch(
        [
          itemSearchText(r.item),
          searchWords(
            [r.supplier?.name, r.lot.origin, `${r.lot.number}`]
              .filter(Boolean)
              .join(" "),
          ).join(" "),
        ].join(" "),
        words,
      ),
    )
    .sort(
      (a, b) =>
        (a.item.description ?? a.item.productName ?? "").localeCompare(
          b.item.description ?? b.item.productName ?? "",
          "pt",
          { sensitivity: "base", numeric: true },
        ) || a.item.position - b.item.position,
    );
  const visibleLots = lots.filter((l) => l.status !== "cancelled");
  return {
    total: matched.length,
    rows: matched.slice(0, SELECTION_MAX),
    all: matched.slice(0, SELECTION_SCAN),
    suppliers: [
      ...new Set(visibleLots.map((l) => l.supplierId).filter(Boolean)),
    ]
      .map((id) => partyOf.get(id as string))
      .filter((p): p is Party => !!p)
      .map((p) => ({ id: p.id, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt")),
    origins: [
      ...new Set(
        visibleLots
          .map((l) => l.origin?.trim())
          .filter((o): o is string => !!o),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt")),
  };
}

/* ------------------------------------------------------------------------ */
/* Abrir                                                                     */
/* ------------------------------------------------------------------------ */

export interface OpenSupplierRequestInput {
  itemId: string;
  alternativeIds: string[];
  /** Vazio: a quantidade da planilha do item. */
  quantity: number | null;
  needs: string | null;
  searchQuery: string | null;
}

/**
 * Uma solicitação com vários produtos: os abertos juntos para o mesmo
 * fornecedor levam o mesmo número e o mesmo `batchId`.
 */
export interface SupplierRequestBatch {
  id: string;
  number: number;
}

/**
 * Com `batches` (um por fornecedor, preenchido aqui), o produto entra na
 * solicitação do fornecedor em vez de ganhar número próprio, e o aviso ao
 * fornecedor fica com quem chamou (um só, com todos os produtos).
 *
 * Abre a solicitação ao fornecedor do item escolhido (uma por item; o item
 * com solicitação em andamento recusa). O booking fechado passa a "Em
 * andamento" e os logins do fornecedor recebem o aviso.
 */
export async function openSupplierRequest(
  user: User,
  input: OpenSupplierRequestInput,
  batches?: Map<string, SupplierRequestBatch>,
): Promise<SupplierRequest> {
  assertWellmix(user);
  assertScreen(user, "booking");
  const store = getStore();
  const item = await withSchema(() => store.get("booking_items", input.itemId));
  if (!item) throw new SupplierRequestError("not_found");
  const lot = await store.get("booking_lots", item.lotId);
  if (!lot || !(SELECTABLE_LOTS as readonly string[]).includes(lot.status))
    throw new SupplierRequestError("supplier_request_lot_not_closed");
  // Vai para o responsável pelo booking; sem ele, para o fornecedor do booking.
  const { bookingRecipientId, BOOKING_PARTNER_TYPES } =
    await import("./booking-lots");
  const recipientId = bookingRecipientId(lot);
  if (!recipientId)
    throw new SupplierRequestError("supplier_request_no_supplier");
  const supplier = await store.get("parties", recipientId);
  if (
    !supplier ||
    !supplier.active ||
    !(BOOKING_PARTNER_TYPES as readonly string[]).includes(supplier.type)
  )
    throw new SupplierRequestError("supplier_invalid");
  const existing = await withSchema(() =>
    store.list("supplier_requests", { filter: { bookingItemId: item.id } }),
  );
  if (existing.some((r) => supplierRequestActive(r.status)))
    throw new SupplierRequestError("supplier_request_exists");

  const quantity = input.quantity ?? sheetQuantity(item);
  if (
    quantity === null ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 1e9
  )
    throw new SupplierRequestError("supplier_request_qty_required");

  const altIds = [...new Set(input.alternativeIds)]
    .filter((id) => id && id !== item.id)
    .slice(0, MAX_ALTERNATIVES);
  const alternatives = altIds.length
    ? await store.list("booking_items", { filter: { id: altIds } })
    : [];

  let batch = batches?.get(supplier.id) ?? null;
  if (batches && !batch) {
    batch = {
      id: crypto.randomUUID(),
      number: await store.nextNumber(COUNTER),
    };
    batches.set(supplier.id, batch);
  }
  const number = batch ? batch.number : await store.nextNumber(COUNTER);
  const request = await store.create("supplier_requests", {
    number,
    ...(batch ? { batchId: batch.id } : {}),
    status: "open",
    supplierId: supplier.id,
    bookingItemId: item.id,
    bookingLotId: lot.id,
    alternativeItemIds: alternatives.length
      ? alternatives.map((a) => a.id)
      : null,
    item: supplierRequestItemOf(item),
    quantity: Math.round(quantity),
    unit: "pcs",
    needs: clip(input.needs, 4000),
    searchQuery: clip(input.searchQuery, 200),
    supplierCanDo: null,
    supplierPrice: null,
    supplierCurrency: null,
    supplierMoq: null,
    supplierLeadTimeDays: null,
    supplierNote: null,
    respondedAt: null,
    respondedByUserId: null,
    decidedAt: null,
    decidedByUserId: null,
    decisionNote: null,
    createdByUserId: user.id,
  });
  if (lot.status === "closed")
    await store.update("booking_lots", lot.id, {
      status: "in_progress",
      statusChangedAt: new Date().toISOString(),
      statusChangedByUserId: user.id,
    });
  await audit(
    user,
    "supplier_request.open",
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${number}: ${supplier.name}, ${request.quantity} pcs (booking nº ${lot.number})`,
  );
  if (batches) return request;
  const { notify } = await import("./notifications");
  await notify(
    { role: "supplier", partyId: supplier.id },
    {
      link: `/app/supplier-requests/${request.id}`,
      kind: "action",
      text: (t) => ({
        subject: t("supplierRequests.notify.open.subject", { n: number }),
        body: t("supplierRequests.notify.open.body", {
          n: number,
          code: request.item.factoryItemCode ?? request.item.description ?? "",
          qty: request.quantity,
        }),
      }),
    },
  ).catch((error) => console.error("notify(supplier_request.open)", error));
  return request;
}

/* ------------------------------------------------------------------------ */
/* Leitura                                                                   */
/* ------------------------------------------------------------------------ */

/** Quem vê: a Wellmix (tela Cotações) todas; o fornecedor só as do próprio cadastro. */
function canSee(user: User, request: SupplierRequest) {
  if (isWellmix(user)) return true;
  return (
    user.role === "supplier" &&
    !!user.partyId &&
    request.supplierId === user.partyId
  );
}

export interface SupplierRequestListEntry {
  request: SupplierRequest;
  supplier: Party | null;
}

export async function listSupplierRequests(
  user: User,
): Promise<SupplierRequestListEntry[] | null> {
  assertScreen(user, "quotes");
  const store = getStore();
  let rows: SupplierRequest[];
  try {
    if (isWellmix(user)) rows = await store.list("supplier_requests");
    else if (user.role === "supplier" && user.partyId)
      rows = await store.list("supplier_requests", {
        filter: { supplierId: user.partyId },
      });
    else rows = [];
  } catch (error) {
    const { isSchemaMissing } = await import("@/lib/db/errors");
    if (isSchemaMissing(error)) return null;
    throw error;
  }
  rows.sort((a, b) => b.number - a.number);
  const ids = [...new Set(rows.map((r) => r.supplierId))];
  const parties = ids.length
    ? await store.list("parties", { filter: { id: ids } })
    : [];
  const partyOf = new Map(parties.map((p) => [p.id, p]));
  return rows.map((request) => ({
    request,
    supplier: partyOf.get(request.supplierId) ?? null,
  }));
}

export interface SupplierRequestDetail {
  request: SupplierRequest;
  supplier: Party | null;
  /** Só para a Wellmix: o booking e os itens alternativos com o fornecedor de cada um. */
  lot: BookingLot | null;
  chosen: BookingItem | null;
  alternatives: Array<{
    item: BookingItem;
    lot: BookingLot | null;
    supplier: Party | null;
  }>;
}

export async function getSupplierRequest(
  user: User,
  id: string,
): Promise<SupplierRequestDetail | null> {
  assertScreen(user, "quotes");
  const store = getStore();
  const request = await withSchema(() => store.get("supplier_requests", id));
  if (!request || !canSee(user, request)) return null;
  const supplier = await store.get("parties", request.supplierId);
  if (!isWellmix(user))
    return { request, supplier, lot: null, chosen: null, alternatives: [] };
  const altIds = request.alternativeItemIds ?? [];
  const [lot, chosen, alts] = await Promise.all([
    store.get("booking_lots", request.bookingLotId),
    store.get("booking_items", request.bookingItemId),
    altIds.length
      ? store.list("booking_items", { filter: { id: altIds } })
      : Promise.resolve([] as BookingItem[]),
  ]);
  const lotIds = [...new Set(alts.map((a) => a.lotId))];
  const lots = lotIds.length
    ? await store.list("booking_lots", { filter: { id: lotIds } })
    : [];
  const lotOf = new Map(lots.map((l) => [l.id, l]));
  const partyIds = [
    ...new Set(lots.map((l) => l.supplierId).filter((s): s is string => !!s)),
  ];
  const parties = partyIds.length
    ? await store.list("parties", { filter: { id: partyIds } })
    : [];
  const partyOf = new Map(parties.map((p) => [p.id, p]));
  return {
    request,
    supplier,
    lot,
    chosen,
    alternatives: alts.map((item) => {
      const l = lotOf.get(item.lotId) ?? null;
      return {
        item,
        lot: l,
        supplier: l?.supplierId ? (partyOf.get(l.supplierId) ?? null) : null,
      };
    }),
  };
}

/**
 * Produtos da solicitação (a tabela que se vê primeiro): os que foram
 * abertos juntos para o fornecedor (`batchId`), em ordem de abertura. A
 * antiga, sem `batchId`, é só ela mesma (decisão do dono, 11/11/2026: a tela
 * não mostra as outras do mesmo fornecedor e booking). Quem não vê, nada.
 */
export async function supplierRequestGroup(
  user: User,
  request: SupplierRequest,
): Promise<SupplierRequest[]> {
  if (!canSee(user, request)) return [];
  if (!request.batchId) return [request];
  const rows = await getStore().list("supplier_requests", {
    filter: { supplierId: request.supplierId },
  });
  const key = requestGroupKey(request);
  const group = rows.filter(
    (r) => requestGroupKey(r) === key && canSee(user, r),
  );
  if (!group.some((r) => r.id === request.id)) group.push(request);
  return group.sort(
    (a, b) => a.number - b.number || a.createdAt.localeCompare(b.createdAt),
  );
}

/**
 * Respostas gravadas antes do histórico de respostas (só a última ficava na
 * solicitação): a hora e o "faz/não faz" de cada uma vêm da auditoria
 * (`supplier_request.answer`). Por solicitação, em ordem. Só serve às
 * solicitações sem passo `answer` no histórico.
 */
export async function legacyAnswers(
  requests: SupplierRequest[],
): Promise<Map<string, Array<{ at: string; canDo: YesNo | null }>>> {
  const ids = requests
    .filter((r) => !(r.negotiation ?? []).some((e) => e.kind === "answer"))
    .filter((r) => r.respondedAt)
    .map((r) => r.id);
  const out = new Map<string, Array<{ at: string; canDo: YesNo | null }>>();
  if (!ids.length) return out;
  const rows = await getStore()
    .list("audit_log", {
      filter: { entityId: ids, action: "supplier_request.answer" },
    })
    .catch(() => []);
  rows.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  for (const row of rows) {
    const list = out.get(row.entityId) ?? [];
    list.push({
      at: row.createdAt,
      canDo: /não faz/.test(row.summary) ? "no" : "yes",
    });
    out.set(row.entityId, list);
  }
  return out;
}

/**
 * O fornecedor dono da solicitação vê a foto do item dela (o documento é
 * interno: sem isto só a Wellmix abriria).
 */
export async function supplierSeesRequestPhoto(
  user: User,
  documentId: string,
): Promise<boolean> {
  if (user.role !== "supplier" || !user.partyId) return false;
  try {
    const rows = await getStore().list("supplier_requests", {
      filter: { supplierId: user.partyId },
    });
    return rows.some((r) => r.item?.photoDocumentId === documentId);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------------ */
/* Resposta do fornecedor                                                    */
/* ------------------------------------------------------------------------ */

export interface SupplierAnswerInput {
  canDo: YesNo;
  price: number | null;
  currency: SheetCurrency | null;
  moq: number | null;
  leadTimeDays: number | null;
  note: string | null;
  /** Modalidade de entrega (FOB/EXW); sem ela, a do item do booking. */
  incoterm?: SheetIncoterm | null;
}

/**
 * Resposta do fornecedor (ou registrada pela Wellmix em nome dele): se faz o
 * que foi pedido e as condições. Muda enquanto a Wellmix não decidiu.
 */
export async function answerSupplierRequest(
  user: User,
  id: string,
  input: SupplierAnswerInput,
): Promise<SupplierRequest> {
  assertScreen(user, "quotes");
  const store = getStore();
  const request = await withSchema(() => store.get("supplier_requests", id));
  if (!request || !canSee(user, request))
    throw new SupplierRequestError("not_found");
  // A resposta é do fornecedor: a Wellmix (mesmo admin) não responde por ele.
  if (isWellmix(user))
    throw new SupplierRequestError("supplier_request_supplier_only");
  if (!supplierCanAnswer(request.status))
    throw new SupplierRequestError("supplier_request_closed");
  // Com contraproposta esperando: aceitar, outra proposta ou recusar.
  if (pendingProposal(request.negotiation))
    throw new SupplierRequestError("supplier_request_proposal_pending");
  if (input.canDo === "yes" && input.price === null)
    throw new SupplierRequestError("supplier_request_price_required");
  const now = new Date().toISOString();
  const incoterm =
    input.canDo === "yes"
      ? (input.incoterm ?? request.item.incoterm ?? null)
      : (input.incoterm ?? null);
  const price = input.canDo === "yes" ? input.price : null;
  // Cada resposta entra no histórico (linha do tempo, primeira e última resposta).
  const answerEvent: SupplierRequestEvent = {
    id: crypto.randomUUID(),
    at: now,
    kind: "answer",
    side: "supplier",
    byUserId: user.id,
    canDo: input.canDo,
    price,
    currency: price === null ? null : (input.currency ?? "USD"),
    moq: input.moq,
    leadTimeDays: input.leadTimeDays,
    incoterm,
    text: clip(input.note, 4000),
    onBehalf: false,
  };
  const updated = await store.update("supplier_requests", request.id, {
    status: "answered",
    supplierCanDo: input.canDo,
    supplierIncoterm: incoterm,
    negotiation: [...(request.negotiation ?? []), answerEvent].slice(-500),
    supplierPrice: input.price,
    supplierCurrency: input.price === null ? null : (input.currency ?? "USD"),
    supplierMoq: input.moq,
    supplierLeadTimeDays: input.leadTimeDays,
    supplierNote: clip(input.note, 4000),
    respondedAt: now,
    respondedByUserId: user.id,
  });
  await audit(
    user,
    "supplier_request.answer",
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${request.number}: ${input.canDo === "yes" ? "faz" : "não faz"}`,
  );
  if (!isWellmix(user)) {
    const { notify } = await import("./notifications");
    await notify(
      { userIds: [request.createdByUserId] },
      {
        link: `/app/supplier-requests/${request.id}`,
        kind: "action",
        actor: "wellmix",
        text: (t) => ({
          subject: t("supplierRequests.notify.answer.subject", {
            n: request.number,
          }),
          body: t(
            input.canDo === "yes"
              ? "supplierRequests.notify.answer.yes"
              : "supplierRequests.notify.answer.no",
            { n: request.number },
          ),
        }),
      },
    ).catch((error) => console.error("notify(supplier_request.answer)", error));
  }
  return updated;
}

/* ------------------------------------------------------------------------ */
/* Decisão da Wellmix                                                        */
/* ------------------------------------------------------------------------ */

export async function decideSupplierRequest(
  user: User,
  id: string,
  decision: "approved" | "declined" | "cancelled",
  note: string | null,
): Promise<SupplierRequest> {
  assertWellmix(user);
  assertScreen(user, "quotes");
  assertCan(user, "supplierRequest.decide");
  const store = getStore();
  const request = await withSchema(() => store.get("supplier_requests", id));
  if (!request) throw new SupplierRequestError("not_found");
  if (
    !supplierRequestDecisions(
      request.status,
      request.supplierCanDo,
      !!pendingProposal(request.negotiation),
    ).includes(decision)
  )
    throw new SupplierRequestError("supplier_request_decision_invalid");
  const updated = await store.update("supplier_requests", request.id, {
    status: decision,
    decidedAt: new Date().toISOString(),
    decidedByUserId: user.id,
    decisionNote: clip(note, 500),
  });
  await audit(
    user,
    `supplier_request.${decision}`,
    "supplier_request",
    request.id,
    `Solicitação ao fornecedor nº ${request.number}: ${request.status} → ${decision}`,
    { status: request.status },
    { status: decision },
  );
  const { notify } = await import("./notifications");
  await notify(
    { role: "supplier", partyId: request.supplierId },
    {
      link: `/app/supplier-requests/${request.id}`,
      kind: decision === "approved" ? "done" : "info",
      actor: null,
      text: (t) => ({
        subject: t(`supplierRequests.notify.${decision}.subject`, {
          n: request.number,
        }),
        body: t(`supplierRequests.notify.${decision}.body`, {
          n: request.number,
        }),
      }),
    },
  ).catch((error) => console.error("notify(supplier_request.decide)", error));
  return updated;
}
