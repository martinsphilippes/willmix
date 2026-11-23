import type {
  ContainerStatus,
  SankhyaChainDoc,
  SankhyaOrderSituation,
  ShipmentState,
} from "@/lib/db/schema";
import { MILESTONE_KEYS, type MilestoneKey } from "@/lib/milestones";

/*
 * Regras da carga dos pedidos de compra do Sankhya a partir do ensaio
 * (docs/SANKHYA_INTEGRACAO.md, seções 4, 5 e 9, etapa 5). Funções puras: o
 * que cada linha do ensaio (sankhya_projection) vira no portal. Quem grava é
 * src/lib/services/sankhya-orders-load.ts.
 */

/** Linha do ensaio de um pedido (kind = "order"). */
export interface ProjectionOrder {
  key: string;
  situation: SankhyaOrderSituation;
  milestone: string | null;
  top: number | null;
  supplierCode: string | null;
  supplierName: string | null;
  shipmentState: ShipmentState | null;
  data: {
    /** TRACK_ID do pedido (a chave da linha do ensaio por track). */
    track?: string | null;
    /** NUNOTA principal do track (a ponta mais adiantada). */
    mainKey?: string | null;
    /** As pontas de cadeia juntadas no track. */
    leaves?: string[] | null;
    chain?: Array<{
      nunota: number;
      top: number;
      pending?: boolean;
      /** STATUS_NOTA = L: documento confirmado (A é rascunho da etapa). */
      confirmed?: boolean | null;
      date?: string | null;
      numnota?: string | null;
    }> | null;
    items?: ProjectionItem[] | null;
    statusShipping?: string | null;
    receipt?: string | null;
    receivedAt?: string | null;
    quality?: string | null;
    inspectedAt?: string | null;
    customsChannel?: string | null;
    etd?: string | null;
    /** ETA da 1104: chegada no destino final (depósito). */
    eta?: string | null;
    currency?: string | null;
    total?: number | string | null;
    incoterm?: string | null;
    orderedAt?: string | null;
    changedAt?: string | null;
    numnota?: string | null;
    reason?: string | null;
    shipments?: number[] | null;
  } | null;
}

export interface ProjectionItem {
  seq: number;
  /** NUNOTA do documento do item (pedido por track junta mais de um). */
  doc?: number | null;
  codprod: string | null;
  name: string | null;
  ref?: string | null;
  unit: string | null;
  qty: number | null;
  shipped: number | null;
  pendingQty: number | null;
  itemPending?: boolean | null;
  price: number | null;
  boxes?: number | null;
}

/** Linha do ensaio de um embarque (kind = "shipment", documento 35). */
export interface ProjectionShipment {
  key: string;
  situation: string;
  milestone: string | null;
  supplierCode: string | null;
  data: {
    orders?: Array<{ order: number; seq: number; qty: number }> | null;
    prenota?: boolean | null;
    nota?: boolean | null;
    statusShipping?: string | null;
    receipt?: string | null;
    customsChannel?: string | null;
    etd?: string | null;
    eta?: string | null;
    orderedAt?: string | null;
    numnota?: string | null;
  } | null;
}

/** Ids fixos: rodar a carga de novo atualiza em vez de duplicar. */
/** Pedido por TRACK_ID (docs/SANKHYA_TRACK_ID.md): `snk-t<track>`. */
export const sankhyaOrderId = (track: string | number) => `snk-t${track}`;
/** Item: track, documento e sequência (o track junta mais de um documento). */
export const sankhyaTrackItemId = (
  track: string | number,
  doc: string | number,
  seq: number,
) => `snk-t${track}-${doc}-${seq}`;
/**
 * Número do pedido no portal = o do Sankhya (dono, 21/11/2026: "não vamos ter
 * número de pedido só do portal"): o TRACK_ID; sem track (compras antigas 30),
 * o NUNOTA da ponta principal.
 */
export function orderNumberOf(row: Pick<ProjectionOrder, "key" | "data">) {
  const track = String(row.data?.track ?? "");
  if (/^\d+$/.test(track)) return Number(track);
  const main = Number(mainKeyOf(row));
  return Number.isFinite(main) && main > 0 ? main : null;
}

/** NUNOTA principal da linha do ensaio (a ponta mais adiantada do track). */
export const mainKeyOf = (row: Pick<ProjectionOrder, "key" | "data">) =>
  String(row.data?.mainKey ?? row.key);
export const sankhyaItemId = (leaf: string | number, seq: number) =>
  `snk-${leaf}-${seq}`;
export const sankhyaContainerId = (nunota: string | number) =>
  `snk-35-${nunota}`;
export const sankhyaContainerItemId = (
  nunota: string | number,
  order: string | number,
  seq: number,
) => `snk-35-${nunota}-${order}-${seq}`;

/** Data do Sankhya ("31012027 00:00:00" ou "31/01/2027") em ISO; vazia: nula. */
export function sankhyaIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m =
    /^(\d{2})\/?(\d{2})\/?(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) {
    const iso = `${m[3]}-${m[2]}-${m[1]}T${m[4] ?? "12"}:${m[5] ?? "00"}:${m[6] ?? "00"}.000Z`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }
  const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(s) : null;
  return iso && !Number.isNaN(iso.getTime()) ? iso.toISOString() : null;
}

/** Moeda do pedido pelo texto do Sankhya ("USD - DOLAR", "RMB PARA US$"). */
export function sankhyaCurrency(text: string | null | undefined) {
  const t = (text ?? "").toUpperCase();
  if (/US\$|USD|DOLAR/.test(t)) return "USD";
  if (/RMB|CNY|YUAN/.test(t)) return "CNY";
  if (/EUR/.test(t)) return "EUR";
  if (/R\$|BRL|REAL/.test(t)) return "BRL";
  return null;
}

const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** A cadeia do ensaio no formato do pedido (do mais antigo ao atual). */
export function chainOf(row: ProjectionOrder): SankhyaChainDoc[] {
  return (row.data?.chain ?? []).map((d) => ({
    nunota: Number(d.nunota),
    top: Number(d.top),
    pending: !!d.pending,
    date: sankhyaIso(d.date),
  }));
}

/** Marco do ensaio, só se for um dos 16 do portal. */
export function milestoneOf(value: string | null | undefined) {
  return (MILESTONE_KEYS as readonly string[]).includes(value ?? "")
    ? (value as MilestoneKey)
    : null;
}

/**
 * Marcos que só o portal tem (seção 5.1): a carga não inventa conclusão para
 * eles; seguem as regras do portal.
 */
const PORTAL_ONLY: readonly MilestoneKey[] = [
  "certification",
  "samples",
  "booking",
];

/**
 * Marcos dados como feitos no pedido em andamento: os anteriores ao marco
 * atual (pela ordem do portal). Antes do embarque, ficam abertos os que só o
 * portal tem (Certificação, Amostras, Booking) e a Inspeção, feita só quando
 * o Sankhya diz "Inspecionado". Com a carga já embarcada (marco depois do
 * Booking: Carregamento, Embarque, Desembaraço, Nota, Entrega), tudo o que
 * vem antes já passou e fica feito.
 */
export function doneMilestones(
  current: MilestoneKey,
  quality: string | null | undefined,
): Set<MilestoneKey> {
  const rank = MILESTONE_KEYS.indexOf(current);
  const shipped = rank > MILESTONE_KEYS.indexOf("booking");
  const out = new Set<MilestoneKey>();
  for (const key of MILESTONE_KEYS.slice(0, rank)) {
    if (!shipped && PORTAL_ONLY.includes(key)) continue;
    if (!shipped && key === "inspection") continue;
    out.add(key);
  }
  if (/^inspecionado$/i.test((quality ?? "").trim())) out.add("inspection");
  return out;
}

/**
 * Situação do pedido no portal (seção 5.2 e D11, D12): o em andamento fica
 * aberto com os itens; o encerrado, o interrompido (D12: encerrado
 * "Interrompido no Sankhya") e o caminho antigo entram encerrados; o
 * "Aguardando definição" fica aberto, sem marco e sem itens.
 */
export function orderStatusOf(row: Pick<ProjectionOrder, "situation">) {
  return row.situation === "in_progress" ||
    row.situation === "awaiting_definition"
    ? "ORDER_CREATED"
    : "CLOSED";
}

/** Canal que pausa o pedido (D8): Vermelho e Cinza; Verde e Amarelo seguem. */
export function channelPause(
  channel: string | null | undefined,
): "red" | "grey" | null {
  const c = (channel ?? "").trim().toLowerCase();
  if (c.startsWith("vermelh")) return "red";
  if (c.startsWith("cinz")) return "grey";
  return null;
}

/** Data de encerramento: recebimento, última mudança ou a do pedido. */
export function closedAtOf(row: ProjectionOrder) {
  const d = row.data ?? {};
  return (
    sankhyaIso(d.receivedAt) ??
    sankhyaIso(d.changedAt) ??
    sankhyaIso(d.orderedAt) ??
    null
  );
}

/** Os campos do pedido que vêm do ensaio (sem cliente, fornecedor nem número). */
export function orderFieldsOf(row: ProjectionOrder, pausedAt: string) {
  const d = row.data ?? {};
  const closed = orderStatusOf(row) === "CLOSED";
  const pause =
    row.situation === "in_progress" && !/^recebido$/i.test(d.receipt ?? "")
      ? channelPause(d.customsChannel)
      : null;
  const numnota = (d.numnota ?? "").trim();
  return {
    status: orderStatusOf(row),
    closedAt: closed ? closedAtOf(row) : null,
    fobTotal: num(d.total),
    fobCurrency: sankhyaCurrency(d.currency),
    incoterm: d.incoterm?.trim() || null,
    erpSyncStatus: "synced" as const,
    erpNumber: numnota && numnota !== "0" ? numnota : mainKeyOf(row),
    sankhyaCode: mainKeyOf(row),
    sankhyaTrackId: d.track ?? null,
    sankhyaChain: chainOf(row),
    sankhyaChangedAt: sankhyaIso(d.changedAt),
    sankhyaQuality: d.quality?.trim() || null,
    sankhyaInspectedAt: sankhyaIso(d.inspectedAt),
    sankhyaReceipt: d.receipt?.trim() || null,
    sankhyaReceivedAt: sankhyaIso(d.receivedAt),
    customsChannel: d.customsChannel?.trim() || null,
    shipmentState: row.shipmentState ?? null,
    sankhyaSituation: row.situation,
    ...(pause
      ? { pausedAt, pauseReason: `channel_${pause}` }
      : { pausedAt: null, pauseReason: null }),
  };
}

/** Itens do pedido com o embarcado e o saldo (o recebido só no encerrado). */
export function itemFieldsOf(row: ProjectionOrder, item: ProjectionItem) {
  const qty = num(item.qty) ?? 0;
  const shipped = num(item.shipped) ?? 0;
  const received = /^recebido$/i.test(row.data?.receipt ?? "") ? shipped : null;
  return {
    id: sankhyaTrackItemId(row.key, item.doc ?? mainKeyOf(row), item.seq),
    name: item.name?.trim() || `Produto ${item.codprod ?? "—"}`,
    quantity: qty,
    unit: item.unit?.trim() || "UN",
    unitPrice: num(item.price),
    sankhyaCode: `${item.doc ?? mainKeyOf(row)}-${item.seq}`,
    shippedQty: shipped,
    receivedQty: received,
    pendingQty: num(item.pendingQty) ?? Math.max(qty - shipped, 0),
    sankhyaRefs: {
      CODPROD: item.codprod ?? "",
      ...(item.ref ? { REFERENCIA_FORNECEDOR: item.ref } : {}),
      ...(num(item.boxes) !== null ? { QTD_CAIXAS: num(item.boxes)! } : {}),
    },
  };
}

/** Situação do embarque (35) no container do portal. */
export function containerStatusOf(row: ProjectionShipment): ContainerStatus {
  if (row.situation !== "in_progress") return "closed";
  if (row.milestone === "customs") return "arrived";
  if (row.data?.statusShipping === "3") return "shipped";
  return "loading";
}

/**
 * O que o embarque leva de cada item: o Sankhya pode dividir o mesmo item do
 * pedido em mais de uma linha do 35 (duas ligações na TGFVAR); aqui as
 * quantidades são somadas, uma linha por pedido e item. Lista ausente: vazia.
 */
export function shipmentLines(
  orders: unknown,
): Array<{ order: number; seq: number; qty: number }> {
  if (!Array.isArray(orders)) return [];
  const out = new Map<string, { order: number; seq: number; qty: number }>();
  for (const o of orders as Array<Record<string, unknown>>) {
    const order = Number(o?.order);
    const seq = Number(o?.seq);
    if (!Number.isFinite(order) || !Number.isFinite(seq)) continue;
    const key = `${order}-${seq}`;
    const qty = Number(o?.qty) || 0;
    const hit = out.get(key);
    if (hit) hit.qty += qty;
    else out.set(key, { order, seq, qty });
  }
  return [...out.values()];
}

/** Embarque (35) do track, no que o marco do pedido precisa. */
export interface TrackShipment {
  /** 35 ou pré-nota ainda pendente no Sankhya. */
  open: boolean;
  /** Pré-nota (TOP 1) pendente: no desembaraço. */
  customs: boolean;
  /** Já tem pré-nota (pendente ou emitida). */
  prenota: boolean;
  eta: string | null;
  channel: string | null;
}

const DAY = 86_400_000;
/** ETD da 1104 vale para "navio saiu" só até 30 dias atrás (ETD velho não é atualizado). */
export const ETD_FRESH_DAYS = 30;

const isInspected = (quality: string | null | undefined) =>
  /^inspecionado$/i.test((quality ?? "").trim());
const isPartialInspection = (quality: string | null | undefined) =>
  /^inspe[cç][aã]o parcial$/i.test((quality ?? "").trim());

/** Marco do embarque (linhas 10 a 12 do de-para), ou nulo se já fechado. */
function shipmentMilestone(
  s: TrackShipment,
  today: number,
): MilestoneKey | null {
  if (!s.open) return null;
  if (s.customs) return "customs";
  if (s.prenota) return "invoice-transport";
  const eta = s.eta ? Date.parse(s.eta) : NaN;
  if (channelOrAny(s.channel) || (Number.isFinite(eta) && today >= eta))
    return "customs";
  return "shipment";
}
const channelOrAny = (c: string | null | undefined) => !!(c ?? "").trim();

/**
 * STATUS_SHIPPING (`AD_STATUSSHIPPING`, lista marcada à mão no cabeçalho;
 * técnico do Sankhya, 23/11/2026) que adianta o marco da 1104 pendente:
 * 10 Booking solicitado e 11 Aguardando embarque. O 1 (Produção), o
 * 2 (Inspeção) e o vazio seguem os eventos (no portal o pedido em produção
 * já aparece em Inspeção); o 8 (Aguardando aceite fornecedor) tem regra
 * própria; 3 Embarcado, 4 Registro, 5 Outras despesas, 6 Finalizado,
 * 7 Aguardando documento final e 9 Compra programada não mudam o marco.
 */
export const STATUS_SHIPPING_MILESTONE: Record<
  string,
  MilestoneKey | undefined
> = { "10": "booking", "11": "loading" };

/**
 * Marco do pedido no portal pelo de-para aprovado pelo dono (21/11/2026,
 * docs/SANKHYA_INTEGRACAO.md, seção 9.4): o documento mais adiantado do
 * track, os status da 1104 e as datas de inspeção, ETD e ETA. Só para o
 * pedido em andamento; a 1100 (reposição) não chega aqui.
 *
 * - 1101 → Pedido novo; 1102 → Arte; 1103 → Revisão (marco Contrato).
 * - 1104 pendente: STATUS_SHIPPING 8 → Sinal; "Inspeção parcial" → Inspeção;
 *   inspecionado → Booking, ou Embarque se o ETD passou há até 30 dias e nada
 *   embarcou; senão → Produção. Parte embarcada não muda o marco (selo
 *   "Embarque parcial" pelo shipmentState).
 * - 1104 sem pendência (tudo embarcado): "Recebimento parcial" → Entrega;
 *   senão o embarque aberto menos adiantado: pré-nota pendente, canal ou ETA
 *   do 35 passado → Desembaraço; pré-nota emitida → Nota fiscal e transporte;
 *   em trânsito → Embarque.
 */
export function trackMilestone(
  row: Pick<ProjectionOrder, "top" | "data" | "milestone">,
  ships: TrackShipment[],
  now: Date = new Date(),
): MilestoneKey | null {
  const d = row.data ?? {};
  const top = Number(row.top);
  if (top === 1101) return "new-order";
  if (top === 1102) return "art";
  if (top === 1103) return "contract";
  if (top !== 1104 && top !== 1107) return milestoneOf(row.milestone);
  const today = now.getTime();
  const ss = String(d.statusShipping ?? "").trim();
  const main = (d.chain ?? []).filter((c) => Number(c.top) === top);
  const pending = main.length
    ? main.some((c) => !!c.pending)
    : !!d.chain?.at(-1)?.pending;
  if (pending) {
    const byEvents = ((): MilestoneKey => {
      const partial = isPartialInspection(d.quality);
      const inspected =
        isInspected(d.quality) || (!partial && !!sankhyaIso(d.inspectedAt));
      // 1104 ainda em rascunho (STATUS_NOTA = A): a etapa atingida é a 1103
      // e falta fechar o contrato (técnico do Sankhya, 23/11/2026).
      const draft = main.length > 0 && main.every((c) => c.confirmed === false);
      if (draft && !inspected && !partial) return "contract";
      // 8 = Aguardando aceite do fornecedor; marcado à mão, perde para a
      // inspeção já feita (o track 116371 estava "Inspecionado" com 8).
      if (ss === "8" && !inspected && !partial) return "down-payment";
      if (partial) return "inspection";
      if (!inspected) return "production";
      const etdIso = sankhyaIso(d.etd);
      const etd = etdIso ? Date.parse(etdIso) : NaN;
      if (
        !ships.length &&
        Number.isFinite(etd) &&
        today >= etd &&
        today - etd <= ETD_FRESH_DAYS * DAY
      )
        return "shipment";
      return "booking";
    })();
    // O STATUS_SHIPPING quase não anda (23/11/2026: na prática só 1, 3 e 8);
    // quando marca uma etapa à frente dos eventos, vale a dele.
    const byStatus = STATUS_SHIPPING_MILESTONE[ss];
    const rank = (m: MilestoneKey) => MILESTONE_KEYS.indexOf(m);
    return byStatus && rank(byStatus) > rank(byEvents) ? byStatus : byEvents;
  }
  if (/^recebimento parcial$/i.test((d.receipt ?? "").trim()))
    return "delivery";
  const order = MILESTONE_KEYS as readonly MilestoneKey[];
  const stages = ships
    .map((s) => shipmentMilestone(s, today))
    .filter((m): m is MilestoneKey => !!m)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (stages.length) return stages[0];
  if (channelOrAny(d.customsChannel) && !d.receipt) return "customs";
  return milestoneOf(row.milestone) ?? "shipment";
}

/**
 * Situação do pedido no portal depois do de-para: a 1104 pendente sem
 * STATUS_SHIPPING (o "caso 1", 191 pedidos) segue em andamento pela inspeção
 * e pelo ETD (dono, 21/11/2026); a 1101 pendente também.
 */
export function trackSituation(
  row: Pick<ProjectionOrder, "situation" | "top" | "data">,
): SankhyaOrderSituation {
  if (row.situation !== "awaiting_definition") return row.situation;
  if (row.data?.reason === "no_status_shipping") return "in_progress";
  const top = Number(row.top);
  const last = row.data?.chain?.at(-1);
  if (top === 1101 && last?.pending) return "in_progress";
  return row.situation;
}

/** Track que parou na 1100: não é pedido, é reposição (dono, 21/11/2026). */
export const isReplenishmentTrack = (row: Pick<ProjectionOrder, "top">) =>
  Number(row.top) === 1100;

/** Reposição do Sankhya: uma por item da 1100, id fixo pelo track e sequência. */
export const sankhyaReplenishmentId = (
  track: string | number,
  doc: string | number,
  seq: number,
) => `snk-r${track}-${doc}-${seq}`;

/** Lote da reposição do Sankhya: todos os itens da 1100 do mesmo track. */
export const sankhyaReplenishmentGroupId = (track: string | number) =>
  `snk-r${track}`;

/**
 * Track encerrado no meio do processo (cancelado): sem pendência e sem
 * documento seguinte, em qualquer etapa. Não entra no portal (dono,
 * 23/11/2026), como a 1100 reprovada.
 */
export const isCancelledTrack = (row: Pick<ProjectionOrder, "situation">) =>
  row.situation === "interrupted";
