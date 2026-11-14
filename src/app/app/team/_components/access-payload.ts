import "server-only";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { User } from "@/lib/db";
import { DIVISIONS, JOB_LEVELS } from "@/lib/db/schema";
import { loginLabel } from "@/lib/auth/login-id";
import { isAdmin } from "@/lib/auth/permissions";
import {
  ADMIN_ONLY,
  SCREEN_LABEL,
  WELLMIX_BASE,
  hasCustomScreens,
  screenExceptionsOf,
  screensFor,
  type Screen,
} from "@/lib/auth/screens";
import {
  accessFromFunctions,
  functionDescription,
  functionLabel,
  type FunctionDef,
} from "@/lib/auth/function-access";
import {
  PERMISSION_MODULES,
  isRetiredAction,
} from "@/lib/auth/permission-modules";
import { exceptionsOf, inheritedScreens } from "@/lib/auth/screen-picker";
import { descendantsOf } from "@/lib/services/team";
import type { PermissionGroup } from "./permission-list";
import type {
  EditorFunction,
  EditorMember,
  EditorOptions,
  EditorTexts,
} from "./team-access-editor";

/*
 * O que o servidor monta para as telas de permissão (Funções e acessos e o
 * painel Editar acessos): as seções por módulo, as funções com o que liberam,
 * cada pessoa com o que está gravado e os textos. Os dados vêm das regras do
 * portal (src/lib/auth/screens.ts, function-access.ts, permission-modules.ts).
 */

/** Nota curta de telas que abrem mais de um lugar do menu. */
const SCREEN_NOTE: Partial<Record<Screen, DictionaryKey>> = {
  booking: "perm.note.booking",
  quotes: "perm.note.quotes",
  products: "perm.note.products",
  finance: "perm.note.finance",
};

export function permissionGroups(t: Translate): {
  screens: PermissionGroup[];
  actions: PermissionGroup[];
} {
  return {
    screens: PERMISSION_MODULES.map((m) => ({
      key: m.key,
      label: t(m.label),
      items: m.screens.map((s) => ({
        key: s,
        label: t(SCREEN_LABEL[s]),
        note: [
          SCREEN_NOTE[s] ? t(SCREEN_NOTE[s]) : null,
          ADMIN_ONLY.includes(s) ? t("fn.screens.adminOnly") : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    })),
    actions: PERMISSION_MODULES.map((m) => ({
      key: m.key,
      label: t(m.label),
      items: m.actions
        .filter((a) => !isRetiredAction(a))
        .map((a) => ({
          key: a,
          label: t(`action.${a}` as DictionaryKey),
          note: t(`action.desc.${a}` as DictionaryKey),
        })),
    })).filter((g) => g.items.length > 0),
  };
}

/** Telas marcadas numa função: as do Início que ela deixa e as outras. */
export const functionScreenMarks = (def: FunctionDef): string[] => [
  ...WELLMIX_BASE.filter((s) => !def.baseOff.includes(s)),
  ...def.screens,
];

export function editorFunctions(
  defs: FunctionDef[],
  t: Translate,
): EditorFunction[] {
  return defs
    .filter((d) => !d.archived)
    .map((d) => ({
      key: d.key,
      label: functionLabel(d.key, defs, (k) => t(k as DictionaryKey)),
      description: d.builtin
        ? functionDescription(d.key, (k) => t(k as DictionaryKey))
        : null,
      screens: d.screens,
      baseOff: d.baseOff,
      actions: d.actions.filter((a) => !isRetiredAction(a)),
    }));
}

/**
 * Uma pessoa para o editor. Personalizado: as exceções gravadas, ou, num
 * cadastro com a lista antiga marcada uma a uma, a diferença entre ela e o
 * que as funções liberam hoje (salvar grava como exceções).
 */
export function editorMember(
  member: User,
  team: User[],
  defs: FunctionDef[],
): EditorMember {
  const custom = hasCustomScreens(member);
  const saved = screenExceptionsOf(member);
  const active = defs.filter((d) => !d.archived);
  const exceptions =
    saved ??
    (custom
      ? exceptionsOf(
          screensFor(member, accessFromFunctions(member.functions, defs)),
          inheritedScreens(member.functions, active, WELLMIX_BASE),
        )
      : { added: [], removed: [] });
  return {
    id: member.id,
    name: member.name,
    login: loginLabel(member.email),
    admin: isAdmin(member),
    jobLevel: member.jobLevel ?? "",
    division: member.division ?? "",
    managerUserId: member.managerUserId ?? "",
    functions: (member.functions ?? []).filter((f) =>
      active.some((d) => d.key === f),
    ),
    custom,
    exceptions: {
      added: [...exceptions.added],
      removed: [...exceptions.removed],
    },
    blockedManagers: [member.id, ...descendantsOf(member.id, team)],
  };
}

export function editorOptions(team: User[], t: Translate): EditorOptions {
  return {
    levels: JOB_LEVELS.map((l) => ({
      value: l,
      label: t(`level.${l}` as DictionaryKey),
    })),
    divisions: DIVISIONS.map((d) => ({
      value: d,
      label: t(`division.${d}` as DictionaryKey),
    })),
    managers: team.map((m) => ({ value: m.id, label: m.name })),
  };
}

export function editorTexts(t: Translate): EditorTexts {
  return {
    title: t("team.edit"),
    close: t("team.modal.close"),
    level: t("team.col.level"),
    division: t("team.col.division"),
    manager: t("team.col.manager"),
    none: t("team.none"),
    functions: t("team.col.functions"),
    addFunction: t("access.addFunction"),
    removeFunction: t("access.removeFunction"),
    noFunctions: t("access.noFunctions"),
    modeDefault: t("team.screens.mode.default"),
    modeDefaultHint: t("access.modeDefaultHint"),
    modeCustom: t("access.modeCustom"),
    modeCustomHint: t("access.modeCustomHint"),
    effective: t("access.effective"),
    screensTab: t("fn.view.screens"),
    actionsTab: t("fn.view.actions"),
    count: t("perm.count"),
    empty: t("perm.empty"),
    inherited: t("access.inherited"),
    portalDefault: t("access.portalDefault"),
    manualAdded: t("access.manualAdded"),
    manualRemoved: t("access.manualRemoved"),
    admin: t("access.adminBadge"),
    adminNote: t("team.screens.adminNote"),
    actionsNote: t("access.actionsNote"),
    levelNote: t("access.levelNote"),
    cancel: t("common.cancel"),
    save: t("access.save"),
    saving: t("access.saving"),
    saved: t("access.saved"),
    dirty: t("access.dirty"),
    discard: t("access.discard"),
    deleteLink: t("team.delete.open"),
    intl: t.intl,
  };
}
