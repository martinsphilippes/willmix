/*
 * Arquivo em pedaços (cabeçalho HTTP "Range"): o vídeo só toca no Safari
 * (iPhone, iPad, Mac) se o servidor entregar a parte pedida, e pular para o
 * meio do vídeo em qualquer navegador também usa isso. Funções puras; a rota
 * /api/files responde 206 com o pedaço e o armazenamento lê só aquele trecho.
 */

export interface ByteRange {
  /** Primeiro byte (contando do zero). */
  start: number;
  /** Último byte, incluído. */
  end: number;
}

/**
 * Teto de cada pedaço: o navegador pede o resto em seguida. Mantém cada
 * resposta curta (função da Vercel e leitura do armazenamento).
 */
export const MAX_RANGE_BYTES = 8 * 1024 * 1024;

/**
 * Lê "Range: bytes=início-fim" (um pedaço só). `null`: sem pedido válido
 * (vai o arquivo inteiro, como antes); "unsatisfiable": o pedaço está fora do
 * arquivo (resposta 416).
 */
export function parseByteRange(
  header: string | null | undefined,
  size: number,
  maxBytes = MAX_RANGE_BYTES,
): ByteRange | "unsatisfiable" | null {
  if (!header || !Number.isSafeInteger(size) || size <= 0) return null;
  const match = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  // Vários pedaços ("0-1,5-9") ou outra unidade: ignora e manda tudo.
  if (!match) return null;
  const [, first, last] = match;
  if (!first && !last) return null;
  let start: number;
  let end: number;
  if (!first) {
    // "bytes=-500": os últimos 500 bytes.
    const suffix = Number(last);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(first);
    end = last ? Number(last) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end))
      return "unsatisfiable";
    if (start >= size || end < start) return "unsatisfiable";
    end = Math.min(end, size - 1);
  }
  return { start, end: Math.min(end, start + maxBytes - 1) };
}

/** Lê "Content-Range: bytes início-fim/total" de uma resposta 206. */
export function parseContentRange(
  header: string | null | undefined,
): ByteRange | null {
  const match = /^\s*bytes\s+(\d+)-(\d+)\/(\d+|\*)\s*$/i.exec(header ?? "");
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    end >= start
    ? { start, end }
    : null;
}

/**
 * Pula `skip` bytes do fluxo e entrega só os `take` seguintes (para quando o
 * armazenamento devolve o arquivo inteiro em vez do pedaço). Para de ler a
 * origem assim que o pedaço termina.
 */
export function sliceStream(
  source: ReadableStream<Uint8Array>,
  skip: number,
  take: number,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let skipped = 0;
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        if (sent >= take) {
          controller.close();
          void reader.cancel().catch(() => {});
          return;
        }
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        let chunk = value;
        if (skipped < skip) {
          const drop = Math.min(skip - skipped, chunk.byteLength);
          skipped += drop;
          chunk = chunk.subarray(drop);
          if (!chunk.byteLength) continue;
        }
        if (chunk.byteLength > take - sent)
          chunk = chunk.subarray(0, take - sent);
        sent += chunk.byteLength;
        controller.enqueue(chunk);
        return;
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/** Pedido dentro do arquivo de verdade (metadado antigo pode divergir). */
export function clampRange(
  range: ByteRange | null | undefined,
  size: number,
): ByteRange | null {
  if (!range || range.start >= size) return null;
  return { start: range.start, end: Math.min(range.end, size - 1) };
}
