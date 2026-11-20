import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Aba Análise (dono, 19/11/2026): as compras do produto pelo cliente e pelas
 * empresas do grupo econômico dele, lidas no Sankhya e convertidas em peças.
 */
withTempStore();

const asked: string[] = [];
vi.mock("@/lib/integrations/sankhya-client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/integrations/sankhya-client")
  >()),
  executeQuery: async (sql: string) => {
    asked.push(sql);
    if (sql.includes("TGFVOA"))
      return {
        columns: [],
        rows: [
          { CODPROD: 501, CODVOL: "CX", QUANTIDADE: 12, DIVIDEMULTIPLICA: "M" },
        ],
      };
    return {
      columns: [],
      rows: [
        { DIA: "2026-01-10", UNIDADE_NEGOCIADA: "CX", QTD: 10 },
        { DIA: "2026-04-10", UNIDADE_NEGOCIADA: "UN", QTD: 120 },
      ],
    };
  },
}));

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const { productPurchaseAnalysis } =
  await import("@/lib/services/purchase-analysis");
type User = import("@/lib/db").User;

let admin: User;
let joao: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  joao = users.find((u) => u.email === "joao@lojista.com")!;
  await getStore().update("products", "prod-boneca", { sankhyaCode: "501" });
});

describe("aba Análise do histórico de compras", () => {
  it("soma o grupo econômico, converte as caixas em peças e estima a demanda", async () => {
    const result = await productPurchaseAnalysis(
      admin,
      "cliente-grupo",
      "prod-boneca",
    );
    expect(result.state).toBe("ok");
    if (result.state !== "ok") return;
    // A matriz e as duas lojas do grupo da demonstração.
    expect(result.companies).toBe(3);
    expect(asked.find((s) => s.includes("COD_CLIENTE IN"))).toMatch(
      /COD_CLIENTE IN \(9100, 9101, 9102\) AND CODPROD = 501/,
    );
    expect(result.purchases.map((p) => [p.date, p.quantity])).toEqual([
      ["2026-01-10", 120],
      ["2026-04-10", 120],
    ]);
    expect(result.years[0]).toMatchObject({ year: "2026", quantity: 240 });
    expect(result.estimate?.monthly).toBeGreaterThan(0);
  });

  it("produto sem código do Sankhya e quem não é da Wellmix", async () => {
    expect(
      (await productPurchaseAnalysis(admin, "cliente-grupo", "prod-jarra"))
        .state,
    ).toBe("no_product_code");
    expect(
      (await productPurchaseAnalysis(joao, "cliente-joao", "prod-boneca"))
        .state,
    ).toBe("forbidden");
  });
});
