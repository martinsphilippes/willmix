import { describe, expect, it } from "vitest";
import {
  nextServerSort,
  parseServerPage,
  parseServerSort,
  serverTable,
  type ServerColumn,
} from "@/lib/server-table";

/*
 * Tabela paginada no servidor (auditoria de performance, 14/11/2026): as
 * listas de cadastro deixam de mandar todas as linhas ao navegador. Busca,
 * ordem e página seguem as regras da TableTools, sobre a lista inteira.
 */
interface Row {
  name: string;
  country: string | null;
  orders: number;
  value: string;
}

const columns: ServerColumn<Row>[] = [
  { key: "name", text: (r) => r.name },
  { key: "country", text: (r) => r.country ?? "—" },
  { key: "orders", text: (r) => String(r.orders) },
  { key: "value", text: (r) => r.value },
  { key: "actions", text: () => "", sortable: false },
];

const rows: Row[] = [
  { name: "Ação Têxtil", country: "Brasil", orders: 10, value: "R$ 1.234,56" },
  { name: "item 2", country: null, orders: 2, value: "R$ 10,00" },
  { name: "Item 10", country: "China", orders: 2, value: "—" },
  { name: "Bazar São José", country: "Brasil", orders: 0, value: "R$ 999,99" },
];

describe("tabela paginada no servidor", () => {
  it("busca todas as palavras, sem acento nem caixa, em todas as colunas", () => {
    const page = serverTable(rows, columns, { q: "acao brasil" });
    expect(page.rows.map((r) => r.name)).toEqual(["Ação Têxtil"]);
    expect(page.total).toBe(4);
    expect(page.matched).toBe(1);
    expect(serverTable(rows, columns, { q: "SAO jose" }).matched).toBe(1);
    expect(serverTable(rows, columns, { q: "nada disso" }).rows).toEqual([]);
  });

  it("ordena a lista inteira: texto com número natural, número, dinheiro; vazio no fim", () => {
    const by = (key: string, desc = false) =>
      serverTable(rows, columns, { sort: { key, desc } }).rows.map(
        (r) => r.name,
      );
    // Como na TableTools: "item 2" (prefixo curto e número) vale como número,
    // e número vem antes de texto.
    expect(by("name")).toEqual([
      "item 2",
      "Item 10",
      "Ação Têxtil",
      "Bazar São José",
    ]);
    // Vazio ("—") fica no fim nas duas direções.
    expect(by("country")).toEqual([
      "Ação Têxtil",
      "Bazar São José",
      "Item 10",
      "item 2",
    ]);
    expect(by("country", true).at(-1)).toBe("item 2");
    // Empate mantém a ordem original.
    expect(by("orders")).toEqual([
      "Bazar São José",
      "item 2",
      "Item 10",
      "Ação Têxtil",
    ]);
    expect(by("value", true)).toEqual([
      "Ação Têxtil",
      "Bazar São José",
      "item 2",
      "Item 10",
    ]);
  });

  it("páginas de 50 (ou o tamanho dado), com a faixa mostrada e página fora do fim na última", () => {
    const many = Array.from({ length: 123 }, (_, i) => ({
      name: `Cliente ${i + 1}`,
      country: "Brasil",
      orders: i,
      value: "—",
    }));
    const first = serverTable(many, columns, {});
    expect(first.rows).toHaveLength(50);
    expect([first.from, first.to, first.pages]).toEqual([1, 50, 3]);
    const last = serverTable(many, columns, { page: 99 });
    expect(last.page).toBe(2);
    expect([last.from, last.to]).toEqual([101, 123]);
    expect(last.rows.map((r) => r.name)).toEqual(
      many.slice(100).map((r) => r.name),
    );
    // A ordem vale antes da página: a primeira página tem os maiores.
    const desc = serverTable(many, columns, {
      sort: { key: "orders", desc: true },
      size: 10,
    });
    expect(desc.rows[0].name).toBe("Cliente 123");
  });

  it("endereço: ordem conhecida (e não a de coluna sem ordem), ciclo de 3 cliques e página base 1", () => {
    expect(parseServerSort("-orders", columns)).toEqual({
      key: "orders",
      desc: true,
    });
    expect(parseServerSort("actions", columns)).toBeNull();
    expect(parseServerSort("xyz", columns)).toBeNull();
    expect(nextServerSort(null, "name")).toBe("name");
    expect(nextServerSort({ key: "name", desc: false }, "name")).toBe("-name");
    expect(nextServerSort({ key: "name", desc: true }, "name")).toBeNull();
    expect(nextServerSort({ key: "name", desc: true }, "orders")).toBe(
      "orders",
    );
    expect(parseServerPage("3")).toBe(2);
    expect(parseServerPage("0")).toBe(0);
    expect(parseServerPage("abc")).toBe(0);
    expect(parseServerPage(undefined)).toBe(0);
  });
});
