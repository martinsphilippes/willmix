import { describe, expect, it } from "vitest";
import { inSituation, matchesRequest } from "@/lib/services/request-list";

const req = (status: string, deadline: string | null = null) =>
  ({ status, deadline }) as never;

describe("lista de solicitações", () => {
  it("situações dos filtros", () => {
    const today = "2026-11-06";
    expect(inSituation(req("RFQ_OPEN"), "RFQ_OPEN", "open", today)).toBe(true);
    // Sinal do cliente saiu (11/11/2026): a antiga "aguardando sinal" é aberta.
    expect(
      inSituation(
        req("WAITING_DOWN_PAYMENT"),
        "WAITING_DOWN_PAYMENT",
        "open",
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
});
