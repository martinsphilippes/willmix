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
    chain?: Array<{
      nunota: number;
      top: number;
      pending?: boolean;
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
export const sankhyaOrderId = (leaf: string | number) => `snk-${leaf}`;
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
 * atual (pela ordem do portal), menos os que só o portal tem e a Inspeção,
 * que só é feita quando o Sankhya diz "Inspecionado".
 */
export function doneMilestones(
  current: MilestoneKey,
  quality: string | null | undefined,
): Set<MilestoneKey> {
  const rank = MILESTONE_KEYS.indexOf(current);
  const out = new Set<MilestoneKey>();
  for (const key of MILESTONE_KEYS.slice(0, rank)) {
    if (PORTAL_ONLY.includes(key)) continue;
    if (key === "inspection") continue;
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
    erpNumber: numnota && numnota !== "0" ? numnota : row.key,
    sankhyaCode: row.key,
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
    id: sankhyaItemId(row.key, item.seq),
    name: item.name?.trim() || `Produto ${item.codprod ?? "—"}`,
    quantity: qty,
    unit: item.unit?.trim() || "UN",
    unitPrice: num(item.price),
    sankhyaCode: String(item.seq),
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
