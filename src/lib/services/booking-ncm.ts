import "server-only";

import { isWellmix } from "@/lib/auth/permissions";
import { assertScreen } from "@/lib/auth/screens";
import {
  getStore,
  type BookingItem,
  type BookingLot,
  type User,
} from "@/lib/db";
import { normalizeNcm } from "@/lib/fiscal";
import {
  buildNcmIndex,
  matchNcm,
  ncmGroupKey,
  suggestNcms,
  type NcmCandidate,
  type NcmIndex,
  type NcmSuggestion,
} from "@/lib/ncm-match";
import { audit } from "./audit";

/*
 * NCM dos itens do booking (docs/BOOKING.md, "NCM do item").
 *
 * 1. Aproximação: o nome do item é comparado com os produtos do cadastro que
 *    têm NCM (nome do produto e descrições dos itens de booking já ligados a
 *    ele; código de fábrica igual vale como certo). Vale o do mais provável
 *    ou a moda entre os igualmente prováveis.
 * 2. Sem correspondência: o item vai para o despachante, que classifica os
 *    itens parecidos de uma vez (/app/ncm-items). A Wellmix também pode
 *    preencher no próprio booking.
 *
 * O NCM é obrigatório para fechar o booking e continua editável depois de
 * fechado: ao mudar, a análise do Superplan do item é refeita.
 */

export class BookingNcmError extends Error {}

/** Quem preenche o NCM do item: a Wellmix (tela Booking) ou o despachante com empresa. */
function assertNcmFiller(user: User) {
  if (isWellmix(user)) {
    assertScreen(user, "booking");
    return;
  }
  if (user.role === "broker" && user.partyId) return;
  throw new BookingNcmError("forbidden");
}

export const canFillBookingNcm = (user: User) =>
  isWellmix(user) || (user.role === "broker" && !!user.partyId);

/* ------------------------------------------------------------------------ */
/* Aproximação                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Produtos do cadastro com NCM (o do produto; sem ele, o da ficha mestre),
 * com os nomes e códigos pelos quais são reconhecidos.
 */
const ALL = 500_000;

export async function loadNcmCandidates(): Promise<NcmCandidate[]> {
  const store = getStore();
  const [products, sheets, linked, links] = await Promise.all([
    // Sem o teto padrão de 10 mil linhas: o cadastro do Sankhya passa disso.
    store.list("products", { limit: ALL }),
    store.list("purchase_sheets", { limit: ALL }),
    store
      .list("booking_items", { limit: ALL })
      .catch(() => [] as BookingItem[]),
    store.list("product_suppliers", { limit: ALL }).catch(() => []),
  ]);
  const sheetNcm = new Map<string, string>();
  for (const s of sheets) {
    const n = normalizeNcm(s.ncm);
    if (n && !sheetNcm.has(s.orderId)) sheetNcm.set(s.orderId, n);
  }
  const itemsOf = new Map<string, BookingItem[]>();
  for (const i of linked)
    if (i.productId) {
      const list = itemsOf.get(i.productId) ?? [];
      list.push(i);
      itemsOf.set(i.productId, list);
    }
  const skusOf = new Map<string, string[]>();
  for (const l of links)
    if (l.supplierSku) {
      const list = skusOf.get(l.productId) ?? [];
      list.push(l.supplierSku);
      skusOf.set(l.productId, list);
    }
  const out: NcmCandidate[] = [];
  for (const p of products) {
    const ncm = normalizeNcm(p.ncm) ?? sheetNcm.get(p.id) ?? null;
    if (!ncm) continue;
    const items = itemsOf.get(p.id) ?? [];
    out.push({
      productId: p.id,
      ncm,
      names: [
        p.name,
        ...items.flatMap((i) => [i.description, i.productName]),
      ].filter((n): n is string => !!n),
      codes: [
        p.supplierSku,
        p.sku,
        ...(skusOf.get(p.id) ?? []),
        ...items.map((i) => i.factoryItemCode),
      ].filter((c): c is string => !!c),
    });
  }
  return out;
}

/**
 * Classifica os itens sem NCM: os com correspondência ganham o NCM; os
 * outros vão para o despachante (marcados e avisados uma vez). Devolve
 * quantos de cada.
 */
export async function classifyBookingItems(
  items: BookingItem[],
  options: { candidates?: NcmCandidate[] } = {},
): Promise<{ matched: number; toBroker: number }> {
  const pending = items.filter((i) => !normalizeNcm(i.ncm));
  if (!pending.length) return { matched: 0, toBroker: 0 };
  const store = getStore();
  const candidates = options.candidates ?? (await loadNcmCandidates());
  const now = new Date().toISOString();
  let matched = 0;
  const newlyToBroker: BookingItem[] = [];
  for (const item of pending) {
    const match = matchNcm(
      {
        names: [item.description, item.productName],
        code: item.factoryItemCode,
      },
      candidates,
    );
    if (match) {
      await store.update("booking_items", item.id, {
        ncm: match.ncm,
        ncmSource: "match",
        ncmMatchProductIds: match.productIds.slice(0, 20),
        ncmScore: match.score,
        ncmAt: now,
        ncmByUserId: null,
      });
      matched++;
    } else if (!item.ncmRequestedAt) {
      await store.update("booking_items", item.id, { ncmRequestedAt: now });
      newlyToBroker.push(item);
    }
  }
  if (newlyToBroker.length) await notifyBrokers(newlyToBroker);
  return {
    matched,
    toBroker: pending.length - matched,
  };
}

async function notifyBrokers(items: BookingItem[]) {
  try {
    const brokers = (
      await getStore().list("users", {
        filter: { role: "broker", active: true },
      })
    ).filter((u) => !!u.partyId);
    if (!brokers.length) return;
    const groups = new Set(
      items.map((i) => ncmGroupKey(i.description ?? i.productName)),
    ).size;
    const { notify } = await import("./notifications");
    await notify(
      { userIds: brokers.map((u) => u.id) },
      {
        kind: "action",
        link: "/app/ncm-items",
        text: (t) => ({
          subject: t("bookingNcm.notify.subject", { n: items.length }),
          body: t("bookingNcm.notify.body", { n: items.length, groups }),
        }),
      },
    );
  } catch (error) {
    console.error("[booking-ncm] aviso ao despachante falhou", error);
  }
}

/** Há despachante com login ativo para receber os itens sem correspondência? */
export async function hasBroker(): Promise<boolean> {
  const brokers = await getStore().list("users", {
    filter: { role: "broker", active: true },
  });
  return brokers.some((u) => !!u.partyId);
}

/* ------------------------------------------------------------------------ */
/* Preencher                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * NCM digitado pela Wellmix (no booking) ou pelo despachante (nos grupos).
 * Com a tabela fiscal carregada, o NCM tem de estar nela. Booking fechado ou
 * em andamento: a análise do Superplan dos itens é refeita. Vazio tira o
 * NCM (só a Wellmix, no rascunho).
 */
export async function setBookingItemsNcm(
  user: User,
  itemIds: string[],
  raw: string,
): Promise<{ updated: number; reanalyzed: number }> {
  assertNcmFiller(user);
  const ids = [...new Set(itemIds)].slice(0, 200);
  if (!ids.length) throw new BookingNcmError("booking_ncm_no_items");
  const store = getStore();
  const trimmed = raw.trim();
  const ncm = trimmed ? normalizeNcm(trimmed) : null;
  if (trimmed && !ncm) throw new BookingNcmError("booking_ncm_invalid");
  if (!ncm && !isWellmix(user))
    throw new BookingNcmError("booking_ncm_invalid");
  if (ncm) {
    const { hasFiscalTable, lookupNcm } = await import("./fiscal");
    if ((await hasFiscalTable()) && !(await lookupNcm(ncm)))
      throw new BookingNcmError("booking_ncm_not_in_table");
  }
  const items = await store.list("booking_items", { filter: { id: ids } });
  if (items.length !== ids.length) throw new BookingNcmError("not_found");
  const lotIds = [...new Set(items.map((i) => i.lotId))];
  const lots = await store.list("booking_lots", { filter: { id: lotIds } });
  const lotOf = new Map(lots.map((l) => [l.id, l]));
  for (const item of items) {
    const lot = lotOf.get(item.lotId);
    if (!lot || lot.status === "cancelled")
      throw new BookingNcmError("booking_lot_locked");
    // Sem NCM, só no rascunho (fechado exige NCM).
    if (!ncm && lot.status !== "draft")
      throw new BookingNcmError("booking_ncm_required");
  }
  const now = new Date().toISOString();
  const source = isWellmix(user) ? "manual" : "broker";
  for (const item of items)
    await store.update("booking_items", item.id, {
      ncm,
      ncmSource: ncm ? source : null,
      ncmMatchProductIds: null,
      ncmScore: null,
      ncmAt: ncm ? now : null,
      ncmByUserId: ncm ? user.id : null,
      updatedByUserId: user.id,
    });
  // Fechado: refaz a análise dos itens com o NCM novo (II e IPI da tabela).
  let reanalyzed = 0;
  const closed = items.filter((i) => {
    const s = lotOf.get(i.lotId)?.status;
    return s === "closed" || s === "in_progress" || s === "done";
  });
  if (closed.length) {
    const { analyzeBookingItems } = await import("./superplan-analysis");
    const byLot = new Map<string, BookingItem[]>();
    for (const i of closed) {
      const list = byLot.get(i.lotId) ?? [];
      list.push({ ...i, ncm });
      byLot.set(i.lotId, list);
    }
    for (const [lotId, list] of byLot) {
      const lot = lotOf.get(lotId) as BookingLot;
      const snapshots = await analyzeBookingItems(list, {
        businessType: lot.businessType,
      });
      for (const i of list) {
        const snap = snapshots.get(i.id);
        if (!snap) continue;
        await store.update("booking_items", i.id, {
          analysis: { ...snap, at: now, byUserId: user.id },
        });
        reanalyzed++;
      }
    }
  }
  await audit(
    user,
    "booking_item.ncm",
    "booking_item",
    ids[0],
    `NCM ${ncm ?? "-"} em ${ids.length} item(ns) de booking (${source})`,
    null,
    { ncm, itemIds: ids },
  );
  return { updated: items.length, reanalyzed };
}

/* ------------------------------------------------------------------------ */
/* Tela do despachante                                                       */
/* ------------------------------------------------------------------------ */

/** O que o despachante vê de cada item: só o produto (sem fornecedor nem preço). */
export interface NcmWorkItem {
  id: string;
  description: string | null;
  productName: string | null;
  factoryItemCode: string | null;
  material: string | null;
  packageType: string | null;
  capacityMl: number | null;
  colorAssortment: string | null;
  powerDetail: string | null;
  size: string | null;
  lotNumber: number | null;
  requestedAt: string | null;
}

export interface NcmWorkGroup {
  key: string;
  items: NcmWorkItem[];
}

/** Itens sem NCM que foram para o despachante, agrupados pelos parecidos. */
export async function pendingNcmGroups(user: User): Promise<NcmWorkGroup[]> {
  assertNcmFiller(user);
  const store = getStore();
  let items: BookingItem[];
  let lots: BookingLot[];
  try {
    lots = await store.list("booking_lots", {
      filter: { status: ["draft", "closed", "in_progress", "done"] },
    });
    items = lots.length
      ? await store.list("booking_items", {
          filter: { lotId: lots.map((l) => l.id) },
        })
      : [];
  } catch (error) {
    const { isSchemaMissing } = await import("./packaging-brief");
    if (isSchemaMissing(error)) return [];
    throw error;
  }
  const lotOf = new Map(lots.map((l) => [l.id, l]));
  const groups = new Map<string, NcmWorkItem[]>();
  for (const i of items) {
    if (normalizeNcm(i.ncm) || !i.ncmRequestedAt) continue;
    const key = ncmGroupKey(i.description ?? i.productName);
    const list = groups.get(key) ?? [];
    const dims = [i.lengthCm, i.widthCm, i.heightCm];
    list.push({
      id: i.id,
      description: i.description,
      productName: i.productName,
      factoryItemCode: i.factoryItemCode,
      material: i.material,
      packageType: i.packageType,
      capacityMl: i.capacityMl,
      colorAssortment: i.colorAssortment,
      powerDetail: i.powerDetail,
      size: dims.every((d) => d !== null) ? dims.join(" × ") : null,
      lotNumber: lotOf.get(i.lotId)?.number ?? null,
      requestedAt: i.ncmRequestedAt ?? null,
    });
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      items: list.sort((a, b) =>
        (a.description ?? "").localeCompare(b.description ?? ""),
      ),
    }))
    .sort(
      (a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key),
    );
}

/** Contagem para as pendências do despachante e o aviso na tela da Wellmix. */
export async function pendingNcmCount(): Promise<number> {
  try {
    const items = await getStore().list("booking_items");
    return items.filter((i) => !normalizeNcm(i.ncm) && !!i.ncmRequestedAt)
      .length;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------------ */
/* Estimar de novo e sugestões                                               */
/* ------------------------------------------------------------------------ */

/**
 * "Estimar o NCM de novo" no booking: refaz a aproximação dos itens sem NCM
 * (o cadastro pode ter ganhado produtos desde a importação). Rascunho ou
 * fechado; cancelado não.
 */
export async function reclassifyBookingLot(
  user: User,
  lotId: string,
): Promise<{ matched: number; toBroker: number }> {
  if (!isWellmix(user)) throw new BookingNcmError("forbidden");
  assertScreen(user, "booking");
  const store = getStore();
  const lot = await store.get("booking_lots", lotId);
  if (!lot) throw new BookingNcmError("not_found");
  if (lot.status === "cancelled")
    throw new BookingNcmError("booking_lot_locked");
  const items = await store.list("booking_items", { filter: { lotId } });
  const result = await classifyBookingItems(items);
  await audit(
    user,
    "booking_item.ncm",
    "booking_lot",
    lotId,
    `NCM estimado de novo no booking nº ${lot.number}: ${result.matched} por aproximação, ${result.toBroker} sem correspondência`,
  );
  return result;
}

let cachedIndex: { at: number; index: NcmIndex } | null = null;
const INDEX_TTL_MS = 120_000;

/**
 * Sugestões de NCM (até 3) para os itens sem NCM, para a Wellmix escolher
 * com um clique na tabela do booking. Nada é gravado aqui.
 */
export async function bookingNcmSuggestions(
  items: BookingItem[],
): Promise<Map<string, NcmSuggestion[]>> {
  const out = new Map<string, NcmSuggestion[]>();
  const pending = items.filter((i) => !normalizeNcm(i.ncm));
  if (!pending.length) return out;
  if (!cachedIndex || Date.now() - cachedIndex.at > INDEX_TTL_MS)
    cachedIndex = {
      at: Date.now(),
      index: buildNcmIndex(await loadNcmCandidates()),
    };
  for (const item of pending) {
    const list = suggestNcms(
      {
        names: [item.description, item.productName],
        code: item.factoryItemCode,
        material: item.material,
      },
      cachedIndex.index,
    );
    if (list.length) out.set(item.id, list);
  }
  return out;
}
