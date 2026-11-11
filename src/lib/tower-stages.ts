import type { Screen } from "@/lib/auth/screens";
import type { TowerRow } from "@/lib/services/control-tower";
import type {
  BoardCard,
  BoardCardKey,
  TowerBoard,
} from "@/lib/services/tower-board";

/*
 * Control Tower por etapa do processo (docs/WORKFLOW.md, "Control Tower: por
 * etapa"). Camada só de apresentação sobre os quadrados de tower-board.ts.
 *
 * O processo de hoje (docs/PURCHASE_ORDER.md), em nove etapas:
 * Booking → Solicitação ao fornecedor → Preparação, arte e certificação →
 * Contrato e assinaturas → Produção e inspeção → Embarque e mar → Porto e
 * alfândega → Entrega → Encerrado.
 *
 * - Cada lote, solicitação ou pedido está em uma etapa só (a soma fecha).
 * - Os passos "em paralelo" (as três raias, produção, recebimento) não entram
 *   na soma da etapa: o mesmo pedido também está em outro passo.
 * - Pedido importado do Sankhya (sem fluxo no portal) aparece só pela etapa da
 *   TOP, num passo próprio ("Do Sankhya") nas etapas em que o fluxo do portal
 *   é diferente (preparação e contrato).
 * - Precisa de ação: o que cada perfil pode resolver (pela tela que abre).
 */

export interface StageCardDef {
  key: BoardCardKey;
  /** Acontece ao lado das etapas: não entra na contagem da etapa. */
  parallel?: boolean;
}

export interface StageDef {
  key: string;
  cards: readonly StageCardDef[];
}

const main = (key: BoardCardKey): StageCardDef => ({ key });
const alongside = (key: BoardCardKey): StageCardDef => ({
  key,
  parallel: true,
});

export const TOWER_STAGES: readonly StageDef[] = [
  {
    key: "booking",
    cards: [main("bkDraft"), main("bkClosed"), main("bkProgress")],
  },
  {
    key: "request",
    cards: [
      main("srWaitingSupplier"),
      main("srWaitingWellmix"),
      main("srApproved"),
      main("srToOrder"),
    ],
  },
  {
    key: "prep",
    cards: [
      main("ordPrepPortal"),
      main("ordPrepSankhya"),
      alongside("lnSupplier"),
      alongside("lnArt"),
      alongside("lnArtReview"),
      alongside("lnCert"),
    ],
  },
  {
    key: "contract",
    cards: [
      main("ordContractWellmix"),
      main("ordContractSupplier"),
      main("ordContractSankhya"),
    ],
  },
  {
    key: "production",
    cards: [
      main("ordInspection"),
      main("ordInspectionIssue"),
      alongside("parProduction"),
    ],
  },
  {
    key: "shipping",
    cards: [main("ordBooking"), main("ordWaitingShip"), main("ordAtSea")],
  },
  { key: "port", cards: [main("ordPort")] },
  {
    key: "delivery",
    cards: [
      main("ordWaitingTruck"),
      main("ordInTransit"),
      main("ordDelivered"),
      alongside("parReceiving"),
    ],
  },
  {
    key: "closed",
    cards: [main("ordClosedMonth"), main("ordCancelledMonth")],
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
  // Do começo do processo: o que espera a Wellmix.
  { key: "bkClosed", screen: "booking" },
  { key: "srWaitingWellmix", screen: "quotes" },
  { key: "srApproved", screen: "quotes" },
  { key: "srToOrder", screen: "orders" },
  { key: "lnArtReview", screen: "orders" },
  { key: "ordContractWellmix", screen: "orders" },
  // Do pedido em andamento.
  { key: "parDocsToValidate", screen: "orders" },
  { key: "parNumerario", screen: "orders" },
  { key: "parChannel", screen: "orders" },
  { key: "parSkuRejected", screen: "orders" },
  { key: "parArtIssue", screen: "orders" },
  { key: "parProductionLate", screen: "orders" },
  { key: "parFollowupDue", screen: "orders" },
  { key: "parReceivingDiff", screen: "orders" },
  { key: "parContainerReturn", screen: "containers" },
  { key: "probErp", screen: "orders" },
  { key: "probCancelRequest", screen: "orders" },
  { key: "probCertExpiring", screen: "products" },
  { key: "probPenalty", screen: "penalties" },
  { key: "probReviews", screen: "reviews" },
  { key: "parInstallmentOverdue", screen: "payables" },
  { key: "parInstallmentDueSoon", screen: "payables" },
  { key: "parInstallmentRequested", screen: "payables" },
  { key: "parReceivable", screen: "finance" },
];

export const isActionCardKey = (key: string | undefined) =>
  !!key && ACTION_CARDS.some((a) => a.key === key);

/** Um passo da etapa: o mesmo quadrado do tower-board, com a lista dele. */
export interface StageGroup {
  /** Chave do quadrado (o texto vem de `board.card.<chave>`). */
  key: BoardCardKey;
  parallel: boolean;
  rows: TowerRow[];
  count: number;
  overdue: number;
  value: number | null;
}

export interface Stage {
  key: string;
  groups: StageGroup[];
  /** Lotes, solicitações e pedidos da etapa (sem os passos em paralelo). */
  count: number;
  overdue: number;
  /** Passos em paralelo, com a contagem de cada um (linha pequena do quadrado). */
  alongside: Array<{ key: BoardCardKey; count: number }>;
  /** Etapa com um passo só: tocar abre a lista direto. */
  single: BoardCardKey | null;
}

/** Junta as linhas de vários quadrados sem repetir. */
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
  return TOWER_STAGES.map((def) => {
    // Quadrado que o tower-board não calculou (ex.: parcela sem Finanças) some.
    const present = def.cards.filter((c) => byKey.has(c.key));
    const groups = present.map((c): StageGroup => {
      const card = byKey.get(c.key)!;
      return {
        key: c.key,
        parallel: !!c.parallel,
        rows: card.rows,
        count: card.rows.length,
        overdue: card.overdue,
        value: card.value,
      };
    });
    const exclusive = present
      .filter((c) => !c.parallel)
      .map((c) => byKey.get(c.key)!);
    const rows = uniqueRows(exclusive);
    return {
      key: def.key,
      groups,
      count: rows.length,
      overdue: rows.filter((r) => r.overdue).length,
      alongside: groups
        .filter((g) => g.parallel)
        .map((g) => ({ key: g.key, count: g.count })),
      single: groups.length === 1 && !groups[0].parallel ? groups[0].key : null,
    };
  });
}

/** Etapa e passo que contêm o quadrado; nulo para quadrado que não está nas etapas. */
export function findGroupOfCard(
  key: string,
): { stage: string; group: BoardCardKey } | null {
  for (const stage of TOWER_STAGES)
    for (const card of stage.cards)
      if (card.key === key) return { stage: stage.key, group: card.key };
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
