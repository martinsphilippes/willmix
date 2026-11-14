import { describe, expect, it } from "vitest";
import { routeHandlerHref } from "@/components/ui";

/*
 * Auditoria de performance (14/11/2026): link para rota de API ou de
 * exportação não pré-carrega. O pré-carregamento do Next executava a rota
 * (baixava o arquivo, montava a exportação) a cada abertura da tela.
 */
describe("links que não pré-carregam", () => {
  it("arquivos, APIs e exportações", () => {
    for (const href of [
      "/api/files/abc",
      "/api/orders/o1/artwork",
      "/app/customers/export",
      "/app/customers/export?q=jo%C3%A3o&status=all",
      "/app/suppliers/s1/orders/o1/export",
      "/app/products/export#x",
      { pathname: "/api/files/abc" },
    ])
      expect(routeHandlerHref(href)).toBe(true);
  });

  it("telas continuam pré-carregando", () => {
    for (const href of [
      "/app/customers",
      "/app/orders/o1",
      "/app/exports-history",
      "/app/parties?type=export",
      { pathname: "/app/orders" },
    ])
      expect(routeHandlerHref(href)).toBe(false);
  });
});
