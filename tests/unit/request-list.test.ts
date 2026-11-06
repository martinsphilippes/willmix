import { describe, expect, it } from "vitest";
import {
  downStatus,
  inSituation,
  matchesRequest,
  receivedByRequest,
} from "@/lib/services/request-list";
import type { Payment } from "@/lib/db";

const req = (status: string, deadline: string | null = null) =>
  ({ status, deadline }) as never;

describe("lista de solicitações", () => {
  it("situações dos filtros", () => {
    const today = "2026-11-06";
    expect(inSituation(req("RFQ_OPEN"), "RFQ_OPEN", "open", today)).toBe(true);
    expect(
      inSituation(
        req("WAITING_DOWN_PAYMENT"),
        "WAITING_DOWN_PAYMENT",
        "waiting",
        today,
      ),
    ).toBe(true);
    expect(inSituation(req("ORDERED"), "ORDERED", "ordered", today)).toBe(true);
    expect(
      inSituation(req("ORDERED"), "ORDER_CANCELLED", "ordered", today),
    ).toBe(false);
    expect(
      inSituation(req("REQUESTED", "2026-11-05"), "REQUESTED", "late", today),
    ).toBe(true);
    expect(
      inSituation(req("REQUESTED", "2026-11-06"), "REQUESTED", "late", today),
    ).toBe(false);
    expect(
      inSituation(req("ORDERED", "2026-01-01"), "ORDERED", "late", today),
    ).toBe(false);
  });

  it("busca por número, produto e cliente, sem acento", () => {
    const r = { number: 12, productName: "Jarra de vidro", description: "" };
    expect(matchesRequest(r, "Loja do João", "#12")).toBe(true);
    expect(matchesRequest(r, "Loja do João", "joao")).toBe(true);
    expect(matchesRequest(r, "Loja do João", "jarra")).toBe(true);
    expect(matchesRequest(r, "Loja do João", "copo")).toBe(false);
  });

  it("sinal recebido e situação do sinal", () => {
    const pay = (over: Partial<Payment>) =>
      ({
        direction: "customer_in",
        requestId: "r1",
        amount: 100,
        status: "confirmed",
        ...over,
      }) as Payment;
    const m = receivedByRequest([
      pay({}),
      pay({ amount: 50, status: "received" }),
      pay({ amount: 999, status: "pending" }),
      pay({ amount: 999, direction: "supplier_out" }),
    ]);
    expect(m.get("r1")).toBe(150);
    expect(downStatus({ downPaymentAmount: 300 }, 150)).toBe("partial");
    expect(downStatus({ downPaymentAmount: 300 }, 300)).toBe("paid");
    expect(downStatus({ downPaymentAmount: 300 }, 0)).toBe("pending");
    expect(downStatus({ downPaymentAmount: null }, 0)).toBe("none");
  });
});
