import { JOB_LEVELS } from "@/lib/db/schema";

/*
 * Hierarquia da equipe pelo "Responde a" (users.managerUserId; dono,
 * 17/11/2026; docs/EQUIPE_ACESSOS.md, R9 e D5): a cadeia de reporte de cada
 * pessoa, os subordinados diretos e os avisos (gestor com nível menor que o
 * do subordinado: aviso, não bloqueio). Regras puras, resistentes a ciclo e a
 * gestor que não está na equipe (cadastro antigo ou corrompido). O servidor
 * recusa gravar ciclo (setTeamMember, src/lib/services/team.ts).
 */

export interface HierarchyNode {
  id: string;
  name: string;
  managerUserId?: string | null;
  jobLevel?: string | null;
}

/**
 * Cadeia de reporte: o gestor direto, o gestor dele e assim até o topo. Para
 * no gestor que não está na lista e num ciclo (sem repetir ninguém).
 */
export function managerChain<N extends HierarchyNode>(
  id: string,
  team: readonly N[],
): { chain: N[]; cycle: boolean; missing: string | null } {
  const byId = new Map(team.map((n) => [n.id, n]));
  const chain: N[] = [];
  const seen = new Set([id]);
  let current = byId.get(id)?.managerUserId ?? null;
  while (current) {
    if (seen.has(current)) return { chain, cycle: true, missing: null };
    const node = byId.get(current);
    if (!node) return { chain, cycle: false, missing: current };
    chain.push(node);
    seen.add(current);
    current = node.managerUserId ?? null;
  }
  return { chain, cycle: false, missing: null };
}

/** Quem responde direto à pessoa, por nome. */
export function directReports<N extends HierarchyNode>(
  id: string,
  team: readonly N[],
): N[] {
  return team
    .filter((n) => n.managerUserId === id && n.id !== id)
    .sort((a, b) =>
      a.name.localeCompare(b.name, "pt", { sensitivity: "base" }),
    );
}

/** Posição do nível na escala (Analista = 0 … Diretor = 4); -1 sem nível. */
export const levelRank = (level: string | null | undefined): number =>
  level ? (JOB_LEVELS as readonly string[]).indexOf(level) : -1;

/**
 * Gestor com nível menor que o do subordinado (os dois com nível): aviso,
 * não bloqueio (D5). Uma entrada por par gestor → subordinado.
 */
export function levelInversions<N extends HierarchyNode>(
  team: readonly N[],
): { manager: N; member: N }[] {
  const byId = new Map(team.map((n) => [n.id, n]));
  const out: { manager: N; member: N }[] = [];
  for (const member of team) {
    const manager = member.managerUserId
      ? byId.get(member.managerUserId)
      : undefined;
    if (!manager || manager.id === member.id) continue;
    const m = levelRank(manager.jobLevel);
    const s = levelRank(member.jobLevel);
    if (m >= 0 && s >= 0 && m < s) out.push({ manager, member });
  }
  return out;
}

/** Problema na árvore do "Responde a" (relatório do administrador, R9). */
export type HierarchyIssue =
  | { kind: "self"; memberId: string }
  | { kind: "missing"; memberId: string; managerId: string }
  | { kind: "inactive"; memberId: string; managerId: string }
  | { kind: "cycle"; memberId: string }
  | { kind: "level"; memberId: string; managerId: string };

/**
 * Referências inválidas e ciclos na árvore da equipe ativa (R9): responde a
 * si mesmo, a quem não existe, a quem saiu (login desativado) ou faz parte de
 * um ciclo; e o aviso de gestor com nível menor que o do subordinado (D5).
 * `all` traz também os logins desativados, para separar "saiu" de "não
 * existe". Uma entrada por pessoa e problema.
 */
export function hierarchyIssues<N extends HierarchyNode>(
  active: readonly N[],
  all: readonly HierarchyNode[],
): HierarchyIssue[] {
  const activeIds = new Set(active.map((n) => n.id));
  const allIds = new Set(all.map((n) => n.id));
  const out: HierarchyIssue[] = [];
  for (const m of active) {
    const manager = m.managerUserId;
    if (!manager) continue;
    if (manager === m.id) out.push({ kind: "self", memberId: m.id });
    else if (!allIds.has(manager))
      out.push({ kind: "missing", memberId: m.id, managerId: manager });
    else if (!activeIds.has(manager))
      out.push({ kind: "inactive", memberId: m.id, managerId: manager });
    else if (managerChain(m.id, active).cycle) {
      // Só quem está dentro do ciclo (a cadeia volta para a própria pessoa).
      const chain = managerChain(m.id, active).chain;
      if (chain.length && chain[chain.length - 1].managerUserId === m.id)
        out.push({ kind: "cycle", memberId: m.id });
    }
  }
  for (const { manager, member } of levelInversions(active))
    out.push({ kind: "level", memberId: member.id, managerId: manager.id });
  return out;
}
