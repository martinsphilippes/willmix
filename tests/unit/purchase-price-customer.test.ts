import { describe, expect, it } from "vitest";
import {
  canSeeOrderPurchasePrice,
  canSeePurchasePrice,
} from "@/lib/auth/function-access";

/*
 * Regra do dono (23/11/2026): o preço original, negociado com o fornecedor,
 * NUNCA aparece para o cliente. As tabelas padrão de itens
 * (docs/ORDER_TABLES.md) mostram o preço de compra só por estas duas
 * funções; este teste trava que o cliente fica de fora em qualquer caso.
 */
describe("preço de compra nunca para o cliente", () => {
  const order = { supplierId: "sup-1", brokerId: "bro-1" };
  const customer = (functions: string[], partyId: string | null) =>
    ({ role: "customer", functions, partyId }) as never;

  it("o cliente não vê, nem do pedido dele", () => {
    expect(canSeePurchasePrice(customer([], "cus-1"))).toBe(false);
    expect(canSeeOrderPurchasePrice(customer([], "cus-1"), order)).toBe(false);
  });

  it("função da Wellmix marcada num login de cliente não libera", () => {
    for (const functions of [["admin"], ["buyer"], ["purchasing_director"]]) {
      expect(canSeePurchasePrice(customer(functions, "cus-1"))).toBe(false);
      expect(
        canSeeOrderPurchasePrice(customer(functions, "cus-1"), order),
      ).toBe(false);
    }
  });

  it("cliente com o cadastro igual ao do fornecedor ou do despachante não vê", () => {
    expect(canSeeOrderPurchasePrice(customer([], "sup-1"), order)).toBe(false);
    expect(canSeeOrderPurchasePrice(customer([], "bro-1"), order)).toBe(false);
  });

  it("os outros parceiros também não (só o fornecedor e o despachante do pedido)", () => {
    for (const role of ["carrier", "certifier", "agency", "logistics"])
      expect(
        canSeeOrderPurchasePrice(
          { role, functions: [], partyId: "sup-1" } as never,
          order,
        ),
      ).toBe(false);
    expect(
      canSeeOrderPurchasePrice(
        { role: "supplier", functions: [], partyId: "outro" } as never,
        order,
      ),
    ).toBe(false);
  });
});
