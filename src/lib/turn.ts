import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Role } from "@/lib/db/schema";

/*
 * De quem é a vez (dono, 18/11/2026; docs/TURNS.md): toda etapa com uma ação
 * a fazer diz qual é a ação e quem está com a vez, e a ação vai para as
 * Pendências de quem pode fazê-la. Esta regra pura dá o nome de quem está
 * com a vez ("Aguardando cliente"), o "com quem" do Próximo passo, o tom do
 * selo e o filtro "Com quem está". As listas, os detalhes, o CSV e as
 * Pendências usam a mesma regra, para não se contradizerem.
 */

/**
 * Quem pode estar com a vez. A equipe Wellmix (administrador e operadores)
 * é uma parte só; a Trading é o fornecedor do tipo Trading. `unassigned`:
 * falta definir o responsável (o caso vai para quem administra o fluxo).
 */
export const TURN_PARTIES = [
  "wellmix",
  "customer",
  "supplier",
  "trading",
  "agency",
  "ocp",
  "broker",
  "comex",
  "logistics",
  "shipping_line",
  "carrier",
  "marketing_agency",
  "legal",
  "unassigned",
] as const;
export type TurnParty = (typeof TURN_PARTIES)[number];

export const isTurnParty = (value: unknown): value is TurnParty =>
  typeof value === "string" &&
  (TURN_PARTIES as readonly string[]).includes(value);

/**
 * Papel de quem faz o item ou a etapa → quem está com a vez. Fornecedor do
 * tipo Trading (`trading`) aparece como Trading.
 */
export function partyOfRole(
  role: Role | null | undefined,
  options: { trading?: boolean } = {},
): TurnParty | null {
  if (!role) return null;
  if (role === "admin" || role === "operator") return "wellmix";
  if (role === "supplier" && options.trading) return "trading";
  return role;
}

/** "Aguardando cliente": a situação de quem está com a vez. */
export const turnWaitingKey = (party: TurnParty) =>
  `turn.waiting.${party}` as DictionaryKey;

/** "com o cliente": o complemento do Próximo passo. */
export const turnWithKey = (party: TurnParty) =>
  `turn.with.${party}` as DictionaryKey;

/** "Cliente": o nome no filtro "Com quem está". */
export const turnNameKey = (party: TurnParty) =>
  `turn.name.${party}` as DictionaryKey;

/**
 * Tom do selo: a vez da Wellmix em destaque (é a equipe que age), a de fora
 * em aviso (acompanhar) e o responsável faltando em alerta.
 */
export function turnTone(
  party: TurnParty,
): "brand" | "warning" | "info" | "danger" {
  if (party === "wellmix") return "brand";
  if (party === "unassigned") return "danger";
  if (party === "customer") return "warning";
  return "info";
}

/** Filtro "Com quem está" pelo endereço (`?vez=`); inválido = todos. */
export const turnFilterOf = (value: unknown): TurnParty | null =>
  isTurnParty(value) ? value : null;

/** As partes presentes numa lista, na ordem de TURN_PARTIES, com a contagem. */
export function turnCounts(
  parties: readonly (TurnParty | null | undefined)[],
): { party: TurnParty; count: number }[] {
  const counts = new Map<TurnParty, number>();
  for (const p of parties) if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  return TURN_PARTIES.filter((p) => counts.has(p)).map((party) => ({
    party,
    count: counts.get(party)!,
  }));
}
