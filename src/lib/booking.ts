import type { BookingAnalysis, BookingStatus } from "@/lib/db/schema";
import { parseNumberInput } from "@/lib/number-input";

export { estimatedGrossKg } from "@/lib/weights";

/*
 * Booking (docs/BOOKING.md): o que acontece com um produto que chegou pela
 * ficha técnica, ANTES de virar solicitação. Uma linha por produto:
 *
 *  Novo → Em análise → Aprovado → Oferecido ao cliente → Reservado pelo
 *  cliente → Virou solicitação            (e Descartado, de qualquer etapa)
 *
 * Regras puras (sem banco): etapas, quem pode mover, o que cada etapa exige,
 * quando o produto aparece na vitrine do cliente, e os filtros da tela (toda
 * coluna filtra; o filtro mora no endereço da página). A tela, o serviço
 * (src/lib/services/booking.ts) e os testes usam as mesmas funções.
 */

/** As etapas na ordem do processo (o "Descartado" fica fora da fila). */
export const BOOKING_FLOW = [
  "new",
  "analysis",
  "approved",
  "offered",
  "reserved",
  "requested",
] as const satisfies readonly BookingStatus[];

/**
 * Etapas em que o produto ainda NÃO aparece para o cliente (vitrine, carrinho,
 * nova solicitação): só depois de aprovado no Booking ele entra na vitrine.
 */
export const BOOKING_HIDDEN: readonly BookingStatus[] = [
  "new",
  "analysis",
  "discarded",
];

export const hidesFromShowcase = (status: BookingStatus) =>
  BOOKING_HIDDEN.includes(status);

/** Etapas de onde sai a solicitação ("Gerar solicitação"). */
export const BOOKING_REQUESTABLE: readonly BookingStatus[] = [
  "approved",
  "offered",
  "reserved",
];

/** Códigos de recusa do Booking (texto em `booking.error.<código>`). */
export const BOOKING_ERRORS = [
  "booking_not_found",
  /** "Virou solicitação" só é gravada pelo "Gerar solicitação". */
  "booking_request_only",
  /** Liberar para a vitrine, tirar dela ou reabrir: só quem analisa (tela Superplan). */
  "booking_approver_required",
  "booking_customer_required",
  "booking_customer_invalid",
  "booking_qty_required",
  "booking_qty_below_moq",
  "booking_owner_invalid",
  /** Gerar solicitação: nenhuma linha marcada. */
  "booking_none_selected",
  /** Ação em várias linhas: linhas demais de uma vez. */
  "booking_too_many",
  /** Gerar solicitação: mais linhas do que um lote aceita. */
  "booking_request_too_many",
  /** Gerar solicitação: linha ainda não aprovada, descartada ou já solicitada. */
  "booking_not_requestable",
  /** Gerar solicitação: linha reservada para outro cliente. */
  "booking_customer_mismatch",
  /** Gerar solicitação: linha sem quantidade reservada e produto sem pedido mínimo. */
  "booking_qty_missing",
  /** Produto com variações: a solicitação precisa da variação (use a Nova solicitação). */
  "booking_variant_required",
  "booking_product_missing",
  /** Análise do Superplan: só quem abre o Superplan. */
  "booking_analysis_forbidden",
  "booking_note_too_long",
  /** Linha que já virou solicitação: cliente e quantidade não mudam aqui. */
  "booking_locked",
  /** Editar dados: algum valor digitado não deu para ler. */
  "booking_data_invalid",
  /** A linha mudou (outra pessoa, outra aba) entre a conferência e a gravação. */
  "booking_changed",
  /** Linha com solicitação em andamento: só volta quando a solicitação é excluída. */
  "booking_request_alive",
  /** Linha recém-tomada: a solicitação dela ainda está sendo criada. */
  "booking_request_pending",
  /** Reabrir uma linha cuja solicitação virou pedido: só quem analisa. */
  "booking_reopen_forbidden",
  /** Gerar solicitação: faltou o cliente (linhas sem cliente e nenhum escolhido). */
  "booking_request_customer",
  /** Barra de ações: faltou escolher a etapa ou o responsável. */
  "booking_status_required",
  "booking_owner_required",
] as const;
export type BookingErrorCode = (typeof BOOKING_ERRORS)[number];

/** Quantas linhas uma ação em lote aceita (a página tem 100). */
export const BOOKING_BULK_MAX = 100;
/** Quantas linhas viram uma solicitação de uma vez (um lote). */
export const BOOKING_REQUEST_MAX = 30;

/** Quem está mexendo: `canApprove` = abre a tela Superplan (hoje, o administrador). */
export interface BookingActor {
  canApprove: boolean;
}

/**
 * Situações da solicitação em que ela ainda pode ser excluída (antes de virar
 * pedido). As mesmas de `DELETABLE_REQUEST_STATUSES` (services/requests.ts);
 * um teste confere que as duas listas batem.
 */
export const BOOKING_OPEN_REQUEST: readonly string[] = [
  "REQUESTED",
  "RFQ_OPEN",
  "QUOTATION_RECEIVED",
  "SUPPLIER_SELECTED",
  "WAITING_DOWN_PAYMENT",
];

/** Quanto tempo a linha tomada espera a solicitação nascer (ms). */
export const BOOKING_LINK_WAIT_MS = 2 * 60_000;

/**
 * Como está a solicitação de uma linha em "Virou solicitação":
 * - `pending`: a linha foi tomada há pouco e a solicitação ainda não existe
 *   (o "Gerar solicitação" está rodando);
 * - `alive`: a solicitação existe e ainda pode ser excluída;
 * - `closed`: a solicitação virou pedido;
 * - `missing`: passaram 2 minutos e a solicitação não existe (a criação
 *   caiu no meio).
 */
export type BookingLinkState = "pending" | "alive" | "closed" | "missing";

export function bookingLinkState(
  row: { status: BookingStatus; statusChangedAt: string | null },
  /** A solicitação ligada, se existe. */
  request: { status: string } | null | undefined,
  now: number = Date.now(),
): BookingLinkState | null {
  if (row.status !== "requested") return null;
  if (request)
    return BOOKING_OPEN_REQUEST.includes(request.status)
      ? "alive"
      : // Cancelada (excluída, ou desfeita depois de uma falha): para a linha
        // é como se não existisse. O resto é pedido.
        request.status === "CANCELLED"
        ? "missing"
        : "closed";
  const since = Date.parse(row.statusChangedAt ?? "");
  return Number.isFinite(since) && now - since <= BOOKING_LINK_WAIT_MS
    ? "pending"
    : "missing";
}

/**
 * Pode mover de uma etapa para outra? Devolve o código da recusa ou null.
 * - "Virou solicitação" nunca à mão (sai do "Gerar solicitação").
 * - Toda mudança que põe o produto na vitrine ou tira dela (aprovar, voltar
 *   para análise, descartar um aprovado) é de quem analisa.
 * - Sair de "Virou solicitação" depende da solicitação ligada (`link`):
 *   sendo criada, ninguém mexe; em andamento, ninguém reabre (o caminho é
 *   excluir a solicitação, e a linha volta sozinha); que não chegou a nascer,
 *   quem tem a tela devolve para Aprovado, Oferecido ou Reservado; que virou
 *   pedido ou foi cancelada, só quem analisa reabre.
 * - O resto (Novo ↔ Em análise, descartar/recuperar antes de aprovar,
 *   Aprovado ↔ Oferecido ↔ Reservado) é de quem tem a tela.
 */
export function bookingMoveError(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor,
  link: BookingLinkState | null = null,
): BookingErrorCode | null {
  if (from === to) return null;
  if (to === "requested") return "booking_request_only";
  if (from === "requested") {
    if (link === "pending") return "booking_request_pending";
    if (link === "alive") return "booking_request_alive";
    if (link === "missing" && BOOKING_REQUESTABLE.includes(to)) return null;
    return actor.canApprove ? null : "booking_reopen_forbidden";
  }
  if (actor.canApprove) return null;
  if (hidesFromShowcase(from) !== hidesFromShowcase(to))
    return "booking_approver_required";
  return null;
}

/** Etapas para as quais a pessoa pode mover esta linha (para o seletor da tela). */
export function bookingMoveOptions(
  from: BookingStatus,
  actor: BookingActor,
  link: BookingLinkState | null = null,
): BookingStatus[] {
  const all: BookingStatus[] = [...BOOKING_FLOW, "discarded"];
  return all.filter(
    (to) => to === from || bookingMoveError(from, to, actor, link) === null,
  );
}

/**
 * O que a etapa exige da linha: "Oferecido" precisa do cliente; "Reservado",
 * do cliente e da quantidade (nunca abaixo do pedido mínimo do produto).
 */
export function bookingStatusRequirementError(
  status: BookingStatus,
  row: {
    customerId: string | null;
    reservedQty: number | null;
    moq: number | null;
  },
): BookingErrorCode | null {
  if (status !== "offered" && status !== "reserved") return null;
  if (!row.customerId) return "booking_customer_required";
  if (status === "reserved") {
    if (!(typeof row.reservedQty === "number" && row.reservedQty > 0))
      return "booking_qty_required";
    if (row.moq && row.reservedQty < row.moq) return "booking_qty_below_moq";
  }
  return null;
}

/** Quantidade reservada informada: inteira, positiva e nunca abaixo do mínimo. */
export function reservedQtyError(
  qty: number | null,
  moq: number | null,
): BookingErrorCode | null {
  if (qty === null) return null;
  if (!Number.isInteger(qty) || qty <= 0) return "booking_qty_required";
  if (moq && qty < moq) return "booking_qty_below_moq";
  return null;
}

/* ------------------------------------------------------------------------ */
/* Linha da tela                                                             */
/* ------------------------------------------------------------------------ */

/** Sinal do Superplan na linha: o veredito da análise, falta de dado ou sem análise. */
export const BOOKING_SIGNALS = [
  "viable",
  "below",
  "loss",
  "minimum",
  "missing",
  "none",
] as const;
export type BookingSignal = (typeof BOOKING_SIGNALS)[number];

/**
 * O sinal verde/amarelo/vermelho só existe com um preço de venda testado.
 * No preço mínimo (custo × markup do tipo de negócio) o lucro depende só da
 * tabela de parâmetros, não do produto: seria a mesma cor em todas as linhas.
 * Aí o sinal é "no preço mínimo" e o que diferencia os produtos são o custo,
 * o preço mínimo e o preço para a meta.
 */
export function bookingSignal(
  analysis: BookingAnalysis | null | undefined,
): BookingSignal {
  if (!analysis) return "none";
  if (!analysis.verdict) return "missing";
  if (analysis.usesMinimum) return "minimum";
  return analysis.verdict;
}

/**
 * Uma linha do Booking como a tela mostra: o produto com os dados da ficha, a
 * etapa, a reserva e (só para quem abre o Superplan) a análise. Montada no
 * servidor por `listBookingRows`.
 */
export interface BookingRow {
  id: string;
  productId: string;
  status: BookingStatus;
  statusChangedAt: string | null;
  /** Foto principal do produto (aberta por /api/files). */
  photoDocumentId: string | null;
  /** Código do item na fábrica (coluna SKU da ficha). */
  code: string | null;
  /** Código do produto no portal. */
  sku: string | null;
  name: string;
  /** Produto apagado ou desativado no cadastro: a linha fica, sem gerar solicitação. */
  productMissing: boolean;
  supplierId: string | null;
  supplierName: string | null;
  supplierStore: string | null;
  location: string | null;
  /** Data da ficha (ISO). */
  sheetDate: string | null;
  incoterm: string | null;
  price: number | null;
  currency: string | null;
  moq: number | null;
  /** Peças por caixa master e por inner. */
  masterQty: number | null;
  innerQty: number | null;
  /** Pesos por peça (kg): líquido e bruto, cada um na sua coluna. */
  netWeightKg: number | null;
  grossWeightKg: number | null;
  /**
   * Peso bruto estimado (kg): o bruto da ficha quando existe; senão o líquido
   * mais a folga da embalagem (Superplan → parâmetros). Nunca é gravado como
   * peso bruto do produto.
   */
  estimatedWeightKg: number | null;
  /** O peso estimado veio da conta (líquido + folga), não da ficha. */
  weightEstimated: boolean;
  /** Média do despachante (US$), da ficha mestre. */
  averageUsd: number | null;
  /** Peso médio por peça (kg), da ficha mestre: o terceiro peso. */
  averageWeightKg: number | null;
  /** Peças planejadas (da planilha, coluna "TT PCS", ou digitadas). */
  plannedQty: number | null;
  /** Previsão de vendas (peças) por canal, digitada; e a soma das três. */
  forecastOrder: number | null;
  forecastDistribution: number | null;
  forecastEcommerce: number | null;
  forecastTotal: number | null;
  /** Volume da caixa master (m³). */
  cbm: number | null;
  /** Medidas da peça ("33,5 × 24,8 × 1,5 cm") ou o tamanho escrito na ficha. */
  size: string | null;
  colors: string | null;
  material: string | null;
  packageType: string | null;
  ncm: string | null;
  customerId: string | null;
  customerName: string | null;
  reservedQty: number | null;
  /** Só para quem abre o Superplan; para os demais, sempre null. */
  analysis: BookingAnalysis | null;
  ownerUserId: string | null;
  ownerName: string | null;
  /** Quando entrou no Booking (ISO). */
  enteredAt: string;
  importBatchId: string | null;
  sourceFileName: string | null;
  /** Linhas da planilha ("3-5") e a primeira delas (ordem da planilha). */
  sourceRows: string | null;
  sourceOrder: number | null;
  note: string | null;
  /** A solicitação da linha, quando ela existe (dá para abrir). */
  requestId: string | null;
  requestGroupId: string | null;
  requestNumber: number | null;
  /**
   * "Virou solicitação" sem solicitação: `pending` = sendo criada agora;
   * `missing` = a criação parou no meio (a linha pode ser devolvida).
   */
  requestState: "pending" | "missing" | null;
  /**
   * Linha que virou solicitação: o próximo passo e para onde ir (nulo nas
   * outras etapas e para quem não abre Solicitações).
   */
  next: BookingNext | null;
  /** Medidas da peça (cm), para editar na tabela. */
  pieceLengthCm: number | null;
  pieceWidthCm: number | null;
  pieceHeightCm: number | null;
}

/* ------------------------------------------------------------------------ */
/* Colunas e filtros                                                         */
/* ------------------------------------------------------------------------ */

export type BookingColumnKind = "text" | "number" | "date" | "option";

export interface BookingColumn {
  key: string;
  kind: BookingColumnKind;
  /** Só aparece (e só filtra) para quem abre o Superplan. */
  superplanOnly?: boolean;
  /** Número inteiro (peças, caixas): no filtro, "1.200" é mil e duzentos. */
  whole?: boolean;
  /** Valor da linha nesta coluna: texto, número, data ISO ou id da opção. */
  value: (row: BookingRow) => string | number | null;
}

/** Valor do filtro "vazio" nas colunas de opção (sem cliente, sem responsável…). */
export const BOOKING_EMPTY = "-";

/**
 * As colunas da tela, na ordem em que aparecem. Toda coluna filtra: texto
 * (contém), número (de/até), data (de/até) ou opção (uma ou mais).
 */
export const BOOKING_COLUMNS = [
  { key: "status", kind: "option", value: (r) => r.status },
  { key: "code", kind: "text", value: (r) => r.code },
  {
    key: "name",
    kind: "text",
    value: (r) => [r.name, r.sku].filter(Boolean).join(" "),
  },
  { key: "supplier", kind: "option", value: (r) => r.supplierId },
  {
    key: "location",
    kind: "text",
    value: (r) => [r.location, r.supplierStore].filter(Boolean).join(" "),
  },
  { key: "sheetDate", kind: "date", value: (r) => r.sheetDate },
  { key: "price", kind: "number", value: (r) => r.price },
  { key: "currency", kind: "option", value: (r) => r.currency },
  { key: "moq", kind: "number", whole: true, value: (r) => r.moq },
  { key: "masterQty", kind: "number", whole: true, value: (r) => r.masterQty },
  { key: "innerQty", kind: "number", whole: true, value: (r) => r.innerQty },
  { key: "netWeight", kind: "number", value: (r) => r.netWeightKg },
  { key: "grossWeight", kind: "number", value: (r) => r.grossWeightKg },
  {
    key: "estimatedWeight",
    kind: "number",
    value: (r) => r.estimatedWeightKg,
  },
  {
    key: "averageWeight",
    kind: "number",
    value: (r) => r.averageWeightKg,
  },
  { key: "average", kind: "number", value: (r) => r.averageUsd },
  { key: "cbm", kind: "number", value: (r) => r.cbm },
  { key: "size", kind: "text", value: (r) => r.size },
  { key: "colors", kind: "text", value: (r) => r.colors },
  { key: "material", kind: "text", value: (r) => r.material },
  { key: "packageType", kind: "text", value: (r) => r.packageType },
  {
    key: "plannedQty",
    kind: "number",
    whole: true,
    value: (r) => r.plannedQty,
  },
  {
    key: "forecastOrder",
    kind: "number",
    whole: true,
    value: (r) => r.forecastOrder,
  },
  {
    key: "forecastDistribution",
    kind: "number",
    whole: true,
    value: (r) => r.forecastDistribution,
  },
  {
    key: "forecastEcommerce",
    kind: "number",
    whole: true,
    value: (r) => r.forecastEcommerce,
  },
  {
    key: "forecastTotal",
    kind: "number",
    whole: true,
    value: (r) => r.forecastTotal,
  },
  { key: "customer", kind: "option", value: (r) => r.customerId },
  {
    key: "reservedQty",
    kind: "number",
    whole: true,
    value: (r) => r.reservedQty,
  },
  {
    key: "cost",
    kind: "number",
    superplanOnly: true,
    value: (r) => r.analysis?.costBrl ?? null,
  },
  {
    key: "salePrice",
    kind: "number",
    superplanOnly: true,
    value: (r) => r.analysis?.salePriceBrl ?? null,
  },
  {
    key: "targetPrice",
    kind: "number",
    superplanOnly: true,
    value: (r) => r.analysis?.targetPriceBrl ?? null,
  },
  {
    key: "signal",
    kind: "option",
    superplanOnly: true,
    value: (r) => bookingSignal(r.analysis),
  },
  { key: "owner", kind: "option", value: (r) => r.ownerUserId },
  { key: "enteredAt", kind: "date", value: (r) => r.enteredAt },
  { key: "source", kind: "option", value: (r) => r.importBatchId },
  { key: "note", kind: "text", value: (r) => r.note },
  {
    key: "request",
    kind: "number",
    whole: true,
    value: (r) => r.requestNumber,
  },
] as const satisfies readonly BookingColumn[];

export type BookingColumnKey = (typeof BOOKING_COLUMNS)[number]["key"];

/** Colunas que a pessoa vê (as do Superplan só para quem o abre). */
export function bookingColumnsFor(superplan: boolean): BookingColumn[] {
  return (BOOKING_COLUMNS as readonly BookingColumn[]).filter(
    (c) => superplan || !c.superplanOnly,
  );
}

export interface BookingFilters {
  /** Busca geral: qualquer coluna de texto ou o nome das opções. */
  q: string;
  text: Partial<Record<BookingColumnKey, string>>;
  options: Partial<Record<BookingColumnKey, string[]>>;
  numbers: Partial<Record<BookingColumnKey, { min?: number; max?: number }>>;
  dates: Partial<Record<BookingColumnKey, { from?: string; to?: string }>>;
  sort: { key: BookingColumnKey; dir: "asc" | "desc" } | null;
  page: number;
}

export const BOOKING_PAGE_SIZE = 100;

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const many = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? [v] : [])
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const OPTION = /^[A-Za-z0-9_.:-]{1,64}$/;

/**
 * Filtros a partir do endereço da página. Nomes: a chave da coluna (texto e
 * opção), `<chave>_min`/`<chave>_max` (número), `<chave>_from`/`<chave>_to`
 * (data, AAAA-MM-DD), `q`, `sort`, `dir` e `page`. O que não dá para ler é
 * ignorado (endereço colado errado não quebra a tela). Colunas do Superplan
 * só filtram para quem as vê.
 */
export function parseBookingFilters(
  params: Params,
  options: { superplan: boolean },
): BookingFilters {
  const filters: BookingFilters = {
    q: first(params.q).slice(0, 80),
    text: {},
    options: {},
    numbers: {},
    dates: {},
    sort: null,
    page: 1,
  };
  const columns = bookingColumnsFor(options.superplan);
  for (const c of columns) {
    const key = c.key as BookingColumnKey;
    if (c.kind === "text") {
      const v = first(params[key]).slice(0, 80);
      if (v) filters.text[key] = v;
    } else if (c.kind === "option") {
      const v = many(params[key])
        .filter((s) => OPTION.test(s))
        .slice(0, 30);
      if (v.length) filters.options[key] = [...new Set(v)];
    } else if (c.kind === "number") {
      const read = (raw: string) => {
        const n = parseNumberInput(raw, { int: !!c.whole });
        return n === null || Number.isNaN(n) ? undefined : n;
      };
      const min = read(first(params[`${key}_min`]));
      const max = read(first(params[`${key}_max`]));
      if (min !== undefined || max !== undefined)
        filters.numbers[key] = {
          ...(min !== undefined ? { min } : {}),
          ...(max !== undefined ? { max } : {}),
        };
    } else {
      // Um campo só na tela: o dia escolhido (`coluna_on`). O período
      // (`coluna_from`/`coluna_to`) continua valendo em endereços antigos.
      const on = first(params[`${key}_on`]);
      const from = first(params[`${key}_from`]);
      const to = first(params[`${key}_to`]);
      const range = DAY.test(on)
        ? { from: on, to: on }
        : {
            ...(DAY.test(from) ? { from } : {}),
            ...(DAY.test(to) ? { to } : {}),
          };
      if (range.from || range.to) filters.dates[key] = range;
    }
  }
  const sortKey = first(params.sort);
  if (columns.some((c) => c.key === sortKey))
    filters.sort = {
      key: sortKey as BookingColumnKey,
      dir: first(params.dir) === "desc" ? "desc" : "asc",
    };
  const page = Number(first(params.page));
  if (Number.isInteger(page) && page > 1) filters.page = Math.min(page, 10_000);
  return filters;
}

/** Sem acento e sem caixa: "Mármore" acha "marmore". */
export const foldText = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** O dia (AAAA-MM-DD) de uma data ISO, sem depender do fuso de quem lê. */
const dayOf = (iso: string) => iso.slice(0, 10);

/**
 * As linhas que passam em todos os filtros. `labels` dá o texto das opções
 * (nome do cliente, do fornecedor…) para a busca geral achar por nome.
 */
export function filterBookingRows(
  rows: BookingRow[],
  filters: BookingFilters,
  options: {
    superplan: boolean;
    /** Texto de cada linha para a busca geral (nomes das opções incluídos). */
    searchText?: (row: BookingRow) => string;
  },
): BookingRow[] {
  const columns = bookingColumnsFor(options.superplan);
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const q = foldText(filters.q);
  const text = Object.entries(filters.text).map(
    ([k, v]) => [byKey.get(k), foldText(v ?? "")] as const,
  );
  const opts = Object.entries(filters.options).map(
    ([k, v]) => [byKey.get(k), new Set(v ?? [])] as const,
  );
  const nums = Object.entries(filters.numbers).map(
    ([k, v]) => [byKey.get(k), v ?? {}] as const,
  );
  const dates = Object.entries(filters.dates).map(
    ([k, v]) => [byKey.get(k), v ?? {}] as const,
  );
  return rows.filter((row) => {
    if (q) {
      const hay = foldText(
        options.searchText
          ? options.searchText(row)
          : columns
              .filter((c) => c.kind === "text")
              .map((c) => c.value(row) ?? "")
              .join(" "),
      );
      if (!q.split(/\s+/).every((word) => hay.includes(word))) return false;
    }
    for (const [column, needle] of text) {
      if (!column || !needle) continue;
      if (!foldText(String(column.value(row) ?? "")).includes(needle))
        return false;
    }
    for (const [column, wanted] of opts) {
      if (!column || !wanted.size) continue;
      const value = column.value(row);
      const id = value === null || value === "" ? BOOKING_EMPTY : String(value);
      if (!wanted.has(id)) return false;
    }
    for (const [column, range] of nums) {
      if (!column) continue;
      const value = column.value(row);
      if (typeof value !== "number") return false;
      if (range.min !== undefined && value < range.min) return false;
      if (range.max !== undefined && value > range.max) return false;
    }
    for (const [column, range] of dates) {
      if (!column) continue;
      const value = column.value(row);
      if (typeof value !== "string" || !value) return false;
      const day = dayOf(value);
      if (range.from && day < range.from) return false;
      if (range.to && day > range.to) return false;
    }
    return true;
  });
}

/**
 * Ordem das linhas. Padrão: as que entraram por último primeiro e, dentro da
 * mesma planilha, a ordem da planilha. Com `sort`, pela coluna (vazios no
 * fim, nos dois sentidos).
 */
export function sortBookingRows(
  rows: BookingRow[],
  sort: BookingFilters["sort"],
  options: {
    superplan: boolean;
    /** Texto das opções para ordenar pelo nome (cliente, fornecedor…). */
    optionLabel?: (key: BookingColumnKey, id: string) => string;
  },
): BookingRow[] {
  const out = [...rows];
  const column = sort
    ? bookingColumnsFor(options.superplan).find((c) => c.key === sort.key)
    : null;
  if (!sort || !column) {
    return out.sort(
      (a, b) =>
        dayOf(b.enteredAt).localeCompare(dayOf(a.enteredAt)) ||
        (a.importBatchId ?? "").localeCompare(b.importBatchId ?? "") ||
        (a.sourceOrder ?? Infinity) - (b.sourceOrder ?? Infinity) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
  }
  const dir = sort.dir === "desc" ? -1 : 1;
  const flow: readonly string[] = [...BOOKING_FLOW, "discarded"];
  const keyOf = (row: BookingRow): string | number | null => {
    const value = column.value(row);
    if (value === null || value === "") return null;
    if (column.key === "status") return flow.indexOf(String(value));
    if (column.kind === "option" && options.optionLabel)
      return foldText(
        options.optionLabel(column.key as BookingColumnKey, String(value)),
      );
    return typeof value === "string" ? foldText(value) : value;
  };
  return out.sort((a, b) => {
    const x = keyOf(a);
    const y = keyOf(b);
    if (x === null && y === null) return a.id.localeCompare(b.id);
    if (x === null) return 1;
    if (y === null) return -1;
    const cmp =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), undefined, { numeric: true });
    return cmp * dir || a.id.localeCompare(b.id);
  });
}

/** Quantos filtros estão ligados (para "3 filtros · Limpar"). */
export function activeBookingFilters(filters: BookingFilters): number {
  return (
    (filters.q ? 1 : 0) +
    Object.keys(filters.text).length +
    Object.keys(filters.options).length +
    Object.keys(filters.numbers).length +
    Object.keys(filters.dates).length
  );
}

/**
 * Os filtros de volta para o endereço (links de ordenar, de página, de tirar
 * um filtro). `patch` troca ou remove (`null`) pedaços.
 */
export function bookingQuery(
  filters: BookingFilters,
  patch: {
    sort?: BookingFilters["sort"];
    page?: number;
    /** Remove o filtro desta coluna. */
    drop?: BookingColumnKey | "q";
    /** Troca o filtro de opção desta coluna (ex.: cartões das etapas). */
    option?: { key: BookingColumnKey; values: string[] };
  } = {},
): string {
  const q = new URLSearchParams();
  const dropped = patch.drop;
  if (filters.q && dropped !== "q") q.set("q", filters.q);
  for (const [k, v] of Object.entries(filters.text))
    if (v && k !== dropped) q.set(k, v);
  const options = { ...filters.options };
  if (patch.option) {
    if (patch.option.values.length)
      options[patch.option.key] = patch.option.values;
    else delete options[patch.option.key];
  }
  for (const [k, v] of Object.entries(options))
    if (v?.length && k !== dropped) q.set(k, v.join(","));
  for (const [k, v] of Object.entries(filters.numbers)) {
    if (!v || k === dropped) continue;
    if (v.min !== undefined) q.set(`${k}_min`, String(v.min));
    if (v.max !== undefined) q.set(`${k}_max`, String(v.max));
  }
  for (const [k, v] of Object.entries(filters.dates)) {
    if (!v || k === dropped) continue;
    // Um dia só: o parâmetro do campo único da tela.
    if (v.from && v.from === v.to) {
      q.set(`${k}_on`, v.from);
      continue;
    }
    if (v.from) q.set(`${k}_from`, v.from);
    if (v.to) q.set(`${k}_to`, v.to);
  }
  const sort = patch.sort === undefined ? filters.sort : patch.sort;
  if (sort) {
    q.set("sort", sort.key);
    if (sort.dir === "desc") q.set("dir", "desc");
  }
  // Mudou filtro ou ordem: volta para a primeira página.
  const page =
    patch.page ??
    (patch.drop || patch.option || patch.sort !== undefined ? 1 : filters.page);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** Uma página das linhas já filtradas e ordenadas. */
export function pageOfBookingRows<T>(
  rows: T[],
  page: number,
  size = BOOKING_PAGE_SIZE,
): { rows: T[]; page: number; pages: number; total: number } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return {
    rows: rows.slice((current - 1) * size, current * size),
    page: current,
    pages,
    total: rows.length,
  };
}

/** Campos do plano da linha (peças), na ordem das colunas. */
export const BOOKING_PLAN_FIELDS = [
  "plannedQty",
  "forecastOrder",
  "forecastDistribution",
  "forecastEcommerce",
] as const;
export type BookingPlanField = (typeof BOOKING_PLAN_FIELDS)[number];
/** Teto de uma quantidade do plano (peças). */
export const BOOKING_PLAN_MAX = 100_000_000;

/** Soma da previsão por canal; nulo quando nenhum canal foi informado. */
export function forecastTotalOf(plan: {
  forecastOrder?: number | null;
  forecastDistribution?: number | null;
  forecastEcommerce?: number | null;
}): number | null {
  const parts = [
    plan.forecastOrder,
    plan.forecastDistribution,
    plan.forecastEcommerce,
  ].filter((n): n is number => typeof n === "number" && n > 0);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

/**
 * Quantidade de uma linha ao gerar a solicitação: a digitada; senão a
 * reservada; senão a planejada (quando não fica abaixo do pedido mínimo);
 * senão o pedido mínimo.
 */
export function bookingRequestQuantity(input: {
  typed?: number | null;
  reservedQty: number | null;
  plannedQty: number | null;
  moq: number | null;
}): number | null {
  const planned =
    input.plannedQty !== null &&
    input.plannedQty > 0 &&
    (input.moq === null || input.plannedQty >= input.moq)
      ? input.plannedQty
      : null;
  return input.typed ?? input.reservedQty ?? planned ?? input.moq ?? null;
}

/**
 * A linha pode virar solicitação? Aprovado, Oferecido e Reservado: sempre.
 * Novo e Em análise: só para quem aprova (gerar a solicitação já aprova).
 * Descartado e "Virou solicitação": nunca.
 */
export function bookingCanRequest(
  status: BookingStatus,
  canApprove: boolean,
): boolean {
  if (BOOKING_REQUESTABLE.includes(status)) return true;
  return canApprove && (status === "new" || status === "analysis");
}

/* ------------------------------------------------------------------------ */
/* Depois de "Virou solicitação": o próximo passo                            */
/* ------------------------------------------------------------------------ */

/** Onde a solicitação da linha está, dito como "o que fazer agora". */
export const BOOKING_NEXT_STEPS = [
  /** Solicitação criada: falta abrir a RFQ (convidar o fornecedor). */
  "open_rfq",
  /** RFQ aberta: o fornecedor ainda não respondeu. */
  "wait_supplier",
  /** RFQ aberta: a ficha já foi preenchida em parte, mas a cotação não foi enviada. */
  "supplier_draft",
  /** O fornecedor não aceitou o preço desejado: conversar. */
  "offer_declined",
  /** Cotação devolvida com comentário: esperando o fornecedor. */
  "negotiating",
  /** Cotação enviada pelo fornecedor: a Wellmix confere e confirma. */
  "choose_quote",
  /** Fornecedor escolhido: falta o sinal (ou a aprovação). */
  "wait_down_payment",
  /** Virou pedido (pedido antigo, sem o documento com assinaturas). */
  "ordered",
  /** Pedido criado: falta a Wellmix assinar o documento do pedido. */
  "sign_wellmix",
  /** Documento enviado: o fornecedor baixa, assina e anexa de volta. */
  "sign_supplier",
  /** Documento do pedido assinado pelos dois. */
  "signed",
  "cancelled",
] as const;
export type BookingNextStep = (typeof BOOKING_NEXT_STEPS)[number];

/** Passos em que a bola não está com a Wellmix (o botão é só para acompanhar). */
export const BOOKING_NEXT_WAITING: readonly BookingNextStep[] = [
  "wait_supplier",
  "negotiating",
  "sign_supplier",
  "signed",
  "cancelled",
];

export interface BookingNext {
  step: BookingNextStep;
  /** Para onde o botão leva (solicitação, cotação, pedido ou documento). */
  href: string;
  /**
   * O que o botão abre (o texto dele): "confirm" = a comparação de cotações
   * da solicitação, onde a Wellmix confirma; "document" = o documento do
   * pedido (baixar, assinar, anexar e conferir).
   */
  target: "request" | "quote" | "order" | "confirm" | "document";
  /** Cotações da solicitação: quantas foram enviadas, de quantas. */
  answered: number;
  total: number;
}

/** Em que ponto está o documento do pedido (docs/ORDER_SIGNATURE.md). */
export type BookingOrderDocument =
  "awaiting_wellmix" | "sent_to_supplier" | "signed" | null;

/**
 * O próximo passo de uma linha que virou solicitação, a partir da situação
 * da solicitação, das cotações dela e do pedido (quando já nasceu).
 * `openQuotes`: quem vê abre a tela Cotações (senão o botão leva à
 * solicitação). `draft` na cotação: a ficha dela já foi gravada (rascunho) e
 * ela ainda não foi enviada. `document` no pedido: o ponto do documento com
 * as duas assinaturas (nulo em pedido antigo, sem ele).
 */
export function bookingNextStep(
  request: { id: string; status: string },
  quotes: Array<{
    id: string;
    status: string;
    negotiation?: Array<{ kind: string }> | null;
    draft?: boolean;
  }>,
  order: { id: string; document?: BookingOrderDocument } | null,
  openQuotes: boolean,
): BookingNext {
  const sent = quotes.filter(
    (q) => q.status === "answered" || q.status === "selected",
  );
  const counts = { answered: sent.length, total: quotes.length };
  const toRequest = {
    href: `/app/requests/${request.id}`,
    target: "request" as const,
    ...counts,
  };
  // Uma cotação só: o botão vai direto nela.
  const toQuote = (quote: { id: string } | undefined) =>
    quote && openQuotes
      ? { href: `/app/quotes/${quote.id}`, target: "quote" as const, ...counts }
      : toRequest;
  const lastKind = (q: { negotiation?: Array<{ kind: string }> | null }) =>
    q.negotiation?.length ? q.negotiation[q.negotiation.length - 1].kind : null;
  if (request.status === "CANCELLED")
    return { step: "cancelled", ...toRequest };
  if (request.status === "ORDERED") {
    if (!order) return { step: "ordered", ...toRequest };
    if (!order.document)
      return {
        step: "ordered",
        href: `/app/orders/${order.id}`,
        target: "order",
        ...counts,
      };
    return {
      step:
        order.document === "awaiting_wellmix"
          ? "sign_wellmix"
          : order.document === "sent_to_supplier"
            ? "sign_supplier"
            : "signed",
      href: `/app/orders/${order.id}/purchase-order`,
      target: "document",
      ...counts,
    };
  }
  if (
    request.status === "WAITING_DOWN_PAYMENT" ||
    request.status === "SUPPLIER_SELECTED"
  )
    return { step: "wait_down_payment", ...toRequest };
  // Cotação enviada com a solicitação ainda em "RFQ aberta" (gravação
  // interrompida no meio): vale a cotação, a linha não fica "esperando".
  if (
    request.status === "QUOTATION_RECEIVED" ||
    (request.status === "RFQ_OPEN" && sent.length > 0)
  ) {
    const returned = quotes.find(
      (q) => q.status === "answered" && lastKind(q) === "return",
    );
    if (returned) return { step: "negotiating", ...toQuote(returned) };
    return {
      step: "choose_quote",
      href: `/app/requests/${request.id}#quotes-compare`,
      target: "confirm",
      ...counts,
    };
  }
  if (request.status === "RFQ_OPEN") {
    const invited = quotes.filter((q) => q.status === "invited");
    const declined = invited.find((q) => lastKind(q) === "decline");
    if (declined) return { step: "offer_declined", ...toQuote(declined) };
    const drafts = invited.filter((q) => q.draft);
    if (drafts.length)
      return {
        step: "supplier_draft",
        ...toQuote(
          drafts.length === 1 || invited.length === 1 ? drafts[0] : undefined,
        ),
      };
    return {
      step: "wait_supplier",
      ...toQuote(invited.length === 1 ? invited[0] : undefined),
    };
  }
  return { step: "open_rfq", ...toRequest };
}
