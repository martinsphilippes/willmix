import { describe, expect, it } from "vitest";
import {
  BOARD_CARDS,
  buildTowerBoard,
  type BoardCardKey,
  type BoardInput,
} from "@/lib/services/tower-board";

/* Quadros da operação na Control Tower: em qual quadrado cada pedido cai. */

type Order = import("@/lib/db").Order;

const NOW = new Date("2026-11-08T15:00:00Z"); // 8/11 em Brasília
const PAST = "2026-11-01T12:00:00.000Z";
const FUTURE = "2026-12-01T12:00:00.000Z";

let seq = 0;
const order = (status: string, extra: Partial<Order> = {}): Order =>
  ({
    id: `o${++seq}`,
    number: seq,
    status,
    customerId: "c1",
    closedAt: null,
    cancelledAt: null,
    cancelStageKey: null,
    ocpId: null,
    erpSyncStatus: "synced",
    cancelRequestStatus: null,
    ...extra,
  }) as unknown as Order;

function input(over: Partial<BoardInput> = {}): BoardInput {
  return {
    now: NOW,
    finance: false,
    orders: [],
    parties: [{ id: "c1", name: "Loja Um" }],
    items: [],
    products: [],
    activeStages: [],
    stages: [],
    requirements: [],
    requests: [],
    quotes: [],
    approvals: [],
    briefRequestIds: [],
    steps: [],
    tracks: [],
    skus: [],
    artIssues: [],
    receivings: [],
    certificationOrderIds: [],
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

describe("bloco 2: onde o pedido está agora", () => {
  it("cada pedido em andamento cai num quadrado só, dividido pelo que já foi feito na etapa", () => {
    const o = {
      conference: order("ORDER_CREATED"),
      sheet: order("PREPARATION"),
      validation: order("PREPARATION"),
      art: order("PACKAGING"),
      approval: order("PACKAGING"),
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
      stage(o.conference),
      stage(o.sheet, { reqs: { purchase_sheet: "pending" } }),
      stage(o.validation, { reqs: { purchase_sheet: "done" } }),
      stage(o.art, { reqs: { art: "pending" } }),
      stage(o.approval, { reqs: { art: "done" } }),
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
        steps: [
          step(o.booked, "booking", "validated"),
          step(o.presence, "cargo_presence"),
        ],
      }),
    );
    const expected: Record<string, BoardCardKey> = {
      conference: "ordConference",
      sheet: "ordSheet",
      validation: "ordValidation",
      art: "ordArt",
      approval: "ordArtApproval",
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
    expect(main.reduce((n, c) => n + c.count, 0)).toBe(15);
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

  it("atrasado: conta no quadrado e no bloco de problemas", () => {
    const late = order("PACKAGING");
    const s = stage(late, { dueAt: PAST, reqs: { art: "pending" } });
    const board = buildTowerBoard(
      input({
        orders: [late],
        activeStages: [s.active],
        stages: [s.stage],
        requirements: s.reqs,
      }),
    );
    const art = board.cards.find((c) => c.key === "ordArt")!;
    expect(art).toMatchObject({ count: 1, overdue: 1 });
    expect(ids(board, "probOverdue")).toEqual([late.id]);
  });
});

describe("bloco 1: antes de virar pedido", () => {
  const request = (status: string, extra: Record<string, unknown> = {}) =>
    ({
      id: `r-${++seq}`,
      status,
      customerId: "c1",
      productName: "Copo",
      deadline: null,
      selectedQuoteId: null,
      sellPrice: null,
      sellCurrency: null,
      ...extra,
    }) as unknown as BoardInput["requests"][number];

  it("usa o mesmo próximo passo da tela Solicitações", () => {
    const fresh = request("REQUESTED");
    const quoting = request("RFQ_OPEN");
    const answered = request("RFQ_OPEN");
    const approving = request("QUOTATION_RECEIVED");
    const down = request("WAITING_DOWN_PAYMENT", {
      sellPrice: 1000,
      sellCurrency: "BRL",
    });
    const quote = (r: { id: string }, status: string) => ({
      id: `q-${++seq}`,
      requestId: r.id,
      status,
      price: status === "answered" ? 2 : null,
      currency: "USD",
      leadTimeDays: null,
      answeredAt: null,
    });
    const board = buildTowerBoard(
      input({
        finance: true,
        requests: [fresh, quoting, answered, approving, down],
        quotes: [
          quote(quoting, "invited"),
          quote(answered, "answered"),
          quote(approving, "answered"),
        ] as BoardInput["quotes"],
        approvals: [
          {
            requestId: approving.id,
            status: "pending",
            currentLevel: "planner",
          },
        ] as BoardInput["approvals"],
        briefRequestIds: [quoting.id],
      }),
    );
    expect(ids(board, "reqNew")).toEqual([fresh.id]);
    expect(ids(board, "reqRfq")).toEqual([quoting.id]);
    expect(ids(board, "reqChoose")).toEqual([answered.id]);
    expect(ids(board, "reqApproval")).toEqual([approving.id]);
    expect(ids(board, "reqDown")).toEqual([down.id]);
    expect(ids(board, "reqPackaging")).toEqual([quoting.id]);
    expect(board.cards.find((c) => c.key === "reqDown")!.value).toBe(1000);
  });
});

describe("bloco 3: acontece ao mesmo tempo", () => {
  it("produção, inspeção por SKU, arte, certificação, documentos, numerário, canal e recebimento", () => {
    const making = order("PACKAGING", { ocpId: "ocp1" });
    const customs = order("CUSTOMS");
    const receiving = order("DELIVERED");
    const s = [stage(making), stage(customs), stage(receiving)];
    const board = buildTowerBoard(
      input({
        orders: [making, customs, receiving],
        activeStages: s.map((x) => x.active),
        stages: s.map((x) => x.stage),
        tracks: [
          {
            orderId: making.id,
            productionStartAt: "2026-10-01T00:00:00Z",
            etd: FUTURE,
            followups: [
              {
                day: 5,
                status: "delayed",
                note: "x",
                at: PAST,
                byUserId: "u",
              },
            ],
          },
        ] as unknown as BoardInput["tracks"],
        skus: [
          {
            orderId: making.id,
            orderItemId: "i1",
            round: 1,
            result: "rejected",
          },
        ] as unknown as BoardInput["skus"],
        artIssues: [{ orderId: making.id, status: "open" }],
        steps: [
          step(customs, "draft_bl"),
          step(customs, "numerario", "validated"),
          step(customs, "channel", "submitted", "red"),
        ],
        receivings: [
          {
            orderId: receiving.id,
            sealNumber: "L1",
            checklist: [],
            items: [
              {
                orderItemId: "i1",
                expected: 10,
                received: 9,
                damaged: 0,
                note: null,
              },
            ],
            containerReturnedAt: null,
            closedAt: null,
          },
        ] as unknown as BoardInput["receivings"],
      }),
    );
    expect(ids(board, "parProduction")).toEqual([making.id]);
    expect(ids(board, "parProductionLate")).toEqual([making.id]);
    // Começou em 1/10: os follows de 5, 15 e 25 dias já venceram (o de 5 foi feito).
    expect(ids(board, "parFollowupDue")).toEqual([making.id]);
    expect(ids(board, "parSkuRejected")).toEqual([making.id]);
    expect(ids(board, "parArtIssue")).toEqual([making.id]);
    expect(ids(board, "parCertification")).toEqual([making.id]);
    expect(ids(board, "parDocsToValidate")).toEqual([customs.id]);
    expect(ids(board, "parNumerario")).toEqual([customs.id]);
    expect(ids(board, "parChannel")).toEqual([customs.id]);
    expect(ids(board, "parReceiving")).toEqual([receiving.id]);
    expect(ids(board, "parReceivingDiff")).toEqual([receiving.id]);
    expect(ids(board, "parContainerReturn")).toEqual([receiving.id]);
  });

  it("parcelas, a receber e valores: só para quem abre Finanças", () => {
    const o = order("SHIPPING");
    const s = stage(o);
    const base = {
      orders: [o],
      activeStages: [s.active],
      stages: [s.stage],
      installments: [
        { orderId: o.id, status: "overdue" as const },
        { orderId: o.id, status: "due_soon" as const },
      ],
      money: new Map([
        [o.id, { sell: 5000, currency: "BRL", receivable: 1500 }],
      ]),
    };
    const closed = buildTowerBoard(input({ ...base, finance: false }));
    const keys = closed.cards.map((c) => c.key);
    for (const k of [
      "parInstallmentOverdue",
      "parInstallmentDueSoon",
      "parInstallmentRequested",
      "parReceivable",
    ] as const)
      expect(keys).not.toContain(k);
    expect(closed.cards.every((c) => c.value === null)).toBe(true);

    const open = buildTowerBoard(input({ ...base, finance: true }));
    expect(ids(open, "parInstallmentOverdue")).toEqual([o.id]);
    expect(ids(open, "parInstallmentDueSoon")).toEqual([o.id]);
    expect(ids(open, "parInstallmentRequested")).toEqual([]);
    expect(open.cards.find((c) => c.key === "parReceivable")).toMatchObject({
      count: 1,
      value: 1500,
    });
    expect(open.cards.find((c) => c.key === "ordBooking")!.value).toBe(5000);
    expect(open.cards.map((c) => c.key)).toEqual(BOARD_CARDS.map((c) => c.key));
  });
});

describe("bloco 4: problemas", () => {
  it("bloqueado, documento rejeitado, Sankhya, multa, cancelamento, revisão e certificação vencendo", () => {
    const blocked = order("INSPECTION", {
      erpSyncStatus: "pending",
      cancelRequestStatus: "requested",
    });
    const fine = order("TRANSPORT");
    const gone = order("CANCELLED");
    const s = [stage(blocked, { status: "blocked" }), stage(fine)];
    const board = buildTowerBoard(
      input({
        orders: [blocked, fine, gone],
        activeStages: s.map((x) => x.active),
        stages: s.map((x) => x.stage),
        steps: [step(fine, "bl", "rejected")],
        penalties: [{ orderId: fine.id }, { orderId: gone.id }],
        reviews: [
          { orderId: blocked.id, rule: "inspection.weight", entity: "order" },
          { orderId: gone.id, rule: "x", entity: "order" },
        ] as unknown as BoardInput["reviews"],
        products: [{ id: "p1", name: "Boneca" }],
        certifications: [
          {
            id: "cert1",
            entity: "product",
            entityId: "p1",
            kind: "Inmetro",
            validUntil: FUTURE,
          },
        ] as unknown as BoardInput["certifications"],
        containers: { open: 3 },
      }),
    );
    expect(ids(board, "probBlocked")).toEqual([blocked.id]);
    expect(ids(board, "ordInspectionIssue")).toEqual([blocked.id]);
    expect(ids(board, "probDocRejected")).toEqual([fine.id]);
    expect(ids(board, "probErp")).toEqual([blocked.id]);
    expect(ids(board, "probCancelRequest")).toEqual([blocked.id]);
    // Multa de pedido cancelado não conta.
    expect(ids(board, "probPenalty")).toEqual([fine.id]);
    // Revisão de pedido cancelado não conta; quadrado leva à tela de revisão.
    expect(board.cards.find((c) => c.key === "probReviews")).toMatchObject({
      count: 1,
      href: "/app/reviews",
    });
    expect(board.cards.find((c) => c.key === "parContainers")).toMatchObject({
      count: 3,
      href: "/app/containers",
    });
    const cert = board.cards.find((c) => c.key === "probCertExpiring")!;
    expect(cert.rows[0]).toMatchObject({
      kind: "cert",
      product: "Boneca",
      link: "/app/products/p1",
    });
  });
});
