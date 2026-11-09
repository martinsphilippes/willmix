import { afterEach, describe, expect, it, vi } from "vitest";
import { AppwriteStore } from "@/lib/db/appwrite-store";

/*
 * Vídeo em produção: o portal pede ao Appwrite só o pedaço que o navegador
 * pediu. Se o Appwrite entregar o pedaço, ele passa direto; se mandar o
 * arquivo inteiro ou recusar o pedaço (ex.: um byte só), o portal recorta.
 * O Appwrite é simulado aqui (nenhuma rede).
 */

const SIZE = 20;
const BYTES = Array.from({ length: SIZE }, (_, i) => i);

function storeWith(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const store = new AppwriteStore(
    "https://appwrite.test/v1",
    "projeto",
    "chave-de-teste",
  );
  store.statFile = async (key: string) => ({
    key,
    name: "amostra.mp4",
    mime: "video/mp4",
    size: SIZE,
  });
  return store;
}

const body = (bytes: number[]) =>
  new Blob([new Uint8Array(bytes)]).stream() as ReadableStream<Uint8Array>;

async function read(stream: ReadableStream<Uint8Array>) {
  return [...new Uint8Array(await new Response(stream).arrayBuffer())];
}

const rangeOf = (call: unknown[]) =>
  (call[1] as { headers: Record<string, string> }).headers.Range;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Appwrite: arquivo em pedaços", () => {
  it("Appwrite entrega o pedaço: passa direto", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(body(BYTES.slice(4, 8)), {
          status: 206,
          headers: { "Content-Range": `bytes 4-7/${SIZE}` },
        }),
    );
    const file = await storeWith(fetchMock).streamFile("arq", {
      start: 4,
      end: 7,
    });
    expect(rangeOf(fetchMock.mock.calls[0])).toBe("bytes=4-7");
    expect(file?.range).toEqual({ start: 4, end: 7 });
    expect(await read(file!.body)).toEqual([4, 5, 6, 7]);
  });

  it("Appwrite manda o arquivo inteiro: o portal recorta", async () => {
    const fetchMock = vi.fn(
      async () => new Response(body(BYTES), { status: 200 }),
    );
    const file = await storeWith(fetchMock).streamFile("arq", {
      start: 15,
      end: 30,
    });
    expect(file?.range).toEqual({ start: 15, end: 19 });
    expect(await read(file!.body)).toEqual([15, 16, 17, 18, 19]);
  });

  it("Appwrite recusa o pedaço (um byte só): pede o arquivo e recorta", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("recusado", { status: 416 }))
      .mockResolvedValueOnce(new Response(body(BYTES), { status: 200 }));
    const file = await storeWith(fetchMock).streamFile("arq", {
      start: 0,
      end: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rangeOf(fetchMock.mock.calls[1])).toBeUndefined();
    expect(file?.range).toEqual({ start: 0, end: 0 });
    expect(await read(file!.body)).toEqual([0]);
  });

  it("sem pedaço: o arquivo inteiro, como antes", async () => {
    const fetchMock = vi.fn(
      async () => new Response(body(BYTES), { status: 200 }),
    );
    const file = await storeWith(fetchMock).streamFile("arq");
    expect(rangeOf(fetchMock.mock.calls[0])).toBeUndefined();
    expect(file?.range).toBeNull();
    expect(await read(file!.body)).toEqual(BYTES);
  });
});
