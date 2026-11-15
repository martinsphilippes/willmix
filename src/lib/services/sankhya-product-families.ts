import "server-only";
import { executeQuery } from "@/lib/integrations/sankhya-client";

/*
 * Árvore de grupos de produto do Sankhya (TGFGRU) e a família de cada
 * produto (docs/ORDER_TERMS.md seções 3.2 e 11). A família é o primeiro
 * nível da árvore (GRAU = 1; técnico do Sankhya, 15/11/2026); o portal só
 * carregou o último nível (as linhas). Tudo pelo DbExplorer, guardado por
 * 30 minutos por instância, até a carga gravar no banco. Sem o Sankhya (ou
 * com erro), mapas vazios: vale o nome da linha.
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

/*
 * Família de cada produto pelo Sankhya (técnico do Sankhya, 15/11/2026): a
 * família é o PRIMEIRO nível da árvore de grupos (TGFGRU.GRAU = 1); a API
 * de produtos só traz o último nível. Consulta pelo DbExplorer, subindo até
 * 4 níveis a partir do grupo do produto, só os ativos, em páginas pelo
 * CODPROD. Ex. (testado pelo técnico): 7429 → 160000000 "CERAMICA";
 * 21952 → 90000000 "WELLCLEAN".
 */

export interface ProductFamily {
  code: string;
  name: string;
}

let familiesCached: { at: number; map: Map<string, ProductFamily> } | null =
  null;
let familiesPending: Promise<Map<string, ProductFamily>> | null = null;

/** Para testes: esquece o mapa produto → família. */
export function resetSankhyaFamiliesByProduct() {
  familiesCached = null;
  familiesPending = null;
}

export const productFamiliesSql = (after: number) =>
  [
    `SELECT TOP ${PAGE} P.CODPROD, F.CODGRUPOPROD AS COD_FAMILIA, RTRIM(F.DESCRGRUPOPROD) AS FAMILIA`,
    "FROM TGFPRO P",
    "JOIN TGFGRU G1 ON G1.CODGRUPOPROD = P.CODGRUPOPROD",
    "LEFT JOIN TGFGRU G2 ON G2.CODGRUPOPROD = G1.CODGRUPAI",
    "LEFT JOIN TGFGRU G3 ON G3.CODGRUPOPROD = G2.CODGRUPAI",
    "LEFT JOIN TGFGRU G4 ON G4.CODGRUPOPROD = G3.CODGRUPAI",
    "JOIN TGFGRU F ON F.CODGRUPOPROD = CASE WHEN G1.GRAU = 1 THEN G1.CODGRUPOPROD WHEN G2.GRAU = 1 THEN G2.CODGRUPOPROD WHEN G3.GRAU = 1 THEN G3.CODGRUPOPROD ELSE G4.CODGRUPOPROD END",
    // Só os ativos (dono, 15/11/2026).
    `WHERE P.ATIVO = 'S' AND P.CODPROD > ${Math.max(0, Math.floor(after))}`,
    "ORDER BY P.CODPROD",
  ].join(" ");

async function loadFamilies(): Promise<Map<string, ProductFamily>> {
  const map = new Map<string, ProductFamily>();
  let after = 0;
  // ~14 mil produtos: até 15 páginas de 2 mil.
  for (let page = 0; page < 15; page++) {
    const { rows } = await executeQuery(productFamiliesSql(after));
    for (const row of rows) {
      const prod = code(row.CODPROD);
      const family = code(row.COD_FAMILIA);
      const name = String(row.FAMILIA ?? "").trim();
      if (prod && family) map.set(prod, { code: family, name: name || family });
      if (prod && Number(prod) > after) after = Number(prod);
    }
    if (rows.length < PAGE) break;
  }
  return map;
}

/** CODPROD → família (1º nível) do Sankhya (vazio sem o Sankhya). */
export async function sankhyaFamiliesByProduct(): Promise<
  Map<string, ProductFamily>
> {
  if (familiesCached && Date.now() - familiesCached.at < TTL_MS)
    return familiesCached.map;
  familiesPending ??= loadFamilies()
    .catch((error) => {
      const kind = (error as { code?: string }).code;
      if (kind !== "sankhya_not_configured")
        console.error("[origin] família dos produtos no Sankhya", error);
      return new Map<string, ProductFamily>();
    })
    .finally(() => {
      familiesPending = null;
    });
  const map = await familiesPending;
  familiesCached = {
    at: map.size ? Date.now() : Date.now() - TTL_MS + RETRY_MS,
    map,
  };
  return map;
}
