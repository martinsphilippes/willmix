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
