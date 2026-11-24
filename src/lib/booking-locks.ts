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
  /** Trabalho completo (todos os itens trabalhados): a trava não vale mais. */
  workDoneAt?: string | null;
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
  // Trabalho completo: a trava se libera sozinha (dono, 24/11/2026).
  if (lot.workDoneAt) return null;
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

/** "24/11 19:52" no horário de Brasília (a lista do Book é da equipe). */
const BRASILIA = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function brasiliaText(ms: number): string {
  const parts = BRASILIA.formatToParts(new Date(ms));
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")} ${part("hour")}:${part("minute")}`;
}

/**
 * Até quando o book fica no prazo com a pessoa (dono, 24/11/2026: no lugar
 * do selo "No prazo (3 h)", só a data e a hora): "24/11 19:52", no horário
 * de Brasília (a lista do Book é da equipe). Vazio se a data é inválida.
 */
export function lockDueText(sinceIso: string, slaHours: number): string {
  const ms = Date.parse(sinceIso);
  if (Number.isNaN(ms)) return "";
  return brasiliaText(ms + slaHours * 3_600_000);
}

/*
 * O prazo do book explicado (dono, 24/11/2026: "a data e a hora, mas também
 * quanto tempo está atrasado, quanto tempo tem para fazer e, quando fizer,
 * há quanto tempo já está feito"). Na lista do Book, numa linha:
 * - no prazo: "Faltam 2 h 10 min · até 24/11 19:52" (verde; âmbar no último
 *   quarto do prazo, para chamar a atenção antes de vencer);
 * - atrasado: "Atrasado 1 h 05 min · venceu 24/11 19:52" (vermelho);
 * - feito (todos os itens trabalhados): "Feito há 40 min · em 24/11 19:30".
 */
export type BookClockStage = "ok" | "soon" | "late" | "done";

export interface BookClock {
  stage: BookClockStage;
  /** Minutos que faltam (no prazo), de atraso (atrasado) ou desde o feito. */
  minutes: number;
  /** Há quantos minutos está com a pessoa (no feito, desde o feito). */
  elapsed: number;
  /** O fim do prazo ou a hora do feito: "24/11 19:52", horário de Brasília. */
  at: string;
}

const MINUTE = 60_000;

/**
 * A situação do prazo agora (`now` em milissegundos). O feito vale mais que a
 * trava (com tudo trabalhado a trava sai sozinha). Nulo: nem trava nem feito.
 */
export function bookClock(
  input: { since?: string | null; workDoneAt?: string | null },
  slaHours: number,
  now: number,
): BookClock | null {
  if (input.workDoneAt) {
    const done = Date.parse(input.workDoneAt);
    if (Number.isNaN(done)) return null;
    const ago = Math.max(0, Math.floor((now - done) / MINUTE));
    return {
      stage: "done",
      minutes: ago,
      elapsed: ago,
      at: brasiliaText(done),
    };
  }
  if (!input.since) return null;
  const start = Date.parse(input.since);
  if (Number.isNaN(start)) return null;
  const sla = Math.max(0, slaHours) * 3_600_000;
  const due = start + sla;
  const elapsed = Math.max(0, Math.floor((now - start) / MINUTE));
  const at = brasiliaText(due);
  if (now < due)
    return {
      stage: due - now <= sla / 4 ? "soon" : "ok",
      // Arredonda para cima (faltam 30 s = 1 min) e nunca passa do prazo
      // inteiro (relógio do aparelho um pouco atrasado).
      minutes: Math.min(
        Math.ceil((due - now) / MINUTE),
        Math.ceil(sla / MINUTE),
      ),
      elapsed,
      at,
    };
  return {
    stage: "late",
    minutes: Math.max(1, Math.floor((now - due) / MINUTE)),
    elapsed,
    at,
  };
}

/** Os textos da situação, com {t} (o tempo) e {d} (a data e a hora). */
export interface BookClockLabels {
  /** "Faltam {t}", "Atrasado {t}", "Feito há {t}" e "Feito agora". */
  left: string;
  late: string;
  done: string;
  doneNow: string;
  /** "até {d}", "venceu {d}" e "em {d}". */
  until: string;
  due: string;
  doneAt: string;
}

/** O texto principal ("Faltam 2 h 10 min") e o da data ("até 24/11 19:52"). */
export function bookClockText(
  clock: BookClock,
  labels: BookClockLabels,
): { main: string; at: string } {
  const [main, at] =
    clock.stage === "done"
      ? [clock.minutes < 1 ? labels.doneNow : labels.done, labels.doneAt]
      : clock.stage === "late"
        ? [labels.late, labels.due]
        : [labels.left, labels.until];
  return {
    main: main.replaceAll("{t}", durationText(clock.minutes)),
    at: at.replaceAll("{d}", clock.at),
  };
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

/**
 * Quem libera a trava (dono, 24/11/2026): nunca quem travou, só o gestor
 * dele (alguém da cadeia do "Responde a") ou quem supervisiona os books. A
 * trava também se libera sozinha quando o book inteiro fica trabalhado.
 */
export function canReleaseLock(
  lockUserId: string,
  userId: string,
  supervisor: boolean,
  /** Ids da cadeia de gestores de quem travou (o direto, o dele…). */
  managerIds: readonly string[],
): boolean {
  if (supervisor) return true;
  if (lockUserId === userId) return false;
  return managerIds.includes(userId);
}
