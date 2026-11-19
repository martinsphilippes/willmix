import { describe, expect, it } from "vitest";
import {
  LIST_RETURN_FRESH_MS,
  isFresh,
  parseListReturn,
  parseTableView,
} from "@/lib/list-return";

/*
 * Volta para a lista como ela estava (dono, 19/11/2026;
 * docs/ORDER_LEVEL_LISTS.md, seção 7): o que a aba guardou só vale para o
 * endereço da própria lista, por 30 minutos, com números válidos.
 */

const saved = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    url: "/app/requests?situ=draft&q=boneca",
    y: 758.4,
    at: 1_000,
    table: { query: "Loja", sort: { column: 15, desc: true }, page: 1 },
    ...over,
  });

describe("volta para a lista", () => {
  it("lê o endereço, a rolagem e a vista da tabela guardados", () => {
    expect(parseListReturn(saved(), "/app/requests")).toEqual({
      url: "/app/requests?situ=draft&q=boneca",
      y: 758,
      at: 1_000,
      table: { query: "Loja", sort: { column: 15, desc: true }, page: 1 },
    });
    expect(
      parseListReturn(saved({ url: "/app/requests" }), "/app/requests")?.url,
    ).toBe("/app/requests");
  });

  it("só o endereço da própria lista (nunca outro caminho ou outro site)", () => {
    for (const url of [
      "/app/requestsX",
      "/app/orders?situ=draft",
      "https://example.com/app/requests",
      "//example.com/app/requests",
      "",
      42,
    ])
      expect(parseListReturn(saved({ url }), "/app/requests")).toBeNull();
    expect(parseListReturn("{nao é json", "/app/requests")).toBeNull();
    expect(parseListReturn(null, "/app/requests")).toBeNull();
  });

  it("valores estranhos viram o padrão (rolagem 0, página 0, sem ordem)", () => {
    const out = parseListReturn(
      saved({
        y: -5,
        table: { query: 3, sort: { column: "x", desc: 1 }, page: -2 },
      }),
      "/app/requests",
    );
    expect(out?.y).toBe(0);
    expect(out?.table).toEqual({ query: "", sort: null, page: 0 });
    expect(parseTableView(null)).toBeNull();
    expect(
      parseTableView({ query: "a".repeat(500), sort: null, page: 2.5 }),
    ).toEqual({ query: "a".repeat(200), sort: null, page: 0 });
  });

  it("vale por 30 minutos", () => {
    const item = parseListReturn(saved(), "/app/requests")!;
    expect(isFresh(item, 1_000 + LIST_RETURN_FRESH_MS - 1)).toBe(true);
    expect(isFresh(item, 1_000 + LIST_RETURN_FRESH_MS)).toBe(false);
    // Relógio voltou (outro fuso, ajuste): não vale.
    expect(isFresh(item, 999)).toBe(false);
  });
});
