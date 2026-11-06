import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Clientes são quem compra da Wellmix; fornecedores, de quem a Wellmix
 * compra. A empresa interna "Estoque Wellmix" (compra para estoque) não
 * aparece em Clientes nem abre a ficha de cliente.
 */
withTempStore();

const { seedDemo } = await import("@/lib/seed");
const pf = await import("@/lib/services/purchase-flow");
const ca = await import("@/lib/services/customer-accounts");
type User = import("@/lib/db").User;

let admin: User;

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  await pf.ensureStockParty(admin);
});

describe("clientes e fornecedores separados", () => {
  it("Estoque Wellmix fica fora de Clientes", async () => {
    const { rows } = await ca.customerAccounts({ status: "all" });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.party.id)).not.toContain(pf.STOCK_PARTY_ID);
    expect(await ca.customerDetail(pf.STOCK_PARTY_ID)).toBeNull();
  });

  it("Clientes só tem clientes e Fornecedores só tem fornecedores", async () => {
    const customers = await ca.customerAccounts({ status: "all" });
    const suppliers = await ca.customerAccounts({ status: "all" }, "supplier");
    expect(customers.rows.every((r) => r.party.type === "customer")).toBe(true);
    expect(suppliers.rows.every((r) => r.party.type === "supplier")).toBe(true);
    expect(suppliers.rows.length).toBeGreaterThan(0);
  });
});
