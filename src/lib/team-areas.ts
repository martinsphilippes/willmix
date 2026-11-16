/*
 * Áreas da equipe (Equipe Acessos e Parceiros → Áreas; dono, 16/11/2026;
 * docs/ACCESS.md, "Áreas"). Regras do cadastro, sem banco (a tela, o serviço
 * e os testes usam as mesmas):
 *
 * - O nome fica como o administrador escreveu: só saem os espaços das pontas
 *   e os repetidos (e o marcador de lista, no cadastro em massa).
 * - Duas áreas são a mesma quando o nome é igual sem contar maiúsculas,
 *   acentos e pontuação: "Processos/Projetos" = "Processos Projetos" e
 *   "Contábil Fiscal" = "Contabil Fiscal". "Operações e Processos" é outra.
 * - Cadastro em massa: uma área por linha. Entra só a que falta; a que já
 *   existe (ativa ou desativada) fica como está, com a grafia cadastrada, e
 *   conta como já cadastrada; a repetida na própria lista entra uma vez.
 */

export const AREA_NAME_MIN = 2;
export const AREA_NAME_MAX = 120;
/** Linhas por cadastro em massa. */
export const AREA_BULK_MAX = 100;

export interface AreaLike {
  id: string;
  name: string;
  active: boolean;
}

/** O nome como fica gravado: sem espaços nas pontas nem repetidos. */
export function cleanAreaName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Chave de comparação: minúsculas, sem acentos, pontuação vira espaço. */
export function areaNameKey(raw: string): string {
  return cleanAreaName(raw)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Nome aceito: tamanho certo e ao menos uma letra ou número. */
export function validAreaName(name: string): boolean {
  return (
    name.length >= AREA_NAME_MIN &&
    name.length <= AREA_NAME_MAX &&
    areaNameKey(name).length > 0
  );
}

/** A área cadastrada com o mesmo nome (pela chave), fora a `except`. */
export function findAreaByName<T extends AreaLike>(
  name: string,
  areas: T[],
  except: string | null = null,
): T | null {
  const key = areaNameKey(name);
  if (!key) return null;
  return (
    areas.find((a) => a.id !== except && areaNameKey(a.name) === key) ?? null
  );
}

/** Ordem da lista: pelo nome, sem contar maiúsculas e acentos. */
export function sortAreas<T extends AreaLike>(areas: T[]): T[] {
  return [...areas].sort((a, b) =>
    a.name.localeCompare(b.name, "pt", { sensitivity: "base" }),
  );
}

/** Marcador de lista colado junto ("- ", "• ", "1. ", "2) " ou sozinho). */
const BULLET = /^(?:[-*•·–—]+|\d{1,3}[.)-])(?:\s+|$)/;

/** As linhas do cadastro em massa (sem as vazias e sem o marcador de lista). */
export function bulkAreaLines(text: string): string[] {
  return text
    .split(/\r?\n|;/)
    .map((line) => cleanAreaName(cleanAreaName(line).replace(BULLET, "")))
    .filter(Boolean);
}

export interface BulkAreaPlan {
  /** As que faltam, com o nome como veio na lista (na ordem da lista). */
  create: string[];
  /** As que já existem: o nome pedido e o cadastro (com a grafia de lá). */
  existing: { asked: string; id: string; name: string; active: boolean }[];
  /** Linhas repetidas na própria lista (vale a primeira). */
  repeated: string[];
  /** Linhas recusadas: curtas, longas demais ou só com pontuação. */
  invalid: string[];
}

/** Compara a lista colada com as áreas cadastradas, sem gravar nada. */
export function planBulkAreas(text: string, areas: AreaLike[]): BulkAreaPlan {
  const plan: BulkAreaPlan = {
    create: [],
    existing: [],
    repeated: [],
    invalid: [],
  };
  const seen = new Set<string>();
  for (const name of bulkAreaLines(text)) {
    if (!validAreaName(name)) {
      plan.invalid.push(name);
      continue;
    }
    const key = areaNameKey(name);
    if (seen.has(key)) {
      plan.repeated.push(name);
      continue;
    }
    seen.add(key);
    const found = findAreaByName(name, areas);
    if (found)
      plan.existing.push({
        asked: name,
        id: found.id,
        name: found.name,
        active: found.active,
      });
    else plan.create.push(name);
  }
  return plan;
}
