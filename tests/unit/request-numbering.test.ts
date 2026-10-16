import { afterEach, describe, expect, it, vi } from "vitest";
import { planRequestNumbers } from "@/lib/request-numbering";

/* Numeração das solicitações antigas (sem número): ordem de criação, lote divide um número. */

const row = (
  id: string,
  createdAt: string,
  extra: { groupId?: string | null; number?: number | null } = {},
) => ({ id, createdAt, groupId: null, number: null, ...extra });

describe("planRequestNumbers", () => {
  it("nenhuma numerada: 1, 2, 3… na ordem de criação; o lote conta pela mais antiga e divide o número", () => {
    const plan = planRequestNumbers(
      [
        row("c", "2026-03-01T00:00:00Z"),
        row("a2", "2026-01-01T00:00:02Z", { groupId: "g1" }),
        row("b", "2026-02-01T00:00:00Z"),
        row("a1", "2026-01-01T00:00:01Z", { groupId: "g1" }),
      ],
      null,
    );
    expect(plan.updates).toEqual([
      { id: "a1", number: 1 },
      { id: "a2", number: 1 },
      { id: "b", number: 2 },
      { id: "c", number: 3 },
    ]);
    expect(plan.counter).toBe(3);
  });

  it("já há numeradas: as antigas continuam depois do maior número em uso, sem trocar nenhum", () => {
    const plan = planRequestNumbers(
      [
        row("velha", "2026-01-01T00:00:00Z"),
        row("nova", "2026-05-01T00:00:00Z", { number: 7 }),
      ],
      5,
    );
    expect(plan.updates).toEqual([{ id: "velha", number: 8 }]);
    expect(plan.counter).toBe(8);
  });

  it("produto do lote sem número herda o número do lote", () => {
    const plan = planRequestNumbers(
      [
        row("x1", "2026-01-01T00:00:00Z", { groupId: "g", number: 4 }),
        row("x2", "2026-01-01T00:00:01Z", { groupId: "g" }),
      ],
      4,
    );
    expect(plan.updates).toEqual([{ id: "x2", number: 4 }]);
    expect(plan.counter).toBe(4);
  });

  it("rodar de novo não muda nada; lista vazia mantém o contador", () => {
    const first = planRequestNumbers(
      [row("a", "2026-01-01T00:00:00Z"), row("b", "2026-01-02T00:00:00Z")],
      null,
    );
    const numbered = [
      row("a", "2026-01-01T00:00:00Z", { number: 1 }),
      row("b", "2026-01-02T00:00:00Z", { number: 2 }),
    ];
    expect(first.updates).toHaveLength(2);
    expect(planRequestNumbers(numbered, first.counter)).toEqual({
      updates: [],
      counter: 2,
    });
    expect(planRequestNumbers([], null)).toEqual({ updates: [], counter: 0 });
    expect(planRequestNumbers([], 9)).toEqual({ updates: [], counter: 9 });
  });
});

/* O script do botão "Publicar esquema Appwrite", contra um TablesDB falso. */
type FakeRow = Record<string, unknown> & { $id: string; $createdAt: string };
const db: Record<string, FakeRow[]> = {};
const calls: string[] = [];

vi.mock("node-appwrite", () => {
  const Query = {
    limit: (n: number) => JSON.stringify({ method: "limit", values: [n] }),
    cursorAfter: (id: string) =>
      JSON.stringify({ method: "cursorAfter", values: [id] }),
    equal: (attribute: string, value: unknown) =>
      JSON.stringify({ method: "equal", attribute, values: [value] }),
  };
  class Client {
    setEndpoint() {
      return this;
    }
    setProject() {
      return this;
    }
    setKey() {
      return this;
    }
  }
  class TablesDB {
    async listRows({
      tableId,
      queries,
    }: {
      tableId: string;
      queries: string[];
    }) {
      const q = queries.map((s) => JSON.parse(s));
      const limit = q.find((x) => x.method === "limit")?.values[0] ?? 25;
      const after = q.find((x) => x.method === "cursorAfter")?.values[0];
      let rows = [...(db[tableId] ?? [])];
      for (const f of q.filter((x) => x.method === "equal"))
        rows = rows.filter((r) => r[f.attribute] === f.values[0]);
      const start = after ? rows.findIndex((r) => r.$id === after) + 1 : 0;
      return { rows: rows.slice(start, start + limit) };
    }
    async updateRow({
      tableId,
      rowId,
      data,
    }: {
      tableId: string;
      rowId: string;
      data: Record<string, unknown>;
    }) {
      calls.push(`update ${tableId} ${rowId} ${JSON.stringify(data)}`);
      Object.assign(
        db[tableId].find((r) => r.$id === rowId)!,
        data,
      );
    }
    async createRow({
      tableId,
      rowId,
      data,
    }: {
      tableId: string;
      rowId: string;
      data: Record<string, unknown>;
    }) {
      calls.push(`create ${tableId} ${JSON.stringify(data)}`);
      (db[tableId] ??= []).push({
        $id: rowId,
        $createdAt: new Date().toISOString(),
        ...data,
      });
    }
  }
  return { Client, TablesDB, Query, ID: { unique: () => "counter-new" } };
});

describe("script appwrite-backfill-request-numbers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("numera as antigas (mais de uma página), cria o contador e não muda nada na 2ª vez", async () => {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", "http://appwrite.test/v1");
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test");
    vi.stubEnv("APPWRITE_API_KEY", "test-key");
    vi.spyOn(console, "log").mockImplementation(() => {});
    db.requests = Array.from({ length: 503 }, (_, i) => ({
      $id: `r${String(i).padStart(4, "0")}`,
      $createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      groupId: i < 2 ? "lote" : null,
      number: null,
    }));
    db.counters = [
      { $id: "c-order", $createdAt: "", key: "order_number", value: 9 },
    ];

    await import("../../scripts/appwrite-backfill-request-numbers.ts");
    expect(db.requests.slice(0, 3).map((r) => r.number)).toEqual([1, 1, 2]);
    expect(db.requests[502].number).toBe(502);
    expect(new Set(db.requests.map((r) => r.number)).size).toBe(502);
    expect(db.counters.find((c) => c.key === "request_number")?.value).toBe(
      502,
    );
    // Contador dos pedidos intacto.
    expect(db.counters.find((c) => c.key === "order_number")?.value).toBe(9);

    calls.length = 0;
    vi.resetModules();
    await import("../../scripts/appwrite-backfill-request-numbers.ts");
    expect(calls).toEqual([]);
  });
});
