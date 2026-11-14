import "server-only";

import { cache } from "react";
import { getStore, type User } from "@/lib/db";
import { isAdmin } from "@/lib/auth/permissions";
import { ForbiddenError } from "@/lib/auth/permissions";
import { SCREENS, WELLMIX_BASE, type Screen } from "@/lib/auth/screens";
import {
  ACTION_KEYS,
  customFunctionKey,
  isCustomFunctionKey,
  resolveFunctions,
  type ActionKey,
  type FunctionDef,
  type StoredFunctions,
} from "@/lib/auth/function-access";
import { WELLMIX_FUNCTIONS } from "@/lib/db/schema";
import { audit } from "./audit";

/*
 * Funções da equipe (Equipe → Funções e acessos): telas e ações de cada
 * função, gravadas na tabela `settings` (chave `teamFunctions`, sem coluna
 * nova). Função de fábrica sem nada gravado segue o padrão do código.
 */

export const TEAM_FUNCTIONS_KEY = "teamFunctions";

export class TeamFunctionError extends Error {}

async function readStored(): Promise<StoredFunctions | null> {
  const [row] = await getStore().list("settings", {
    filter: { key: TEAM_FUNCTIONS_KEY },
    limit: 1,
  });
  return (row?.value as StoredFunctions | undefined) ?? null;
}

/** As funções em uso (uma leitura por requisição). Banco fora do ar: o padrão do código. */
export const loadFunctionDefs = cache(async (): Promise<FunctionDef[]> => {
  try {
    return resolveFunctions(await readStored());
  } catch {
    return resolveFunctions(null);
  }
});

/** Grava a lista inteira (só o que difere do padrão é útil, mas guardamos tudo para ficar explícito). */
async function writeDefs(defs: FunctionDef[]) {
  const store = getStore();
  const value: StoredFunctions = {
    functions: defs.map((d) => ({
      key: d.key,
      name: d.name,
      screens: d.screens,
      actions: d.actions,
      baseOff: d.baseOff,
      archived: d.archived,
    })),
  };
  const [existing] = await store.list("settings", {
    filter: { key: TEAM_FUNCTIONS_KEY },
    limit: 1,
  });
  if (existing) await store.update("settings", existing.id, { value });
  else await store.create("settings", { key: TEAM_FUNCTIONS_KEY, value });
}

function assertAdmin(user: User) {
  if (!isAdmin(user)) throw new ForbiddenError();
}

async function current(): Promise<FunctionDef[]> {
  return resolveFunctions(await readStored());
}

/** Cria uma função nova (sem telas nem ações até o administrador marcar). */
export async function createFunction(
  user: User,
  name: string,
): Promise<FunctionDef> {
  assertAdmin(user);
  const defs = await current();
  const clean = name.trim();
  if (clean.length < 2) throw new TeamFunctionError("name");
  if (defs.some((d) => (d.name ?? "").toLowerCase() === clean.toLowerCase()))
    throw new TeamFunctionError("duplicate");
  const def: FunctionDef = {
    key: customFunctionKey(
      clean,
      defs.map((d) => d.key),
    ),
    name: clean,
    builtin: false,
    screens: [],
    actions: [],
    baseOff: [],
    archived: false,
  };
  await writeDefs([...defs, def]);
  await audit(
    user,
    "team.function_create",
    "user",
    user.id,
    `Função criada: ${clean}`,
  );
  return def;
}

/** Muda o nome (vazio na de fábrica volta ao nome original). */
export async function renameFunction(user: User, key: string, name: string) {
  assertAdmin(user);
  const defs = await current();
  const def = defs.find((d) => d.key === key);
  if (!def) throw new TeamFunctionError("not_found");
  const clean = name.trim();
  if (!def.builtin && clean.length < 2) throw new TeamFunctionError("name");
  def.name = clean || null;
  await writeDefs(defs);
  await audit(
    user,
    "team.function_rename",
    "user",
    user.id,
    `Função ${key}: ${clean || "(nome de fábrica)"}`,
  );
}

/**
 * Telas da função. As do Início vêm na mesma lista: as que não vierem marcadas
 * ficam em `baseOff` (desmarcadas só nesta função).
 */
export async function setFunctionScreens(
  user: User,
  key: string,
  screens: Screen[],
) {
  assertAdmin(user);
  const defs = await current();
  const def = defs.find((d) => d.key === key);
  if (!def) throw new TeamFunctionError("not_found");
  def.screens = SCREENS.filter(
    (s) => screens.includes(s) && !WELLMIX_BASE.includes(s),
  );
  def.baseOff = WELLMIX_BASE.filter((s) => !screens.includes(s));
  await writeDefs(defs);
  await audit(
    user,
    "team.function_screens",
    "user",
    user.id,
    `Função ${key}: ${def.screens.join(", ") || "(só o básico)"}${
      def.baseOff.length ? ` · Início sem: ${def.baseOff.join(", ")}` : ""
    }`,
  );
}

/** Ações da função. */
export async function setFunctionActions(
  user: User,
  key: string,
  actions: ActionKey[],
) {
  assertAdmin(user);
  const defs = await current();
  const def = defs.find((d) => d.key === key);
  if (!def) throw new TeamFunctionError("not_found");
  def.actions = ACTION_KEYS.filter((a) => actions.includes(a));
  await writeDefs(defs);
  await audit(
    user,
    "team.function_actions",
    "user",
    user.id,
    `Função ${key}: ${def.actions.join(", ") || "(nenhuma)"}`,
  );
}

/** Função de fábrica: volta ao padrão do código (nome, telas e ações). */
export async function resetFunction(user: User, key: string) {
  assertAdmin(user);
  if (!(WELLMIX_FUNCTIONS as readonly string[]).includes(key))
    throw new TeamFunctionError("not_found");
  const stored = await readStored();
  await writeDefs(
    resolveFunctions({
      functions: (stored?.functions ?? []).filter((f) => f.key !== key),
    }),
  );
  await audit(
    user,
    "team.function_reset",
    "user",
    user.id,
    `Função ${key}: padrão do código`,
  );
}

/** Função criada: desativa (some das listas; os logins com ela deixam de ter o que ela liberava) ou reativa. */
export async function setFunctionArchived(
  user: User,
  key: string,
  archived: boolean,
) {
  assertAdmin(user);
  if (!isCustomFunctionKey(key)) throw new TeamFunctionError("builtin");
  const defs = await current();
  const def = defs.find((d) => d.key === key);
  if (!def) throw new TeamFunctionError("not_found");
  def.archived = archived;
  await writeDefs(defs);
  await audit(
    user,
    "team.function_archive",
    "user",
    user.id,
    `Função ${key}: ${archived ? "desativada" : "reativada"}`,
  );
}
