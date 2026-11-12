import { describe, expect, it, vi } from "vitest";
import { indexBy, listByIds } from "@/lib/db/lookup";
import { tableSql } from "@/lib/db/supabase-sql";
import type { Store } from "@/lib/db/store";

describe("leitura só do que a tela usa", () => {
  it("listByIds: sem repetidos e sem vazios; lista vazia não consulta", async () => {
    const list = vi.fn(async () => [{ id: "a" }]);
    const store = { list } as unknown as Store;
    expect(await listByIds(store, "parties", [null, undefined, ""])).toEqual(
      [],
    );
    expect(list).not.toHaveBeenCalled();
    await listByIds(store, "parties", ["a", null, "b", "a"]);
    expect(list).toHaveBeenCalledWith("parties", {
      filter: { id: ["a", "b"] },
    });
  });

  it("indexBy fica com a primeira linha de cada valor (como o find)", () => {
    const rows = [
      { orderId: "o1", name: "primeiro" },
      { orderId: "o2", name: "outro" },
      { orderId: "o1", name: "segundo" },
    ];
    const map = indexBy(rows, "orderId");
    expect(map.get("o1")?.name).toBe("primeiro");
    expect(map.get("o2")?.name).toBe("outro");
    expect(map.size).toBe(2);
  });

  it("esquema: índice na ordem das listas (criação e nome, com o id)", () => {
    const sql = tableSql("parties");
    expect(sql).toContain(
      `create index if not exists "parties_created_id" on public."parties" ("createdAt", "id");`,
    );
    expect(sql).toContain(
      `create index if not exists "parties_name_id" on public."parties" ("name", "id");`,
    );
    expect(tableSql("stages")).not.toContain("name_id");
  });
});

describe("leitura só das colunas usadas", () => {
  it("sem listColumns no store, recorta a linha inteira", async () => {
    const { listColumns, columnsExcept } = await import("@/lib/db/lookup");
    const store = {
      list: vi.fn(async () => [
        {
          id: "1",
          createdAt: "a",
          updatedAt: "b",
          name: "X",
          sankhyaRefs: { big: 1 },
        },
      ]),
    } as unknown as Store;
    expect(await listColumns(store, "order_items", ["name"])).toEqual([
      { id: "1", createdAt: "a", updatedAt: "b", name: "X" },
    ]);
    expect(columnsExcept("orders", ["sankhyaRefs"])).not.toContain(
      "sankhyaRefs",
    );
    expect(columnsExcept("orders", ["sankhyaRefs"])).toContain("customerId");
  });

  it("filtro em memória: lista de valores e vazio como no banco", async () => {
    const { rowMatcher } = await import("@/lib/db/store");
    const match = rowMatcher<{ id: string; x?: string | null }>({
      id: ["a", "b"],
      x: null,
    });
    expect(match({ id: "a" })).toBe(true);
    expect(match({ id: "a", x: "v" })).toBe(false);
    expect(match({ id: "c" })).toBe(false);
  });
});

describe("busca por nome (campo de cliente/fornecedor)", () => {
  it("tira os curingas do LIKE e do PostgREST e ignora caixa e acento", async () => {
    const { searchText, matchesSearch } = await import("@/lib/db/store");
    expect(searchText(" 50%_off*, (x) ")).toBe("50 off x");
    const search = { column: "name" as const, text: "joao" };
    expect(matchesSearch({ name: "Loja do João Ltda" }, search)).toBe(true);
    expect(matchesSearch({ name: "Outra" }, search)).toBe(false);
    expect(matchesSearch({ name: null }, search)).toBe(false);
  });
});
