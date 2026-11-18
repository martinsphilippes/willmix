import { describe, expect, it } from "vitest";
import {
  requestClosed,
  requestOrderState,
} from "@/lib/supplier-request-closing";
import type { SupplierRequest } from "@/lib/db/schema";

/*
 * Abas da lista de solicitações ao fornecedor e "Gerar pedido" (dono,
 * 18/11/2026): encerrada quando todos os produtos foram decididos; vira
 * pedido só com todos os aprovados cadastrados e com a amostra aprovada.
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
  ...over,
});

describe("requestClosed", () => {
  it("só com todos os produtos decididos", () => {
    expect(requestClosed([])).toBe(false);
    expect(
      requestClosed([{ status: "approved" }, { status: "answered" }]),
    ).toBe(false);
    expect(requestClosed([{ status: "open" }])).toBe(false);
    expect(
      requestClosed([
        { status: "approved" },
        { status: "declined" },
        { status: "cancelled" },
      ]),
    ).toBe(true);
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
