"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  archiveFunctionAction,
  renameFunctionAction,
  resetFunctionAction,
  saveFunctionPermissionsAction,
  type TeamSaveState,
} from "@/app/app/actions/team";
import { Alert, Badge, Button, Input, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PermissionList, type PermissionGroup } from "./permission-list";

/*
 * Função escolhida em Equipe e acessos → Funções e acessos (dono,
 * 14/11/2026): nome com o menu ⋯ (renomear, restaurar o nome padrão, voltar
 * ao padrão, desativar), "Telas e links" e "Ações" no mesmo painel, em linhas
 * por módulo do portal, com busca, e um botão só, "Salvar permissões", que
 * grava as duas abas. Trocar de aba não perde o que foi marcado; o aviso de
 * salvo aparece depois que o servidor terminou.
 */

export interface FunctionView {
  key: string;
  label: string;
  builtin: boolean;
  archived: boolean;
  /** Nome dado pelo administrador (nulo = o nome padrão). */
  customName: string | null;
  description: string | null;
  members: string;
  kind: string;
}

export interface FunctionTexts {
  screensTab: string;
  actionsTab: string;
  search: string;
  empty: string;
  count: string;
  save: string;
  saving: string;
  saved: string;
  dirty: string;
  menu: string;
  rename: string;
  renameLabel: string;
  renameHint: string;
  renameSave: string;
  cancel: string;
  restoreName: string;
  restoreNameNone: string;
  reset: string;
  resetConfirm: string;
  archive: string;
  archiveConfirm: string;
  unarchive: string;
  discard: string;
  screensHint: string;
  actionsHint: string;
  adminNote: string;
  intl: string;
}

const INITIAL: TeamSaveState = {
  ok: false,
  error: null,
  message: null,
  savedAt: null,
};

const same = (a: ReadonlySet<string>, b: readonly string[]) =>
  a.size === b.length && b.every((k) => a.has(k));

export function FunctionPermissions({
  fn,
  screenGroups,
  actionGroups,
  initialScreens,
  initialActions,
  initialView,
  texts,
}: {
  fn: FunctionView;
  screenGroups: PermissionGroup[];
  actionGroups: PermissionGroup[];
  /** Telas marcadas (as do Início que a função deixa e as outras). */
  initialScreens: string[];
  initialActions: string[];
  initialView: "screens" | "actions";
  texts: FunctionTexts;
}) {
  const [screens, setScreens] = useState(() => new Set(initialScreens));
  const [actions, setActions] = useState(() => new Set(initialActions));
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  // Seções abertas de cada aba (a primeira de cada uma começa aberta).
  const [openScreens, setOpenScreens] = useState<Set<string>>(
    () => new Set(screenGroups[0] ? [screenGroups[0].key] : []),
  );
  const [openActions, setOpenActions] = useState<Set<string>>(
    () => new Set(actionGroups[0] ? [actionGroups[0].key] : []),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [state, formAction, pending] = useActionState(
    saveFunctionPermissionsAction,
    INITIAL,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const dirty =
    !same(screens, initialScreens) || !same(actions, initialActions);

  // Menu ⋯: fecha ao tocar fora ou com Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const toggle =
    (set: (fn: (s: Set<string>) => Set<string>) => void) =>
    (key: string, on: boolean) =>
      set((current) => {
        const next = new Set(current);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      });

  const toggler =
    (set: (fn: (current: Set<string>) => Set<string>) => void) =>
    (key: string) =>
      set((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });

  // Ações do menu que recarregam a tela: perguntar antes de perder o que não
  // foi salvo.
  const keepUnsaved = (e: FormEvent) => {
    if (dirty && !window.confirm(texts.discard)) e.preventDefault();
  };

  const countLabel = (n: number, total: number) =>
    texts.count.replace("{n}", String(n)).replace("{total}", String(total));
  const savedAt = state.savedAt
    ? new Date(state.savedAt).toLocaleTimeString(texts.intl, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const tab = (v: "screens" | "actions", label: string, n: number) => (
    <button
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
      data-fn-view={v}
    >
      {label}
      <span className="ml-1.5 text-xs font-medium tabular-nums text-zinc-400">
        {n}
      </span>
    </button>
  );

  const visibleActions = actionGroups.flatMap((g) => g.items.map((i) => i.key));

  return (
    <section
      className="min-w-0 rounded-2xl border border-zinc-200/80 bg-white p-3.5 shadow-sm shadow-zinc-900/[0.03] sm:p-4"
      data-fn-detail={fn.key}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
            <span data-fn-name>{fn.label}</span>
            <Badge tone={fn.archived ? "warning" : "neutral"}>{fn.kind}</Badge>
          </h2>
          <p className="text-sm text-zinc-500" data-fn-members>
            {fn.members}
          </p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={texts.menu}
            title={texts.menu}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg leading-none text-zinc-700 shadow-sm hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            data-fn-menu
          >
            <span aria-hidden>⋯</span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-zinc-200 bg-white p-1 text-sm shadow-lg"
              data-fn-menu-list
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setRenaming(true);
                  setMenuOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-100"
                data-fn-menu-rename
              >
                {texts.rename}
              </button>
              {fn.builtin ? (
                <form action={renameFunctionAction} onSubmit={keepUnsaved}>
                  <input type="hidden" name="key" value={fn.key} />
                  <input type="hidden" name="name" value="" />
                  <button
                    type="submit"
                    role="menuitem"
                    disabled={!fn.customName}
                    title={fn.customName ? undefined : texts.restoreNameNone}
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400 disabled:hover:bg-transparent"
                    data-fn-menu-restore-name
                  >
                    {texts.restoreName}
                  </button>
                </form>
              ) : null}
              <div className="my-1 border-t border-zinc-100" />
              {fn.builtin ? (
                <form
                  action={resetFunctionAction}
                  onSubmit={(e) => {
                    if (!window.confirm(texts.resetConfirm)) e.preventDefault();
                  }}
                >
                  <input type="hidden" name="key" value={fn.key} />
                  <button
                    type="submit"
                    role="menuitem"
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-100"
                    data-fn-menu-reset
                  >
                    {texts.reset}
                  </button>
                </form>
              ) : (
                <form
                  action={archiveFunctionAction}
                  onSubmit={(e) => {
                    if (!fn.archived && !window.confirm(texts.archiveConfirm))
                      e.preventDefault();
                    else keepUnsaved(e);
                  }}
                >
                  <input type="hidden" name="key" value={fn.key} />
                  <input
                    type="hidden"
                    name="archived"
                    value={fn.archived ? "0" : "1"}
                  />
                  <button
                    type="submit"
                    role="menuitem"
                    className="block w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-100"
                    data-fn-menu-archive
                  >
                    {fn.archived ? texts.unarchive : texts.archive}
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {renaming ? (
        <form
          action={renameFunctionAction}
          onSubmit={keepUnsaved}
          className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3"
          data-fn-rename
        >
          <input type="hidden" name="key" value={fn.key} />
          <label className="min-w-0 flex-1 text-xs font-medium text-zinc-700">
            {texts.renameLabel}
            <Input
              name="name"
              defaultValue={fn.customName ?? ""}
              placeholder={fn.label}
              maxLength={60}
              autoFocus
              className="mt-1"
            />
            {fn.builtin ? (
              <span className="mt-1 block font-normal text-zinc-500">
                {texts.renameHint}
              </span>
            ) : null}
          </label>
          <SubmitButton className="text-sm" data-fn-rename-save>
            {texts.renameSave}
          </SubmitButton>
          <Button
            type="button"
            variant="secondary"
            className="text-sm"
            onClick={() => setRenaming(false)}
          >
            {texts.cancel}
          </Button>
        </form>
      ) : null}

      {fn.description ? (
        <p className="mt-2 text-sm text-zinc-600">{fn.description}</p>
      ) : null}

      <div
        role="tablist"
        className="mt-3 flex gap-1 border-b border-zinc-200"
        aria-label={fn.label}
      >
        {tab("screens", texts.screensTab, screens.size)}
        {tab(
          "actions",
          texts.actionsTab,
          visibleActions.filter((a) => actions.has(a)).length,
        )}
      </div>

      <form action={formAction} className="mt-3" data-fn-form={fn.key}>
        <input type="hidden" name="key" value={fn.key} />
        {[...screens].map((s) => (
          <input key={`s-${s}`} type="hidden" name="screens" value={s} />
        ))}
        {[...actions].map((a) => (
          <input key={`a-${a}`} type="hidden" name="actions" value={a} />
        ))}
        <label className="relative block">
          <span className="sr-only">{texts.search}</span>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5L17 17" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={texts.search}
            className="block min-h-11 w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
            data-fn-search
          />
        </label>
        <p className="mt-2 text-xs text-zinc-500">
          {view === "screens" ? texts.screensHint : texts.actionsHint}
        </p>

        <div
          role="tabpanel"
          hidden={view !== "screens"}
          className="mt-3"
          data-fn-screens={fn.key}
        >
          <PermissionList
            groups={screenGroups}
            query={query}
            open={openScreens}
            onToggleGroup={toggler(setOpenScreens)}
            checked={(k) => screens.has(k)}
            onChange={toggle(setScreens)}
            attr="data-fn-screen"
            countLabel={countLabel}
            emptyText={texts.empty}
          />
        </div>
        <div
          role="tabpanel"
          hidden={view !== "actions"}
          className="mt-3"
          data-fn-actions={fn.key}
        >
          <PermissionList
            groups={actionGroups}
            query={query}
            open={openActions}
            onToggleGroup={toggler(setOpenActions)}
            checked={(k) => actions.has(k)}
            onChange={toggle(setActions)}
            attr="data-fn-action"
            countLabel={countLabel}
            emptyText={texts.empty}
          />
        </div>

        <p className="mt-3 text-xs text-zinc-500">{texts.adminNote}</p>

        {/* Um botão só para as duas abas, sempre à vista no fim do painel. */}
        <div className="sticky bottom-0 z-10 -mx-3.5 mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-zinc-200 bg-white/95 px-3.5 py-3 backdrop-blur sm:-mx-4 sm:px-4">
          <span
            role="status"
            aria-live="polite"
            className="mr-auto text-sm"
            data-fn-status={
              pending
                ? "saving"
                : dirty
                  ? "dirty"
                  : state.ok
                    ? "saved"
                    : state.error
                      ? "error"
                      : "idle"
            }
          >
            {pending ? (
              <span className="text-zinc-500">{texts.saving}</span>
            ) : dirty ? (
              <span className="text-amber-700">{texts.dirty}</span>
            ) : state.ok ? (
              <span className="font-medium text-emerald-700" data-fn-saved>
                {texts.saved.replace("{time}", savedAt)}
              </span>
            ) : null}
          </span>
          <SubmitButton pendingText={texts.saving} data-fn-save>
            {texts.save}
          </SubmitButton>
        </div>
        {state.error && !pending ? (
          <div className="mt-2" data-fn-error>
            <Alert tone="danger">{state.message}</Alert>
          </div>
        ) : null}
      </form>
    </section>
  );
}
