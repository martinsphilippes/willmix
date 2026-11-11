import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Carga completa dos cadastros do Sankhya (lotes por faixa de código, com
 * cursor) e moeda dos pedidos da amostra (USD pelo câmbio do pedido).
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const st = await import("@/lib/integrations/sankhya-settings");
const sk = await import("@/lib/integrations/sankhya-client");
const { runFullLoad, getFullLoadProgress, resetFullLoad } =
  await import("@/lib/integrations/sankhya-full-load");
const { importSankhyaSet } = await import("@/lib/integrations/sankhya-import");
type User = import("@/lib/db").User;

let admin: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  await st.saveSankhyaCredentials(
    {
      environment: "production",
      clientId: "c",
      clientSecret: "s",
      xToken: "x",
    },
    "admin",
  );
});
afterEach(() => vi.unstubAllGlobals());

/** Sankhya falso: tabelas em memória, responde MIN/COUNT e faixas de código. */
function fakeSankhya(
  tables: Record<string, { key: string; rows: Record<string, unknown>[] }>,
) {
  const sqls: string[] = [];
  const reply = (columns: string[], rows: unknown[][]) =>
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
    const name = Object.keys(tables).find((t) => sql.includes(`FROM ${t}`))!;
    const { key, rows } = tables[name];
    const filtered = rows.filter((r) => {
      if (name === "TGFPAR" && !(r.FORNECEDOR === "S" || r.CLIENTE === "S"))
        return false;
      const k = Number(r[key]);
      const gt = new RegExp(`${key} > (\\d+)`).exec(sql);
      const le = new RegExp(`${key} <= (\\d+)`).exec(sql);
      const inList = new RegExp(`${key} IN \\(([\\d, -]+)\\)`).exec(sql);
      if (gt && !(k > Number(gt[1]))) return false;
      if (le && !(k <= Number(le[1]))) return false;
      if (inList && !inList[1].split(",").map(Number).includes(k)) return false;
      return true;
    });
    if (sql.includes("NEXTCODE")) {
      const keys = filtered.map((r) => Number(r[key]));
      return reply(
        ["NEXTCODE", "REMAINING"],
        [[keys.length ? Math.min(...keys) : null, keys.length]],
      );
    }
    const columns = Object.keys(rows[0] ?? {});
    return reply(
      columns,
      filtered.map((r) => columns.map((c) => r[c] ?? null)),
    );
  }) as typeof fetch);
  return sqls;
}

describe("carga completa", () => {
  it("parceiros: lotes, cursor, fornecedor e cliente no mesmo CODPARC", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      CODPARC: (i + 1) * 100, // códigos espaçados: a faixa pula os buracos
      NOMEPARC: `Parceiro ${i + 1}`,
      CGC_CPF: null,
      FORNECEDOR: i % 3 === 0 ? "S" : "N",
      CLIENTE: i % 2 === 0 ? "S" : "N",
      ATIVO: "S",
    }));
    rows.push({
      CODPARC: 99999,
      NOMEPARC: "Funcionário",
      CGC_CPF: null,
      FORNECEDOR: "N",
      CLIENTE: "N",
      ATIVO: "S",
    });
    fakeSankhya({ TGFPAR: { key: "CODPARC", rows } });
    sk.resetSankhyaTokenCache();
    await resetFullLoad("partners");

    // Orçamento curto: para no meio e guarda o cursor.
    const first = await runFullLoad(admin, "partners", 1);
    expect(first.progress.done).toBe(false);
    expect(first.progress.after).toBeGreaterThan(0);
    let progress = first.progress;
    for (let i = 0; i < 20 && !progress.done; i++)
      progress = (await runFullLoad(admin, "partners", 1)).progress;
    expect(progress.done).toBe(true);

    // A Wellmix SC da demonstração (comprador dos pedidos de compra) já nasce
    // com o código do Sankhya e não vem desta carga.
    const parties = (await getStore().list("parties")).filter(
      (p) => p.sankhyaCode && p.id !== "wellmix-sc",
    );
    const suppliers = parties.filter((p) => p.type === "supplier");
    const customers = parties.filter((p) => p.type === "customer");
    expect(suppliers).toHaveLength(10); // i = 0, 3, …, 27
    expect(customers).toHaveLength(15); // i = 0, 2, …, 28
    // CODPARC 100 é fornecedor e cliente: dois cadastros com o mesmo código.
    expect(
      parties
        .filter((p) => p.sankhyaCode === "100")
        .map((p) => p.type)
        .sort(),
    ).toEqual(["customer", "supplier"]);
    expect(parties.some((p) => p.name === "Funcionário")).toBe(false);

    // Rodar de novo (recomeçar) atualiza, não duplica.
    await resetFullLoad("partners");
    const again = await runFullLoad(admin, "partners", 60_000);
    expect(again.progress.done).toBe(true);
    expect(again.progress.counts.created ?? 0).toBe(0);
    expect(
      (await getStore().list("parties")).filter(
        (p) => p.sankhyaCode && p.id !== "wellmix-sc",
      ),
    ).toHaveLength(25);
    expect((await getFullLoadProgress("partners")).done).toBe(true);
  });

  it("produtos com grupos (linhas), EAN e SKU; condições de pagamento", async () => {
    const sqls = fakeSankhya({
      TGFPRO: {
        key: "CODPROD",
        rows: [
          {
            CODPROD: 50,
            DESCRPROD: "CANECA 300ML",
            REFFORN: "WX7588",
            REFERENCIA: "7899527157747",
            CODGRUPOPROD: 160201001,
            NCM: "69120000",
            ALTURA: 0.082,
            ATIVO: "S",
          },
          {
            CODPROD: 51,
            DESCRPROD: "PRATO",
            REFFORN: "WX1",
            REFERENCIA: null,
            CODGRUPOPROD: 160201001,
            ATIVO: "N",
          },
        ],
      },
      TGFGRU: {
        key: "CODGRUPOPROD",
        rows: [
          { CODGRUPOPROD: 160201001, DESCRGRUPOPROD: "CANECA", ATIVO: "S" },
        ],
      },
      TGFTPV: {
        key: "CODTIPVENDA",
        rows: [
          { CODTIPVENDA: 33, DESCRTIPVENDA: "IMPORTAÇÃO" },
          { CODTIPVENDA: 111, DESCRTIPVENDA: "30% ANT 70% 30 DAYS AFTER SHIP" },
        ],
      },
    });
    sk.resetSankhyaTokenCache();
    await resetFullLoad("products");
    expect((await runFullLoad(admin, "products", 60_000)).progress.done).toBe(
      true,
    );
    const [caneca] = await getStore().list("products", {
      filter: { sankhyaCode: "50" },
    });
    expect(caneca).toMatchObject({
      sku: "WX7588",
      ean: "7899527157747",
      ncm: "69120000",
      heightCm: 8.2,
      active: true,
    });
    const line = await getStore().get("product_lines", caneca.lineId);
    expect(line).toMatchObject({ name: "CANECA", sankhyaCode: "160201001" });
    const [prato] = await getStore().list("products", {
      filter: { sankhyaCode: "51" },
    });
    expect(prato.active).toBe(false);

    await resetFullLoad("paymentConditions");
    expect(
      (await runFullLoad(admin, "paymentConditions", 60_000)).progress.done,
    ).toBe(true);
    const conditions = await getStore().list("payment_conditions");
    expect(conditions.map((c) => [c.code, c.name, c.source]).sort()).toEqual([
      [111, "30% ANT 70% 30 DAYS AFTER SHIP", "sankhya"],
      [33, "IMPORTAÇÃO", "sankhya"],
    ]);
    for (const sql of sqls)
      expect(() => sk.assertReadOnlySql(sql)).not.toThrow();
  });
});

describe("moeda dos pedidos da amostra", () => {
  it("com câmbio no pedido: USD = VLRNOTA ÷ VLRMOEDA; vínculo pelo NUNOTA e número pelo NUMNOTA", async () => {
    const erp = {
      ...st.DEFAULT_SANKHYA_ERP,
      erpNumberField: "NUMNOTA" as const,
    };
    const lines = await importSankhyaSet(
      admin,
      {
        orders: [
          {
            NUNOTA: 7001,
            NUMNOTA: 4321,
            CODEMP: 3,
            CODTIPOPER: 1101,
            CODPARC: 100,
            DTNEG: "10/11/2026",
            VLRNOTA: 5160,
            VLRMOEDA: 5.16,
          },
        ],
        partners: [
          {
            CODPARC: 100,
            NOMEPARC: "Parceiro 1",
            FORNECEDOR: "S",
            CLIENTE: "S",
          },
        ],
        items: [
          {
            NUNOTA: 7001,
            SEQUENCIA: 1,
            CODPROD: 50,
            DESCRPROD: "CANECA 300ML",
            QTDNEG: 1000,
            CODVOL: "UN",
            VLRUNIT: 5.16,
          },
        ],
        products: [
          {
            CODPROD: 50,
            DESCRPROD: "CANECA 300ML",
            REFFORN: "WX7588",
            CODGRUPOPROD: 160201001,
          },
        ],
        groups: [],
        financial: [],
        companies: [{ CODEMP: 3, NOMEFANTASIA: "WELLMIX - SC" }],
      },
      erp,
    );
    const order = await getStore().get(
      "orders",
      lines.find((l) => l.entity === "orders")!.id!,
    );
    expect(order).toMatchObject({
      fobTotal: 1000,
      fobCurrency: "USD",
      erpNumber: "4321",
      sankhyaCode: "7001",
    });
    const [item] = await getStore().list("order_items", {
      filter: { orderId: order!.id },
    });
    expect(item.unitPrice).toBe(1);
    // O fornecedor da nota reaproveita o cadastro da carga completa (mesmo código).
    expect(lines.find((l) => l.entity === "partners")?.outcome).toBe(
      "existing",
    );
  });
});
