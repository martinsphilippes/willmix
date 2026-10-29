import { describe, expect, it } from "vitest";
import { parentFor, recordVisit, screenUrl } from "@/components/back-button";

/* "Voltar": caminho das telas visitadas na aba e a tela mãe pelo menu. */
describe("voltar para a tela anterior", () => {
  it("avisos da própria tela (salvar, erro) não viram tela nova", () => {
    expect(screenUrl("/app/orders/1", "saved=1&at=123")).toBe("/app/orders/1");
    expect(screenUrl("/app/orders", "p=jarra&error=x")).toBe(
      "/app/orders?p=jarra",
    );
  });

  it("tela nova entra; a mesma tela com outro filtro só troca; voltar do navegador tira", () => {
    let stack: string[] = [];
    stack = recordVisit(stack, "/app/orders?p=jarra");
    stack = recordVisit(stack, "/app/orders/1");
    expect(stack).toEqual(["/app/orders?p=jarra", "/app/orders/1"]);
    // Recarregar depois de salvar: nada muda.
    expect(recordVisit(stack, "/app/orders/1")).toBe(stack);
    // Mesma tela, outro filtro: troca a última.
    expect(recordVisit(stack, "/app/orders/1?tab=x")).toEqual([
      "/app/orders?p=jarra",
      "/app/orders/1?tab=x",
    ]);
    // Voltar do navegador para a anterior: tira a última.
    expect(recordVisit(stack, "/app/orders?p=jarra")).toEqual([
      "/app/orders?p=jarra",
    ]);
  });

  it("sem tela anterior: a tela mãe mais específica do menu, senão o início", () => {
    const menu = [
      "/app",
      "/app/orders",
      "/app/requests",
      "/app/freight",
      "/app/freight/tariff",
    ];
    expect(parentFor("/app/orders/abc", menu)).toBe("/app/orders");
    expect(parentFor("/app/requests/batch/g1", menu)).toBe("/app/requests");
    expect(parentFor("/app/freight/tariff/x", menu)).toBe(
      "/app/freight/tariff",
    );
    expect(parentFor("/app/orders", menu)).toBe("/app");
    expect(parentFor("/app/quotes/q1", menu)).toBe("/app");
  });
});
