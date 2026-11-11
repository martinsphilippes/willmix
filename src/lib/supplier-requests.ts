import type {
  BookingItem,
  SupplierRequest,
  SupplierRequestEvent,
  SupplierRequestItem,
  SupplierRequestStatus,
} from "@/lib/db/schema";

/*
 * Seleção de itens e solicitação ao fornecedor (docs/SUPPLIER_REQUESTS.md):
 * regras puras, sem banco.
 */

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Texto do item em que a busca procura: descrição, nome, código, material, embalagem e cores. */
export function itemSearchText(
  item: Pick<
    BookingItem,
    | "description"
    | "productName"
    | "factoryItemCode"
    | "itemNumber"
    | "material"
    | "packageType"
    | "colorAssortment"
  >,
): string {
  return fold(
    [
      item.description,
      item.productName,
      item.factoryItemCode,
      item.itemNumber,
      item.material,
      item.packageType,
      item.colorAssortment,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** Palavras da busca (sem acento nem caixa). */
export const searchWords = (query: string) =>
  fold(query)
    .split(/[^a-z0-9一-鿿]+/)
    .filter(Boolean);

/** O item combina com a busca: cada palavra aparece em algum lugar (parte da palavra vale). */
export function matchesItemSearch(text: string, words: string[]): boolean {
  return words.every((w) => text.includes(w));
}

/** Palavras que não ajudam a achar itens parecidos. */
const STOP = new Set([
  "de",
  "da",
  "do",
  "com",
  "para",
  "e",
  "the",
  "of",
  "with",
  "for",
  "and",
  "a",
  "in",
  "pcs",
  "pc",
  "set",
  "new",
]);

/**
 * Busca para "ver parecidos": as duas primeiras palavras significativas da
 * descrição (ou do nome), sem números, medidas nem palavras vazias.
 */
/** Palavras significativas da descrição (ou do nome): sem números nem palavras vazias. */
export function itemKeywords(
  item: Pick<BookingItem, "description" | "productName">,
): string[] {
  return searchWords(item.description ?? item.productName ?? "").filter(
    (w) => w.length >= 3 && !/\d/.test(w) && !STOP.has(w),
  );
}

export function similarQuery(
  item: Pick<BookingItem, "description" | "productName">,
): string {
  const words = searchWords(item.description ?? item.productName ?? "").filter(
    (w) => w.length >= 3 && !/\d/.test(w) && !STOP.has(w),
  );
  return words.slice(0, 2).join(" ");
}

/** Preço em US$: dólar direto; RMB pela cotação (RMB por US$). Outra moeda: nulo. */
export function priceInUsd(
  price: number | null,
  currency: string | null,
  rmbPerUsd: number | null,
): number | null {
  if (price === null || !Number.isFinite(price)) return null;
  if (currency === "USD") return price;
  if (currency === "RMB" && rmbPerUsd && rmbPerUsd > 0)
    return price / rmbPerUsd;
  return null;
}

/** O id do item de menor preço mínimo do Superplan entre os mostrados (o "melhor caso"). */
export function bestMinimumItem(items: BookingItem[]): string | null {
  let best: BookingItem | null = null;
  for (const item of items) {
    const min = item.analysis?.minimumBrl;
    if (typeof min !== "number" || !Number.isFinite(min)) continue;
    if (!best || min < (best.analysis?.minimumBrl ?? Infinity)) best = item;
  }
  return best?.id ?? null;
}

/** Cópia do item para a solicitação (o que o fornecedor vê). */
export function supplierRequestItemOf(item: BookingItem): SupplierRequestItem {
  return {
    itemNumber: item.itemNumber,
    factoryItemCode: item.factoryItemCode,
    productName: item.productName,
    description: item.description,
    incoterm: item.incoterm,
    currency: item.currency,
    price: item.price,
    masterCartonQty: item.masterCartonQty,
    innerQty: item.innerQty,
    netWeightPcKg: item.netWeightPcKg,
    grossWeightPcKg: item.grossWeightPcKg,
    cbmPerCarton: item.cbmPerCarton,
    lengthCm: item.lengthCm,
    widthCm: item.widthCm,
    heightCm: item.heightCm,
    capacityMl: item.capacityMl,
    packageType: item.packageType,
    material: item.material,
    moq: item.moq,
    colorAssortment: item.colorAssortment,
    powerDetail: item.powerDetail,
    photoDocumentId: item.photoDocumentId,
  };
}

/** Quantidade da planilha do item: a de compra; senão as peças planejadas (TT PCS). */
export const sheetQuantity = (
  item: Pick<BookingItem, "purchaseQty" | "plannedQty">,
): number | null => item.purchaseQty ?? item.plannedQty ?? null;

/** Solicitação ainda em andamento (ocupa o item: não abre outra para ele). */
export const supplierRequestActive = (status: SupplierRequestStatus) =>
  status === "open" || status === "answered";

/** O fornecedor responde (ou muda a resposta) enquanto a Wellmix não decidiu. */
export const supplierCanAnswer = supplierRequestActive;

/**
 * Decisões da Wellmix em cada status. Com contraproposta esperando o
 * fornecedor, não aprova (ainda não se sabe o que ele aceita).
 */
export function supplierRequestDecisions(
  status: SupplierRequestStatus,
  canDo: "yes" | "no" | null,
  proposalPending = false,
): Array<"approved" | "declined" | "cancelled"> {
  if (status === "open") return ["cancelled", "declined"];
  if (status === "answered") {
    if (proposalPending) return ["declined"];
    return canDo === "yes" ? ["approved", "declined"] : ["declined"];
  }
  return [];
}

/* ---- Negociação (docs/SUPPLIER_REQUESTS.md, "Negociação") ---- */

/** Passos que mudam os valores negociados (as mensagens não contam). */
const OFFER_KINDS = new Set(["proposal", "accept", "counter", "reject"]);

/**
 * A contraproposta da Wellmix que ainda espera o fornecedor (o último passo
 * de valores é uma contraproposta), ou nulo.
 */
export function pendingProposal(
  events: SupplierRequestEvent[] | null | undefined,
): SupplierRequestEvent | null {
  const offers = (events ?? []).filter((e) => OFFER_KINDS.has(e.kind));
  const last = offers.at(-1);
  return last?.kind === "proposal" ? last : null;
}

/** De quem é a vez: o fornecedor (responder) ou a Wellmix (decidir); nulo depois de decidida. */
export function negotiationTurn(
  request: Pick<SupplierRequest, "status" | "negotiation">,
): "supplier" | "wellmix" | null {
  if (request.status === "open") return "supplier";
  if (request.status !== "answered") return null;
  return pendingProposal(request.negotiation) ? "supplier" : "wellmix";
}

/** A Wellmix devolve com contraproposta: na resposta "faz", sem outra esperando. */
export const canPropose = (
  request: Pick<SupplierRequest, "status" | "supplierCanDo" | "negotiation">,
) =>
  request.status === "answered" &&
  request.supplierCanDo === "yes" &&
  !pendingProposal(request.negotiation);

/** Mensagens e arquivos: enquanto a solicitação está em andamento ou aprovada. */
export const canPostMessage = (status: SupplierRequestStatus) =>
  status === "open" || status === "answered" || status === "approved";

/** Padrão do SLA da negociação (Configurações), em minutos. */
export const SUPPLIER_REQUEST_SLA_DEFAULT = 30;
export const SUPPLIER_REQUEST_SLA_MIN = 1;
export const SUPPLIER_REQUEST_SLA_MAX = 60 * 24 * 60;

/** Prazo da negociação: da abertura da solicitação até a decisão da Wellmix. */
export function supplierRequestSlaDue(
  request: Pick<SupplierRequest, "createdAt">,
  minutes: number,
): string {
  return new Date(
    new Date(request.createdAt).getTime() + minutes * 60_000,
  ).toISOString();
}

/** Atrasada: ainda sem decisão e o prazo passou. */
export function supplierRequestLate(
  request: Pick<SupplierRequest, "createdAt" | "status">,
  minutes: number,
  now: Date = new Date(),
): boolean {
  if (!supplierRequestActive(request.status)) return false;
  return (
    now.getTime() > new Date(request.createdAt).getTime() + minutes * 60_000
  );
}

/* ---- Respostas e linha do tempo (docs/SUPPLIER_REQUESTS.md, "Tabela" e "Linha do tempo") ---- */

/** Passos em que o fornecedor responde (a resposta e o que faz com a contraproposta). */
const ANSWER_KINDS = new Set(["answer", "accept", "counter", "reject"]);

/**
 * Data e hora da primeira e da última resposta do fornecedor. As respostas
 * gravadas antes do histórico de respostas só têm `respondedAt` (a última).
 */
export function answerTimes(
  request: Pick<SupplierRequest, "negotiation" | "respondedAt">,
): { first: string | null; last: string | null } {
  const times = (request.negotiation ?? [])
    .filter((e) => e.side === "supplier" && ANSWER_KINDS.has(e.kind))
    .map((e) => e.at);
  if (request.respondedAt) times.push(request.respondedAt);
  if (!times.length) return { first: null, last: null };
  times.sort();
  return { first: times[0], last: times[times.length - 1] };
}

export type TimelineKind =
  | "opened"
  | SupplierRequestEvent["kind"]
  | "decided"
  | "product"
  | "showcase"
  | "erp";

/** Um ponto da linha do tempo: quando, quem e o que ficou resolvido. */
export interface TimelineEntry {
  key: string;
  at: string;
  kind: TimelineKind;
  side: "wellmix" | "supplier";
  /** Passo da negociação (valores, texto, arquivo), quando houver. */
  event?: SupplierRequestEvent;
  /** Decisão da Wellmix ou o que foi feito com o produto. */
  outcome?: string | null;
  note?: string | null;
}

/**
 * Histórico da solicitação em ordem: abertura, respostas, contrapropostas,
 * mensagens, decisão e o produto. Resposta antiga sem passo no histórico
 * entra pela `respondedAt`.
 */
export function requestTimeline(request: SupplierRequest): TimelineEntry[] {
  const out: TimelineEntry[] = [
    {
      key: "opened",
      at: request.createdAt,
      kind: "opened",
      side: "wellmix",
    },
  ];
  const events = request.negotiation ?? [];
  for (const e of events)
    out.push({ key: e.id, at: e.at, kind: e.kind, side: e.side, event: e });
  if (request.respondedAt && !events.some((e) => e.kind === "answer"))
    out.push({
      key: "answer-legacy",
      at: request.respondedAt,
      kind: "answer",
      side: "supplier",
      event: {
        id: "answer-legacy",
        at: request.respondedAt,
        kind: "answer",
        side: "supplier",
        byUserId: request.respondedByUserId ?? "",
        canDo: request.supplierCanDo,
        price: request.supplierPrice,
        currency: request.supplierCurrency,
        moq: request.supplierMoq,
        leadTimeDays: request.supplierLeadTimeDays,
        incoterm: request.supplierIncoterm ?? null,
        text: request.supplierNote,
      },
    });
  if (request.decidedAt)
    out.push({
      key: "decided",
      at: request.decidedAt,
      kind: "decided",
      side: "wellmix",
      outcome: request.status,
      note: request.decisionNote,
    });
  if (request.productLinkedAt)
    out.push({
      key: "product",
      at: request.productLinkedAt,
      kind: "product",
      side: "wellmix",
      outcome: request.productAction ?? null,
    });
  if (request.showcaseReleasedAt)
    out.push({
      key: "showcase",
      at: request.showcaseReleasedAt,
      kind: "showcase",
      side: "wellmix",
    });
  if (request.erpCheckedAt)
    out.push({
      key: "erp",
      at: request.erpCheckedAt,
      kind: "erp",
      side: "wellmix",
    });
  return out.sort((a, b) => (a.at === b.at ? 0 : a.at < b.at ? -1 : 1));
}

/** Condições de uma resposta "faz": preço, moeda, MOQ, entrega e prazo. */
export interface RequestConditions {
  price: number | null;
  currency: string | null;
  moq: number | null;
  incoterm: string | null;
  leadTimeDays: number | null;
}

/**
 * Condições iniciais da negociação: a primeira resposta "faz" do fornecedor.
 * Resposta antiga sem passo no histórico: as atuais, se nada foi negociado
 * depois (sem contraproposta); senão não se sabe (nulo).
 */
export function initialConditions(
  request: SupplierRequest,
): RequestConditions | null {
  const events = request.negotiation ?? [];
  const first = events.find((e) => e.kind === "answer" && e.canDo === "yes");
  if (first)
    return {
      price: first.price ?? null,
      currency: first.currency ?? null,
      moq: first.moq ?? null,
      incoterm: first.incoterm ?? null,
      leadTimeDays: first.leadTimeDays ?? null,
    };
  if (events.some((e) => e.kind === "answer" || OFFER_KINDS.has(e.kind)))
    return null;
  return finalConditions(request);
}

/** Condições finais (as que valem hoje): a resposta atual, quando "faz". */
export function finalConditions(
  request: SupplierRequest,
): RequestConditions | null {
  if (request.supplierCanDo !== "yes") return null;
  return {
    price: request.supplierPrice,
    currency: request.supplierCurrency,
    moq: request.supplierMoq,
    incoterm: request.supplierIncoterm ?? null,
    leadTimeDays: request.supplierLeadTimeDays,
  };
}

/**
 * Finalizada (decidida) depois do prazo do SLA? Nulo enquanto não foi
 * decidida. O prazo é o mesmo do selo "Atrasada": abertura + minutos.
 */
export function finishedLate(
  request: Pick<SupplierRequest, "createdAt" | "decidedAt">,
  minutes: number,
): boolean | null {
  if (!request.decidedAt) return null;
  return (
    new Date(request.decidedAt).getTime() >
    new Date(request.createdAt).getTime() + minutes * 60_000
  );
}

/**
 * A que solicitação o produto pertence: os abertos juntos para o mesmo
 * fornecedor (`batchId`) são uma solicitação só. A antiga, sem `batchId`, é
 * uma solicitação sozinha.
 */
export function requestGroupKey(
  r: Pick<SupplierRequest, "id" | "batchId">,
): string {
  return r.batchId ? `batch:${r.batchId}` : `single:${r.id}`;
}

/** As solicitações, cada uma com os seus produtos (na ordem em que chegam). */
export function groupRequests<
  T extends Pick<SupplierRequest, "id" | "batchId">,
>(requests: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const r of requests) {
    const key = requestGroupKey(r);
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  return [...groups.values()];
}

/**
 * Produtos distintos por fornecedor e booking: quantos itens diferentes
 * foram pedidos.
 */
export function distinctProductsByGroup(
  requests: Pick<
    SupplierRequest,
    "supplierId" | "bookingLotId" | "bookingItemId"
  >[],
): Map<string, number> {
  const sets = new Map<string, Set<string>>();
  for (const r of requests) {
    const key = `${r.supplierId}:${r.bookingLotId}`;
    const set = sets.get(key) ?? new Set<string>();
    set.add(r.bookingItemId);
    sets.set(key, set);
  }
  return new Map([...sets].map(([k, v]) => [k, v.size]));
}
