import {
  areaNameKey,
  cleanAreaName,
  findAreaByName,
  splitBulkText,
  validAreaName,
  type AreaLike,
} from "./team-areas";

/*
 * Cargos da equipe (Equipe Acessos e Parceiros → Cargos; dono, 16/11/2026;
 * docs/ACCESS.md, "Áreas e cargos"). Regras do cadastro, sem banco:
 *
 * - Nome e "mesmo cargo" pelas regras das áreas (src/lib/team-areas.ts): a
 *   grafia cadastrada fica; maiúsculas, acentos e pontuação não contam.
 *   "Vendedor Sênior" e "Vendedora Sênior" são cargos diferentes.
 * - Cada cargo fica em uma área ativa (ou sem área).
 * - Cadastro em massa: um cargo por linha; a área pode vir na mesma linha,
 *   depois de uma tabulação (colado da planilha) ou de ";". Sem área na
 *   linha, vale a área escolhida para a lista (ou nenhuma). Área que não está
 *   cadastrada (ou desativada): a linha não entra e volta no resumo. O cargo
 *   que já existe fica como está, com a área de lá.
 */

export interface PositionLike {
  id: string;
  name: string;
  active: boolean;
  areaId: string | null;
}

/** O cargo cadastrado com o mesmo nome (pela chave), fora o `except`. */
export function findPositionByName<T extends PositionLike>(
  name: string,
  positions: T[],
  except: string | null = null,
): T | null {
  return findAreaByName(name, positions, except);
}

/** Uma linha do cadastro em massa: o cargo e, se veio, a área. */
export function positionLine(line: string): { name: string; area: string } {
  const [name, area = ""] = line.split(/\t|;/);
  return { name: cleanAreaName(name), area: cleanAreaName(area) };
}

export interface BulkPositionPlan {
  /** Os que faltam: o nome como veio e a área (na ordem da lista). */
  create: { name: string; areaId: string | null; areaName: string | null }[];
  /** Os que já existem: o nome pedido e o cadastro (grafia e área de lá). */
  existing: {
    asked: string;
    id: string;
    name: string;
    active: boolean;
    areaId: string | null;
  }[];
  /** Linhas repetidas na própria lista (vale a primeira). */
  repeated: string[];
  /** Linhas recusadas: nome curto, longo demais ou só com pontuação. */
  invalid: string[];
  /** Linhas com uma área que não está cadastrada ou está desativada. */
  unknownArea: { name: string; area: string }[];
  /** Título da coluna colado na primeira linha (ignorado). */
  header: string | null;
}

/** Compara a lista colada com os cargos e as áreas, sem gravar nada. */
export function planBulkPositions(
  text: string,
  positions: PositionLike[],
  areas: AreaLike[],
  defaultAreaId: string | null = null,
): BulkPositionPlan {
  const { lines, header } = splitBulkText(text, /\r?\n/);
  const plan: BulkPositionPlan = {
    create: [],
    existing: [],
    repeated: [],
    invalid: [],
    unknownArea: [],
    header,
  };
  const fallback = defaultAreaId
    ? (areas.find((a) => a.id === defaultAreaId && a.active) ?? null)
    : null;
  const seen = new Set<string>();
  for (const line of lines) {
    const { name, area } = positionLine(line);
    if (!validAreaName(name)) {
      plan.invalid.push(cleanAreaName(line));
      continue;
    }
    const key = areaNameKey(name);
    if (seen.has(key)) {
      plan.repeated.push(name);
      continue;
    }
    seen.add(key);
    const found = findPositionByName(name, positions);
    if (found) {
      plan.existing.push({
        asked: name,
        id: found.id,
        name: found.name,
        active: found.active,
        areaId: found.areaId,
      });
      continue;
    }
    if (area) {
      const match = findAreaByName(area, areas);
      if (!match || !match.active) {
        plan.unknownArea.push({ name, area });
        continue;
      }
      plan.create.push({ name, areaId: match.id, areaName: match.name });
    } else
      plan.create.push({
        name,
        areaId: fallback?.id ?? null,
        areaName: fallback?.name ?? null,
      });
  }
  return plan;
}
