"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  saveTeamAccessAction,
  type TeamSaveState,
} from "@/app/app/actions/team";
import { Alert, Button, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  actionSources,
  inheritedScreens,
  screenSources,
  toggleException,
  withExceptions,
  type ScreenExceptions,
} from "@/lib/auth/screen-picker";
import { PermissionList, type PermissionGroup } from "./permission-list";

/*
 * Editar acessos de uma pessoa da equipe (dono, 14/11/2026; docs/ACCESS.md):
 * no painel lateral da lista (TeamAccessDrawer) e na página da pessoa.
 * Cargo, funções, divisão e "Responde a"; o modo das telas (Padrão das
 * funções ou Personalizado) e a prévia de "Acessos efetivos", em telas e
 * ações, recalculada na hora a cada mudança, com a mesma regra do servidor
 * (src/lib/auth/screen-picker.ts). Cada permissão diz de onde vem: a função
 * que a libera, o padrão do portal, o Personalizado do login ou o acesso de
 * administrador. O cargo não libera telas nem ações.
 */

export interface EditorFunction {
  key: string;
  label: string;
  description: string | null;
  screens: string[];
  baseOff: string[];
  actions: string[];
}

export interface EditorMember {
  id: string;
  name: string;
  login: string;
  admin: boolean;
  jobLevel: string;
  division: string;
  managerUserId: string;
  functions: string[];
  custom: boolean;
  exceptions: ScreenExceptions;
  /** Quem não pode ser chefe dela: ela mesma e quem está abaixo. */
  blockedManagers: string[];
}

export interface EditorOptions {
  levels: Array<{ value: string; label: string }>;
  divisions: Array<{ value: string; label: string }>;
  managers: Array<{ value: string; label: string }>;
}

export interface EditorTexts {
  title: string;
  close: string;
  level: string;
  division: string;
  manager: string;
  none: string;
  functions: string;
  addFunction: string;
  removeFunction: string;
  noFunctions: string;
  modeDefault: string;
  modeDefaultHint: string;
  modeCustom: string;
  modeCustomHint: string;
  effective: string;
  screensTab: string;
  actionsTab: string;
  count: string;
  empty: string;
  inherited: string;
  portalDefault: string;
  manualAdded: string;
  manualRemoved: string;
  admin: string;
  adminNote: string;
  actionsNote: string;
  levelNote: string;
  cancel: string;
  save: string;
  saving: string;
  saved: string;
  dirty: string;
  discard: string;
  deleteLink: string;
  intl: string;
}

const INITIAL: TeamSaveState = {
  ok: false,
  error: null,
  message: null,
  savedAt: null,
};

function Tag({
  tone,
  children,
  ...rest
}: {
  tone: "inherited" | "custom" | "removed" | "admin";
  children: ReactNode;
  [data: `data-${string}`]: string | undefined;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-[14rem] items-center truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4",
        tone === "inherited" && "border-zinc-200 bg-zinc-50 text-zinc-600",
        tone === "custom" && "border-brand-200 bg-brand-50 text-brand-800",
        tone === "removed" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "admin" && "border-sky-200 bg-sky-50 text-sky-800",
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((k) => b.includes(k));

export function TeamAccessEditor({
  member,
  functions,
  screenGroups,
  actionGroups,
  base,
  options,
  texts,
  mode,
  deleteHref,
  onSaved,
  onCancel,
  onDirtyChange,
}: {
  member: EditorMember;
  /** Funções ativas, na ordem de Equipe → Funções e acessos. */
  functions: EditorFunction[];
  screenGroups: PermissionGroup[];
  actionGroups: PermissionGroup[];
  /** Telas do Início. */
  base: string[];
  options: EditorOptions;
  texts: EditorTexts;
  /** No painel lateral da lista ou na página da pessoa. */
  mode: "drawer" | "page";
  deleteHref?: string;
  onSaved?: () => void;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [jobLevel, setJobLevel] = useState(member.jobLevel);
  const [division, setDivision] = useState(member.division);
  const [manager, setManager] = useState(member.managerUserId);
  const [selected, setSelected] = useState(member.functions);
  const [custom, setCustom] = useState(member.custom);
  const [exceptions, setExceptions] = useState<ScreenExceptions>(
    member.exceptions,
  );
  const [view, setView] = useState<"screens" | "actions">("screens");
  // Seções abertas de cada aba (a primeira de cada uma começa aberta).
  const [openScreens, setOpenScreens] = useState<Set<string>>(
    () => new Set(screenGroups[0] ? [screenGroups[0].key] : []),
  );
  const [openActions, setOpenActions] = useState<Set<string>>(
    () => new Set(actionGroups[0] ? [actionGroups[0].key] : []),
  );
  const [state, formAction, pending] = useActionState(
    saveTeamAccessAction,
    INITIAL,
  );

  // A prévia: o que as funções marcadas liberam agora e de onde vem cada
  // permissão. O cargo entra na conta das telas do portal sem liberar nada.
  const preview = useMemo(() => {
    const inherited = inheritedScreens(selected, functions, base);
    return {
      inherited,
      screenFrom: screenSources(selected, functions, base),
      actionFrom: actionSources(selected, functions),
    };
  }, [selected, functions, base]);
  const allScreens = screenGroups.flatMap((g) => g.items.map((i) => i.key));
  const allActions = actionGroups.flatMap((g) => g.items.map((i) => i.key));
  const screens = member.admin
    ? new Set(allScreens)
    : custom
      ? withExceptions(preview.inherited, exceptions)
      : preview.inherited;
  const actions = member.admin
    ? new Set(allActions)
    : new Set(preview.actionFrom.keys());

  const labelOf = (key: string) =>
    functions.find((f) => f.key === key)?.label ?? key;
  const dirty =
    jobLevel !== member.jobLevel ||
    division !== member.division ||
    manager !== member.managerUserId ||
    !sameList(selected, member.functions) ||
    custom !== member.custom ||
    (custom &&
      (!sameList(exceptions.added, member.exceptions.added) ||
        !sameList(exceptions.removed, member.exceptions.removed)));

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (state.ok && state.savedAt) onSaved?.();
    // Só quando o servidor termina uma gravação nova.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  const toggler =
    (set: (fn: (current: Set<string>) => Set<string>) => void) =>
    (key: string) =>
      set((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
  const countLabel = (n: number, total: number) =>
    texts.count.replace("{n}", String(n)).replace("{total}", String(total));
  // Nomes na ordem da lista de funções (Equipe → Funções e acessos).
  const order = (key: string) => functions.findIndex((f) => f.key === key);
  const from = (keys: string[] | undefined) =>
    keys?.length
      ? texts.inherited.replace(
          "{names}",
          [...keys]
            .sort((a, b) => order(a) - order(b))
            .map(labelOf)
            .join(", "),
        )
      : null;

  const screenBadges = (key: string) => {
    if (member.admin)
      return (
        <Tag tone="admin" data-team-screen-from="admin">
          {texts.admin}
        </Tag>
      );
    const sources = preview.screenFrom.get(key);
    const inherited =
      sources === undefined ? null : (from(sources) ?? texts.portalDefault);
    const added = custom && exceptions.added.includes(key);
    const removed = custom && exceptions.removed.includes(key);
    return (
      <>
        {inherited ? (
          <Tag tone="inherited" data-team-screen-from="inherited">
            {inherited}
          </Tag>
        ) : null}
        {added ? (
          <Tag tone="custom" data-team-screen-from="custom">
            {texts.manualAdded}
          </Tag>
        ) : null}
        {removed ? (
          <Tag tone="removed" data-team-screen-from="removed">
            {texts.manualRemoved}
          </Tag>
        ) : null}
      </>
    );
  };
  const actionBadges = (key: string) => {
    if (member.admin)
      return (
        <Tag tone="admin" data-team-action-from="admin">
          {texts.admin}
        </Tag>
      );
    const inherited = from(preview.actionFrom.get(key));
    return inherited ? (
      <Tag tone="inherited" data-team-action-from="inherited">
        {inherited}
      </Tag>
    ) : null;
  };

  const savedAt = state.savedAt
    ? new Date(state.savedAt).toLocaleTimeString(texts.intl, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const unselected = functions.filter((f) => !selected.includes(f.key));
  const field = "mb-1 block text-xs font-semibold text-zinc-700";
  const select =
    "block min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

  const modeCard = (value: boolean, label: string, hint: string) => (
    <label
      className={cx(
        "flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-sm transition",
        custom === value
          ? "border-brand-600 bg-brand-50/60 text-brand-900"
          : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300",
      )}
    >
      <input
        type="radio"
        name="screensMode"
        value={value ? "custom" : "default"}
        checked={custom === value}
        onChange={() => setCustom(value)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
        data-team-screens-mode={value ? "custom" : "default"}
      />
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="block text-xs text-zinc-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <form
      action={formAction}
      className={cx("flex min-h-0 flex-col", mode === "drawer" && "h-full")}
      data-team-access-form={member.id}
    >
      <input type="hidden" name="userId" value={member.id} />
      <input type="hidden" name="functions.__form" value="1" />
      {selected.map((f) => (
        <input key={f} type="hidden" name="functions" value={f} />
      ))}
      {!member.admin ? (
        <>
          <input type="hidden" name="screens.__form" value="1" />
          {custom ? (
            <>
              <input type="hidden" name="screens.__exceptions" value="1" />
              {exceptions.added.map((s) => (
                <input key={`+${s}`} type="hidden" name="exAdded" value={s} />
              ))}
              {exceptions.removed.map((s) => (
                <input key={`-${s}`} type="hidden" name="exRemoved" value={s} />
              ))}
            </>
          ) : null}
        </>
      ) : null}

      <div
        className={cx(
          "min-h-0 flex-1 space-y-4",
          mode === "drawer" && "overflow-y-auto px-4 pb-4 sm:px-5",
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={field}>{texts.level}</span>
            <select
              name="jobLevel"
              value={jobLevel}
              onChange={(e) => setJobLevel(e.target.value)}
              className={select}
              data-team-level
            >
              <option value="">{texts.none}</option>
              {options.levels.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-zinc-500">
              {texts.levelNote}
            </span>
          </label>
          <label className="block">
            <span className={field}>{texts.division}</span>
            <select
              name="division"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className={select}
              data-team-division
            >
              <option value="">{texts.none}</option>
              {options.divisions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className={field}>{texts.manager}</span>
            <select
              name="managerUserId"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              className={select}
              data-team-manager
            >
              <option value="">{texts.none}</option>
              {options.managers
                .filter((o) => !member.blockedManagers.includes(o.value))
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div>
          <span className={field}>{texts.functions}</span>
          <div
            className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5"
            data-team-functions
          >
            {selected.length === 0 ? (
              <span className="px-1 text-sm text-zinc-400">
                {texts.noFunctions}
              </span>
            ) : null}
            {selected.map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 py-0.5 pl-2 pr-1 text-sm text-zinc-800"
                data-team-function-chip={key}
              >
                {labelOf(key)}
                <button
                  type="button"
                  onClick={() =>
                    setSelected((current) => current.filter((k) => k !== key))
                  }
                  aria-label={texts.removeFunction.replace(
                    "{name}",
                    labelOf(key),
                  )}
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                  data-team-function-remove={key}
                >
                  <span aria-hidden>×</span>
                </button>
              </span>
            ))}
            {unselected.length ? (
              <select
                value=""
                onChange={(e) => {
                  const key = e.target.value;
                  if (key) setSelected((current) => [...current, key]);
                }}
                aria-label={texts.addFunction}
                className="min-h-9 min-w-[10rem] flex-1 rounded-md border-0 bg-transparent px-1 text-sm text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
                data-team-function-add
              >
                <option value="">+ {texts.addFunction}</option>
                {unselected.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>

        {member.admin ? (
          <Alert tone="info">{texts.adminNote}</Alert>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {modeCard(false, texts.modeDefault, texts.modeDefaultHint)}
            {modeCard(true, texts.modeCustom, texts.modeCustomHint)}
          </div>
        )}

        <div data-team-effective={custom ? "custom" : "default"}>
          <h3 className="text-base font-semibold tracking-tight text-zinc-900">
            {texts.effective}
          </h3>
          <div
            role="tablist"
            className="mt-2 flex gap-1 border-b border-zinc-200"
            aria-label={texts.effective}
          >
            {(["screens", "actions"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cx(
                  "-mb-px min-h-11 border-b-2 px-3 text-sm font-semibold transition",
                  view === v
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-zinc-500 hover:text-zinc-800",
                )}
                data-team-view={v}
              >
                {v === "screens" ? texts.screensTab : texts.actionsTab}
                <span className="ml-1.5 text-xs font-medium tabular-nums text-zinc-400">
                  {v === "screens"
                    ? allScreens.filter((s) => screens.has(s)).length
                    : allActions.filter((a) => actions.has(a)).length}
                </span>
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            hidden={view !== "screens"}
            className="mt-3"
            data-team-screens-panel
          >
            <PermissionList
              groups={screenGroups}
              query=""
              open={openScreens}
              onToggleGroup={toggler(setOpenScreens)}
              checked={(k) => screens.has(k)}
              disabled={() => member.admin || !custom}
              onChange={(k, on) =>
                setExceptions((current) =>
                  toggleException(current, k, on, preview.inherited),
                )
              }
              badges={screenBadges}
              attr="data-team-screen"
              countLabel={countLabel}
              emptyText={texts.empty}
            />
          </div>
          <div
            role="tabpanel"
            hidden={view !== "actions"}
            className="mt-3"
            data-team-actions-panel
          >
            <p className="mb-2 text-xs text-zinc-500">{texts.actionsNote}</p>
            <PermissionList
              groups={actionGroups}
              query=""
              open={openActions}
              onToggleGroup={toggler(setOpenActions)}
              checked={(k) => actions.has(k)}
              disabled={() => true}
              badges={actionBadges}
              attr="data-team-action"
              countLabel={countLabel}
              emptyText={texts.empty}
            />
          </div>
        </div>
        {mode === "drawer" && deleteHref ? (
          <a
            href={deleteHref}
            className="inline-block text-xs font-medium text-red-700 underline decoration-red-200 underline-offset-2 hover:decoration-red-600"
            data-team-delete-link
          >
            {texts.deleteLink}
          </a>
        ) : null}
      </div>

      <div
        className={cx(
          "flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 bg-white py-3",
          mode === "drawer"
            ? "px-4 sm:px-5"
            : "sticky bottom-0 z-10 mt-4 bg-white/95 backdrop-blur",
        )}
      >
        <span
          role="status"
          aria-live="polite"
          className="mr-auto text-sm"
          data-team-save-status={
            pending
              ? "saving"
              : state.error
                ? "error"
                : dirty
                  ? "dirty"
                  : state.ok
                    ? "saved"
                    : "idle"
          }
        >
          {pending ? (
            <span className="text-zinc-500">{texts.saving}</span>
          ) : state.error ? (
            <span className="text-red-700" data-team-save-error>
              {state.message}
            </span>
          ) : dirty ? (
            <span className="text-amber-700">{texts.dirty}</span>
          ) : state.ok ? (
            <span className="font-medium text-emerald-700" data-team-saved>
              {texts.saved.replace("{time}", savedAt)}
            </span>
          ) : null}
        </span>
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            data-team-cancel
          >
            {texts.cancel}
          </Button>
        ) : null}
        <SubmitButton pendingText={texts.saving} data-team-save>
          {texts.save}
        </SubmitButton>
      </div>
    </form>
  );
}
