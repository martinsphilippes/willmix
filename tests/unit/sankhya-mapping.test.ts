import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Mapeamento Sankhya → portal e amostra da carga: conversões, SQL da amostra
 * (só leitura, listas de inteiros), colunas que faltam e a cadeia
 * notas → parceiros/itens/financeiro → produtos → grupos/estoque, com um
 * Sankhya falso.
 */
withTempStore();

const m = await import("@/lib/integrations/sankhya-mapping");
const st = await import("@/lib/integrations/sankhya-settings");
const sk = await import("@/lib/integrations/sankhya-client");
const { loadSankhyaSample } = await import("@/lib/integrations/sankhya-sample");
const { getStore } = await import("@/lib/db");

afterEach(() => vi.unstubAllGlobals());

describe("conversões", () => {
  it("datas, S/N, dígitos, metros e números", () => {
    expect(m.sankhyaDate("10/11/2026")).toBe("2026-11-10");
    expect(m.sankhyaDate("10112026 00:00:00")).toBe("2026-11-10");
    expect(m.sankhyaDate("2026-11-10T00:00:00")).toBe("2026-11-10");
    expect(m.sankhyaDate("")).toBeNull();
    expect(m.convert("sn", "S", {})).toBe(true);
    expect(m.convert("sn", "n", {})).toBe(false);
    expect(m.convert("digits", "12.345.678/0001-90", {})).toBe(
      "12345678000190",
    );
    expect(m.convert("metersToCm", 0.082, {})).toBe(8.2);
    expect(m.convert("number", "1,5", {})).toBe(1.5);
    expect(m.convert("int", "33", {})).toBe(33);
    expect(m.convert("text", "  ", {})).toBeNull();
  });

  it("tipo do parceiro, direção e situação do financeiro", () => {
    expect(m.convert("partyType", "S", { CLIENTE: "N" })).toBe("supplier");
    expect(m.convert("partyType", "S", { CLIENTE: "S" })).toBe(
      "supplier + customer",
    );
    expect(m.convert("partyType", "N", { CLIENTE: "N" })).toBeNull();
    expect(m.convert("recDesp", -1, {})).toBe("supplier_out");
    expect(m.convert("recDesp", "1", {})).toBe("customer_in");
    expect(m.convert("paidAt", null, { RECDESP: -1 })).toBe("pending");
    expect(m.convert("paidAt", "01/10/2026", { RECDESP: -1 })).toBe(
      "confirmed",
    );
    expect(m.convert("paidAt", "01/10/2026", { RECDESP: 1 })).toBe("received");
  });

  it("mapRow só traz campos com destino no portal", () => {
    const mapped = m.mapRow("products", {
      CODPROD: 50,
      DESCRPROD: "CANECA CERAMICA 300ML",
      REFFORN: "WX7588",
      ALTURA: 0.082,
      ATIVO: "S",
    });
    const byPortal = Object.fromEntries(mapped.map((v) => [v.portal, v.value]));
    expect(byPortal).toMatchObject({
      name: "CANECA CERAMICA 300ML",
      sku: "WX7588",
      heightCm: 8.2,
      active: true,
    });
    // O código vira o vínculo; coluna sem destino (CODVOL) não aparece.
    expect(byPortal.sankhyaCode).toBe("50");
    expect(mapped.some((v) => v.sankhya === "CODVOL")).toBe(false);
  });
});

describe("SQL da amostra", () => {
  it("só SELECT, listas de inteiros e nada de texto vindo de fora", () => {
    for (const entity of m.SANKHYA_ENTITIES) {
      const sql = m.sampleSql(entity, [1, "2", "3; DROP TABLE X", null]);
      expect(() => sk.assertReadOnlySql(sql)).not.toThrow();
      expect(sql).not.toContain("DROP");
    }
    expect(m.sampleSql("partners", [7, 7, 9])).toContain("IN (7, 9)");
    expect(m.sampleSql("partners", [])).toContain("IN (-1)");
    expect(m.sampleSql("orders")).toContain("IN (33, 1101,");
    expect(m.sampleSql("orderItems", [1])).toContain("P.DESCRPROD");
    expect(m.sampleSql("products", [1], true)).toMatch(/^SELECT P\.\* FROM/);
  });

  it("aponta as colunas do mapeamento que o ERP não tem", () => {
    expect(
      m.missingColumns("productGroups", ["CODGRUPOPROD", "DESCRGRUPOPROD"]),
    ).toEqual(["ATIVO"]);
  });
});

describe("amostra com um Sankhya falso", () => {
  it("segue a cadeia, limita a N, refaz com * quando falta coluna e casa com o portal", async () => {
    await st.saveSankhyaCredentials(
      {
        environment: "production",
        clientId: "c",
        clientSecret: "s",
        xToken: "x",
      },
      "admin",
    );
    sk.resetSankhyaTokenCache();
    const store = getStore();
    await store.create("parties", {
      type: "supplier",
      name: "Fornecedor Teste",
      country: "CN",
      email: null,
      phone: null,
      taxId: "12.345.678/0001-90",
      notes: null,
      active: true,
      city: null,
      address: null,
      contactName: null,
      wechat: null,
      operationMode: null,
      radar: null,
      radarNotes: null,
      importerId: null,
      bankBeneficiary: null,
      bankName: null,
      bankAccount: null,
      bankSwift: null,
      bankAddress: null,
    });

    const sqls: string[] = [];
    const table = (columns: string[], rows: unknown[][]) =>
      new Response(
        JSON.stringify({
          status: "1",
          responseBody: {
            fieldsMetadata: columns.map((name) => ({ name })),
            rows,
          },
        }),
      );
    vi.stubGlobal("fetch", (async (
      input: RequestInfo | URL,
      init: RequestInit = {},
    ) => {
      if (String(input).endsWith("/authenticate"))
        return new Response(
          JSON.stringify({ access_token: "t", expires_in: 300 }),
        );
      const sql = JSON.parse(String(init.body)).requestBody.sql as string;
      sqls.push(sql);
      if (sql.includes("FROM TGFCAB"))
        return table(
          ["NUNOTA", "CODPARC", "CODTIPOPER", "DTNEG", "VLRNOTA"],
          [
            [900, 11, 1101, "10/11/2026", 100],
            [899, 12, 1002, "09/11/2026", 50],
            [898, 11, 1101, "08/11/2026", 10],
          ],
        );
      if (sql.includes("FROM TGFPAR"))
        return table(
          ["CODPARC", "NOMEPARC", "CGC_CPF", "FORNECEDOR", "CLIENTE"],
          [
            [11, "Outro nome", "12345678000190", "S", "N"],
            [12, "Novo Ltd", "", "S", "N"],
          ],
        );
      if (sql.includes("FROM TGFITE"))
        return table(
          ["NUNOTA", "SEQUENCIA", "CODPROD", "DESCRPROD", "QTDNEG"],
          [
            [900, 1, 50, "CANECA", 10],
            [900, 2, 51, "PRATO", 5],
            [899, 1, 52, "COPO", 1],
          ],
        );
      // TGFGRU sem a coluna ATIVO: o SQL do mapeamento falha e volta com *.
      if (sql.includes("FROM TGFGRU") && !sql.includes("G.*"))
        return new Response(
          JSON.stringify({ status: "0", statusMessage: "ORA-00904: ATIVO" }),
        );
      if (sql.includes("FROM TGFGRU"))
        return table(
          ["CODGRUPOPROD", "DESCRGRUPOPROD"],
          [[160201001, "CANECA"]],
        );
      if (sql.includes("FROM TGFPRO"))
        return table(
          ["CODPROD", "DESCRPROD", "REFFORN", "CODGRUPOPROD"],
          [
            [50, "CANECA", "WX7588", 160201001],
            [51, "PRATO", "WX1", 160201001],
          ],
        );
      return table(["X"], []);
    }) as typeof fetch);

    const samples = await loadSankhyaSample(2);
    const get = (key: string) => samples.find((s) => s.entity === key)!;

    expect(get("orders").records.map((r) => r.key)).toEqual(["900", "899"]);
    // Parceiros e itens só das 2 notas da amostra.
    expect(sqls.find((s) => s.includes("FROM TGFPAR"))).toContain(
      "IN (11, 12)",
    );
    expect(sqls.find((s) => s.includes("FROM TGFITE"))).toContain(
      "IN (900, 899)",
    );
    expect(get("orderItems").records).toHaveLength(2);
    expect(sqls.find((s) => s.includes("FROM TGFPRO"))).toContain(
      "IN (50, 51)",
    );
    // Casou pelo CNPJ com o cadastro do portal; o outro é novo.
    const partners = get("partners").records;
    expect(partners[0].match?.label).toContain("Fornecedor Teste");
    expect(partners[1].match).toBeNull();
    // Grupo: faltou ATIVO, refeito com *.
    expect(get("productGroups").missing).toEqual(["ATIVO"]);
    expect(get("productGroups").records).toHaveLength(1);
    expect(get("productGroups").sql).toContain("G.*");
    // Nenhum SQL de escrita.
    for (const sql of sqls)
      expect(() => sk.assertReadOnlySql(sql)).not.toThrow();
  });
});
