import { beforeAll, describe, expect, it, vi } from "vitest";
import { withTempStore } from "./setup";

/*
 * Cópia bruta das views de pedido do Sankhya para análise (stage; dono,
 * 20/11/2026; docs/SANKHYA_PEDIDOS.md): páginas de 4.000 por NUNOTA e
 * SEQUENCIA, linhas como vêm, gravadas pela chave da origem (ler de novo não
 * duplica) e as ligações (TGFVAR) a partir dos cabeçalhos já copiados.
 */
withTempStore();

const PAGE = 4000;
const sankhya: {
  sql: string[];
  headers: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  saleItems: Array<Record<string, unknown>>;
} = { sql: [], headers: [], items: [], links: [], saleItems: [] };

const afterCursor = (sql: string, rows: Array<Record<string, unknown>>) => {
  const m =
    /\(?(?:V\.)?NUNOTA > (\d+)(?: OR \((?:V\.)?NUNOTA = \d+ AND (?:V\.)?SEQUENCIA > (\d+)\)\))?/.exec(
      sql,
    );
  const n = Number(m?.[1] ?? 0);
  const s = Number(m?.[2] ?? -1);
  return rows
    .filter(
      (r) =>
        Number(r.NUNOTA) > n ||
        (m?.[2] != null && Number(r.NUNOTA) === n && Number(r.SEQUENCIA) > s),
    )
    .slice(0, PAGE);
};

vi.mock("@/lib/integrations/sankhya-client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/lib/integrations/sankhya-client")
  >()),
  executeQuery: async (sql: string) => {
    sankhya.sql.push(sql);
    if (sql.includes("VW_AD_PEDCLIENTE_ITEM_WELL")) {
      const list = /NUNOTA IN \(([\d, -]+)\)/
        .exec(sql)![1]
        .split(",")
        .map(Number);
      const rows = sankhya.saleItems.filter((r) =>
        list.includes(Number(r.NUNOTA)),
      );
      return { columns: Object.keys(rows[0] ?? {}), rows };
    }
    if (sql.includes("FROM TGFVAR")) {
      const list = /V\.NUNOTA IN \(([\d, -]+)\)/
        .exec(sql)![1]
        .split(",")
        .map(Number);
      const rows = sankhya.links.filter(
        (l) =>
          list.includes(Number(l.NUNOTA)) ||
          list.includes(Number(l.NUNOTAORIG)),
      );
      return { columns: Object.keys(rows[0] ?? {}), rows };
    }
    const rows = sql.includes("VW_AD_PEDCOMPRA_ITEM_WELL")
      ? afterCursor(sql, sankhya.items)
      : afterCursor(sql, sankhya.headers);
    return { columns: Object.keys(rows[0] ?? {}), rows };
  },
}));

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const stage = await import("@/lib/integrations/sankhya-stage");
const { assertReadOnlySql } = await import("@/lib/integrations/sankhya-client");
type User = import("@/lib/db").User;

let admin: User;
beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
});

describe("SQL das páginas", () => {
  it("páginas de 4.000 depois do último NUNOTA e SEQUENCIA, só leitura", () => {
    const items = stage.stagePageSql("purchaseItems", 1538808, 13);
    expect(items).toContain(
      "SELECT TOP 4000 * FROM sankhya.VW_AD_PEDCOMPRA_ITEM_WELL",
    );
    expect(items).toContain(
      "(NUNOTA > 1538808 OR (NUNOTA = 1538808 AND SEQUENCIA > 13))",
    );
    expect(items).toContain("ORDER BY NUNOTA, SEQUENCIA");
    expect(stage.stagePageSql("purchaseHeaders", 0, 0)).toContain(
      "WHERE NUNOTA > 0 ORDER BY NUNOTA",
    );
    // Itens de venda: pela lista de pedidos no IN (sem OR na view inteira).
    expect(stage.saleItemsSql([9, 7, 9])).toBe(
      "SELECT * FROM sankhya.VW_AD_PEDCLIENTE_ITEM_WELL WHERE NUNOTA IN (9, 7) ORDER BY NUNOTA, SEQUENCIA",
    );
    expect(() => assertReadOnlySql(stage.saleItemsSql([1]))).not.toThrow();
    // Ligações com a lista de números no IN, sem subconsulta.
    const links = stage.stageLinksSql([5, 3, 5]);
    expect(links).toContain("V.NUNOTA IN (5, 3) OR V.NUNOTAORIG IN (5, 3)");
    expect(links).not.toMatch(/IN \(SELECT/);
    for (const d of [
      "purchaseHeaders",
      "purchaseItems",
      "saleHeaders",
    ] as const)
      expect(() =>
        assertReadOnlySql(stage.stagePageSql(d, 1, 1)),
      ).not.toThrow();
    expect(() => assertReadOnlySql(links)).not.toThrow();
  });

  it("página cheia de ligações não corta um item no meio", () => {
    const rows = [
      ...Array.from({ length: PAGE - 2 }, (_, i) => ({
        NUNOTA: 1,
        SEQUENCIA: i + 1,
        NUNOTAORIG: 9,
        SEQUENCIAORIG: 1,
      })),
      { NUNOTA: 2, SEQUENCIA: 1, NUNOTAORIG: 7, SEQUENCIAORIG: 1 },
      { NUNOTA: 2, SEQUENCIA: 1, NUNOTAORIG: 8, SEQUENCIAORIG: 1 },
    ];
    const page = stage.cutPage("purchaseLinks", rows);
    expect(page.rows).toHaveLength(PAGE - 2);
    expect(page).toMatchObject({ nunota: 1, seq: PAGE - 2, done: false });
  });
});

describe("cópia", () => {
  it("cabeçalhos e itens em páginas, sem duplicar; ligações a partir dos cabeçalhos", async () => {
    sankhya.headers = Array.from({ length: 4500 }, (_, i) => ({
      NUNOTA: 1000 + i,
      CODTIPOPER: i % 2 ? 1101 : 1102,
      PEDIDO_PENDENTE: i === 4499 ? "S" : "N",
      NUMERO_IMPORTACAO: null,
      DESCRICAO_TOP: "  (IMP) PEDIDO DE COMPRA ",
    }));
    sankhya.items = Array.from({ length: 9 }, (_, i) => ({
      NUNOTA: 1000 + Math.floor(i / 3),
      SEQUENCIA: (i % 3) + 1,
      CODPROD: 50 + i,
      QTD_NEGOCIADA: 10,
    }));
    sankhya.links = [
      {
        NUNOTA: 1001,
        SEQUENCIA: 1,
        NUNOTAORIG: 1000,
        SEQUENCIAORIG: 1,
        QTDATENDIDA: 10,
        TOP_DESTINO: 1101,
        TOP_ORIGEM: 1100,
      },
      {
        NUNOTA: 1002,
        SEQUENCIA: 1,
        NUNOTAORIG: 1001,
        SEQUENCIAORIG: 1,
        QTDATENDIDA: 10,
        TOP_DESTINO: 1102,
        TOP_ORIGEM: 1101,
      },
    ];
    const store = getStore();

    const first = await stage.runStageLoad(admin, "purchaseHeaders", 0);
    expect(first).toMatchObject({ done: false, after: 1000 + PAGE - 1 });
    const end = await stage.runStageLoad(admin, "purchaseHeaders", 60_000);
    expect(end.done).toBe(true);
    let rows = await store.list("sankhya_stage_rows", {
      filter: { dataset: "purchaseHeaders" },
    });
    expect(rows).toHaveLength(4500);
    const last = rows.find((r) => r.nunota === 5499)!;
    // Como veio, sem os vazios e com o texto aparado.
    expect(last.row).toEqual({
      NUNOTA: 5499,
      CODTIPOPER: 1101,
      PEDIDO_PENDENTE: "S",
      DESCRICAO_TOP: "(IMP) PEDIDO DE COMPRA",
    });

    expect(
      (await stage.runStageLoad(admin, "purchaseItems", 60_000)).done,
    ).toBe(true);
    const items = await store.list("sankhya_stage_rows", {
      filter: { dataset: "purchaseItems" },
    });
    expect(items.map((r) => r.rowKey).sort()).toContain("1001:2");
    expect(items).toHaveLength(9);

    const links = await stage.runStageLoad(admin, "purchaseLinks", 60_000);
    expect(links.done).toBe(true);
    const linkRows = await store.list("sankhya_stage_rows", {
      filter: { dataset: "purchaseLinks" },
    });
    expect(linkRows.map((r) => r.rowKey).sort()).toEqual([
      "1001:1:1000:1",
      "1002:1:1001:1",
    ]);
    expect(linkRows[0].row).toMatchObject({ TOP_ORIGEM: expect.any(Number) });

    // Recomeçar e ler de novo: mesmas linhas, sem duplicar.
    const { resetFullLoad } =
      await import("@/lib/integrations/sankhya-full-load");
    await resetFullLoad("stagePurchaseHeaders");
    await stage.runStageLoad(admin, "purchaseHeaders", 60_000);
    rows = await store.list("sankhya_stage_rows", {
      filter: { dataset: "purchaseHeaders" },
    });
    expect(rows).toHaveLength(4500);
  });
});

describe("itens de venda", () => {
  it("escolhe os pedidos pendentes ou alterados em 90 dias", () => {
    const now = Date.UTC(2026, 10, 20, 12);
    const t = stage.saleItemTargets(
      [
        { nunota: 3, row: { PEDIDO_PENDENTE: "S", QTD_ITENS: 4 } },
        { nunota: 1, row: { QTD_ITENS_PENDENTES: 2, QTD_ITENS: 2 } },
        {
          nunota: 2,
          row: { DATA_ALTERACAO_PEDIDO: "01102026 10:00:00", QTD_ITENS: 5 },
        },
        {
          nunota: 4,
          row: { DATA_ALTERACAO_PEDIDO: "31122024 09:22:28", QTD_ITENS: 9 },
        },
      ],
      now,
    );
    expect(t).toEqual([
      [1, 2],
      [2, 5],
      [3, 4],
    ]);
    expect(stage.stageTime("31122024 09:22:28")).toBe(
      Date.UTC(2024, 11, 31, 9, 22, 28),
    );
  });

  it("copia os itens dos pedidos escolhidos a partir dos cabeçalhos de venda", async () => {
    const store = getStore();
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const recent = `${pad(today.getUTCDate())}${pad(today.getUTCMonth() + 1)}${today.getUTCFullYear()} 08:00:00`;
    for (const [n, r] of [
      [9001, { PEDIDO_PENDENTE: "S", QTD_ITENS: 2 }],
      [
        9002,
        { PEDIDO_PENDENTE: "N", DATA_ALTERACAO_PEDIDO: recent, QTD_ITENS: 1 },
      ],
      [
        9003,
        {
          PEDIDO_PENDENTE: "N",
          DATA_ALTERACAO_PEDIDO: "01012021 08:00:00",
          QTD_ITENS: 3,
        },
      ],
    ] as const)
      await store.create("sankhya_stage_rows", {
        id: `saleHeaders:${n}`,
        dataset: "saleHeaders",
        rowKey: String(n),
        nunota: n,
        runId: null,
        row: { NUNOTA: n, ...r },
        loadedAt: new Date().toISOString(),
      });
    sankhya.saleItems = [
      { NUNOTA: 9001, SEQUENCIA: 1, ITEM_PENDENTE: "S" },
      { NUNOTA: 9001, SEQUENCIA: 2, ITEM_PENDENTE: "N" },
      { NUNOTA: 9002, SEQUENCIA: 1, ITEM_PENDENTE: "N" },
      { NUNOTA: 9003, SEQUENCIA: 1, ITEM_PENDENTE: "N" },
    ];
    const run = await stage.runStageLoad(admin, "saleItems", 60_000);
    expect(run.done).toBe(true);
    const rows = await store.list("sankhya_stage_rows", {
      filter: { dataset: "saleItems" },
    });
    expect(rows.map((r) => r.rowKey).sort()).toEqual([
      "9001:1",
      "9001:2",
      "9002:1",
    ]);

    // Ligações das vendas: a partir dos pedidos escolhidos nos itens.
    sankhya.links = [
      {
        NUNOTA: 9001,
        SEQUENCIA: 1,
        NUNOTAORIG: 8001,
        SEQUENCIAORIG: 1,
        TOP_ORIGEM: 111,
        TOP_DESTINO: 61,
      },
      {
        NUNOTA: 9500,
        SEQUENCIA: 1,
        NUNOTAORIG: 9002,
        SEQUENCIAORIG: 1,
        TOP_ORIGEM: 61,
        TOP_DESTINO: 3,
      },
      {
        NUNOTA: 9600,
        SEQUENCIA: 1,
        NUNOTAORIG: 9003,
        SEQUENCIAORIG: 1,
        TOP_ORIGEM: 61,
        TOP_DESTINO: 3,
      },
    ];
    expect((await stage.runStageLoad(admin, "saleLinks", 60_000)).done).toBe(
      true,
    );
    const saleLinks = await store.list("sankhya_stage_rows", {
      filter: { dataset: "saleLinks" },
    });
    expect(saleLinks.map((r) => r.rowKey).sort()).toEqual([
      "9001:1:8001:1",
      "9500:1:9002:1",
    ]);
  });
});
