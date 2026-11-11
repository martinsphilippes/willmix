import { describe, expect, it } from "vitest";
import {
  BOARD_CARDS,
  buildTowerBoard,
  type BoardCardKey,
  type BoardInput,
} from "@/lib/services/tower-board";

/*
 * Quadros da operação na Control Tower: o processo de hoje (Booking,
 * solicitação ao fornecedor, pedido de compra com três raias e contrato,
 * depois produção, embarque e entrega). Pedido sem `flow` é o importado do
 * Sankhya: só visibilidade.
 */

type Order = import("@/lib/db").Order;

const NOW = new Date("2026-11-08T15:00:00Z"); // 8/11 em Brasília
const PAST = "2026-11-01T12:00:00.000Z";
const FUTURE = "2026-12-01T12:00:00.000Z";

let seq = 0;
/** Pedido de compra (fluxo do portal). */
const order = (status: string, extra: Partial<Order> = {}): Order =>
  ({
    id: `o${++seq}`,
    number: seq,
    status,
    flow: "supplier_request",
    customerId: "c1",
    closedAt: null,
    cancelledAt: null,
    cancelStageKey: null,
    ocpId: null,
    erpSyncStatus: "synced",
    cancelRequestStatus: null,
    ...extra,
  }) as unknown as Order;
/** Pedido importado do Sankhya (sem fluxo no portal). */
const imported = (status: string, extra: Partial<Order> = {}) =>
  order(status, { flow: null, ...extra });

function input(over: Partial<BoardInput> = {}): BoardInput {
  return {
    now: NOW,
    finance: false,
    orders: [],
    parties: [
      { id: "c1", name: "Wellmix" },
      { id: "f1", name: "Fábrica Um" },
    ],
    items: [],
    products: [],
    activeStages: [],
    stages: [],
    requirements: [],
    laneRequirements: [],
    lots: [],
    supplierRequests: [],
    steps: [],
    tracks: [],
    skus: [],
    artIssues: [],
    receivings: [],
    penalties: [],
    rejected: [],
    reviews: [],
    certifications: [],
    containers: { open: 0 },
    installments: [],
    money: new Map(),
    currency: "BRL",
    ...over,
  };
}

/** Etapa em andamento e os itens dela (o que divide os quadrados). */
function stage(
  o: Order,
  opts: {
    status?: "active" | "blocked";
    dueAt?: string | null;
    reqs?: Record<string, "pending" | "done">;
  } = {},
) {
  const id = `s-${o.id}-${o.status}`;
  return {
    active: {
      id,
      orderId: o.id,
      key: o.status,
      status: opts.status ?? "active",
      dueAt: opts.dueAt ?? null,
      responsibleRole: "operator",
    } as unknown as BoardInput["activeStages"][number],
    stage: { id, orderId: o.id, key: o.status } as BoardInput["stages"][number],
    reqs: Object.entries(opts.reqs ?? {}).map(([key, status]) => ({
      orderId: o.id,
      stageId: id,
      key,
      status,
      value: null,
    })) as BoardInput["requirements"],
  };
}

const step = (o: Order, key: string, status = "submitted", value = "") =>
  ({
    orderId: o.id,
    key,
    status,
    value,
  }) as unknown as BoardInput["steps"][number];

const ids = (board: ReturnType<typeof buildTowerBoard>, key: BoardCardKey) =>
  board.cards.find((c) => c.key === key)?.rows.map((r) => r.id) ?? null;

describe("pedido: onde está agora", () => {
  it("cada pedido em andamento cai num quadrado só, dividido pelo que já foi feito na etapa", () => {
    const o = {
      created: order("ORDER_CREATED"),
      prep: order("PREPARATION"),
      contractW: order("PACKAGING"),
      contractS: order("PACKAGING"),
      inspection: order("INSPECTION"),
      blocked: order("INSPECTION"),
      booking: order("SHIPPING"),
      booked: order("SHIPPING"),
      sea: order("CUSTOMS"),
      etaPassed: order("CUSTOMS"),
      presence: order("CUSTOMS"),
      truck: order("TRANSPORT"),
      transit: order("TRANSPORT"),
      delivered: order("DELIVERED"),
    };
    const s = [
      stage(o.created),
      stage(o.prep),
      stage(o.contractW),
      stage(o.contractS),
      stage(o.inspection),
      stage(o.blocked, { status: "blocked" }),
      stage(o.booking),
      stage(o.booked),
      stage(o.sea),
      stage(o.etaPassed),
      stage(o.presence),
      stage(o.truck, { reqs: { plate: "pending" } }),
      stage(o.transit, { reqs: { plate: "done" } }),
      stage(o.delivered),
    ];
    // Previsão de chegada fica no Embarque (etapa já concluída).
    const eta = (x: Order, value: string) => [
      { id: `ship-${x.id}`, orderId: x.id, key: "SHIPPING" },
      {
        orderId: x.id,
        stageId: `ship-${x.id}`,
        key: "eta",
        status: "done",
        value,
      },
    ];
    const [seaStage, seaEta] = eta(o.sea, FUTURE.slice(0, 10));
    const [pastStage, pastEta] = eta(o.etaPassed, "2026-11-05");
    const [presStage, presEta] = eta(o.presence, FUTURE.slice(0, 10));
    // Contrato: a Wellmix já assinou o do contractS.
    const signed = s[3].stage;
    const board = buildTowerBoard(
      input({
        orders: Object.values(o),
        activeStages: s.map((x) => x.active),
        stages: [
          ...s.map((x) => x.stage),
          seaStage,
          pastStage,
          presStage,
        ] as BoardInput["stages"],
        requirements: [
          ...s.flatMap((x) => x.reqs),
          seaEta,
          pastEta,
          presEta,
        ] as BoardInput["requirements"],
        laneRequirements: [
          {
            orderId: o.contractS.id,
            stageId: signed.id,
            key: "order_signed_wellmix",
            status: "done",
          },
          {
            orderId: o.contractW.id,
            stageId: s[2].stage.id,
            key: "order_signed_wellmix",
            status: "pending",
          },
        ] as BoardInput["laneRequirements"],
        steps: [
          step(o.booked, "booking", "validated"),
          step(o.presence, "cargo_presence"),
        ],
      }),
    );
    const expected: Record<string, BoardCardKey> = {
      created: "ordPrepPortal",
      prep: "ordPrepPortal",
      contractW: "ordContractWellmix",
      contractS: "ordContractSupplier",
      inspection: "ordInspection",
      blocked: "ordInspectionIssue",
      booking: "ordBooking",
      booked: "ordWaitingShip",
      sea: "ordAtSea",
      etaPassed: "ordPort",
      presence: "ordPort",
      truck: "ordWaitingTruck",
      transit: "ordInTransit",
      delivered: "ordDelivered",
    };
    for (const [name, key] of Object.entries(expected))
      expect(ids(board, key), name).toContain(o[name as keyof typeof o].id);
    // Um quadrado só por pedido: a soma do bloco é o total em andamento.
    const main = board.cards.filter(
      (c) =>
        c.block === "order" &&
        c.key !== "ordClosedMonth" &&
        c.key !== "ordCancelledMonth",
    );
    expect(main.reduce((n, c) => n + c.count, 0)).toBe(14);
  });

  it("pedido importado do Sankhya entra pela etapa da TOP, num quadrado próprio, sem atraso nem bloqueio", () => {
    const prep = imported("PREPARATION");
    const contract = imported("PACKAGING");
    const sea = imported("CUSTOMS");
    const s = [
      stage(prep, { dueAt: PAST }),
      stage(contract, { status: "blocked" }),
      stage(sea, { dueAt: PAST }),
    ];
    const board = buildTowerBoard(
      input({
        orders: [prep, contract, sea],
        activeStages: s.map((x) => x.active),
        stages: s.map((x) => x.stage),
      }),
    );
    expect(ids(board, "ordPrepSankhya")).toEqual([prep.id]);
    expect(ids(board, "ordPrepPortal")).toEqual([]);
    expect(ids(board, "ordContractSankhya")).toEqual([contract.id]);
    expect(ids(board, "ordAtSea")).toEqual([sea.id]);
    // Sem o fluxo do portal, prazo vencido e bloqueio não valem.
    expect(ids(board, "probOverdue")).toEqual([]);
    expect(ids(board, "probBlocked")).toEqual([]);
    const row = board.cards.find((c) => c.key === "ordPrepSankhya")!.rows[0];
    expect(row).toMatchObject({ origin: "sankhya", overdue: false });
  });

  it("encerrados e cancelados contam só no mês", () => {
    const closedNow = order("CLOSED", { closedAt: "2026-11-03T10:00:00Z" });
    const closedBefore = order("CLOSED", { closedAt: "2026-10-30T10:00:00Z" });
    const cancelledNow = order("CANCELLED", {
      cancelledAt: "2026-11-02T10:00:00Z",
      cancelStageKey: "SHIPPING",
    });
    const board = buildTowerBoard(
      input({ orders: [closedNow, closedBefore, cancelledNow] }),
    );
    expect(ids(board, "ordClosedMonth")).toEqual([closedNow.id]);
    expect(ids(board, "ordCancelledMonth")).toEqual([cancelledNow.id]);
    const row = board.cards
      .find((c) => c.key === "ordCancelledMonth")!
      .rows.at(0)!;
    expect(row).toMatchObject({ cancelled: true, stageKey: "SHIPPING" });
  });

  it("atrasado (pedido de compra): conta no quadrado e no bloco de problemas", () => {
    const late = order("PACKAGING");
    const s = stage(late, { dueAt: PAST });
    const board = buildTowerBoard(
      input({
        orders: [late],
        activeStages: [s.active],
        stages: [s.stage],
        requirements: s.reqs,
      }),
    );
    const card = board.cards.find((c) => c.key === "ordContractWellmix")!;
    expect(card).toMatchObject({ count: 1, overdue: 1 });
    expect(ids(board, "probOverdue")).toEqual([late.id]);
  });
});

describe("as três raias da Preparação, arte e certificação", () => {
  const lane = (
    o: Order,
    s: ReturnType<typeof stage>,
    key: string,
    done = false,
  ) => ({
    orderId: o.id,
    stageId: s.stage.id,
    key,
    status: done ? "done" : "pending",
  });

  it("cada raia conta o pedido que tem item liberado e pendente nela", () => {
    const a = order("PREPARATION"); // tudo pendente: fornecedor, arte, certificado
    const b = order("PREPARATION"); // arte enviada: a Wellmix valida
    const c = order("PREPARATION"); // arte validada e certificado: arte final
    const sa = stage(a);
    const sb = stage(b);
    const sc = stage(c);
    const board = buildTowerBoard(
      input({
        orders: [a, b, c],
        activeStages: [sa.active, sb.active, sc.active],
        stages: [sa.stage, sb.stage, sc.stage],
        laneRequirements: [
          lane(a, sa, "die_cut__i1"),
          lane(a, sa, "art__i1"),
          lane(a, sa, "art_review__i1"),
          lane(a, sa, "certificate__i1"),
          lane(a, sa, "art_final__i1"),
          lane(b, sb, "die_cut__i2", true),
          lane(b, sb, "art__i2", true),
          lane(b, sb, "art_review__i2"),
          lane(b, sb, "certificate__i2", true),
          lane(b, sb, "art_final__i2"),
          lane(c, sc, "die_cut__i3", true),
          lane(c, sc, "art__i3", true),
          lane(c, sc, "art_review__i3", true),
          lane(c, sc, "certificate__i3", true),
          lane(c, sc, "art_final__i3"),
        ] as BoardInput["laneRequirements"],
      }),
    );
    // A arte final só é pedida quando validada e certificada (não conta antes).
    expect(ids(board, "lnSupplier")).toEqual([a.id]);
    expect(ids(board, "lnArt")?.sort()).toEqual([a.id, c.id].sort());
    expect(ids(board, "lnArtReview")).toEqual([b.id]);
    expect(ids(board, "lnCert")).toEqual([a.id]);
    // As raias não mudam a posição: os três ficam em "Pedidos de compra".
    expect(ids(board, "ordPrepPortal")?.length).toBe(3);
  });
});

describe("booking e solicitação ao fornecedor", () => {
  it("lotes por situação; encerrados ficam de fora", () => {
    const lot = (status: string) =>
      ({
        id: `l${++seq}`,
        number: seq,
        status,
        supplierId: "f1",
        fileName: "plan.xlsx",
        itemCount: 12,
      }) as unknown as NonNullable<BoardInput["lots"]>[number];
    const draft = lot("draft");
    const closed = lot("closed");
    const progress = lot("in_progress");
    const done = lot("done");
    const board = buildTowerBoard(
      input({ lots: [draft, closed, progress, done] }),
    );
    expect(ids(board, "bkDraft")).toEqual([draft.id]);
    expect(ids(board, "bkClosed")).toEqual([closed.id]);
    expect(ids(board, "bkProgress")).toEqual([progress.id]);
    expect(
      board.cards.find((c) => c.key === "bkClosed")!.rows[0],
    ).toMatchObject({
      kind: "booking",
      link: `/app/booking/lots/${closed.id}`,
    });
  });

  it("solicitação: de quem é a vez; aprovada espera produto e depois o pedido", () => {
    const sr = (status: string, extra: Record<string, unknown> = {}) =>
      ({
        id: `sr${++seq}`,
        number: seq,
        status,
        supplierId: "f1",
        item: { description: "Copo", productName: null },
        createdAt: NOW.toISOString(),
        negotiation: null,
        productId: null,
        orderId: null,
        ...extra,
      }) as unknown as NonNullable<BoardInput["supplierRequests"]>[number];
    const open = sr("open");
    const answered = sr("answered");
    const counter = sr("answered", {
      negotiation: [
        {
          kind: "proposal",
          at: NOW.toISOString(),
          by: "wellmix",
          userId: "u1",
          price: 1,
          comment: "baixa",
        },
      ],
    });
    const approved = sr("approved");
    const toOrder = sr("approved", { productId: "p1" });
    const ordered = sr("approved", { productId: "p1", orderId: "o9" });
    const declined = sr("declined");
    const late = sr("open", { createdAt: PAST });
    const board = buildTowerBoard(
      input({
        supplierRequests: [
          open,
          answered,
          counter,
          approved,
          toOrder,
          ordered,
          declined,
          late,
        ],
      }),
    );
    expect(ids(board, "srWaitingSupplier")?.sort()).toEqual(
      [open.id, counter.id, late.id].sort(),
    );
    expect(ids(board, "srWaitingWellmix")).toEqual([answered.id]);
    expect(ids(board, "srApproved")).toEqual([approved.id]);
    expect(ids(board, "srToOrder")).toEqual([toOrder.id]);
    // SLA da negociação (30 min): a aberta há dias está atrasada.
    expect(
      board.cards.find((c) => c.key === "srWaitingSupplier")!.overdue,
    ).toBe(1);
  });
});

describe("em paralelo e problemas", () => {
  it("documento rejeitado, bloqueado, multa e numerário", () => {
    const o = order("INSPECTION");
    const s = stage(o, { status: "blocked" });
    const board = buildTowerBoard(
      input({
        orders: [o],
        activeStages: [s.active],
        stages: [s.stage],
        rejected: [{ orderId: o.id }],
        penalties: [{ orderId: o.id }],
        steps: [
          step(o, "numerario", "submitted"),
          step(o, "numerario_paid", "pending"),
        ],
      }),
    );
    expect(ids(board, "probBlocked")).toEqual([o.id]);
    expect(ids(board, "probDocRejected")).toEqual([o.id]);
    expect(ids(board, "probPenalty")).toEqual([o.id]);
    expect(ids(board, "parNumerario")).toEqual([o.id]);
  });

  it("quadrados de dinheiro só com Finanças", () => {
    const keys = (finance: boolean) =>
      buildTowerBoard(input({ finance })).cards.map((c) => c.key);
    expect(keys(true)).toEqual(BOARD_CARDS.map((c) => c.key));
    expect(keys(false)).not.toContain("parReceivable");
    expect(keys(false)).not.toContain("parInstallmentOverdue");
  });
});
