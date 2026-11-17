import type { User } from "@/lib/db/schema";
import { isAdmin } from "./permissions";
import {
  ADMIN_ONLY,
  WELLMIX_BASE,
  screenExceptionsOf,
  screensFor,
  validScreens,
  type Screen,
} from "./screens";
import {
  ACTION_KEYS,
  accessFromFunctions,
  type ActionKey,
  type FunctionDef,
} from "./function-access";
import { PERMISSION_MODULES, isRetiredAction } from "./permission-modules";
import { actionSources, screenSources } from "./screen-picker";

/*
 * Acesso efetivo de uma pessoa da equipe com a origem de cada tela e ação
 * (Gestão de telas da Equipe Interna; dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, etapa 5). Usa as mesmas regras de cada requisição
 * (`screensFor`, `accessFromFunctions`): o que esta conta mostra é o que o
 * menu, as páginas e as Server Actions deixam. Só consulta; gravar continua
 * em Editar acessos (a pessoa) e em Funções e acessos (a função), só o
 * administrador.
 */

export type AccessOrigin =
  /** Administrador (inclui o Master): abre e faz tudo. */
  | { kind: "admin" }
  /** Tela do Início sem função ativa: o padrão do portal. */
  | { kind: "base" }
  /** As funções da pessoa que liberam. */
  | { kind: "functions"; keys: string[] }
  /** Ajuste individual (Personalizado): marcada à mão. */
  | { kind: "added" }
  /** Ajuste individual (Personalizado): desmarcada à mão. */
  | { kind: "removed" }
  /** Lista antiga marcada uma a uma (de antes das exceções). */
  | { kind: "legacy" }
  /** Nada libera. */
  | { kind: "none" };

export interface ScreenAccess {
  screen: Screen;
  opens: boolean;
  /** Tela protegida (Financeiro, Configurações, Equipe…): nunca por padrão. */
  protected: boolean;
  origin: AccessOrigin;
}

export interface ActionAccess {
  action: ActionKey;
  allowed: boolean;
  origin: AccessOrigin;
}

/** As telas da equipe interna, na ordem do catálogo (Funções e acessos). */
export const TEAM_SCREENS: readonly Screen[] = [
  ...new Set(PERMISSION_MODULES.flatMap((m) => m.screens)),
];

/** As ações em uso (sem as aposentadas), na ordem do catálogo. */
export const TEAM_ACTIONS: readonly ActionKey[] = ACTION_KEYS.filter(
  (a) => !isRetiredAction(a),
);

type Person = Pick<User, "role"> &
  Partial<Pick<User, "functions" | "screens" | "screenExceptions">>;

/** As telas que a pessoa abre e de onde vem cada uma. */
export function screenAccessOf(
  user: Person,
  defs: FunctionDef[],
): ScreenAccess[] {
  const admin = isAdmin(user);
  const opens = screensFor(
    user as never,
    accessFromFunctions(user.functions, defs),
  );
  const active = defs.filter((d) => !d.archived);
  const sources = screenSources(user.functions, active, WELLMIX_BASE);
  const exceptions = screenExceptionsOf(user as never);
  const legacy =
    !exceptions && Array.isArray(user.screens)
      ? new Set<string>(validScreens(user.screens))
      : null;
  return TEAM_SCREENS.map((screen) => {
    let origin: AccessOrigin;
    if (admin) origin = { kind: "admin" };
    else if (exceptions?.added.includes(screen)) origin = { kind: "added" };
    else if (exceptions?.removed.includes(screen)) origin = { kind: "removed" };
    else if (legacy)
      origin = WELLMIX_BASE.includes(screen)
        ? { kind: "base" }
        : legacy.has(screen)
          ? { kind: "legacy" }
          : { kind: "none" };
    else {
      const keys = sources.get(screen);
      origin =
        keys === undefined
          ? { kind: "none" }
          : keys.length
            ? { kind: "functions", keys }
            : { kind: "base" };
    }
    return {
      screen,
      opens: opens.has(screen),
      protected: ADMIN_ONLY.includes(screen),
      origin,
    };
  });
}

/** As ações que a pessoa pode fazer e as funções que liberam cada uma. */
export function actionAccessOf(
  user: Person,
  defs: FunctionDef[],
): ActionAccess[] {
  const admin = isAdmin(user);
  const active = defs.filter((d) => !d.archived);
  const sources = actionSources(user.functions, active);
  return TEAM_ACTIONS.map((action) => {
    const keys = sources.get(action) ?? [];
    return {
      action,
      allowed: admin || keys.length > 0,
      origin: admin
        ? { kind: "admin" }
        : keys.length
          ? { kind: "functions", keys }
          : { kind: "none" },
    };
  });
}

/** Quantas telas a pessoa abre (o número da coluna Telas); null = todas. */
export function screenCountOf(
  user: Person,
  defs: FunctionDef[],
): number | null {
  if (isAdmin(user)) return null;
  return screenAccessOf(user, defs).filter((s) => s.opens).length;
}
