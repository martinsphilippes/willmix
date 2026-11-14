import { describe, expect, it } from "vitest";
import { canCreateOrder } from "@/lib/auth/permissions";

describe("Criar pedido (encomenda do cliente)", () => {
  it("Wellmix e cliente com a tela de solicitações criam", () => {
    expect(canCreateOrder({ role: "admin" }, true)).toBe(true);
    expect(canCreateOrder({ role: "operator" }, true)).toBe(true);
    expect(canCreateOrder({ role: "customer" }, true)).toBe(true);
  });

  it("sem a tela de solicitações, ninguém vê o botão", () => {
    expect(canCreateOrder({ role: "operator" }, false)).toBe(false);
    expect(canCreateOrder({ role: "customer" }, false)).toBe(false);
  });

  it("fornecedor e parceiros da operação não criam", () => {
    for (const role of ["supplier", "agency", "broker", "comex"] as const)
      expect(canCreateOrder({ role }, true)).toBe(false);
  });
});
