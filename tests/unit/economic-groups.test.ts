import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Pedido para um grupo econômico (docs/ECONOMIC_GROUPS.md): contas da
 * distribuição, o grupo do cliente, a distribuição padrão e o campo das
 * empresas em cada produto.
 */
withTempStore();

const { seedDemo } = await import("@/lib/seed");
const g = await import("@/lib/economic-group");
const svc = await import("@/lib/services/economic-groups");
const { parseCompanyAllocations } =
  await import("@/app/app/actions/request-items");
type User = import("@/lib/db").User;

let admin: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("contas da distribuição", () => {
  const ids = ["a", "b", "c"];
  it("total pelos percentuais, em inteiros (maiores frações)", () => {
    expect(g.splitByPercent(100, ids, { a: 50, b: 30, c: 20 })).toEqual({
      a: 50,
      b: 30,
      c: 20,
    });
    const odd = g.splitByPercent(10, ids, { a: 33.34, b: 33.33, c: 33.33 });
    expect(odd.a + odd.b + odd.c).toBe(10);
    expect(g.splitByPercent(10, ids, {})).toEqual({});
  });
  it("a partir de uma empresa, na proporção dos percentuais", () => {
    expect(g.fromBaseCompany("a", 50, ids, { a: 50, b: 30, c: 20 })).toEqual({
      a: 50,
      b: 30,
      c: 20,
    });
    expect(g.fromBaseCompany("c", 10, ids, { a: 50, c: 0 })).toBeNull();
  });
  it("percentuais iguais somam 100", () => {
    expect(g.sharesTotal(g.equalShares(ids))).toBe(100);
  });
  it("caixas de cada empresa nas entregas e a soma por entrega", () => {
    const r = g.companyRounds({ a: 5, b: 2 }, ids, 2, 10);
    expect(r.byCompany).toEqual({ a: [30, 20], b: [10, 10] });
    expect(r.total).toEqual([40, 30]);
  });
  it("confere as empresas contra a programação", () => {
    const ok = new Set(["a", "b"]);
    const rows = [
      { customerId: "a", quantities: [30, 20] },
      { customerId: "b", quantities: [10, 10] },
    ];
    expect(g.allocationsMatch(rows, [40, 30], ok)).toBe(true);
    expect(g.allocationsMatch(rows, [40, 31], ok)).toBe(false);
    expect(g.allocationsMatch(rows, [40, 30], new Set(["a"]))).toBe(false);
    expect(g.allocationsMatch([rows[0], rows[0]], [60, 40], ok)).toBe(false);
    expect(g.allocationsMatch(rows, [70], ok)).toBe(false);
  });
  it("CNPJ com a máscara", () => {
    expect(g.taxIdText("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("grupo do cliente", () => {
  it("a matriz representa o grupo; a loja sozinha não abre o grupo", async () => {
    const group = await svc.economicGroupOf("cliente-grupo");
    expect(group?.code).toBe("9100");
    expect(group?.companies.map((c) => c.id)).toEqual([
      "cliente-grupo",
      "cliente-grupo-loja2",
      "cliente-grupo-loja3",
    ]);
    expect(group?.companies[0].head).toBe(true);
    expect(await svc.economicGroupOf("cliente-grupo-loja2")).toBeNull();
    expect(await svc.economicGroupOf("cliente-joao")).toBeNull();
    expect((await svc.groupSizes(["9100", "9101"])).get("9100")).toBe(2);
  });
  it("distribuição padrão: soma 100 e só empresas do grupo", async () => {
    await expect(
      svc.saveGroupShares(admin, "cliente-grupo", { "cliente-grupo": 60 }),
    ).rejects.toThrow("percent_total");
    const saved = await svc.saveGroupShares(admin, "cliente-grupo", {
      "cliente-grupo": 50,
      "cliente-grupo-loja2": 30,
      "cliente-grupo-loja3": 20,
      "cliente-joao": 10,
    });
    expect(saved.shares).toEqual({
      "cliente-grupo": 50,
      "cliente-grupo-loja2": 30,
      "cliente-grupo-loja3": 20,
    });
    expect((await svc.economicGroupOf("cliente-grupo"))?.shares).toEqual(
      saved.shares,
    );
    // Gravar de novo troca a anterior inteira.
    await svc.saveGroupShares(admin, "cliente-grupo", {
      "cliente-grupo": 100,
    });
    expect((await svc.economicGroupOf("cliente-grupo"))?.shares).toEqual({
      "cliente-grupo": 100,
    });
  });
});

describe("campo das empresas do produto", () => {
  it("lê o JSON e recusa o que não é", () => {
    expect(parseCompanyAllocations("")).toBeNull();
    expect(
      parseCompanyAllocations(
        JSON.stringify([{ customerId: "cliente-grupo", quantities: [10, 5] }]),
      ),
    ).toEqual([{ customerId: "cliente-grupo", quantities: [10, 5] }]);
    expect(() => parseCompanyAllocations("{")).toThrow("allocations");
    expect(() =>
      parseCompanyAllocations(
        JSON.stringify([{ customerId: "x", quantities: [1.5] }]),
      ),
    ).toThrow("allocations");
  });
});
