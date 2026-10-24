import "server-only";

/*
 * Planilha do Google Sheets pelo link: uma planilha compartilhada como
 * "qualquer pessoa com o link" pode ser baixada em .xlsx sem credencial pelo
 * endereço de exportação. Sem compartilhamento, o Google devolve a página de
 * login (HTML), que vira o erro `sheet_private`. Nada é guardado além do
 * arquivo baixado (a evidência do lote, como numa planilha enviada).
 */

export class GoogleSheetError extends Error {}

const SHEET_URL =
  /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{10,120})(?:[/?#]|$)/;

/** Id da planilha num link do Google Sheets; nulo quando o link não é de uma planilha. */
export function googleSheetId(url: string): string | null {
  const m = SHEET_URL.exec(url.trim());
  return m ? m[1] : null;
}

export function isGoogleSheetUrl(url: string): boolean {
  return googleSheetId(url) !== null;
}

/** Endereço de exportação em .xlsx (planilha inteira, todas as abas). */
export function googleSheetExportUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=xlsx`;
}

export interface FetchSheetOptions {
  /** Teto do arquivo baixado (bytes). */
  maxBytes?: number;
  timeoutMs?: number;
  /** Para testes: substitui o `fetch` global. */
  fetchImpl?: typeof fetch;
}

const fileNameFrom = (disposition: string | null): string | null => {
  if (!disposition) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]).trim() || null;
    } catch {
      return null;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1].trim() || null : null;
};

const safeName = (name: string) =>
  name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

/**
 * Baixa a planilha como .xlsx. Erros por código: `sheet_url_invalid`,
 * `sheet_private` (sem compartilhamento público), `sheet_not_found`,
 * `sheet_fetch_failed` (rede, tempo, resposta estranha) e `too_large`.
 */
export async function fetchGoogleSheetXlsx(
  url: string,
  options: FetchSheetOptions = {},
): Promise<{ bytes: Uint8Array; name: string }> {
  const id = googleSheetId(url);
  if (!id) throw new GoogleSheetError("sheet_url_invalid");
  const maxBytes = options.maxBytes ?? 50_000_000;
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);
  let response: Response;
  try {
    response = await doFetch(googleSheetExportUrl(id), {
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "application/octet-stream, */*" },
    });
  } catch {
    clearTimeout(timer);
    throw new GoogleSheetError("sheet_fetch_failed");
  }
  try {
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    const finalUrl = response.url ?? "";
    // Sem compartilhamento, o Google redireciona para o login (HTML).
    if (
      response.status === 401 ||
      response.status === 403 ||
      /accounts\.google\.com/.test(finalUrl) ||
      type.startsWith("text/html")
    )
      throw new GoogleSheetError("sheet_private");
    if (response.status === 404) throw new GoogleSheetError("sheet_not_found");
    if (!response.ok) throw new GoogleSheetError("sheet_fetch_failed");
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > maxBytes) throw new GoogleSheetError("too_large");
    const bytes = await readLimited(response, maxBytes);
    // .xlsx é um ZIP ("PK"); qualquer outra coisa não é a planilha.
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      throw new GoogleSheetError("sheet_private");
    const name = safeName(
      fileNameFrom(response.headers.get("content-disposition")) ??
        "planilha-google.xlsx",
    );
    return { bytes, name: /\.xlsx$/i.test(name) ? name : `${name}.xlsx` };
  } finally {
    clearTimeout(timer);
  }
}

/** Lê o corpo até o teto; acima dele, `too_large` sem carregar o resto. */
async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const body = response.body;
  if (!body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new GoogleSheetError("too_large");
    return buffer;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.length;
      if (total > maxBytes) throw new GoogleSheetError("too_large");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
