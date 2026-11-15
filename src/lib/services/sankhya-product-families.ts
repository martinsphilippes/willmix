import "server-only";
import { executeQuery } from "@/lib/integrations/sankhya-client";

/*
 * Família de produto = o grupo pai da linha no Sankhya (dono, 15/11/2026;
 * docs/ORDER_TERMS.md seção 3.2): a árvore de grupos (TGFGRU) tem níveis no
 * código (70106001 "CJ COPOS" fica dentro do grupo pai de 70106…), e o
 * portal só carregou o último nível (as linhas). O pai e o nome dele vêm do
 * Sankhya pela API (CODGRUPOPROD → CODGRUPAI e DESCRGRUPOPROD), guardados
 * por 30 minutos por instância, até a carga gravá-los no banco. Sem o
 * Sankhya (ou com erro), um mapa vazio: cada linha vale como a própria
 * família.
 */

export interface SankhyaGroup {
  name: string;
  /** CODGRUPAI; nulo no topo da árvore. */
  parent: string | null;
}

const TTL_MS = 30 * 60 * 1000;
const RETRY_MS = 2 * 60 * 1000;
const PAGE = 2000;
const MAX_PAGES = 10;

let cached: { at: number; map: Map<string, SankhyaGroup> } | null = null;
let pending: Promise<Map<string, SankhyaGroup>> | null = null;

/** Para testes: esquece o mapa. */
export function resetSankhyaProductFamilies() {
  cached = null;
  pending = null;
}

export const productGroupsSql = (after: number) =>
  `SELECT TOP ${PAGE} CODGRUPOPROD, DESCRGRUPOPROD, CODGRUPAI FROM TGFGRU WHERE CODGRUPOPROD > ${Math.max(0, Math.floor(after))} ORDER BY CODGRUPOPROD`;

const code = (value: unknown) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? String(n) : null;
};

async function load(): Promise<Map<string, SankhyaGroup>> {
  const map = new Map<string, SankhyaGroup>();
  let after = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { rows } = await executeQuery(productGroupsSql(after));
    for (const row of rows) {
      const own = code(row.CODGRUPOPROD);
      if (!own) continue;
      const parent = code(row.CODGRUPAI);
      map.set(own, {
        name: String(row.DESCRGRUPOPROD ?? "").trim() || own,
        parent: parent && parent !== own ? parent : null,
      });
      if (Number(own) > after) after = Number(own);
    }
    if (rows.length < PAGE) break;
  }
  return map;
}

/** CODGRUPOPROD → nome e grupo pai, do Sankhya (vazio sem o Sankhya). */
export async function sankhyaProductGroups(): Promise<
  Map<string, SankhyaGroup>
> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.map;
  pending ??= load()
    .catch((error) => {
      const kind = (error as { code?: string }).code;
      if (kind !== "sankhya_not_configured")
        console.error("[origin] grupos de produto no Sankhya", error);
      return new Map<string, SankhyaGroup>();
    })
    .finally(() => {
      pending = null;
    });
  const map = await pending;
  cached = { at: map.size ? Date.now() : Date.now() - TTL_MS + RETRY_MS, map };
  return map;
}
