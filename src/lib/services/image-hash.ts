import "server-only";

/**
 * Impressão digital visual (dHash de 64 bits, 16 hex): a mesma foto, mesmo
 * redimensionada ou recomprimida, dá hashes a poucos bits de distância.
 * Determinístico e sem IA. Não reconhece "o mesmo produto em outra foto":
 * para isso existe a IA (quando configurada).
 */
export async function imageHashOf(bytes: Uint8Array): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(Buffer.from(bytes))
      .rotate()
      .grayscale()
      .resize(9, 8, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    let hex = "";
    for (let y = 0; y < 8; y++) {
      let nibble = 0;
      for (let x = 0; x < 8; x++) {
        const bit = data[y * 9 + x] < data[y * 9 + x + 1] ? 1 : 0;
        nibble = (nibble << 1) | bit;
        if (x % 4 === 3) {
          hex += nibble.toString(16);
          nibble = 0;
        }
      }
    }
    return hex;
  } catch {
    return null;
  }
}

/** Bits diferentes entre dois hashes (0 = idênticos, 64 = opostos). */
export function hashDistance(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let d = 0;
  for (let i = 0; i < 16; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/** Hash utilizável: imagem lisa (tudo zero) casaria com qualquer outra lisa. */
export const usableHash = (h: string | null | undefined): h is string =>
  !!h && h.length === 16 && h !== "0000000000000000";

/** Até esta distância consideramos "a mesma foto". */
// Medido: a mesma foto reduzida, recomprimida (WhatsApp), com leve recorte ou
// brilho fica a ≤7 bits; fotos diferentes ficam bem acima.
export const SAME_PHOTO_MAX_DISTANCE = 8;
