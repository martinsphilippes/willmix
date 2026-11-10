import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Migração do Sankhya: códigos guardados (sankhyaRefs), locais de estoque,
 * saldos por local (só a diferença, idempotente), histórico de notas por
 * lotes e o que o portal envia ao incluir no Sankhya.
 */
withTempStore();

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const st = await import("@/lib/integrations/sankhya-settings");
const sk = await import("@/lib/integrations/sankhya-client");
const m = await import("@/lib/integrations/sankhya-mapping");
const sync = await import("@/lib/integrations/sankhya-sync");
const inv = await import("@/lib/services/inventory");
const { runFullLoad, resetFullLoad } =
  await import("@/lib/integrations/sankhya-full-load");
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

type Rows = Record<string, unknown>[];

/**
 * Sankhya falso: a tabela é a primeira depois de FROM; filtra pelas colunas
 * da linha que aparecem no SQL com IN (...), > n, <= n ou = n.
 */
function fakeSankhya(
  tables: Record<string, Rows>,
  keys: Record<string, string>,
) {
  const sqls: string[] = [];
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
    const name = /FROM (\w+)/.exec(sql)?.[1] ?? "";
    const rows = tables[name];
    if (!rows)
      return new Response(
        JSON.stringify({ status: "0", statusMessage: "tabela não existe" }),
      );
    const where = sql.split(/\bWHERE\b/)[1] ?? "";
    const outer = where.split(/\(SELECT/)[0];
    const filtered = rows.filter((r) =>
      Object.keys(r).every((col) => {
        const v = Number(r[col]);
        const inList = new RegExp(
          `\\b(?:\\w+\\.)?${col} IN \\(([\\d, -]+)\\)`,
        ).exec(outer);
        if (inList && !inList[1].split(",").map(Number).includes(v))
          return false;
        const gt = new RegExp(`\\b(?:\\w+\\.)?${col} > (\\d+)`).exec(outer);
        if (gt && !(v > Number(gt[1]))) return false;
        const le = new RegExp(`\\b(?:\\w+\\.)?${col} <= (\\d+)`).exec(outer);
        if (le && !(v <= Number(le[1]))) return false;
        const eq = new RegExp(`\\b(?:\\w+\\.)?${col} = (\\d+)\\b`).exec(outer);
        if (eq && v !== Number(eq[1])) return false;
        return true;
      }),
    );
    const reply = (columns: string[], data: unknown[][]) =>
      new Response(
        JSON.stringify({
          status: "1",
          responseBody: {
            fieldsMetadata: columns.map((n) => ({ name: n })),
            rows: data,
          },
        }),
      );
    if (sql.includes("NEXTCODE")) {
      const key = keys[name];
      const codes = filtered.map((r) => Number(r[key]));
      return reply(
        ["NEXTCODE", "REMAINING"],
        [[codes.length ? Math.min(...codes) : null, new Set(codes).size]],
      );
    }
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    return reply(
      columns,
      filtered.map((r) => columns.map((c) => r[c] ?? null)),
    );
  }) as typeof fetch);
  sk.resetSankhyaTokenCache();
  return sqls;
}

async function runAll(entity: Parameters<typeof runFullLoad>[1]) {
  let p = (await runFullLoad(admin, entity)).progress;
  for (let i = 0; i < 20 && !p.done; i++)
    p = (await runFullLoad(admin, entity)).progress;
  expect(p.done).toBe(true);
  return p;
}

describe("códigos do Sankhya", () => {
  it("guarda COD*, NU*, SEQUENCIA e endereço; ignora o resto e os vazios", () => {
    expect(
      m.refsOf({
        CODPARC: 31,
        CODCID: 7,
        NUNOTA: 950,
        SEQUENCIA: 2,
        CEP: "88300000",
        NOMEPARC: "NB",
        CODVEND: null,
        CODEND: " ",
      }),
    ).toEqual({
      CODPARC: 31,
      CODCID: 7,
      NUNOTA: 950,
      SEQUENCIA: 2,
      CEP: "88300000",
    });
    expect(m.isRefColumn("AD_INCOTERM")).toBe(false);
    expect(m.isRefColumn("codlocal")).toBe(true);
  });

  it("parceiro e produto do portal levam razão social, IE, endereço e marca ao Sankhya", () => {
    const erp = st.DEFAULT_SANKHYA_ERP;
    const values = sync.partnerValues(
      {
        name: "NB",
        legalName: "NINGBO HOME CO LTD",
        personType: "J",
        stateRegistration: "ISENTO",
        taxId: null,
        email: null,
        phone: null,
        active: true,
        type: "supplier",
        sankhyaRefs: { CODCID: 7, CODEND: 5, NUMEND: "88" },
      } as never,
      erp,
      "create",
      { CODCID: 9 },
    );
    expect(values).toMatchObject({
      RAZAOSOCIAL: "NINGBO HOME CO LTD",
      TIPPESSOA: "J",
      IDENTINSCESTAD: "ISENTO",
      CODCID: 9,
      CODEND: 5,
      NUMEND: "88",
      FORNECEDOR: "S",
    });
    expect(
      sync.productValues(
        { name: "X", brand: "WELLMIX", active: true } as never,
        null,
        erp,
        "create",
      ),
    ).toMatchObject({ MARCA: "WELLMIX" });
  });
});

describe("estoque por local", () => {
  it("locais, saldos (só a diferença) e o total por local no estoque", async () => {
    const store = getStore();
    const tables = {
      TGFLOC: [
        { CODLOCAL: 101, DESCRLOCAL: "CD ITAJAÍ", ATIVO: "S" },
        { CODLOCAL: 102, DESCRLOCAL: "AVARIAS", ATIVO: "S" },
      ],
      TGFEST: [
        { CODEMP: 3, CODPROD: 70, CODLOCAL: 101, ESTOQUE: 120, RESERVADO: 0 },
        { CODEMP: 3, CODPROD: 70, CODLOCAL: 102, ESTOQUE: 5, RESERVADO: 0 },
        { CODEMP: 3, CODPROD: 71, CODLOCAL: 101, ESTOQUE: 9, RESERVADO: 0 },
        { CODEMP: 1, CODPROD: 70, CODLOCAL: 101, ESTOQUE: 999, RESERVADO: 0 },
      ] as Rows,
    };
    const keys = { TGFLOC: "CODLOCAL", TGFEST: "CODPROD" };
    const product = await store.create("products", {
      ...(await import("@/lib/db")).PRODUCT_EXTRA_DEFAULTS,
      lineId: (await store.list("product_lines"))[0].id,
      name: "Taça",
      sku: "WX70",
      specification: null,
      active: true,
      sankhyaCode: "70",
    } as never);

    fakeSankhya(tables, keys);
    await resetFullLoad("stockLocations");
    await runAll("stockLocations");
    const locations = await store.list("stock_locations");
    expect(locations.map((l) => [l.code, l.name]).sort()).toEqual([
      [101, "CD ITAJAÍ"],
      [102, "AVARIAS"],
    ]);

    await resetFullLoad("stockBalances");
    const p = await runAll("stockBalances");
    // Produto 71 não foi carregado: pulado; empresa 1 fica de fora.
    expect(p.counts.skipped).toBe(1);
    let movements = await store.list("stock_movements", {
      filter: { productId: product.id },
    });
    expect(movements.map((x) => x.quantity).sort((a, b) => a - b)).toEqual([
      5, 120,
    ]);
    expect(
      movements.every((x) => x.kind === "sankhya_balance" && x.locationId),
    ).toBe(true);

    // De novo, com um saldo mudado: só a diferença.
    tables.TGFEST[0].ESTOQUE = 100;
    fakeSankhya(tables, keys);
    await resetFullLoad("stockBalances");
    await runAll("stockBalances");
    movements = await store.list("stock_movements", {
      filter: { productId: product.id },
    });
    expect(movements.map((x) => x.quantity).sort((a, b) => a - b)).toEqual([
      -20, 5, 120,
    ]);

    const row = inv.buildInventory({
      containers: [],
      containerItems: [],
      stockOrders: [],
      stockOrderItems: [],
      products: [],
      movements,
    })[0];
    const cd = locations.find((l) => l.code === 101)!;
    expect(row.brazil).toBe(105);
    expect(row.locations?.[cd.id]).toBe(100);
  });
});

describe("histórico de pedidos", () => {
  it("carrega as notas por lotes, com itens, títulos e os códigos do Sankhya", async () => {
    const store = getStore();
    const orders = Array.from({ length: 14 }, (_, i) => ({
      NUNOTA: 1000 + i * 3,
      NUMNOTA: 500 + i,
      CODEMP: 3,
      CODTIPOPER: 1101,
      CODPARC: 31,
      CODVEND: 7,
      CODNAT: 203005,
      DTNEG: "02/11/2026",
      VLRNOTA: 100,
    }));
    const tables: Record<string, Rows> = {
      TGFCAB: [
        ...orders,
        { NUNOTA: 1001, CODEMP: 3, CODTIPOPER: 9999, CODPARC: 31 },
      ],
      TGFPAR: [
        {
          CODPARC: 31,
          NOMEPARC: "NB HOME",
          FORNECEDOR: "S",
          CLIENTE: "N",
          ATIVO: "S",
          CODCID: 7,
        },
      ],
      TGFITE: orders.map((o) => ({
        NUNOTA: o.NUNOTA,
        SEQUENCIA: 1,
        CODPROD: 80,
        CODLOCALORIG: 101,
        DESCRPROD: "PRATO",
        QTDNEG: 10,
        CODVOL: "UN",
        VLRUNIT: 10,
      })),
      TGFPRO: [
        {
          CODPROD: 80,
          DESCRPROD: "PRATO",
          REFFORN: "WX80",
          MARCA: "WELLMIX",
          ATIVO: "S",
          CODGRUPOPROD: 5,
        },
      ],
      TGFGRU: [{ CODGRUPOPROD: 5, DESCRGRUPOPROD: "PRATOS", ATIVO: "S" }],
      TGFFIN: [
        {
          NUFIN: 9001,
          NUNOTA: 1000,
          RECDESP: -1,
          VLRDESDOB: 50,
          CODTIPTIT: 4,
          CODNAT: 203005,
        },
      ],
      TSIEMP: [{ CODEMP: 3, NOMEFANTASIA: "WELLMIX - SC" }],
    };
    fakeSankhya(tables, { TGFCAB: "NUNOTA" });
    await resetFullLoad("orders");
    const p = await runAll("orders");
    expect(p.counts.created).toBeGreaterThanOrEqual(14);

    const loaded = await store.list("orders");
    const fromSankhya = loaded.filter((o) => o.sankhyaCode);
    expect(fromSankhya).toHaveLength(14);
    const first = fromSankhya.find((o) => o.sankhyaCode === "1000")!;
    expect(first.sankhyaRefs).toMatchObject({
      CODEMP: 3,
      CODVEND: 7,
      CODNAT: 203005,
      NUMNOTA: 501 - 1,
    });
    const [item] = await store.list("order_items", {
      filter: { orderId: first.id },
    });
    expect(item).toMatchObject({ sankhyaCode: "1" });
    expect(item.sankhyaRefs).toMatchObject({ CODPROD: 80, CODLOCALORIG: 101 });
    const [payment] = await store.list("payments", {
      filter: { sankhyaCode: "9001" },
    });
    expect(payment.sankhyaRefs).toMatchObject({ CODTIPTIT: 4, NUNOTA: 1000 });
    const supplier = (await store.list("parties")).find(
      (x) => x.sankhyaCode === "31" && x.type === "supplier",
    )!;
    expect(supplier.sankhyaRefs).toMatchObject({ CODPARC: 31, CODCID: 7 });
    const [product] = await store.list("products", {
      filter: { sankhyaCode: "80" },
    });
    expect(product.brand).toBe("WELLMIX");

    // Rodar de novo não duplica.
    await resetFullLoad("orders");
    await runAll("orders");
    expect(
      (await store.list("orders")).filter((o) => o.sankhyaCode),
    ).toHaveLength(14);
  });
});
