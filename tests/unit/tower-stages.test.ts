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
  finance = true,
): TowerBoard {
  const cards = BOARD_CARDS.filter(
    (c) => finance || !("finance" in c && c.finance),
  ).map((c): BoardCard => ({
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
  it("são nove, na ordem do processo de hoje", () => {
    expect(TOWER_STAGES.map((s) => s.key)).toEqual([
      "booking",
      "request",
      "prep",
      "contract",
      "production",
      "shipping",
      "port",
      "delivery",
      "closed",
    ]);
  });

  it("cada quadrado de posição está em uma etapa só", () => {
    const all = TOWER_STAGES.flatMap((s) =>
      s.cards.map((c) => c.key as string),
    );
    expect(new Set(all).size).toBe(all.length);
    for (const c of BOARD_CARDS)
      if (c.block === "booking" || c.block === "request" || c.block === "order")
        expect(findGroupOfCard(c.key), c.key).not.toBeNull();
  });

  it("a soma das etapas fecha com lotes, solicitações e pedidos em andamento", () => {
    const stages = buildTowerStages(
      board({
        bkClosed: [row("l1", false, "booking")],
        srWaitingWellmix: [row("sr1", false, "supplier_request")],
        srToOrder: [row("sr2", true, "supplier_request")],
        ordPrepPortal: [row("o1"), row("o2")],
        ordPrepSankhya: [row("o3")],
        ordContractWellmix: [row("o4")],
        ordInspectionIssue: [row("o5", true)],
        ordAtSea: [row("o6")],
        ordPort: [row("o7")],
        ordInTransit: [row("o8")],
        ordDelivered: [row("o9")],
      }),
    );
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
    expect(stages.reduce((n, s) => n + s.count, 0)).toBe(12);
    expect(byKey.booking.count).toBe(1);
    expect(byKey.request.count).toBe(2);
    expect(byKey.request.overdue).toBe(1);
    expect(byKey.prep.count).toBe(3);
    expect(byKey.production.overdue).toBe(1);
  });

  it("raias e produção não somam na etapa e aparecem ao lado", () => {
    const stages = buildTowerStages(
      board({
        ordPrepPortal: [row("o1")],
        lnSupplier: [row("o1")],
        lnArt: [row("o1")],
        lnCert: [row("o1")],
        ordInspection: [row("o2")],
        parProduction: [row("o1"), row("o2"), row("o3")],
      }),
    );
    const prep = stages.find((s) => s.key === "prep")!;
    expect(prep.count).toBe(1);
    expect(prep.alongside).toEqual([
      { key: "lnSupplier", count: 1 },
      { key: "lnArt", count: 1 },
      { key: "lnArtReview", count: 0 },
      { key: "lnCert", count: 1 },
      { key: "lnRegistration", count: 0 },
    ]);
    const production = stages.find((s) => s.key === "production")!;
    expect(production.count).toBe(1);
    expect(production.alongside).toEqual([{ key: "parProduction", count: 3 }]);
  });

  it("zero continua à vista e etapa de um passo só abre a lista direto", () => {
    const stages = buildTowerStages(board());
    expect(stages).toHaveLength(9);
    expect(stages.every((s) => s.count === 0)).toBe(true);
    expect(stages.find((s) => s.key === "port")!.single).toBe("ordPort");
    expect(stages.find((s) => s.key === "prep")!.single).toBeNull();
  });
});

describe("alerta de prazo nos cards", () => {
  const NOW = new Date("2026-11-08T15:00:00Z");
  const inDays = (d: number) =>
    new Date(NOW.getTime() + d * 86_400_000).toISOString();
  const order = (id: string, dueAt: string | null, overdue = false) =>
    ({
      ...row(id, overdue),
      dueAt,
      stageKey: "PACKAGING",
    }) as unknown as TowerRow;

  it("separa estourado (vermelho) de vencendo em até 2 dias (âmbar); o resto não alerta", () => {
    const stages = buildTowerStages(
      board({
        ordContractWellmix: [
          order("a", inDays(-1), true),
          order("b", inDays(1)),
          order("c", inDays(5)),
          order("d", null),
        ],
      }),
      NOW,
    );
    const contract = stages.find((s) => s.key === "contract")!;
    expect(contract.count).toBe(4);
    expect(contract.overdue).toBe(1);
    expect(contract.risk).toBe(1);
    const card = contract.groups.find((g) => g.key === "ordContractWellmix")!;
    expect(card).toMatchObject({ overdue: 1, risk: 1 });
  });

  it("encerrado, cancelado e solicitação ao fornecedor não entram como risco", () => {
    const closed = {
      ...order("x", inDays(1)),
      stageKey: "CLOSED",
    } as unknown as TowerRow;
    const request = {
      ...row("sr", false, "supplier_request"),
      dueAt: inDays(1),
    } as unknown as TowerRow;
    const stages = buildTowerStages(
      board({ ordClosedMonth: [closed], srWaitingSupplier: [request] }),
      NOW,
    );
    expect(stages.every((s) => s.risk === 0)).toBe(true);
  });
});

describe("pontos de ação por perfil", () => {
  it("só traz os quadrados das telas que o perfil abre", () => {
    const b = board();
    const only = (...screens: string[]) =>
      actionCardsFor(b, (s) => screens.includes(s)).map((c) => c.key);
    expect(only()).toEqual([]);
    expect(only("penalties")).toEqual(["probPenalty"]);
    expect(only("booking")).toEqual(["bkClosed"]);
    expect(only("quotes")).toEqual(["srWaitingWellmix", "srApproved"]);
    const orders = only("orders");
    expect(orders).toContain("probOverdue");
    expect(orders).toContain("srToOrder");
    expect(orders).toContain("lnArtReview");
    expect(orders).not.toContain("probPenalty");
    expect(orders).not.toContain("parReceivable");
    // Quem abre tudo vê todos os pontos de ação.
    expect(actionCardsFor(b, () => true)).toHaveLength(ACTION_CARDS.length);
  });

  it("quadrado de dinheiro não aparece sem Finanças, nem para quem abre a tela", () => {
    const keys = actionCardsFor(board({}, false), () => true).map((c) => c.key);
    expect(keys).not.toContain("parReceivable");
    expect(keys).not.toContain("parInstallmentOverdue");
  });

  it("reconhece a chave de ponto de ação", () => {
    expect(isActionCardKey("probOverdue")).toBe(true);
    expect(isActionCardKey("ordPrepPortal")).toBe(false);
  });
});
