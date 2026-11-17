import type { User } from "@/lib/db/schema";
import { isAdmin } from "@/lib/auth/permissions";
import { SCREENS, WELLMIX_BASE, type Screen } from "@/lib/auth/screens";
import {
  ACTION_KEYS,
  accessFromFunctions,
  type ActionKey,
  type FunctionDef,
} from "@/lib/auth/function-access";
import { isRetiredAction } from "@/lib/auth/permission-modules";
import { screenAccessOf } from "@/lib/auth/screen-origin";

/*
 * Prévia de impacto de uma regra coletiva (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, R1 e etapa 5b): antes de salvar as telas e as
 * ações de uma função, quem é afetado e o que cada pessoa ganha ou perde.
 * Calcula sem gravar nada, com as mesmas regras de cada requisição: o
 * rascunho troca só a função escolhida, e o acesso efetivo de cada pessoa
 * (funções, Início, ajuste individual, lista antiga) sai da mesma conta do
 * menu, das páginas e das Server Actions. O administrador (inclui o Master)
 * abre e faz tudo: nunca ganha nem perde.
 */

/** O que o editor manda: as telas marcadas (inclusive as do Início) e as ações. */
export interface FunctionDraft {
  screens: readonly string[];
  actions: readonly string[];
}

export interface ImpactRow {
  id: string;
  name: string;
  gainedScreens: Screen[];
  lostScreens: Screen[];
  gainedActions: ActionKey[];
  lostActions: ActionKey[];
}

export interface FunctionImpact {
  /** Quem tem a função (fora o administrador, que não muda). */
  holders: number;
  /** Só quem ganha ou perde alguma tela ou ação. */
  rows: ImpactRow[];
}

/**
 * As funções com o rascunho no lugar da escolhida: a mesma divisão que o
 * salvar faz (setFunctionPermissions): as telas do Início desmarcadas vão
 * para `baseOff`; as aposentadas continuam como estavam.
 */
export function applyFunctionDraft(
  defs: readonly FunctionDef[],
  key: string,
  draft: FunctionDraft,
): FunctionDef[] {
  return defs.map((d) =>
    d.key !== key
      ? d
      : {
          ...d,
          screens: SCREENS.filter(
            (s) => draft.screens.includes(s) && !WELLMIX_BASE.includes(s),
          ),
          baseOff: WELLMIX_BASE.filter((s) => !draft.screens.includes(s)),
          actions: ACTION_KEYS.filter((a) =>
            isRetiredAction(a)
              ? d.actions.includes(a)
              : draft.actions.includes(a),
          ),
        },
  );
}

type Person = Pick<User, "id" | "name" | "role"> &
  Partial<Pick<User, "functions" | "screens" | "screenExceptions">>;

const opened = (person: Person, defs: FunctionDef[]) =>
  new Set(
    screenAccessOf(person, defs)
      .filter((s) => s.opens)
      .map((s) => s.screen),
  );

const allowed = (person: Person, defs: FunctionDef[]) =>
  new Set(
    accessFromFunctions(person.functions, defs).actions.filter(
      (a): a is ActionKey => !isRetiredAction(a as ActionKey),
    ) as ActionKey[],
  );

/** Quem tem a função e o que muda para cada um com o rascunho. */
export function functionImpact(
  team: readonly Person[],
  defs: readonly FunctionDef[],
  key: string,
  draft: FunctionDraft,
): FunctionImpact {
  const now = [...defs];
  const next = applyFunctionDraft(defs, key, draft);
  const holders = team.filter(
    (m) => !isAdmin(m) && (m.functions ?? []).includes(key),
  );
  const rows: ImpactRow[] = [];
  for (const person of holders) {
    const before = opened(person, now);
    const after = opened(person, next);
    const actionsBefore = allowed(person, now);
    const actionsAfter = allowed(person, next);
    const row: ImpactRow = {
      id: person.id,
      name: person.name,
      gainedScreens: SCREENS.filter((s) => after.has(s) && !before.has(s)),
      lostScreens: SCREENS.filter((s) => before.has(s) && !after.has(s)),
      gainedActions: ACTION_KEYS.filter(
        (a) => actionsAfter.has(a) && !actionsBefore.has(a),
      ),
      lostActions: ACTION_KEYS.filter(
        (a) => actionsBefore.has(a) && !actionsAfter.has(a),
      ),
    };
    if (
      row.gainedScreens.length ||
      row.lostScreens.length ||
      row.gainedActions.length ||
      row.lostActions.length
    )
      rows.push(row);
  }
  rows.sort((a, b) =>
    a.name.localeCompare(b.name, "pt", { sensitivity: "base" }),
  );
  return { holders: holders.length, rows };
}
