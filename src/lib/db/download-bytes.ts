/**
 * Conteúdo baixado do armazenamento em bytes. O SDK do Appwrite devolve o
 * arquivo já "aberto" (objeto) quando ele é servido como application/json, e
 * ArrayBuffer nos demais casos; aqui tudo volta a ser bytes.
 */
export function downloadBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data !== null && data !== undefined)
    return new TextEncoder().encode(JSON.stringify(data));
  return new Uint8Array();
}
