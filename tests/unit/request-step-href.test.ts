import { describe, expect, it } from "vitest";
import { requestStepHref, type StepAccess } from "@/lib/request-step-href";
import type { NextStep } from "@/lib/services/request-list";

/*
 * O status leva ao lugar de agir (dono, 24/11/2026: "o status tem que ser
 * clicável e direcionar para o local certo... padrão em toda linha de tabela
 * que tenha status"): cada passo da encomenda abre o mesmo lugar da
 * pendência, e sem a tela (ou sem o lugar) o selo fica sem link.
 */
const all: StepAccess = {
  requests: true,
  strategy: true,
  quotes: true,
  orders: true,
};
const request = { id: "r1", groupId: "g1", orderId: "o1" };
const step = (over: Partial<NextStep>): NextStep => ({
  key: "none",
  who: "wellmix",
  ...over,
});

describe("o lugar de agir em cada passo da encomenda", () => {
  it("cada passo abre o mesmo lugar da pendência", () => {
    const href = (over: Partial<NextStep>) =>
      requestStepHref(step(over), request, all);
    expect(href({ key: "confirm", who: "customer" })).toBe("/app/requests/r1");
    expect(href({ key: "login" })).toBe("/app/requests/r1");
    expect(href({ key: "send" })).toBe("/app/requests/batch/g1");
    expect(href({ key: "strategy" })).toBe("/app/purchase-strategy");
    expect(href({ key: "strategy_approve", decisionId: "d1" })).toBe(
      "/app/purchase-strategy?tab=open#decision-d1",
    );
    expect(href({ key: "quote_choose", quoteId: "q1" })).toBe(
      "/app/purchase-quotes/q1",
    );
    expect(href({ key: "quote_answer", who: "supplier", quoteId: "q1" })).toBe(
      "/app/purchase-quotes/q1",
    );
    expect(href({ key: "sampling_validate", supplierRequestId: "s1" })).toBe(
      "/app/supplier-requests/s1?view=item#amostragem",
    );
    expect(href({ key: "supplier_decide", supplierRequestId: "s1" })).toBe(
      "/app/supplier-requests/s1",
    );
    expect(href({ key: "purchase_order", supplierRequestId: "s1" })).toBe(
      "/app/supplier-requests?tab=closed&pick=s1#pedido-de-compra",
    );
    expect(href({ key: "order", who: "supplier" })).toBe("/app/orders/o1");
  });

  it("sem o lugar ou sem a tela, o selo fica sem link", () => {
    expect(requestStepHref(step({ key: "none" }), request, all)).toBeNull();
    expect(
      requestStepHref(step({ key: "quote_choose" }), request, all),
    ).toBeNull();
    expect(
      requestStepHref(step({ key: "quote_choose", quoteId: "q1" }), request, {
        ...all,
        quotes: false,
      }),
    ).toBeNull();
    expect(
      requestStepHref(step({ key: "strategy" }), request, {
        ...all,
        strategy: false,
      }),
    ).toBeNull();
    expect(
      requestStepHref(step({ key: "order" }), { id: "r1", orderId: null }, all),
    ).toBeNull();
    // A encomenda sem lote: a página dela pelo próprio id.
    expect(requestStepHref(step({ key: "send" }), { id: "r9" }, all)).toBe(
      "/app/requests/batch/r9",
    );
  });
});
