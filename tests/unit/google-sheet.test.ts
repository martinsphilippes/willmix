import { describe, expect, it } from "vitest";
import { xlsxBytes } from "./xlsx-fixture";

/*
 * Planilha do Google Sheets pelo link: baixada em .xlsx pelo endereço de
 * exportação quando está compartilhada com o link; sem isso, o Google devolve
 * a página de login e o portal explica.
 */
const gs = await import("@/lib/services/google-sheet");

const ID = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms";
const LINK = `https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`;

const respond = (
  body: Uint8Array | string,
  init: { status?: number; type?: string; url?: string; disposition?: string } = {},
): typeof fetch => {
  return (async (input) => {
    const headers = new Headers();
    headers.set("content-type", init.type ?? "application/octet-stream");
    if (init.disposition) headers.set("content-disposition", init.disposition);
    const res = new Response(typeof body === "string" ? body : new Uint8Array(body), {
      status: init.status ?? 200,
      headers,
    });
    Object.defineProperty(res, "url", { value: init.url ?? String(input) });
    return res;
  }) as typeof fetch;
};

describe("link do Google Sheets", () => {
  it("reconhece o id no link (edit, compartilhamento, gid) e recusa outros endereços", () => {
    expect(gs.googleSheetId(LINK)).toBe(ID);
    expect(gs.googleSheetId(`https://docs.google.com/spreadsheets/d/${ID}`)).toBe(ID);
    expect(gs.googleSheetId(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`)).toBe(ID);
    // Navegador com mais de uma conta do Google: "/u/1/" antes do "/d/".
    expect(gs.googleSheetId(`https://docs.google.com/spreadsheets/u/1/d/${ID}/edit#gid=0`)).toBe(ID);
    expect(gs.googleSheetId(`https://docs.google.com/spreadsheets/u/0/d/${ID}`)).toBe(ID);
    expect(gs.googleSheetId(`https://docs.google.com/spreadsheets/u/x/d/${ID}`)).toBeNull();
    expect(gs.googleSheetId("https://docs.google.com/document/d/abc123456789/edit")).toBeNull();
    expect(gs.googleSheetId("http://docs.google.com/spreadsheets/d/abc123456789")).toBeNull();
    expect(gs.googleSheetId("https://evil.example/spreadsheets/d/abc123456789")).toBeNull();
    expect(gs.googleSheetExportUrl(ID)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=xlsx`,
    );
  });

  it("baixa o .xlsx (com o nome do arquivo) quando a planilha está compartilhada", async () => {
    const bytes = xlsxBytes([{ name: "Plan1", cells: [["A", "B"], ["1", "2"]] }]);
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      seen.push(String(input));
      return respond(bytes, {
        disposition: "attachment; filename*=UTF-8''Lista%20de%20produtos.xlsx",
      })(input, init);
    };
    const got = await gs.fetchGoogleSheetXlsx(LINK, { fetchImpl });
    expect(seen).toEqual([gs.googleSheetExportUrl(ID)]);
    expect(got.name).toBe("Lista de produtos.xlsx");
    expect(got.bytes.length).toBe(bytes.length);
    expect(got.bytes[0]).toBe(0x50);
  });

  it("sem compartilhamento: login do Google (HTML ou redirecionamento) vira sheet_private", async () => {
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, { fetchImpl: respond("<html>login</html>", { type: "text/html" }) }),
    ).rejects.toThrow("sheet_private");
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, {
        fetchImpl: respond("x", { url: "https://accounts.google.com/ServiceLogin?x" }),
      }),
    ).rejects.toThrow("sheet_private");
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, { fetchImpl: respond("x", { status: 403 }) }),
    ).rejects.toThrow("sheet_private");
    // Corpo que não é ZIP também não é a planilha.
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, { fetchImpl: respond("not a zip") }),
    ).rejects.toThrow("sheet_private");
  });

  it("link errado, planilha inexistente, falha de rede e arquivo grande demais", async () => {
    await expect(gs.fetchGoogleSheetXlsx("https://example.com/x")).rejects.toThrow("sheet_url_invalid");
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, { fetchImpl: respond("x", { status: 404 }) }),
    ).rejects.toThrow("sheet_not_found");
    // A página de erro do Google é HTML: continua "não encontrada", não "privada".
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, { fetchImpl: respond("<html>404</html>", { status: 404, type: "text/html" }) }),
    ).rejects.toThrow("sheet_not_found");
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, { fetchImpl: respond("<html>500</html>", { status: 500, type: "text/html" }) }),
    ).rejects.toThrow("sheet_fetch_failed");
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, { fetchImpl: respond("<html>429</html>", { status: 429, type: "text/html" }) }),
    ).rejects.toThrow("sheet_fetch_failed");
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, {
        fetchImpl: (async () => {
          throw new TypeError("fetch failed");
        }) as typeof fetch,
      }),
    ).rejects.toThrow("sheet_fetch_failed");
    const big = new Uint8Array(2048);
    big[0] = 0x50;
    big[1] = 0x4b;
    await expect(
      gs.fetchGoogleSheetXlsx(LINK, { fetchImpl: respond(big), maxBytes: 1024 }),
    ).rejects.toThrow("too_large");
  });
});
