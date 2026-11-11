import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Limpar os cadastros que vêm do Sankhya (migração): só depois das vendas;
 * apaga fornecedores, clientes, transportadoras, produtos, linhas, condições
 * e locais; mantém os outros parceiros, o cliente Estoque Wellmix, os
 * usuários (ativos) e o parceiro de quem tem usuário; zera a carga.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const r = await import("@/lib/services/requests");
const sales = await import("@/lib/services/data-reset");
const catalog = await import("@/lib/services/catalog-reset");
const { STOCK_PARTY_ID } = await import("@/lib/services/stock-party");
const { writeSetting, readSetting } =
  await import("@/lib/integrations/sankhya-settings");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
});

describe("limpeza dos cadastros do Sankhya", () => {
  it("exige as vendas apagadas, depois apaga os cadastros e mantém o resto", async () => {
    const store = getStore();
    await r.createRequest(joao, {
      customerId: "cliente-joao",
      productId: "prod-jarra",
      productName: "Jarra",
      description: "Teste da limpeza dos cadastros",
      specification: null,
      quantity: 100,
      unit: "un",
      deadline: null,
      notes: null,
    });
    await store.create("stock_locations", {
      code: 101,
      name: "CD",
      active: true,
      notes: null,
      sankhyaCode: "101",
    });
    await writeSetting("sankhya.load.orders", { after: 99, done: true });
    const agencies = (await store.list("parties")).filter(
      (p) => p.type === "agency",
    );

    const before = await catalog.planCatalogReset(admin);
    expect(before.salesLeft).toBeGreaterThan(0);
    await expect(catalog.resetCatalogData(admin, "APAGAR")).rejects.toThrow(
      "sales_first",
    );
    await expect(catalog.resetCatalogData(joao, "APAGAR")).rejects.toThrow(
      "forbidden",
    );

    await sales.resetSalesData(admin, "APAGAR");
    const plan = await catalog.planCatalogReset(admin);
    expect(plan.salesLeft).toBe(0);
    expect(plan.remove.products).toBeGreaterThan(0);
    // O cliente do João tem usuário: fica.
    expect(plan.partiesKept).toBeGreaterThan(0);

    await expect(catalog.resetCatalogData(admin, "errado")).rejects.toThrow(
      "reset_confirm",
    );
    const result = await catalog.resetCatalogData(admin, "apagar");
    expect(result.finished).toBe(true);

    const parties = await store.list("parties");
    const users = await store.list("users");
    const withUsers = new Set(users.map((u) => u.partyId).filter(Boolean));
    // Só ficam os fornecedores/clientes com usuário ligado.
    const left = parties.filter(
      (p) =>
        ["supplier", "customer", "carrier"].includes(p.type) &&
        p.id !== STOCK_PARTY_ID,
    );
    expect(left.length).toBe(plan.partiesKept);
    expect(left.every((p) => withUsers.has(p.id))).toBe(true);
    expect(parties.filter((p) => p.type === "agency")).toHaveLength(
      agencies.length,
    );
    expect(await store.list("products")).toEqual([]);
    expect(await store.list("product_lines")).toEqual([]);
    expect(await store.list("stock_locations")).toEqual([]);
    // Usuários continuam ativos e ligados ao mesmo cadastro.
    const joaoAfter = users.find((u) => u.id === joao.id)!;
    expect(joaoAfter).toMatchObject({ active: true, partyId: joao.partyId });
    expect(parties.some((p) => p.id === joao.partyId)).toBe(true);
    expect(users.find((u) => u.id === admin.id)?.active).toBe(true);
    expect(await readSetting("sankhya.load.orders")).toBeNull();
    expect((await catalog.planCatalogReset(admin)).total).toBe(0);
  });
});
