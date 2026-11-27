import { describe, expect, it } from "vitest";
import {
  requestClosed,
  requestOrderState,
} from "@/lib/supplier-request-closing";
import type { SupplierRequest } from "@/lib/db/schema";

/*
 * Abas da lista de solicitações ao fornecedor e "Gerar pedido" (dono,
 * 18/11/2026): encerrada quando todos os produtos foram decididos e, desde
 * 24/11/2026, com a amostra dos aprovados aprovada; vira pedido só com todos
 * os aprovados cadastrados e com a amostra aprovada.
 */
type Row = Parameters<typeof requestOrderState>[0][number];
const AT = "2026-11-18T10:00:00.000Z";
const sample = (status: string) =>
  ({
    status,
    round: 1,
    openedAt: AT,
    files: [],
    history: [],
  }) as unknown as SupplierRequest["sampling"];
const row = (over: Partial<Row>): Row => ({
  id: "r1",
  status: "approved",
  productId: "p1",
  orderId: null,
  decidedAt: AT,
  updatedAt: AT,
  sampling: sample("approved"),
  // "Necessita amostragem" (dono, 27/11/2026): marcada nestes casos.
  samplingNeed: "yes",
  ...over,
});

describe("requestClosed", () => {
  it("só com todos os produtos decididos", () => {
    expect(requestClosed([])).toBe(false);
    expect(
      requestClosed([row({}), row({ status: "answered", sampling: null })]),
    ).toBe(false);
    expect(requestClosed([row({ status: "open", sampling: null })])).toBe(
      false,
    );
    expect(
      requestClosed([
        row({}),
        row({ status: "declined", sampling: null }),
        row({ status: "cancelled", sampling: null }),
      ]),
    ).toBe(true);
  });

  it("aprovada com a amostra pendente continua em andamento (dono, 24/11/2026)", () => {
    expect(requestClosed([row({ sampling: sample("pending") })])).toBe(false);
    expect(requestClosed([row({ sampling: sample("submitted") })])).toBe(false);
    expect(requestClosed([row({ sampling: sample("rejected") })])).toBe(false);
    // Aprovada antes da etapa existir (sem amostragem gravada): pendente.
    expect(requestClosed([row({ sampling: null })])).toBe(false);
    // Sem "Necessita amostragem" (o padrão desde 27/11/2026), nada espera
    // a amostra: encerrada.
    expect(requestClosed([row({ sampling: null, samplingNeed: null })])).toBe(
      true,
    );
    expect(
      requestClosed([row({ sampling: sample("pending"), samplingNeed: "no" })]),
    ).toBe(true);
    // Dispensada (o conhecido do produto) ou já num pedido: encerrada.
    const skipped = {
      ...sample("approved")!,
      skipped: true,
    } as SupplierRequest["sampling"];
    expect(requestClosed([row({ sampling: skipped })])).toBe(true);
    expect(
      requestClosed([row({ sampling: sample("pending"), orderId: "o1" })]),
    ).toBe(true);
    // Um produto com a amostra pendente segura a solicitação inteira.
    expect(
      requestClosed([
        row({ id: "a" }),
        row({ id: "b", sampling: sample("pending") }),
      ]),
    ).toBe(false);
  });
});

describe("requestOrderState", () => {
  it("pronta com os aprovados fora de pedido", () => {
    expect(
      requestOrderState([
        row({ id: "a" }),
        row({ id: "b", status: "declined", productId: null, sampling: null }),
        row({ id: "c", orderId: "o1" }),
      ]),
    ).toEqual({ kind: "ready", requestIds: ["a"] });
  });
  it("falta cadastrar o produto", () => {
    expect(
      requestOrderState([row({ id: "a" }), row({ id: "b", productId: null })]),
    ).toEqual({ kind: "missingProduct", missing: 1 });
  });
  it("amostra ainda não aprovada", () => {
    expect(requestOrderState([row({ sampling: sample("submitted") })])).toEqual(
      { kind: "waitingSample", waiting: 1 },
    );
  });
  it("já em pedido ou sem aprovados", () => {
    expect(requestOrderState([row({ orderId: "o1" })])).toEqual({
      kind: "ordered",
    });
    expect(requestOrderState([row({ status: "declined" })])).toEqual({
      kind: "none",
    });
  });
});
