import { describe, expect, it } from "vitest";
import {
  ACTION_CARDS,
  TOWER_STAGES,
  actionCardsFor,
  buildTowerStages,
  findGroupOfCard,
  isActionCardKey,
} from "@/lib/tower-stages";
import {
  BOARD_CARDS,
  type BoardCard,
  type BoardCardKey,
  type TowerBoard,
} from "@/lib/services/tower-board";
import type { TowerRow } from "@/lib/services/control-tower";

/* Control Tower por etapa: só agrupa os quadrados; a regra de cada um é do tower-board. */

const row = (id: string, overdue = false, kind = "order"): TowerRow =>
  ({ id, kind, overdue, number: id }) as unknown as TowerRow;

function board(
  rows: Partial<Record<BoardCardKey, TowerRow[]>> = {},
): TowerBoard {
  const cards = BOARD_CARDS.map((c): BoardCard => ({
    key: c.key,
    block: c.block,
    href: "href" in c ? c.href : null,
    rows: rows[c.key] ?? [],
    count: (rows[c.key] ?? []).length,
    overdue: (rows[c.key] ?? []).filter((r) => r.overdue).length,
    value: null,
  }));
  return { cards, currency: "BRL" };
}

describe("etapas da Control Tower", () => {
  it("são sete e cada quadrado de posição está em um passo só", () => {
    expect(TOWER_STAGES.map((s) => s.key)).toEqual([
      "request",
      "prep",
      "production",
      "shipping",
      "port",
      "delivery",
      "closed",
    ]);
    const all = TOWER_STAGES.flatMap((s) =>
      s.groups.flatMap((g) => g.cards as readonly string[]),
    );
    expect(new Set(all).size).toBe(all.length);
    // Todo quadrado dos blocos 1 e 2 cai em alguma etapa.
    for (const c of BOARD_CARDS)
      if (c.block === "request" || c.block === "order")
        expect(findGroupOfCard(c.key), c.key).not.toBeNull();
  });

  it("a soma das etapas fecha com os pedidos e solicitações em andamento", () => {
    const stages = buildTowerStages(
      board({
        reqNew: [row("r1", false, "request")],
        reqChoose: [row("r2", false, "request")],
        ordSheet: [row("o1"), row("o2")],
        ordValidation: [row("o3")],
        ordInspectionIssue: [row("o4", true)],
        ordAtSea: [row("o5")],
        ordPort: [row("o6")],
        ordInTransit: [row("o7")],
        ordDelivered: [row("o8")],
      }),
    );
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
    expect(stages.reduce((n, s) => n + s.count, 0)).toBe(10);
    expect(byKey.request.count).toBe(2);
    expect(byKey.prep.count).toBe(3);
    expect(byKey.production.count).toBe(1);
    expect(byKey.production.overdue).toBe(1);
  });

  it("junta os passos que se resolvem na mesma tela", () => {
    const stages = buildTowerStages(
      board({
        ordSheet: [row("o1")],
        ordValidation: [row("o2")],
        ordDieline: [row("o3")],
        ordArt: [row("o4")],
        ordArtApproval: [row("o5")],
        ordBooking: [row("o6")],
        ordWaitingShip: [row("o7", true)],
      }),
    );
    const group = (stage: string, key: string) =>
      stages.find((s) => s.key === stage)!.groups.find((g) => g.key === key)!;
    expect(group("prep", "sheet").count).toBe(2);
    expect(group("prep", "art").count).toBe(3);
    expect(group("shipping", "booking").count).toBe(2);
    expect(group("shipping", "booking").overdue).toBe(1);
  });

  it("passo em paralelo não entra na soma da etapa e aparece ao lado", () => {
    const stages = buildTowerStages(
      board({
        ordInspection: [row("o1")],
        parProduction: [row("o1"), row("o2"), row("o3")],
      }),
    );
    const production = stages.find((s) => s.key === "production")!;
    expect(production.count).toBe(1);
    expect(production.alongside).toEqual([{ key: "factory", count: 3 }]);
  });

  it("zero continua à vista e etapa de um passo só abre a lista direto", () => {
    const stages = buildTowerStages(board());
    expect(stages).toHaveLength(7);
    expect(stages.every((s) => s.count === 0)).toBe(true);
    expect(stages.find((s) => s.key === "port")!.single).toBe("port");
    expect(stages.find((s) => s.key === "prep")!.single).toBeNull();
  });

  it("a mesma solicitação em dois quadrados conta uma vez no passo", () => {
    const stages = buildTowerStages(
      board({
        reqRfq: [row("r1", false, "request")],
        reqNew: [row("r1", false, "request")],
      }),
    );
    expect(stages.find((s) => s.key === "request")!.groups[0].count).toBe(1);
  });
});

describe("pontos de ação por perfil", () => {
  it("só traz os quadrados das telas que o perfil abre", () => {
    const b = board();
    const only = (...screens: string[]) =>
      actionCardsFor(b, (s) => screens.includes(s)).map((c) => c.key);
    expect(only()).toEqual([]);
    expect(only("penalties")).toEqual(["probPenalty"]);
    expect(only("requests")).toEqual(["reqNew", "reqChoose", "reqApproval"]);
    const orders = only("orders");
    expect(orders).toContain("probOverdue");
    expect(orders).not.toContain("probPenalty");
    expect(orders).not.toContain("parReceivable");
    // Quem abre tudo vê todos os pontos de ação.
    expect(actionCardsFor(b, () => true)).toHaveLength(ACTION_CARDS.length);
  });

  it("quadrado sem Finanças (fora do tower-board) não aparece nem para quem abre a tela", () => {
    const b = board();
    const noFinance: TowerBoard = {
      ...b,
      cards: b.cards.filter((c) => c.key !== "parReceivable"),
    };
    const keys = actionCardsFor(noFinance, () => true).map((c) => c.key);
    expect(keys).not.toContain("parReceivable");
  });

  it("reconhece a chave de ponto de ação", () => {
    expect(isActionCardKey("probOverdue")).toBe(true);
    expect(isActionCardKey("ordSheet")).toBe(false);
  });
});
