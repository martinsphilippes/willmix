import { describe, expect, it } from "vitest";
import {
  clampRange,
  parseByteRange,
  parseContentRange,
  sliceStream,
} from "@/lib/http-range";

/*
 * Arquivo em pedaços (Range): o vídeo da conversa só toca no Safari se o
 * servidor entregar o pedaço pedido. Leitura do pedido, teto por pedaço e o
 * recorte quando o armazenamento manda o arquivo inteiro.
 */

const streamOf = (chunks: number[][]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(new Uint8Array(c));
      controller.close();
    },
  });

async function bytesOf(stream: ReadableStream<Uint8Array>) {
  const out: number[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(...value);
  }
}

describe("pedido de pedaço (Range)", () => {
  it("lê o pedaço pedido, o aberto e o do fim", () => {
    expect(parseByteRange("bytes=0-1", 100)).toEqual({ start: 0, end: 1 });
    expect(parseByteRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
    expect(parseByteRange("bytes=-30", 100)).toEqual({ start: 70, end: 99 });
    expect(parseByteRange("bytes=-500", 100)).toEqual({ start: 0, end: 99 });
    // Fim além do arquivo: até o último byte.
    expect(parseByteRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
  });

  it("cada resposta tem no máximo o teto; o navegador pede o resto", () => {
    expect(parseByteRange("bytes=0-", 1000, 100)).toEqual({
      start: 0,
      end: 99,
    });
    expect(parseByteRange("bytes=500-999", 1000, 100)).toEqual({
      start: 500,
      end: 599,
    });
  });

  it("sem pedido válido: vai o arquivo inteiro; fora do arquivo: 416", () => {
    expect(parseByteRange(null, 100)).toBeNull();
    expect(parseByteRange("bytes=0-1,5-9", 100)).toBeNull();
    expect(parseByteRange("items=0-1", 100)).toBeNull();
    expect(parseByteRange("bytes=-", 100)).toBeNull();
    expect(parseByteRange("bytes=0-1", 0)).toBeNull();
    expect(parseByteRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=9-3", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=-0", 100)).toBe("unsatisfiable");
  });

  it("lê a resposta 206 do armazenamento e ajusta ao tamanho real", () => {
    expect(parseContentRange("bytes 0-99/1000")).toEqual({ start: 0, end: 99 });
    expect(parseContentRange("bytes 5-4/10")).toBeNull();
    expect(parseContentRange(null)).toBeNull();
    expect(clampRange({ start: 5, end: 50 }, 10)).toEqual({ start: 5, end: 9 });
    expect(clampRange({ start: 10, end: 50 }, 10)).toBeNull();
  });

  it("recorta o fluxo inteiro no pedaço pedido (entre e através de blocos)", async () => {
    const source = () =>
      streamOf([
        [0, 1, 2],
        [3, 4, 5, 6],
        [7, 8, 9],
      ]);
    expect(await bytesOf(sliceStream(source(), 2, 5))).toEqual([2, 3, 4, 5, 6]);
    expect(await bytesOf(sliceStream(source(), 0, 2))).toEqual([0, 1]);
    expect(await bytesOf(sliceStream(source(), 8, 10))).toEqual([8, 9]);
    expect(await bytesOf(sliceStream(source(), 12, 3))).toEqual([]);
  });
});
