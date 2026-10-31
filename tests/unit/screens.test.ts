import { describe, expect, it } from "vitest";
import {
  ADMIN_ONLY,
  FUNCTION_SCREENS,
  SCREENS,
  WELLMIX_BASE,
  assertScreen,
  canOpen,
  hasNoFunction,
  screenOfPath,
  screensFor,
} from "@/lib/auth/screens";
import { ROLES, WELLMIX_FUNCTIONS } from "@/lib/db/schema";

/*
 * Telas por papel e por função (docs/ACCESS.md): admin abre tudo; operador
 * abre o básico mais as telas das funções; financeiro é só do admin; cliente,
 * fornecedor e parceiros têm a lista fixa do papel.
 */
describe("telas por papel e por função", () => {
  it("admin abre todas as telas", () => {
    expect([...screensFor({ role: "admin" })].sort()).toEqual(
      [...SCREENS].sort(),
    );
  });

  it("operador sem função vê só o básico (e o aviso)", () => {
    const op = { role: "operator" as const, functions: null };
    expect([...screensFor(op)].sort()).toEqual([...WELLMIX_BASE].sort());
    expect(hasNoFunction(op)).toBe(true);
    expect(hasNoFunction({ role: "admin" })).toBe(false);
    expect(canOpen(op, "orders")).toBe(false);
    expect(() => assertScreen(op, "requests")).toThrow();
  });

  it("função libera as suas telas; várias funções somam", () => {
    const buyer = { role: "operator" as const, functions: ["buyer" as const] };
    expect(canOpen(buyer, "requests")).toBe(true);
    expect(canOpen(buyer, "orders")).toBe(true);
    expect(canOpen(buyer, "lines")).toBe(false);
    const both = {
      role: "operator" as const,
      functions: ["buyer" as const, "catalog" as const],
    };
    expect(canOpen(both, "lines")).toBe(true);
    expect(canOpen(both, "import")).toBe(true);
    expect(() => assertScreen(both, "lines")).not.toThrow();
  });

  it("financeiro, conta corrente, configurações e equipe: só o admin, com qualquer função", () => {
    const everything = {
      role: "operator" as const,
      functions: [...WELLMIX_FUNCTIONS],
    };
    for (const screen of ADMIN_ONLY) {
      expect(canOpen(everything, screen)).toBe(false);
      expect(canOpen({ role: "admin" }, screen)).toBe(true);
    }
    // A função "financeiro" não libera tela alguma (vale dentro do pedido).
    expect(FUNCTION_SCREENS.finance).toEqual([]);
    expect(
      canOpen({ role: "operator", functions: ["finance"] }, "finance"),
    ).toBe(false);
  });

  it("diretorias abrem tudo que não é só do admin; auditoria e painéis inclusos", () => {
    const director = {
      role: "operator" as const,
      functions: ["purchasing_director" as const],
    };
    expect(canOpen(director, "audit")).toBe(true);
    expect(canOpen(director, "dashboards")).toBe(true);
    expect(canOpen(director, "finance")).toBe(false);
    expect(canOpen(director, "settings")).toBe(false);
  });

  it("cliente, fornecedor e parceiros: a lista fixa do papel (nada removido)", () => {
    const has = (
      role: (typeof ROLES)[number],
      screen: Parameters<typeof canOpen>[1],
    ) => canOpen({ role }, screen);
    expect(has("customer", "explore")).toBe(true);
    expect(has("customer", "requests")).toBe(true);
    expect(has("customer", "history")).toBe(true);
    expect(has("customer", "parties")).toBe(false);
    expect(has("supplier", "quotes")).toBe(true);
    expect(has("supplier", "account")).toBe(true);
    expect(has("supplier", "requests")).toBe(false);
    expect(has("agency", "packaging")).toBe(true);
    expect(has("shipping_line", "freightTariff")).toBe(true);
    expect(has("legal", "penalties")).toBe(true);
    for (const role of [
      "broker",
      "carrier",
      "comex",
      "logistics",
      "ocp",
    ] as const) {
      expect(has(role, "orders")).toBe(true);
      expect(has(role, "finance")).toBe(false);
      expect(has(role, "requests")).toBe(false);
    }
    // Toda função conhecida tem uma lista (nenhuma esquecida).
    for (const fn of WELLMIX_FUNCTIONS)
      expect(FUNCTION_SCREENS[fn]).toBeDefined();
  });

  it("rota → tela (a mais específica primeiro)", () => {
    expect(screenOfPath("/app")).toBe("home");
    expect(screenOfPath("/app/orders/abc")).toBe("orders");
    expect(screenOfPath("/app/freight/tariff")).toBe("freightTariff");
    expect(screenOfPath("/app/freight/x1")).toBe("freight");
    expect(screenOfPath("/app/products/p1/tax")).toBe("products");
    expect(screenOfPath("/app/after-sales")).toBe("afterSales");
    expect(screenOfPath("/login")).toBeNull();
  });
});
