import "server-only";

import type { DemandKind } from "@/lib/purchase-demand";
import {
  earliestDue,
  isOverdue,
  type StepDue,
} from "@/lib/request-responsible";
import { turnCounts, type TurnParty } from "@/lib/turn";
import {
  matchesRequest,
  type NextStep,
  type RequestSituation,
} from "./request-list";

/*
 * Cards e filtros de Encomendas (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
 * seção 6). Regra pura, usada pela tela e pelo CSV:
 * - cada solicitação conta uma vez, com quantos produtos, programações e
 *   pendências tiver (antes contava cada produto: a #6, de 2 produtos,
 *   entrava 2 vezes);
 * - Total = solicitações + rascunhos de quem vê; Abertas = enviadas com
 *   alguma etapa pendente (de quem for a vez); Rascunhos; Atrasadas = abertas
 *   com o prazo da etapa vencido (subconjunto de Abertas);
 * - os cards contam sobre tudo o que a busca, o tipo e o "Com quem está"
 *   deixam (antes da paginação); o card escolhido filtra a lista sem mudar a
 *   contagem dos outros. O "Com quem está" conta com a busca, o tipo e o card.
 */

/** Um produto da solicitação, com o passo dele. */
export interface CardRow {
  number?: number | null;
  productName: string;
  description?: string | null;
  kind: DemandKind | null;
  step: NextStep;
  due: StepDue | null;
}

/** Uma solicitação (um ou vários produtos). */
export interface CardEntry {
  rows: readonly CardRow[];
  customerName: string;
}

/** Um rascunho de quem vê (só dele, como sempre). */
export interface CardDraft {
  number?: number | null;
  title: string;
  customerName: string | null;
}

export type CardCounts = Record<Exclude<RequestSituation, "ordered">, number>;

/** A solicitação tem alguma etapa pendente (de qualquer parte)? */
export const entryOpen = (e: CardEntry) =>
  e.rows.some((r) => r.step.key !== "none");

/** O prazo que vale para a solicitação: o da etapa pendente que vence antes. */
export const entryDue = (e: CardEntry) =>
  earliestDue(e.rows.filter((r) => r.step.key !== "none").map((r) => r.due));

/** Aberta com o prazo da etapa vencido. */
export const entryLate = (e: CardEntry, now: Date, today: string) =>
  entryOpen(e) && isOverdue(entryDue(e), now, today);

/** As partes com a vez na solicitação (ações paralelas: mais de uma). */
export const entryParties = (e: CardEntry): Set<TurnParty> =>
  new Set(
    e.rows.map((r) => r.step.who).filter((p): p is TurnParty => p !== null),
  );

/** O rascunho é de quem o salvou: a vez é da Wellmix. */
const DRAFT_PARTY: TurnParty = "wellmix";

export function listCards<E extends CardEntry, D extends CardDraft>(
  entries: readonly E[],
  drafts: readonly D[],
  f: {
    situation: RequestSituation;
    q: string;
    kind: DemandKind | null;
    turn: TurnParty | null;
    now: Date;
    today: string;
  },
): {
  counts: CardCounts;
  entries: E[];
  drafts: D[];
  chips: { party: TurnParty; count: number }[];
} {
  const matchesQ = (e: E) =>
    !f.q ||
    e.rows.some((r) =>
      matchesRequest(
        {
          number: r.number ?? null,
          productName: r.productName,
          description: r.description ?? "",
        },
        e.customerName,
        f.q,
      ),
    );
  const matchesKind = (e: E) =>
    !f.kind || e.rows.some((r) => r.kind === f.kind);
  const draftQ = (d: D) =>
    !f.q ||
    matchesRequest(
      { number: d.number ?? null, productName: d.title, description: "" },
      d.customerName ?? "",
      f.q,
    );
  // Rascunhos são encomendas (a Reposição tem a lista dela).
  const draftsOk = !f.kind || f.kind === "order";
  const inCard = (e: E) =>
    f.situation === "all" ||
    (f.situation === "open" && entryOpen(e)) ||
    (f.situation === "late" && entryLate(e, f.now, f.today));
  const showsDrafts = f.situation === "all" || f.situation === "draft";

  const base = entries.filter(
    (e) =>
      matchesQ(e) && matchesKind(e) && (!f.turn || entryParties(e).has(f.turn)),
  );
  const baseDrafts = draftsOk
    ? drafts.filter((d) => draftQ(d) && (!f.turn || f.turn === DRAFT_PARTY))
    : [];
  const counts: CardCounts = {
    all: base.length + baseDrafts.length,
    open: base.filter(entryOpen).length,
    draft: baseDrafts.length,
    late: base.filter((e) => entryLate(e, f.now, f.today)).length,
  };
  // "Com quem está": cada parte conta a solicitação uma vez.
  const chipEntries =
    f.situation === "draft"
      ? []
      : entries.filter((e) => matchesQ(e) && matchesKind(e) && inCard(e));
  const chipDrafts = draftsOk && showsDrafts ? drafts.filter(draftQ) : [];
  return {
    counts,
    entries: f.situation === "draft" ? [] : base.filter(inCard),
    drafts: showsDrafts ? baseDrafts : [],
    chips: turnCounts([
      ...chipEntries.flatMap((e) => [...entryParties(e)]),
      ...chipDrafts.map(() => DRAFT_PARTY),
    ]),
  };
}
