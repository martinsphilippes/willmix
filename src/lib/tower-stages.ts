import type { Screen } from "@/lib/auth/screens";
import type { TowerRow } from "@/lib/services/control-tower";
import type {
  BoardCard,
  BoardCardKey,
  TowerBoard,
} from "@/lib/services/tower-board";

/*
 * Control Tower por etapa do processo (docs/WORKFLOW.md, "Control Tower: por
 * etapa"). Camada só de apresentação sobre os quadrados de tower-board.ts:
 * nenhuma regra de classificação muda, os 50 quadrados continuam existindo
 * (em "Mais visões") e as chaves `?card=` antigas continuam valendo.
 *
 * - Etapas: 7 quadrados; cada pedido ou solicitação está em uma etapa só (a
 *   soma fecha com o total em andamento).
 * - Passos: dentro da etapa, os quadrados que se resolvem na mesma tela foram
 *   juntos (ficha: preencher e validar; faca e arte; inspeção com ou sem
 *   problema; reserva e saída do navio; caminhão e a caminho). Passo "em
 *   paralelo" (produção, embalagem na cotação, recebimento) não entra na
 *   soma da etapa: o mesmo pedido também está em outro passo.
 * - Precisa de ação: o que cada perfil pode resolver (pela tela que abre).
 */

export interface StageGroupDef {
  key: string;
  /** Quadrados de tower-board.ts que formam o passo. */
  cards: readonly BoardCardKey[];
  /** Acontece ao lado das etapas: não entra na contagem da etapa. */
  parallel?: boolean;
}

export interface StageDef {
  key: string;
  groups: readonly StageGroupDef[];
}

export const TOWER_STAGES: readonly StageDef[] = [
  {
    key: "request",
    groups: [
      { key: "quoting", cards: ["reqNew", "reqRfq", "reqQuotes"] },
      { key: "choosing", cards: ["reqChoose", "reqApproval"] },
      { key: "proposal", cards: ["reqProposal", "reqDown"] },
      { key: "reqPackaging", cards: ["reqPackaging"], parallel: true },
    ],
  },
  {
    key: "prep",
    groups: [
      { key: "conference", cards: ["ordConference"] },
      { key: "sheet", cards: ["ordSheet", "ordValidation"] },
      { key: "art", cards: ["ordDieline", "ordArt", "ordArtApproval"] },
    ],
  },
  {
    key: "production",
    groups: [
      { key: "inspection", cards: ["ordInspection", "ordInspectionIssue"] },
      { key: "factory", cards: ["parProduction"], parallel: true },
    ],
  },
  {
    key: "shipping",
    groups: [
      { key: "booking", cards: ["ordBooking", "ordWaitingShip"] },
      { key: "atSea", cards: ["ordAtSea"] },
    ],
  },
  { key: "port", groups: [{ key: "port", cards: ["ordPort"] }] },
  {
    key: "delivery",
    groups: [
      { key: "transport", cards: ["ordWaitingTruck", "ordInTransit"] },
      { key: "delivered", cards: ["ordDelivered"] },
      { key: "receiving", cards: ["parReceiving"], parallel: true },
    ],
  },
  {
    key: "closed",
    groups: [
      { key: "closedMonth", cards: ["ordClosedMonth"] },
      { key: "cancelledMonth", cards: ["ordCancelledMonth"] },
    ],
  },
];

/**
 * Pontos de ação: o que alguém precisa resolver. `screen` é a tela onde se
 * resolve: o quadrado só aparece para quem a abre (um perfil vê o que pode
 * efetivamente atuar). Financeiro e parcelas dependem de Finanças, que o
 * próprio tower-board.ts já filtra.
 */
export const ACTION_CARDS: ReadonlyArray<{
  key: BoardCardKey;
  screen: Screen;
}> = [
  { key: "probOverdue", screen: "orders" },
  { key: "probBlocked", screen: "orders" },
  { key: "probDocRejected", screen: "orders" },
  { key: "parDocsToValidate", screen: "orders" },
  { key: "parNumerario", screen: "orders" },
  { key: "parChannel", screen: "orders" },
  { key: "parSkuRejected", screen: "orders" },
  { key: "parArtIssue", screen: "orders" },
  { key: "parProductionLate", screen: "orders" },
  { key: "parFollowupDue", screen: "orders" },
  { key: "parCertification", screen: "orders" },
  { key: "parReceivingDiff", screen: "orders" },
  { key: "parContainerReturn", screen: "containers" },
  { key: "probErp", screen: "orders" },
  { key: "probCancelRequest", screen: "orders" },
  { key: "probCertExpiring", screen: "products" },
  { key: "probPenalty", screen: "penalties" },
  { key: "probReviews", screen: "reviews" },
  { key: "reqNew", screen: "requests" },
  { key: "reqChoose", screen: "requests" },
  { key: "reqApproval", screen: "requests" },
  { key: "parInstallmentOverdue", screen: "payables" },
  { key: "parInstallmentDueSoon", screen: "payables" },
  { key: "parInstallmentRequested", screen: "payables" },
  { key: "parReceivable", screen: "finance" },
];

export const isActionCardKey = (key: string | undefined) =>
  !!key && ACTION_CARDS.some((a) => a.key === key);

export interface StageGroup {
  key: string;
  parallel: boolean;
  cards: BoardCardKey[];
  rows: TowerRow[];
  count: number;
  overdue: number;
  value: number | null;
}

export interface Stage {
  key: string;
  groups: StageGroup[];
  /** Pedidos e solicitações da etapa (sem os passos em paralelo). */
  count: number;
  overdue: number;
  /** Passos em paralelo, com a contagem de cada um (linha pequena do quadrado). */
  alongside: Array<{ key: string; count: number }>;
  /** Etapa com um passo só: tocar abre a lista direto. */
  single: string | null;
}

/** Junta as linhas de vários quadrados sem repetir (a mesma solicitação pode estar em dois). */
function uniqueRows(cards: BoardCard[]): TowerRow[] {
  const seen = new Set<string>();
  const rows: TowerRow[] = [];
  for (const card of cards)
    for (const row of card.rows) {
      const id = `${row.kind ?? ""}:${row.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
    }
  return rows;
}

/** Monta as etapas a partir dos quadrados já calculados (função pura). */
export function buildTowerStages(board: TowerBoard): Stage[] {
  const byKey = new Map(board.cards.map((c) => [c.key, c]));
  const pick = (keys: readonly BoardCardKey[]) =>
    keys.map((k) => byKey.get(k)).filter((c): c is BoardCard => !!c);
  return TOWER_STAGES.map((def) => {
    const groups = def.groups.map((g): StageGroup => {
      const cards = pick(g.cards);
      const rows = uniqueRows(cards);
      const values = cards
        .map((c) => c.value)
        .filter((v): v is number => v !== null);
      return {
        key: g.key,
        parallel: !!g.parallel,
        cards: cards.map((c) => c.key),
        rows,
        count: rows.length,
        overdue: rows.filter((r) => r.overdue).length,
        value: values.length ? values.reduce((a, b) => a + b, 0) : null,
      };
    });
    const main = groups.filter((g) => !g.parallel);
    const rows = uniqueRows(pick(main.flatMap((g) => g.cards)));
    return {
      key: def.key,
      groups,
      count: rows.length,
      overdue: rows.filter((r) => r.overdue).length,
      alongside: groups
        .filter((g) => g.parallel)
        .map((g) => ({ key: g.key, count: g.count })),
      single: groups.length === 1 ? groups[0].key : null,
    };
  });
}

/** Passo (e etapa) que contém o quadrado; nulo para quadrado que não está nas etapas. */
export function findGroupOfCard(
  key: string,
): { stage: string; group: string } | null {
  for (const stage of TOWER_STAGES)
    for (const group of stage.groups)
      if ((group.cards as readonly string[]).includes(key))
        return { stage: stage.key, group: group.key };
  return null;
}

/** Quadrados de ação que o perfil pode resolver, na ordem da tela. */
export function actionCardsFor(
  board: TowerBoard,
  canOpen: (screen: Screen) => boolean,
): BoardCard[] {
  const byKey = new Map(board.cards.map((c) => [c.key, c]));
  return ACTION_CARDS.filter((a) => canOpen(a.screen))
    .map((a) => byKey.get(a.key))
    .filter((c): c is BoardCard => !!c);
}
