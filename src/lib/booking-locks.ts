import type { BookingLock, BookingLot } from "@/lib/db/schema";
import { bookingLotLockable } from "@/lib/booking-lots";

/*
 * Travar books (dono, 23/11/2026; docs/BOOKING.md, "Travar books"): regras
 * puras, sem banco. O analista pega para si um book ou todos os de um tipo
 * de item. Os outros analistas deixam de ver o que está travado; quem travou
 * vê só o que travou. O administrador e quem tem "Supervisionar os books"
 * veem todos, com quem está cada um e há quanto tempo.
 */

/** Tipo de item sem acento, maiúsculas nem espaços sobrando: "Vidro " = "vidro". */
export function itemTypeKey(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Tipo de item como fica gravado (espaços arrumados, até 80 letras); vazio = nulo. */
export function cleanItemType(raw: string | null | undefined): string | null {
  const value = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  return value || null;
}

type LockedLot = Pick<BookingLot, "id" | "createdAt"> & {
  itemType?: string | null;
  /** Com a situação, só o book que já saiu do rascunho tem trava. */
  status?: BookingLot["status"];
};
type Lock = Pick<
  BookingLock,
  "id" | "scope" | "lotId" | "typeKey" | "itemType" | "userId" | "lockedAt"
>;

/** A trava que vale para o book: a dele; sem ela, a do tipo de item dele. */
export function lockOfLot<L extends Lock>(
  lot: LockedLot,
  locks: readonly L[],
): L | null {
  // Só depois do rascunho (dono, 24/11/2026): o book em rascunho ainda não
  // está sendo trabalhado na seleção, e todos continuam vendo.
  if (lot.status && !bookingLotLockable(lot.status)) return null;
  const own = locks.find((l) => l.scope === "lot" && l.lotId === lot.id);
  if (own) return own;
  const key = itemTypeKey(lot.itemType);
  if (!key) return null;
  return locks.find((l) => l.scope === "type" && l.typeKey === key) ?? null;
}

/**
 * Desde quando o book está com a pessoa: a hora da trava ou, no book que
 * chegou depois de o tipo ser travado, a hora em que ele chegou.
 */
export function lockedSince(lot: LockedLot, lock: Lock): string {
  return lock.scope === "type" && lot.createdAt > lock.lockedAt
    ? lot.createdAt
    : lock.lockedAt;
}

/**
 * Os books que o login vê. Supervisor: todos. Analista com book travado: só
 * os dele. Analista sem nenhum: os que ninguém travou.
 */
export function visibleLots<T extends LockedLot>(
  lots: readonly T[],
  locks: readonly Lock[],
  userId: string,
  supervisor: boolean,
): T[] {
  if (supervisor || !locks.length) return [...lots];
  const holder = new Map(lots.map((l) => [l.id, lockOfLot(l, locks)]));
  const mine = lots.filter((l) => holder.get(l.id)?.userId === userId);
  if (mine.length) return mine;
  return lots.filter((l) => !holder.get(l.id));
}

/** O book passou do prazo com a pessoa? (minutos com ela × prazo em horas) */
export const lockLate = (minutes: number, slaHours: number) =>
  minutes > slaHours * 60;

/**
 * Até quando o book fica no prazo com a pessoa (dono, 24/11/2026: no lugar
 * do selo "No prazo (3 h)", só a data e a hora): "24/11 19:52", no horário
 * de Brasília (a lista do Book é da equipe). Vazio se a data é inválida.
 */
export function lockDueText(sinceIso: string, slaHours: number): string {
  const ms = Date.parse(sinceIso);
  if (Number.isNaN(ms)) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms + slaHours * 3_600_000));
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")} ${part("hour")}:${part("minute")}`;
}

/** "2 h 05 min", "45 min", "3 d 4 h". */
export function durationText(minutes: number): string {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min`;
}

/** Quantos itens do book já foram trabalhados e o percentual (inteiro). */
export function workedShare(
  items: ReadonlyArray<{ workedAt?: string | null }>,
) {
  const worked = items.filter((i) => !!i.workedAt).length;
  return {
    worked,
    total: items.length,
    pct: items.length ? Math.round((worked / items.length) * 100) : 0,
  };
}
