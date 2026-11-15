import "server-only";
import { executeQuery, type SankhyaClientOptions } from "./sankhya-client";
import { boxQuantities } from "./sankhya-mapping";

/**
 * Caixa master direto do Sankhya (dono, 15/11/2026): peças por caixa e CBM
 * pelos volumes alternativos (TGFVOA), para o produto cujo cadastro no portal
 * ainda não tem esses dados. Só leitura, nada é gravado; a carga de produtos
 * grava os mesmos valores no cadastro. Sem Sankhya configurado, com erro ou
 * demora, volta vazio e a tela segue como antes (sem dado inventado).
 */
export interface SankhyaCarton {
  masterBoxQty: number | null;
  cbm: number | null;
}

const TIMEOUT_MS = 4000;

export async function sankhyaCartons(
  codes: readonly (string | null | undefined)[],
  options: SankhyaClientOptions = {},
): Promise<Map<string, SankhyaCarton>> {
  const out = new Map<string, SankhyaCarton>();
  const list = [
    ...new Set(
      codes.map((c) => Number(c)).filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  if (!list.length) return out;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const table = await Promise.race([
      executeQuery(
        `SELECT * FROM TGFVOA WHERE CODPROD IN (${list.join(", ")})`,
        options,
      ),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), TIMEOUT_MS);
      }),
    ]);
    if (!table) return out;
    for (const code of list) {
      const rows = table.rows.filter((r) => Number(r.CODPROD) === code);
      if (!rows.length) continue;
      const box = boxQuantities(rows);
      if (box.masterBoxQty == null && box.masterCbm == null) continue;
      out.set(String(code), {
        masterBoxQty: box.masterBoxQty,
        cbm: box.masterCbm,
      });
    }
  } catch {
    // Sankhya fora, sem credencial ou sem acesso: segue sem o dado.
  } finally {
    if (timer) clearTimeout(timer);
  }
  return out;
}
