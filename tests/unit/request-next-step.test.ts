import { describe, expect, it } from "vitest";
import {
  nextStepText,
  nextStepWho,
  quoteSummary,
  requestNextStep,
} from "@/lib/services/request-list";
import { translator } from "@/i18n";

const t = translator("pt");
const q = (over: Record<string, unknown>) =>
  ({
    id: "q",
    status: "invited",
    price: null,
    currency: "USD",
    leadTimeDays: null,
    answeredAt: null,
    ...over,
  }) as never;

describe("cotações da solicitação", () => {
  it("conta convites e respostas; a escolhida vence a mais barata", () => {
    const quotes = [
      q({ id: "a" }),
      q({
        id: "b",
        status: "answered",
        price: 5,
        leadTimeDays: 30,
        answeredAt: "2026-11-01T10:00:00.000Z",
      }),
      q({
        id: "c",
        status: "answered",
        price: 4,
        leadTimeDays: 45,
        answeredAt: "2026-11-02T10:00:00.000Z",
      }),
    ];
    const open = quoteSummary(quotes, null);
    expect(open).toMatchObject({ invited: 3, answered: 2 });
    expect(open.best).toMatchObject({ price: 4, selected: false });
    const chosen = quoteSummary(quotes, "b");
    expect(chosen.best).toMatchObject({
      price: 5,
      leadTimeDays: 30,
      selected: true,
    });
    expect(quoteSummary([], null)).toMatchObject({
      invited: 0,
      answered: 0,
      best: null,
    });
  });

  it("não mistura moedas ao escolher a mais barata", () => {
    const s = quoteSummary(
      [
        q({
          id: "a",
          status: "answered",
          price: 10,
          currency: "USD",
          answeredAt: "x",
        }),
        q({
          id: "b",
          status: "answered",
          price: 1,
          currency: "CNY",
          answeredAt: "x",
        }),
      ],
      null,
    );
    expect(s.best).toMatchObject({ price: 10, currency: "USD" });
  });
});

describe("próximo passo da solicitação", () => {
  const base = {
    display: "RFQ_OPEN" as never,
    quotes: { invited: 0, answered: 0 },
    approval: null,
    order: null,
    today: "2026-11-08",
  };
  it("do pedido de cotação ao sinal", () => {
    expect(
      requestNextStep({
        ...base,
        status: "REQUESTED",
        display: "REQUESTED" as never,
      }),
    ).toMatchObject({ key: "rfq", who: "wellmix" });
    expect(
      requestNextStep({
        ...base,
        status: "RFQ_OPEN",
        quotes: { invited: 3, answered: 0 },
      }),
    ).toMatchObject({ key: "quotes", who: "suppliers" });
    expect(
      requestNextStep({
        ...base,
        status: "QUOTATION_RECEIVED",
        quotes: { invited: 3, answered: 2 },
      }),
    ).toMatchObject({ key: "choose", who: "wellmix" });
    expect(
      requestNextStep({
        ...base,
        status: "QUOTATION_RECEIVED",
        quotes: { invited: 3, answered: 2 },
        approval: { status: "pending", currentLevel: "purchasing_director" },
      }),
    ).toMatchObject({
      key: "approval",
      who: "approvers",
      level: "purchasing_director",
    });
    expect(
      requestNextStep({
        ...base,
        status: "WAITING_DOWN_PAYMENT",
        display: "WAITING_DOWN_PAYMENT" as never,
      }),
    ).toMatchObject({ key: "down", who: "customer" });
  });

  it("pedido: etapa atual, quem responde e atraso; cancelado não tem passo", () => {
    const n = requestNextStep({
      ...base,
      status: "ORDERED",
      display: "ORDERED" as never,
      order: {
        status: "PREPARATION",
        responsibleRole: "supplier",
        dueAt: "2026-11-01T00:00:00.000Z",
      },
    });
    expect(n).toMatchObject({
      key: "order",
      who: "supplier",
      stage: "PREPARATION",
      late: true,
    });
    expect(nextStepText(t, n)).toBe("Pedido em Preparação");
    expect(nextStepWho(t, n)).toBe("com: Fornecedor");
    expect(
      requestNextStep({
        ...base,
        status: "ORDERED",
        display: "ORDER_CANCELLED" as never,
      }),
    ).toMatchObject({ key: "none", who: null });
    expect(
      nextStepText(
        t,
        requestNextStep({
          ...base,
          status: "ORDERED",
          display: "ORDERED" as never,
          order: { status: "CLOSED", responsibleRole: null, dueAt: null },
        }),
      ),
    ).toBe("Pedido encerrado");
  });
});
