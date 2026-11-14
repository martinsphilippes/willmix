/*
 * Regras puras do card "Telas que o login abre" (Equipe e acessos → Editar
 * acessos; docs/ACCESS.md), usadas no servidor e no navegador. Sem import de
 * servidor: o card recalcula as caixas na hora, sem salvar nem recarregar.
 *
 * - Padrão das funções: o que as funções marcadas liberam. É a mesma
 *   combinação de `accessFromFunctions` (que usa esta função): a tela do
 *   Início abre se alguma função ativa a deixa marcada (sem função ativa,
 *   todas); as demais telas são a união das telas de cada função.
 * - Personalizado: o padrão das funções com as exceções do administrador por
 *   cima (o que ele marcou ou desmarcou à mão). Trocar as funções muda as
 *   caixas herdadas e mantém as exceções.
 */

/** O que uma função ativa libera: as telas e as do Início que ela desmarca. */
export interface FunctionScreens {
  key: string;
  screens: readonly string[];
  baseOff: readonly string[];
}

/**
 * Telas que as funções marcadas liberam: `screens` (sem o Início) e `base`
 * (as do Início que ficam). Função desconhecida não conta; quem chama passa
 * só as ativas (a desativada não libera nada).
 */
export function combineFunctionScreens(
  selected: readonly string[] | null | undefined,
  defs: readonly FunctionScreens[],
  base: readonly string[],
): { screens: string[]; base: string[] } {
  const screens = new Set<string>();
  const baseOn = new Set<string>();
  let active = 0;
  for (const key of selected ?? []) {
    const def = defs.find((d) => d.key === key);
    if (!def) continue;
    active++;
    def.screens.forEach((s) => screens.add(s));
    base.forEach((s) => {
      if (!def.baseOff.includes(s)) baseOn.add(s);
    });
  }
  return {
    screens: [...screens],
    base: active ? base.filter((s) => baseOn.has(s)) : [...base],
  };
}

/** Padrão das funções: as telas do Início que ficam mais as das funções. */
export function inheritedScreens(
  selected: readonly string[] | null | undefined,
  defs: readonly FunctionScreens[],
  base: readonly string[],
): Set<string> {
  const combined = combineFunctionScreens(selected, defs, base);
  return new Set([...combined.base, ...combined.screens]);
}

/** O que o administrador marcou (`added`) ou desmarcou (`removed`) à mão. */
export interface ScreenExceptions {
  added: string[];
  removed: string[];
}

export const NO_EXCEPTIONS: ScreenExceptions = { added: [], removed: [] };

/**
 * Exceções de uma lista gravada no Personalizado: o que ela tem a mais e a
 * menos que o padrão das funções.
 */
export function exceptionsOf(
  saved: Iterable<string>,
  inherited: ReadonlySet<string>,
): ScreenExceptions {
  const list = new Set(saved);
  return {
    added: [...list].filter((s) => !inherited.has(s)),
    removed: [...inherited].filter((s) => !list.has(s)),
  };
}

/** Personalizado: o padrão das funções com as exceções por cima. */
export function withExceptions(
  inherited: ReadonlySet<string>,
  exceptions: ScreenExceptions,
): Set<string> {
  const out = new Set(inherited);
  exceptions.added.forEach((s) => out.add(s));
  exceptions.removed.forEach((s) => out.delete(s));
  return out;
}

/**
 * Uma caixa marcada ou desmarcada à mão no Personalizado: vira exceção, ou
 * deixa de ser se voltou a ficar igual ao padrão das funções.
 */
export function toggleException(
  exceptions: ScreenExceptions,
  screen: string,
  on: boolean,
  inherited: ReadonlySet<string>,
): ScreenExceptions {
  const added = exceptions.added.filter((s) => s !== screen);
  const removed = exceptions.removed.filter((s) => s !== screen);
  if (on !== inherited.has(screen)) (on ? added : removed).push(screen);
  return { added, removed };
}
