import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

/*
 * Aplicativo (PWA, docs/PWA.md): o manifesto deixa o portal instalável e o
 * service worker só guarda arquivos públicos, nunca dados do portal.
 */
describe("aplicativo (PWA)", () => {
  it("manifesto: instalável, em janela própria, com ícones e atalhos", () => {
    const m = manifest();
    expect([m.display, m.start_url, m.scope]).toEqual([
      "standalone",
      "/app",
      "/",
    ]);
    const sizes = (m.icons ?? []).map((i) => `${i.sizes}:${i.purpose ?? ""}`);
    expect(sizes).toEqual(["192x192:", "512x512:", "512x512:maskable"]);
    for (const icon of m.icons ?? [])
      expect(() => readFileSync(`public${icon.src}`)).not.toThrow();
    expect((m.shortcuts ?? []).map((s) => s.url)).toEqual([
      "/app/tasks",
      "/app/orders",
      "/app/notifications",
    ]);
  });

  it("service worker: guarda só arquivos públicos e tem a tela sem conexão", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    // Só arquivos do aplicativo e da marca entram no aparelho.
    expect(sw).toContain('url.pathname.startsWith("/_next/static/")');
    expect(sw).toContain('url.pathname.startsWith("/brand/")');
    // Nada de páginas, API ou arquivos do portal guardados.
    expect(sw).not.toMatch(/\/api\/|\/app\//);
    expect(sw).toContain('request.method !== "GET"');
    const offline = readFileSync("public/offline.html", "utf8");
    expect(offline).toContain("Sem conexão com a internet");
    // A tela sem conexão não depende de nada além do logotipo já guardado.
    expect(offline).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
  });
});
