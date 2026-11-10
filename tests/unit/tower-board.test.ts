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
    rfqDays: 3,
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
    // 1 de 2 respondeu, dentro do prazo da RFQ: ainda chegando cotações.
    const partial = request("QUOTATION_RECEIVED");
    const approving = request("QUOTATION_RECEIVED");
    // Proposta enviada, sem aprovação do cliente: "Proposta ao cliente".
    const proposing = request("WAITING_DOWN_PAYMENT", {
      selectedQuoteId: "q-sel",
    });
    const down = request("WAITING_DOWN_PAYMENT", {
      sellPrice: 1000,
      sellCurrency: "BRL",
      proposalApprovedAt: PAST,
    });
    const quote = (
      r: { id: string },
      status: string,
      createdAt = "2026-11-06T12:00:00.000Z",
    ) => ({
      id: `q-${++seq}`,
      requestId: r.id,
      status,
      price: status === "answered" ? 2 : null,
      currency: "USD",
      leadTimeDays: null,
      answeredAt: status === "answered" ? createdAt : null,
      createdAt,
    });
    const board = buildTowerBoard(
      input({
        finance: true,
        requests: [
          fresh,
          quoting,
          answered,
          partial,
          approving,
          proposing,
          down,
        ],
        quotes: [
          quote(quoting, "invited"),
          quote(answered, "answered"),
          quote(partial, "answered"),
          quote(partial, "invited"),
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
        dielineRequestIds: [proposing.id, quoting.id],
      }),
    );
    expect(ids(board, "reqNew")).toEqual([fresh.id]);
    expect(ids(board, "reqRfq")).toEqual([quoting.id]);
    expect(ids(board, "reqQuotes")).toEqual([partial.id]);
    expect(ids(board, "reqChoose")).toEqual([answered.id]);
    expect(ids(board, "reqApproval")).toEqual([approving.id]);
    expect(ids(board, "reqProposal")).toEqual([proposing.id]);
    expect(ids(board, "reqDown")).toEqual([down.id]);
    // Faca só depois da escolha do fornecedor (a de cotação não entra).
    expect(ids(board, "reqDieline")).toEqual([proposing.id]);
    expect(ids(board, "reqPackaging")).toEqual([quoting.id]);
    expect(board.cards.find((c) => c.key === "reqDown")!.value).toBe(1000);
  });

  it("prazo da RFQ vencido com cotação: vai para a comparação", () => {
    const late = request("QUOTATION_RECEIVED");
    const q = (status: string) => ({
      id: `q-${++seq}`,
      requestId: late.id,
      status,
      price: status === "answered" ? 2 : null,
      currency: "USD",
      leadTimeDays: null,
      answeredAt: status === "answered" ? "2026-10-20T12:00:00.000Z" : null,
      createdAt: "2026-10-20T12:00:00.000Z",
    });
    const board = buildTowerBoard(
      input({
        requests: [late],
        quotes: [q("answered"), q("invited")] as BoardInput["quotes"],
      }),
    );
    expect(ids(board, "reqChoose")).toEqual([late.id]);
    expect(ids(board, "reqQuotes")).toEqual([]);
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
    // Todo pedido precisa do selo de certificação: os três estão sem ele.
    expect(ids(board, "parCertification")).toEqual([
      making.id,
      customs.id,
      receiving.id,
    ]);
    expect(ids(board, "parDocsToValidate")).toEqual([customs.id]);
    expect(ids(board, "parNumerario")).toEqual([customs.id]);
    expect(ids(board, "parChannel")).toEqual([customs.id]);
    expect(ids(board, "parReceiving")).toEqual([receiving.id]);
    expect(ids(board, "parReceivingDiff")).toEqual([receiving.id]);
    expect(ids(board, "parContainerReturn")).toEqual([receiving.id]);
  });

  it("selo de certificação: todo pedido fica em Certificação pendente até a arte com o selo ser conferida, e não vira documento para validar", () => {
    const born = order("ORDER_CREATED", { ocpId: "ocp1" });
    const sealed = order("PACKAGING", { ocpId: "ocp1" });
    const done = order("PACKAGING", { ocpId: "ocp1" });
    // Sem certificadora designada: o selo vale do mesmo jeito.
    const noOcp = order("PREPARATION");
    const noOcpDone = order("PREPARATION");
    // Memorial, laudo e registro concluídos, mas ainda sem o selo.
    const classicOnly = order("PACKAGING", { ocpId: "ocp1" });
    const s = [born, sealed, done, noOcp, noOcpDone, classicOnly].map((o) =>
      stage(o),
    );
    const board = buildTowerBoard(
      input({
        orders: [born, sealed, done, noOcp, noOcpDone, classicOnly],
        activeStages: s.map((x) => x.active),
        stages: s.map((x) => x.stage),
        steps: [
          // Selo enviado; a arte com o selo aguarda a conferência da Wellmix.
          step(sealed, "cert_seal"),
          step(sealed, "cert_seal_art"),
          // Tudo da certificação concluído.
          step(done, "cert_memorial", "validated"),
          step(done, "cert_lab"),
          step(done, "cert_registration", "validated"),
          step(done, "cert_seal"),
          step(done, "cert_seal_art", "validated"),
          // Sem certificadora: só o selo conta (memorial, laudo e registro não).
          step(noOcpDone, "cert_seal"),
          step(noOcpDone, "cert_seal_art", "validated"),
          step(classicOnly, "cert_memorial", "validated"),
          step(classicOnly, "cert_lab"),
          step(classicOnly, "cert_registration", "validated"),
        ],
      }),
    );
    expect(ids(board, "parCertification")).toEqual([
      born.id,
      sealed.id,
      noOcp.id,
      classicOnly.id,
    ]);
    expect(ids(board, "parDocsToValidate")).toEqual([]);
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
    // Sem a lista do Booking (login que não abre a tela), sem o quadrado dele.
    expect(open.cards.map((c) => c.key)).toEqual(
      BOARD_CARDS.filter((c) => c.key !== "bkOpen").map((c) => c.key),
    );
  });
});

describe("o fluxo começa no Booking", () => {
  const status = (s: string) =>
    ({ status: s }) as NonNullable<BoardInput["bookings"]>[number];
  const request = (id: string) =>
    ({
      id,
      status: "REQUESTED",
      customerId: "c1",
      productName: "Copo",
      deadline: null,
      sellPrice: null,
      sellCurrency: null,
      selectedQuoteId: null,
    }) as unknown as BoardInput["requests"][number];

  it("o Booking toma o lugar de Solicitação nova e conta as linhas que ainda não viraram solicitação", () => {
    const board = buildTowerBoard(
      input({
        finance: true,
        bookings: [
          status("new"),
          status("analysis"),
          status("approved"),
          status("offered"),
          status("reserved"),
          // Já está nos quadrados da solicitação; descartado saiu do fluxo.
          status("requested"),
          status("discarded"),
        ],
      }),
    );
    expect(board.cards[0]).toMatchObject({
      key: "bkOpen",
      block: "request",
      count: 5,
      href: "/app/booking?status=new,analysis,approved,offered,reserved",
    });
    expect(board.cards[1].key).toBe("reqRfq");
    expect(board.cards.map((c) => c.key)).toEqual(
      BOARD_CARDS.filter((c) => c.key !== "reqNew").map((c) => c.key),
    );
  });

  it("havendo solicitação nova, o quadrado dela aparece logo depois do Booking", () => {
    const board = buildTowerBoard(
      input({ bookings: [], requests: [request("r1")] }),
    );
    expect(board.cards.slice(0, 2).map((c) => [c.key, c.count])).toEqual([
      ["bkOpen", 0],
      ["reqNew", 1],
    ]);
    expect(ids(board, "reqNew")).toEqual(["r1"]);
  });

  it("quem não abre o Booking continua com Solicitação nova, mesmo zerada", () => {
    const board = buildTowerBoard(input());
    expect(board.cards[0]).toMatchObject({ key: "reqNew", count: 0 });
    expect(board.cards.some((c) => c.key === "bkOpen")).toBe(false);
  });
});
