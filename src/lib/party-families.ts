import type { PartyType } from "@/lib/db/schema";

/*
 * Grupo de produto (família) do parceiro (dono, 18/11/2026;
 * docs/PARTNER_FAMILIES.md): regras puras. A família é o 1º nível da árvore
 * de grupos do Sankhya (TGFGRU), a mesma da Nova solicitação; o parceiro
 * marca as famílias que atende e entra na cotação de compra das linhas
 * delas.
 */

/**
 * Tipos de parceiro com a seção "Grupo de produto (família)" e que entram na
 * cotação de compra: Fornecedor, Trading, Supplier e Factory (dono,
 * 18/11/2026; antes, só o Fornecedor entrava).
 */
export const FAMILY_PARTY_TYPES = [
  "supplier",
  "trading",
  "supplier_partner",
  "factory",
] as const satisfies readonly PartyType[];

export const servesFamilies = (type: string | null | undefined) =>
  !!type && (FAMILY_PARTY_TYPES as readonly string[]).includes(type);

/** Nó da árvore de grupos do Sankhya: nome e grupo pai (nulo no topo). */
export interface GroupNode {
  name: string;
  parent: string | null;
}

/** Código do Sankhya sem zeros à esquerda; nulo se não for um código. */
export function groupCode(value: unknown): string | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? String(n) : null;
}

/**
 * Família de um grupo: sobe a árvore até o topo (o 1º nível). O grupo que já
 * é do topo é a própria família. Grupo fora da árvore: nulo. Resistente a
 * ciclo (cadastro corrompido).
 */
export function familyCodeOf(
  code: string | null | undefined,
  groups: ReadonlyMap<string, GroupNode>,
): string | null {
  const start = groupCode(code);
  if (!start || !groups.has(start)) return null;
  let at = start;
  const seen = new Set<string>([at]);
  for (let step = 0; step < 20; step++) {
    const parent = groups.get(at)?.parent ?? null;
    if (!parent || !groups.has(parent) || seen.has(parent)) return at;
    seen.add(parent);
    at = parent;
  }
  return at;
}

/** As famílias da árvore: os grupos do topo, por nome e código. */
export function familiesOfTree(
  groups: ReadonlyMap<string, GroupNode>,
): Array<{ code: string; name: string }> {
  const out: Array<{ code: string; name: string }> = [];
  for (const [code, node] of groups)
    if (!node.parent || !groups.has(node.parent))
      out.push({ code, name: node.name.trim() || code });
  return out.sort(byNameAndCode);
}

/** Texto sem acento e sem caixa, para comparar e buscar. */
export function plain(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function byNameAndCode(
  a: { name: string; code: string },
  b: { name: string; code: string },
): number {
  return (
    a.name.localeCompare(b.name, "pt", { sensitivity: "base" }) ||
    Number(a.code) - Number(b.code) ||
    a.code.localeCompare(b.code)
  );
}

/** A família bate com a busca: pelo nome (sem acento e caixa) ou pelo código. */
export function familyMatches(
  family: { name: string; code: string },
  query: string,
): boolean {
  const q = plain(query);
  if (!q) return true;
  return plain(family.name).includes(q) || family.code.includes(q.trim());
}

/**
 * Nomes que aparecem em mais de uma família (códigos diferentes): a tela
 * mostra o código ao lado do nome para distinguir.
 */
export function repeatedNames(
  families: ReadonlyArray<{ name: string }>,
): Set<string> {
  const count = new Map<string, number>();
  for (const f of families)
    count.set(plain(f.name), (count.get(plain(f.name)) ?? 0) + 1);
  return new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));
}

/** Lista sem repetir o mesmo código (vale a primeira). */
export function uniqueByCode<T extends { code: string }>(
  list: readonly T[],
): T[] {
  const seen = new Set<string>();
  return list.filter((f) =>
    seen.has(f.code) ? false : (seen.add(f.code), true),
  );
}
