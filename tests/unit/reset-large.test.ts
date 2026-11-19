import { beforeAll, describe, expect, it } from "vitest";
import { withTempStore } from "./setup";

/*
 * Limpezas com o volume da produção (19/11/2026: a tela /app/settings/reset
 * estourava a memória da Vercel lendo pedidos, solicitações, histórico e
 * avisos inteiros). Base sintética grande: nenhuma prévia nem a limpeza dos
 * testes do portal pode ler linhas inteiras das tabelas grandes; só colunas
 * pedidas, por filtro ou pelos ids do que sai.
 */
withTempStore();

const { MemoryStore } = await import("@/lib/db/memory-store");
const { CachedStore } = await import("@/lib/db/cached-store");
const dir = process.env.DATA_DIR!;
// Sem gravar o JSON em disco a cada escrita (a base tem ~150 mil linhas).
const memory = new MemoryStore(dir, false);
(globalThis as { __wellmixStore?: unknown }).__wellmixStore = new CachedStore(
  memory,
);

const { getStore } = await import("@/lib/db");
const { seedDemo } = await import("@/lib/seed");
const portal = await import("@/lib/services/portal-test-reset");
const sales = await import("@/lib/services/data-reset");
const catalog = await import("@/lib/services/catalog-reset");
const { sweepTable } = await import("@/lib/services/reset-query");
type User = import("@/lib/db").User;

const ORDERS = 16_000;
const REQUIREMENTS_PER_ORDER = 6;
const HISTORY = 5_000;
// Cópia do registro do ERP: o peso que estourava a memória.
const ERP_COPY = { raw: "x".repeat(2_000) };

let admin: User;
const db = () =>
  (
    memory as unknown as {
      db: Record<string, Array<Record<string, unknown> & { id: string }>>;
    }
  ).db;
const t0 = new Date(Date.now() - 86_400_000).toISOString();
const row = (id: string, data: Record<string, unknown>) => ({
  id,
  createdAt: t0,
  updatedAt: t0,
  ...data,
});

beforeAll(async () => {
  const { users } = await seedDemo();
  admin = users.find((u) => u.email === "admin@wellmix.com")!;
  const d = db();
  for (let i = 0; i < ORDERS; i++) {
    d.requests.push(
      row(`erp-req-${i}`, {
        customerId: "cliente-joao",
        productName: "Produto",
        description: "",
        quantity: 1,
        unit: "un",
        status: "ORDERED",
        number: i + 1,
        orderId: `erp-order-${i}`,
      }),
    );
    d.orders.push(
      row(`erp-order-${i}`, {
        number: i + 1,
        requestId: `erp-req-${i}`,
        customerId: "cliente-joao",
        status: "IN_PRODUCTION",
        sankhyaCode: String(100_000 + i),
        sankhyaRefs: ERP_COPY,
      }),
    );
    for (let j = 0; j < REQUIREMENTS_PER_ORDER; j++)
      d.requirements.push(
        row(`erp-rq-${i}-${j}`, {
          orderId: `erp-order-${i}`,
          key: `k${j}`,
          status: "pending",
          held: j % 2 === 0,
        }),
      );
  }
  for (let i = 0; i < HISTORY; i++) {
    d.audit_log.push(
      row(`erp-audit-${i}`, {
        action: "order.update",
        entity: "order",
        entityId: `erp-order-${i}`,
        summary: "x".repeat(500),
      }),
    );
    d.notifications.push(
      row(`erp-note-${i}`, {
        userId: admin.id,
        channel: "in_app",
        subject: "Pedido",
        body: "x".repeat(500),
        link: `/app/orders/erp-order-${i}`,
        status: "sent",
      }),
    );
    d.documents.push(
      row(`erp-doc-${i}`, {
        orderId: `erp-order-${i}`,
        type: "bl",
        name: "bl.pdf",
        mime: "application/pdf",
        size: 1,
        storageKey: `erp-key-${i}`,
        version: 1,
        visibility: "internal",
      }),
    );
  }
  // Testes do portal: dois pedidos sem código (com requisitos, histórico,
  // aviso e documento) e uma solicitação solta.
  for (const n of [1, 2]) {
    d.orders.push(
      row(`test-order-${n}`, {
        number: 90_000 + n,
        customerId: "cliente-joao",
        status: "IN_PRODUCTION",
        sankhyaCode: null,
      }),
    );
    for (let j = 0; j < 3; j++)
      d.requirements.push(
        row(`test-rq-${n}-${j}`, {
          orderId: `test-order-${n}`,
          key: `k${j}`,
          status: "pending",
          held: false,
        }),
      );
    d.audit_log.push(
      row(`test-audit-${n}`, {
        action: "order.create",
        entity: "order",
        entityId: `test-order-${n}`,
        summary: "",
      }),
    );
    d.notifications.push(
      row(`test-note-${n}`, {
        userId: admin.id,
        channel: "in_app",
        subject: "Pedido de teste",
        body: "",
        link: `/app/orders/test-order-${n}?tab=x`,
        status: "sent",
      }),
    );
    d.documents.push(
      row(`test-doc-${n}`, {
        orderId: `test-order-${n}`,
        type: "bl",
        name: "bl.pdf",
        mime: "application/pdf",
        size: 1,
        storageKey: null,
        version: 1,
        visibility: "internal",
      }),
    );
  }
  d.requests.push(
    row("test-req", {
      customerId: "cliente-joao",
      productName: "Teste",
      description: "",
      quantity: 1,
      unit: "un",
      status: "NEW",
      number: 99_999,
    }),
  );
  d.counters.push(row("counter-req", { key: "request_number", value: 99_999 }));
});

const BIG = new Set([
  "orders",
  "requests",
  "requirements",
  "audit_log",
  "notifications",
  "documents",
]);

/** Lê o que as limpezas pedem ao store enquanto `fn` roda. */
async function watchReads(fn: () => Promise<unknown>) {
  const store = getStore();
  const fullRows: Array<{ table: string; rows: number }> = [];
  const columnReads: Array<{
    table: string;
    columns: readonly string[];
    filtered: boolean;
  }> = [];
  const list = store.list.bind(store);
  const listColumns = store.listColumns!.bind(store);
  store.list = (async (table: string, options?: object) => {
    const rows = await list(table as never, options as never);
    fullRows.push({ table, rows: rows.length });
    return rows;
  }) as typeof store.list;
  store.listColumns = (async (
    table: string,
    columns: readonly string[],
    options?: { filter?: object },
  ) => {
    columnReads.push({
      table,
      columns,
      filtered: !!options?.filter && Object.keys(options.filter).length > 0,
    });
    return listColumns(table as never, columns as never, options as never);
  }) as typeof store.listColumns;
  try {
    await fn();
  } finally {
    store.list = list;
    store.listColumns = listColumns;
  }
  return { fullRows, columnReads };
}

describe("limpezas com o volume da produção", () => {
  it("prévias sem ler linhas inteiras das tabelas grandes", async () => {
    const started = Date.now();
    const { fullRows, columnReads } = await watchReads(async () => {
      const p = await portal.planPortalTestReset(admin);
      expect(p.remove.orders).toBe(2);
      expect(p.remove.requests).toBe(1);
      expect(p.remove.requirements).toBe(6);
      expect(p.remove.audit_log).toBe(2);
      expect(p.remove.notifications).toBe(2);
      expect(p.remove.documents).toBe(2);
      const s = await sales.planSalesReset(admin);
      // Tudo de venda sai: pedidos, solicitações e requisitos (também os em
      // espera), avisos e o histórico deles.
      expect(s.remove.orders).toBe(ORDERS + 2);
      expect(s.remove.requests).toBe(ORDERS + 1);
      expect(s.total).toBeGreaterThan(ORDERS * REQUIREMENTS_PER_ORDER);
      const c = await catalog.planCatalogReset(admin);
      expect(c.salesLeft).toBeGreaterThan(0);
    });
    // Linha inteira de tabela grande: nunca.
    expect(fullRows.filter((r) => BIG.has(r.table) && r.rows > 10)).toEqual([]);
    // A cópia do ERP nunca é pedida.
    expect(columnReads.some((r) => r.columns.includes("sankhyaRefs"))).toBe(
      false,
    );
    expect(Date.now() - started).toBeLessThan(30_000);
  });

  it("a limpeza dos testes do portal busca só pelos ids do que sai", async () => {
    const { fullRows, columnReads } = await watchReads(async () => {
      const result = await portal.resetPortalTestData(admin, "APAGAR");
      expect(result.finished).toBe(true);
    });
    expect(fullRows.filter((r) => BIG.has(r.table) && r.rows > 10)).toEqual([]);
    // Sem filtro, nas tabelas grandes, só a coluna do link dos avisos.
    const unfiltered = columnReads.filter(
      (r) => BIG.has(r.table) && !r.filtered,
    );
    expect(unfiltered.map((r) => `${r.table}:${r.columns.join(",")}`)).toEqual(
      unfiltered.map(() => "notifications:link"),
    );

    const store = getStore();
    expect(await store.get("orders", "test-order-1")).toBeNull();
    expect(await store.get("requests", "test-req")).toBeNull();
    expect(await store.get("requirements", "test-rq-1-0")).toBeNull();
    expect(await store.get("audit_log", "test-audit-2")).toBeNull();
    expect(await store.get("notifications", "test-note-2")).toBeNull();
    expect(await store.get("documents", "test-doc-1")).toBeNull();
    // Do Sankhya: tudo fica.
    const d = db();
    expect(d.orders).toHaveLength(ORDERS);
    expect(d.requests).toHaveLength(ORDERS);
    expect(d.requirements).toHaveLength(ORDERS * REQUIREMENTS_PER_ORDER);
    expect(d.audit_log.filter((a) => a.id.startsWith("erp-"))).toHaveLength(
      HISTORY,
    );
    expect(d.notifications.filter((n) => n.id.startsWith("erp-"))).toHaveLength(
      HISTORY,
    );
    // A numeração das solicitações recomeça do 1 (dono, 19/11/2026).
    expect(d.counters.some((c) => c.key === "request_number")).toBe(false);
    expect((await portal.planPortalTestReset(admin)).total).toBe(0);
  });

  it("apaga a tabela de venda em páginas e deixa o que nasceu depois", async () => {
    const store = getStore();
    const d = db();
    for (let i = 0; i < 7; i++)
      d.ai_suggestions.push(row(`old-sug-${i}`, { kind: "x", status: "new" }));
    const startedAt = new Date().toISOString();
    d.ai_suggestions.push({
      ...row("new-sug", { kind: "x", status: "new" }),
      createdAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const finished = await sweepTable(
      "ai_suggestions",
      startedAt,
      (id) => store.remove("ai_suggestions", id),
      Infinity,
      3,
    );
    expect(finished).toBe(true);
    expect(d.ai_suggestions.map((s) => s.id)).toEqual(["new-sug"]);
  });
});
