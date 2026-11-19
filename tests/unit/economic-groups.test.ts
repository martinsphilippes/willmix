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
const rounds = await import("@/lib/services/delivery-round-shares");
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

describe("matriz Empresas × Entregas (19/11/2026)", () => {
  const ids = ["a", "b"];
  it("totais pelas entregas, pelos percentuais ou iguais", () => {
    expect(g.spreadRounds(10, 2, [60, 40])).toEqual([6, 4]);
    expect(g.spreadRounds(10, 3)).toEqual([4, 3, 3]);
    expect(g.spreadRounds(10, 2, [1])).toEqual([5, 5]);
    expect(g.matrixFromTotals({ a: 10, b: 5 }, ids, 2, [60, 40])).toEqual({
      a: [6, 4],
      b: [3, 2],
    });
  });
  it("soma por empresa e por entrega; outro número de entregas", () => {
    const m = { a: [6, 4], b: [3, 2] };
    expect(g.matrixTotals(m, ids)).toEqual({ a: 10, b: 5 });
    expect(g.matrixColumns(m, ids, 2)).toEqual([9, 6]);
    expect(g.reshapeMatrix(m, ids, 3)).toEqual({ a: [4, 3, 3], b: [2, 2, 1] });
    expect(g.matrixPieces(m, ids, 2, 10)).toEqual({
      byCompany: { a: [60, 40], b: [30, 20] },
      total: [90, 60],
    });
  });
  it("programação mudada fora da matriz: cada entrega na mesma proporção", () => {
    const m = { a: [6, 4], b: [3, 2] };
    // A 1ª entrega dobrou e a 2ª ficou: a proporção de cada coluna fica.
    expect(g.rescaleMatrix(m, ids, [18, 6], {})).toEqual({
      a: [12, 4],
      b: [6, 2],
    });
    // Matriz vazia: os percentuais do grupo; sem eles, nada.
    expect(g.rescaleMatrix({}, ids, [10, 10], { a: 70, b: 30 })).toEqual({
      a: [7, 7],
      b: [3, 3],
    });
    expect(g.rescaleMatrix({}, ids, [10, 10], {})).toBeNull();
  });
});

describe("distribuição padrão entre entregas por cliente", () => {
  it("por número de entregas, somando 100", async () => {
    expect(await rounds.roundSharesOf("cliente-grupo", 3)).toBeNull();
    await expect(
      rounds.saveRoundShares(admin, "cliente-grupo", [50, 30, 10]),
    ).rejects.toThrow("percent_total");
    await rounds.saveRoundShares(admin, "cliente-grupo", [40, 30, 30]);
    await rounds.saveRoundShares(admin, "cliente-grupo", [60, 40]);
    expect(await rounds.roundSharesOf("cliente-grupo", 3)).toEqual([
      40, 30, 30,
    ]);
    expect(await rounds.roundSharesOf("cliente-grupo", 2)).toEqual([60, 40]);
    // Gravar de novo troca só o do mesmo número de entregas.
    await rounds.saveRoundShares(admin, "cliente-grupo", [50, 50]);
    expect(await rounds.roundSharesOf("cliente-grupo", 2)).toEqual([50, 50]);
    expect(await rounds.roundSharesOf("cliente-grupo", 3)).toEqual([
      40, 30, 30,
    ]);
  });
});
