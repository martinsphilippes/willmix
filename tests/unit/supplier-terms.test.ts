import { describe, expect, it } from "vitest";
import {
  addDays,
  buildSupplierSchedule,
  parseTerms,
  paymentEventsFor,
  sameTerms,
  sortTerms,
  type PaymentEvents,
} from "@/lib/supplier-terms";

/* Condição de pagamento ao fornecedor: leitura, marcos e parcelas (contas puras). */

const terms = [
  { percent: 30, base: "order_created" as const, days: 0 },
  { percent: 70, base: "delivered" as const, days: 90 },
];
const events: PaymentEvents = {
  order_created: "2026-10-01",
  shipped: null,
  delivered: null,
};
const pay = (
  amount: number,
  status: "pending" | "confirmed" | "received",
  currency = "USD",
) => ({ amount, status, currency });

describe("parseTerms", () => {
  it("aceita parcelas válidas que somam 100%", () => {
    expect(parseTerms(terms)).toEqual(terms);
    expect(
      parseTerms([
        { percent: 33.33, base: "shipped", days: 0 },
        { percent: 33.33, base: "shipped", days: 30 },
        { percent: 33.34, base: "shipped", days: 60 },
      ]),
    ).not.toBeNull();
  });

  it("qualquer coisa fora do formato conta como não configurada", () => {
    expect(parseTerms(null)).toBeNull();
    expect(parseTerms([])).toBeNull();
    expect(parseTerms("30/70")).toBeNull();
    expect(
      parseTerms([{ percent: 50, base: "order_created", days: 0 }]),
    ).toBeNull();
    expect(parseTerms([{ percent: 100, base: "paid", days: 0 }])).toBeNull();
    expect(
      parseTerms([{ percent: 100, base: "shipped", days: -1 }]),
    ).toBeNull();
    expect(
      parseTerms([{ percent: 100, base: "shipped", days: 1.5 }]),
    ).toBeNull();
    expect(
      parseTerms([{ percent: 100, base: "shipped", days: 721 }]),
    ).toBeNull();
    expect(
      parseTerms([
        { percent: 0, base: "shipped", days: 0 },
        { percent: 100, base: "shipped", days: 0 },
      ]),
    ).toBeNull();
    expect(
      parseTerms(
        Array.from({ length: 7 }, () => ({
          percent: 100 / 7,
          base: "shipped",
          days: 0,
        })),
      ),
    ).toBeNull();
  });

  it("ordena as parcelas pela ordem em que vencem", () => {
    expect(
      sortTerms([
        { percent: 70, base: "delivered", days: 0 },
        { percent: 10, base: "order_created", days: 60 },
        { percent: 20, base: "order_created", days: 0 },
      ]),
    ).toEqual([
      { percent: 20, base: "order_created", days: 0 },
      { percent: 10, base: "order_created", days: 60 },
      { percent: 70, base: "delivered", days: 0 },
    ]);
  });

  it("compara condições", () => {
    expect(sameTerms(terms, parseTerms(terms))).toBe(true);
    expect(sameTerms(terms, [{ ...terms[0] }, { ...terms[1], days: 60 }])).toBe(
      false,
    );
    expect(sameTerms(null, null)).toBe(true);
    expect(sameTerms(terms, null)).toBe(false);
  });
});

describe("marcos do pedido", () => {
  it("embarque pela data informada; entrega pelo início da etapa Entregue", () => {
    const stages = [
      {
        id: "s-ship",
        key: "SHIPPING",
        status: "done",
        startedAt: "2026-11-01T10:00:00.000Z",
        completedAt: "2026-11-20T10:00:00.000Z",
      },
      {
        id: "s-del",
        key: "DELIVERED",
        status: "active",
        startedAt: "2027-01-10T02:00:00.000Z",
        completedAt: null,
      },
    ];
    const reqs = [
      {
        stageId: "s-ship",
        key: "ship_date",
        status: "done",
        value: "2026-11-15",
      },
    ];
    expect(
      paymentEventsFor({ createdAt: "2026-10-01T15:00:00.000Z" }, stages, reqs),
    ).toEqual({
      order_created: "2026-10-01",
      shipped: "2026-11-15",
      // 02:00 UTC de 10/01 ainda é 09/01 em Brasília.
      delivered: "2027-01-09",
    });
  });

  it("sem data de embarque, vale a conclusão da etapa; etapas por vir ficam sem data", () => {
    const done = paymentEventsFor(
      { createdAt: "2026-10-01T15:00:00.000Z" },
      [
        {
          id: "s",
          key: "SHIPPING",
          status: "done",
          startedAt: null,
          completedAt: "2026-11-20T15:00:00.000Z",
        },
        {
          id: "d",
          key: "DELIVERED",
          status: "pending",
          startedAt: null,
          completedAt: null,
        },
      ],
      [
        {
          stageId: "s",
          key: "ship_date",
          status: "rejected",
          value: "2026-11-01",
        },
      ],
    );
    expect(done.shipped).toBe("2026-11-20");
    expect(done.delivered).toBeNull();
  });

  it("soma dias atravessando mês e ano", () => {
    expect(addDays("2026-12-15", 30)).toBe("2027-01-14");
    expect(addDays("2026-10-16", 0)).toBe("2026-10-16");
  });
});

describe("cronograma de parcelas", () => {
  const base = {
    total: 200,
    currency: "USD",
    terms,
    events,
    payments: [] as ReturnType<typeof pay>[],
    today: "2026-10-16",
    cancelled: false,
  };

  it("valores por parcela, vencimento pelo marco e situação pela data", () => {
    const s = buildSupplierSchedule(base);
    expect(s.installments.map((i) => i.amount)).toEqual([60, 140]);
    expect(s.installments[0].dueDate).toBe("2026-10-01");
    expect(s.installments[0].status).toBe("overdue");
    expect(s.installments[1].dueDate).toBeNull();
    expect(s.installments[1].status).toBe("waiting");
    expect(s.next?.index).toBe(1);
    expect(s.open).toBe(200);

    const soon = buildSupplierSchedule({ ...base, today: "2026-09-26" });
    expect(soon.installments[0].status).toBe("due_soon");
    const later = buildSupplierSchedule({ ...base, today: "2026-09-01" });
    expect(later.installments[0].status).toBe("scheduled");
    const delivered = buildSupplierSchedule({
      ...base,
      events: { ...events, delivered: "2026-12-01" },
    });
    expect(delivered.installments[1].dueDate).toBe("2027-03-01");
  });

  it("a última parcela fica com o resto dos centavos", () => {
    const s = buildSupplierSchedule({
      ...base,
      total: 100,
      terms: [
        { percent: 33.33, base: "order_created", days: 0 },
        { percent: 33.33, base: "order_created", days: 30 },
        { percent: 33.34, base: "order_created", days: 60 },
      ],
    });
    const amounts = s.installments.map((i) => i.amount);
    expect(amounts).toEqual([33.33, 33.33, 33.34]);
    expect(amounts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });

  it("pagamentos quitam as parcelas na ordem: recebido, pago, pedido", () => {
    const s = buildSupplierSchedule({
      ...base,
      payments: [pay(60, "received"), pay(40, "confirmed"), pay(50, "pending")],
    });
    expect(s.installments[0].status).toBe("received");
    expect(s.installments[1].paid).toBe(40);
    expect(s.installments[1].requested).toBe(50);
    expect(s.installments[1].open).toBe(50);
    expect(s.installments[1].status).toBe("waiting");
    expect(s.next?.index).toBe(2);
    expect(s.paid).toBe(100);
    expect(s.requested).toBe(50);
    expect(s.open).toBe(50);

    const requested = buildSupplierSchedule({
      ...base,
      payments: [pay(60, "pending")],
    });
    expect(requested.installments[0].status).toBe("requested");
    expect(requested.next?.index).toBe(2);

    const paid = buildSupplierSchedule({
      ...base,
      payments: [pay(60, "confirmed")],
    });
    expect(paid.installments[0].status).toBe("paid");
  });

  it("o dinheiro quita a parcela que vence primeiro, mesmo digitada depois", () => {
    // 70% na entrega (ainda não aconteceu) digitada antes de 30% no pedido.
    const s = buildSupplierSchedule({
      ...base,
      total: 100,
      terms: [
        { percent: 70, base: "delivered", days: 0 },
        { percent: 30, base: "order_created", days: 0 },
      ],
      events: { order_created: "2026-09-01", shipped: null, delivered: null },
      payments: [pay(30, "confirmed")],
    });
    expect(s.installments[1].status).toBe("paid");
    expect(s.installments[0].status).toBe("waiting");
    expect(s.installments[0].paid).toBe(0);
    expect(s.next?.index).toBe(1);
    expect(s.next?.open).toBe(70);

    // Mesmo marco, dias fora de ordem.
    const days = buildSupplierSchedule({
      ...base,
      total: 100,
      terms: [
        { percent: 50, base: "order_created", days: 60 },
        { percent: 50, base: "order_created", days: 0 },
      ],
      events: { order_created: "2026-09-01", shipped: null, delivered: null },
      payments: [pay(50, "confirmed")],
    });
    expect(days.installments[1].status).toBe("paid");
    // 01/09 + 60 dias = 31/10: ainda programada.
    expect(days.installments[0].status).toBe("scheduled");
    expect(days.next?.index).toBe(1);
  });

  it("pedido pago no fluxo antigo: nada a pagar nem a vencer", () => {
    const s = buildSupplierSchedule({ ...base, legacySettled: true });
    expect(s.legacySettled).toBe(true);
    expect(s.installments).toEqual([]);
    expect(s.open).toBe(0);
    expect(s.next).toBeNull();
  });

  it("pagamento em outra moeda não entra na conta", () => {
    const s = buildSupplierSchedule({
      ...base,
      payments: [pay(60, "received", "BRL")],
    });
    expect(s.installments[0].status).toBe("overdue");
    expect(s.paid).toBe(0);
  });

  it("pedido cancelado: nada mais vence; o que foi pago continua", () => {
    const s = buildSupplierSchedule({
      ...base,
      cancelled: true,
      payments: [pay(60, "received")],
    });
    expect(s.installments.map((i) => i.status)).toEqual([
      "received",
      "cancelled",
    ]);
    expect(s.open).toBe(0);
    expect(s.next).toBeNull();
  });

  it("sem condição: sem parcelas, o saldo é o FOB menos o pago e o pedido", () => {
    const s = buildSupplierSchedule({
      ...base,
      terms: null,
      payments: [pay(50, "confirmed"), pay(30, "pending")],
    });
    expect(s.installments).toEqual([]);
    expect(s.open).toBe(120);
    expect(s.next).toBeNull();
    const noFob = buildSupplierSchedule({ ...base, total: null });
    expect(noFob.installments).toEqual([]);
    expect(noFob.open).toBe(0);
  });
});
