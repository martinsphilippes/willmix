import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { TeamArea, TeamPosition, User } from "@/lib/db";
import {
  ADMIN_ONLY,
  SCREEN_LABEL,
  WELLMIX_BASE,
  isScreen,
  type Screen,
} from "@/lib/auth/screens";
import type { FunctionDef } from "@/lib/auth/function-access";
import { isRetiredAction } from "@/lib/auth/permission-modules";
import {
  TEAM_SCREENS,
  actionAccessOf,
  screenAccessOf,
  type AccessOrigin,
  type ScreenAccess,
} from "@/lib/auth/screen-origin";
import { Alert, Badge, Select, cx } from "@/components/ui";
import { AutoApply } from "@/components/auto-apply";
import { SidePanel } from "@/components/side-panel";
import type { PanelLinks } from "./team-panels";

/*
 * Gestão de telas da Equipe Interna (dono, 17/11/2026;
 * docs/EQUIPE_ACESSOS.md, etapa 5), no modelo da Equipe Externa, em dois
 * modos:
 * - "Por usuário, cargo, área ou função": escolhido o escopo e o registro, as
 *   telas (Tela, Situação, Abre, No menu, Origem). Na pessoa, o acesso
 *   efetivo (consulta); na função, a regra coletiva; no cargo e na área, o
 *   acesso de cada pessoa do escopo (eles não liberam telas sozinhos, D13).
 * - "Por tela": quem abre a tela (pessoas, cargos, áreas e as funções que a
 *   liberam), com a origem.
 * Tudo sai das regras de cada requisição (screen-origin.ts). "No menu" da
 * equipe interna é só consulta (acompanha "Abre", R3). Gravar continua em
 * Editar acessos e em Funções e acessos, só o administrador.
 */

export type ScreensScope = "user" | "position" | "area" | "function";
export const SCREENS_SCOPES: readonly ScreensScope[] = [
  "user",
  "position",
  "area",
  "function",
];
export const isScreensScope = (v: unknown): v is ScreensScope =>
  typeof v === "string" && (SCREENS_SCOPES as readonly string[]).includes(v);

export interface ScreensState {
  mode: "scope" | "screen";
  scope: ScreensScope;
  id: string | null;
  screen: Screen;
}

const linkClass =
  "font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600";
const th =
  "border-b border-zinc-200 bg-zinc-50/80 px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
const td = "border-b border-zinc-100 px-2.5 py-1.5 align-top";

function Segmented({
  label,
  items,
  ...rest
}: {
  label: string;
  items: { key: string; href: string; label: string; current: boolean }[];
} & { [key: `data-${string}`]: string | undefined }) {
  return (
    <nav
      aria-label={label}
      className="inline-flex flex-wrap rounded-lg bg-zinc-100 p-1"
      {...rest}
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          scroll={false}
          replace
          aria-current={item.current ? "page" : undefined}
          className={cx(
            "rounded-md px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
            item.current
              ? "bg-brand-600 text-white shadow-sm"
              : "text-zinc-700 hover:bg-white hover:text-zinc-900",
          )}
          data-team-screens-option={item.key}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Texto da origem de uma tela ou ação. */
export function originText(
  t: Translate,
  origin: AccessOrigin,
  label: (key: string) => string,
): string {
  switch (origin.kind) {
    case "admin":
      return t("internalTeam.origin.admin");
    case "base":
      return t("internalTeam.origin.base");
    case "functions":
      return t("internalTeam.origin.functions", {
        list: origin.keys.map(label).join(", "),
      });
    case "added":
      return t("internalTeam.origin.added");
    case "removed":
      return t("internalTeam.origin.removed");
    case "legacy":
      return t("internalTeam.origin.legacy");
    default:
      return "—";
  }
}

function StatusBadge({ t, row }: { t: Translate; row: ScreenAccess }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {row.opens ? (
        <Badge tone="success">
          {t("internalTeam.screensPanel.status.open")}
        </Badge>
      ) : (
        <Badge>{t("internalTeam.screensPanel.status.closed")}</Badge>
      )}
      {row.protected ? (
        <span title={t("internalTeam.screensPanel.protectedNote")}>
          <Badge tone="warning">
            {t("internalTeam.screensPanel.status.protected")}
          </Badge>
        </span>
      ) : null}
    </span>
  );
}

const yesNo = (t: Translate, on: boolean) =>
  on ? t("internalTeam.screensPanel.yes") : t("internalTeam.screensPanel.no");

/** Tabela de telas de uma pessoa ou da regra de uma função. */
function ScreensTable({
  t,
  rows,
  label,
}: {
  t: Translate;
  rows: ScreenAccess[];
  label: (key: string) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full min-w-[34rem] text-sm" data-team-screens-table>
        <thead>
          <tr>
            <th className={th}>{t("internalTeam.screensPanel.col.screen")}</th>
            <th className={th}>{t("internalTeam.screensPanel.col.status")}</th>
            <th className={th}>{t("internalTeam.screensPanel.col.opens")}</th>
            <th className={th}>{t("internalTeam.screensPanel.col.menu")}</th>
            <th className={th}>{t("internalTeam.screensPanel.col.origin")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.screen}
              data-team-screen-row={row.screen}
              data-team-screen-opens={row.opens ? "1" : "0"}
            >
              <td className={cx(td, "font-medium text-zinc-900")}>
                {t(SCREEN_LABEL[row.screen])}
              </td>
              <td className={td}>
                <StatusBadge t={t} row={row} />
              </td>
              <td className={td}>{yesNo(t, row.opens)}</td>
              {/* Equipe interna: "No menu" acompanha "Abre" (só consulta, R3). */}
              <td className={cx(td, "text-zinc-500")} data-team-screen-menu>
                {yesNo(t, row.opens)}
              </td>
              <td className={cx(td, "text-zinc-600")} data-team-screen-origin>
                {originText(t, row.origin, label)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Hidden inputs com o estado da lista (filtros, ordem e página). */
function Keep({ list }: { list: Record<string, string> }) {
  return (
    <>
      {Object.entries(list).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function ScreensPanel({
  t,
  state,
  team,
  defs,
  positions,
  areas,
  label,
  links,
  admin,
  href,
  list,
}: {
  t: Translate;
  state: ScreensState;
  team: User[];
  defs: FunctionDef[];
  positions: TeamPosition[];
  areas: TeamArea[];
  /** Nome de uma função no idioma do login. */
  label: (key: string) => string;
  links: PanelLinks;
  admin: boolean;
  /** Endereço do painel com o estado dado (a lista continua como está). */
  href: (patch: Partial<ScreensState> & { id?: string | null }) => string;
  /** Parâmetros da lista, guardados nos formulários do painel. */
  list: Record<string, string>;
}) {
  const scopeLabel = (s: ScreensScope) =>
    t(`internalTeam.screensPanel.scope.${s}` as DictionaryKey);
  const activeDefs = defs.filter((d) => !d.archived);
  const records: { value: string; label: string }[] =
    state.scope === "user"
      ? team.map((m) => ({ value: m.id, label: m.name }))
      : state.scope === "position"
        ? positions.map((p) => ({
            value: p.id,
            label: p.active
              ? p.name
              : `${p.name} ${t("position.inactiveSuffix")}`,
          }))
        : state.scope === "area"
          ? areas.map((a) => ({
              value: a.id,
              label: a.active
                ? a.name
                : `${a.name} ${t("area.inactiveSuffix")}`,
            }))
          : defs.map((d) => ({
              value: d.key,
              label: d.archived
                ? `${label(d.key)} (${t("fn.archived")})`
                : label(d.key),
            }));
  const id = records.some((r) => r.value === state.id) ? state.id : null;

  let body: ReactNode;
  if (state.mode === "screen") {
    body = (
      <ByScreen
        t={t}
        screen={state.screen}
        team={team}
        defs={activeDefs}
        allDefs={defs}
        positions={positions}
        areas={areas}
        label={label}
        href={href}
        list={list}
      />
    );
  } else if (!id) {
    body = (
      <p className="text-sm text-zinc-500" data-team-screens-empty>
        {t("internalTeam.screensPanel.empty")}
      </p>
    );
  } else if (state.scope === "user") {
    const member = team.find((m) => m.id === id)!;
    const screens = screenAccessOf(member, defs);
    const actions = actionAccessOf(member, defs).filter((a) => a.allowed);
    const position = positions.find((p) => p.id === member.positionId);
    const area = areas.find((a) => a.id === member.areaId);
    body = (
      <div className="space-y-4" data-team-screens-user={member.id}>
        <p className="text-sm text-zinc-600">
          {t("internalTeam.screensPanel.effective", { name: member.name })}
        </p>
        {/* Atalhos para o Cargo, a Área e as Funções da pessoa. */}
        <div
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
          data-team-screens-links
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("internalTeam.screensPanel.links")}
          </span>
          {position ? (
            <Link href={links.position(position.id)} className={linkClass}>
              {t("internalTeam.col.position")}: {position.name}
            </Link>
          ) : null}
          {area ? (
            <Link href={links.area(area.id)} className={linkClass}>
              {t("internalTeam.col.area")}: {area.name}
            </Link>
          ) : null}
          {(member.functions ?? [])
            .filter((f) => activeDefs.some((d) => d.key === f))
            .map((f) => (
              <Link key={f} href={links.fn(f)} className={linkClass}>
                {t("internalTeam.col.function")}: {label(f)}
              </Link>
            ))}
          {admin ? (
            <Link
              href={links.person(member.id)}
              className={linkClass}
              data-team-screens-edit
            >
              {t("internalTeam.screensPanel.editPerson", { name: member.name })}
            </Link>
          ) : null}
        </div>
        <h3 className="text-sm font-semibold text-zinc-900">
          {t("internalTeam.screensPanel.screens", {
            n: screens.filter((s) => s.opens).length,
            total: screens.length,
          })}
        </h3>
        <ScreensTable t={t} rows={screens} label={label} />
        <p className="text-xs text-zinc-500">
          {t("internalTeam.screensPanel.menuReadOnly")}
        </p>
        <h3 className="text-sm font-semibold text-zinc-900">
          {t("internalTeam.screensPanel.actions", {
            n: actions.length,
            total: actionAccessOf(member, defs).length,
          })}
        </h3>
        <ul className="space-y-1 text-sm" data-team-screens-actions>
          {actions.map((a) => (
            <li key={a.action} data-team-action-row={a.action}>
              <span className="text-zinc-900">
                {t(`action.${a.action}` as DictionaryKey)}
              </span>{" "}
              <span className="text-xs text-zinc-500">
                · {originText(t, a.origin, label)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (state.scope === "function") {
    const def = defs.find((d) => d.key === id)!;
    // A regra: o que a função libera para quem a tem (só ela, sem as outras).
    const rows = screenAccessOf(
      { role: "operator", functions: [def.key] },
      defs,
    ).map((row) =>
      def.archived
        ? { ...row, opens: false, origin: { kind: "none" as const } }
        : row,
    );
    const actions = def.archived
      ? []
      : def.actions.filter((a) => !isRetiredAction(a));
    body = (
      <div className="space-y-4" data-team-screens-function={def.key}>
        <p className="text-sm text-zinc-600">
          {t("internalTeam.screensPanel.rule", { name: label(def.key) })}
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={links.fn(def.key)} className={linkClass}>
            {t("internalTeam.function.title")}: {label(def.key)}
          </Link>
          {admin ? (
            <Link
              href={`/app/team?tab=functions&fn=${encodeURIComponent(def.key)}`}
              className={linkClass}
              data-team-screens-edit
            >
              {t("internalTeam.screensPanel.editFunction", {
                name: label(def.key),
              })}
            </Link>
          ) : (
            <span className="text-xs text-zinc-500">
              {t("internalTeam.screensPanel.adminOnlyEdit")}
            </span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-zinc-900">
          {t("internalTeam.screensPanel.screens", {
            n: rows.filter((s) => s.opens).length,
            total: rows.length,
          })}
        </h3>
        <ScreensTable t={t} rows={rows} label={label} />
        <h3 className="text-sm font-semibold text-zinc-900">
          {t("internalTeam.function.actions", { n: actions.length })}
        </h3>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-zinc-700">
          {actions.map((a) => (
            <li key={a}>{t(`action.${a}` as DictionaryKey)}</li>
          ))}
        </ul>
      </div>
    );
  } else {
    // Cargo ou área: o acesso efetivo de cada pessoa do escopo.
    const people = team.filter((m) =>
      state.scope === "position" ? m.positionId === id : m.areaId === id,
    );
    const name = records.find((r) => r.value === id)?.label ?? "";
    const access = people.map((m) => ({
      member: m,
      screens: screenAccessOf(m, defs),
    }));
    body = (
      <div
        className="space-y-4"
        data-team-screens-collective={`${state.scope}:${id}`}
      >
        <p className="text-sm text-zinc-600">
          {t("internalTeam.screensPanel.collective", {
            name: `${scopeLabel(state.scope)} ${name}`,
          })}
        </p>
        <Link
          href={
            state.scope === "position" ? links.position(id) : links.area(id)
          }
          className={`${linkClass} text-sm`}
        >
          {scopeLabel(state.scope)}: {name}
        </Link>
        {people.length ? (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr>
                  <th className={th}>
                    {t("internalTeam.screensPanel.col.screen")}
                  </th>
                  <th className={th}>
                    {t("internalTeam.screensPanel.col.opens")}
                  </th>
                  <th className={th}>
                    {t("internalTeam.screensPanel.col.origin")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {TEAM_SCREENS.map((screen) => {
                  const opens = access.filter((a) =>
                    a.screens.some((s) => s.screen === screen && s.opens),
                  );
                  const origins = [
                    ...new Set(
                      opens.map((a) =>
                        originText(
                          t,
                          a.screens.find((s) => s.screen === screen)!.origin,
                          label,
                        ),
                      ),
                    ),
                  ];
                  return (
                    <tr key={screen} data-team-screen-row={screen}>
                      <td className={cx(td, "font-medium text-zinc-900")}>
                        {t(SCREEN_LABEL[screen])}
                      </td>
                      <td className={td} data-team-screen-share={opens.length}>
                        {t("internalTeam.screensPanel.byScreen.share", {
                          n: opens.length,
                          total: people.length,
                        })}
                      </td>
                      <td className={cx(td, "text-zinc-600")}>
                        {origins.join(" · ") || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            {t("internalTeam.panel.people.none")}
          </p>
        )}
        {people.length ? (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {access.map(({ member, screens }) => (
              <li
                key={member.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
              >
                <Link
                  href={href({ mode: "scope", scope: "user", id: member.id })}
                  className={linkClass}
                  scroll={false}
                >
                  {member.name}
                </Link>
                <span className="text-xs text-zinc-500">
                  {t("internalTeam.screensPanel.screens", {
                    n: screens.filter((s) => s.opens).length,
                    total: screens.length,
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <SidePanel
      title={t("internalTeam.screensPanel.title")}
      subtitle={t("internalTeam.nav")}
      closeHref={links.closeHref}
      closeLabel={t("internalTeam.panel.close")}
      wide
      data-team-panel="screens"
      data-team-screens-mode-current={state.mode}
    >
      <div className="space-y-4">
        <Segmented
          label={t("internalTeam.screensPanel.mode")}
          data-team-screens-modes
          items={[
            {
              key: "scope",
              href: href({ mode: "scope" }),
              label: t("internalTeam.screensPanel.mode.scope"),
              current: state.mode === "scope",
            },
            {
              key: "screen",
              href: href({ mode: "screen" }),
              label: t("internalTeam.screensPanel.mode.screen"),
              current: state.mode === "screen",
            },
          ]}
        />
        {state.mode === "scope" ? (
          <div className="space-y-3">
            <Segmented
              label={t("internalTeam.screensPanel.scope")}
              data-team-screens-scopes
              items={SCREENS_SCOPES.map((s) => ({
                key: `scope-${s}`,
                href: href({ mode: "scope", scope: s, id: null }),
                label: scopeLabel(s),
                current: state.scope === s,
              }))}
            />
            <form
              method="get"
              action="/app/team"
              className="flex flex-wrap items-end gap-2"
              data-team-screens-record-form
            >
              <Keep list={list} />
              <input type="hidden" name="panel" value="screens" />
              <input type="hidden" name="mode" value="scope" />
              <input type="hidden" name="scope" value={state.scope} />
              <label className="min-w-0 flex-1 basis-60">
                <span className="mb-1 block text-xs font-medium text-zinc-700">
                  {scopeLabel(state.scope)}
                </span>
                <Select
                  name="id"
                  defaultValue={id ?? ""}
                  data-team-screens-record
                >
                  <option value="">
                    {t("internalTeam.screensPanel.choose")}
                  </option>
                  {records.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </label>
              <noscript>
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold"
                >
                  {t("internalTeam.screensPanel.show")}
                </button>
              </noscript>
              <AutoApply />
            </form>
          </div>
        ) : null}
        {body}
      </div>
    </SidePanel>
  );
}

/** Modo "Por tela": quem abre a tela e por quê. */
function ByScreen({
  t,
  screen,
  team,
  defs,
  allDefs,
  positions,
  areas,
  label,
  href,
  list,
}: {
  t: Translate;
  screen: Screen;
  team: User[];
  defs: FunctionDef[];
  allDefs: FunctionDef[];
  positions: TeamPosition[];
  areas: TeamArea[];
  label: (key: string) => string;
  href: (patch: Partial<ScreensState> & { id?: string | null }) => string;
  list: Record<string, string>;
}) {
  const granting = defs.filter((d) =>
    WELLMIX_BASE.includes(screen)
      ? !d.baseOff.includes(screen)
      : d.screens.includes(screen),
  );
  const rows = team.map((m) => ({
    member: m,
    access: screenAccessOf(m, allDefs).find((s) => s.screen === screen)!,
  }));
  const opens = rows.filter((r) => r.access.opens);
  const share = (ids: (m: User) => string | null | undefined, key: string) => {
    const people = team.filter((m) => ids(m) === key);
    return {
      n: people.filter((m) => opens.some((o) => o.member.id === m.id)).length,
      total: people.length,
    };
  };
  const positionName = (id: string | null | undefined) =>
    (id && positions.find((p) => p.id === id)?.name) || "—";
  const areaName = (id: string | null | undefined) =>
    (id && areas.find((a) => a.id === id)?.name) || "—";
  const usedPositions = positions.filter((p) =>
    team.some((m) => m.positionId === p.id),
  );
  const usedAreas = areas.filter((a) => team.some((m) => m.areaId === a.id));
  return (
    <div className="space-y-4" data-team-screens-screen={screen}>
      <form
        method="get"
        action="/app/team"
        className="flex flex-wrap items-end gap-2"
        data-team-screens-screen-form
      >
        <Keep list={list} />
        <input type="hidden" name="panel" value="screens" />
        <input type="hidden" name="mode" value="screen" />
        <label className="min-w-0 flex-1 basis-60">
          <span className="mb-1 block text-xs font-medium text-zinc-700">
            {t("internalTeam.screensPanel.screen")}
          </span>
          <Select
            name="screen"
            defaultValue={screen}
            data-team-screens-screen-select
          >
            {TEAM_SCREENS.map((s) => (
              <option key={s} value={s}>
                {t(SCREEN_LABEL[s])}
              </option>
            ))}
          </Select>
        </label>
        <noscript>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold"
          >
            {t("internalTeam.screensPanel.show")}
          </button>
        </noscript>
        <AutoApply />
      </form>
      {ADMIN_ONLY.includes(screen) ? (
        <Alert tone="warning">
          {t("internalTeam.screensPanel.protectedNote")}
        </Alert>
      ) : null}
      <section
        className="space-y-1.5"
        data-team-screens-granting={granting.length}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("internalTeam.screensPanel.byScreen.functions")}
        </h3>
        {granting.length ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {granting.map((d) => (
              <Link
                key={d.key}
                href={href({ mode: "scope", scope: "function", id: d.key })}
                scroll={false}
                className={linkClass}
                data-team-screens-granting-fn={d.key}
              >
                {label(d.key)}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            {t("internalTeam.screensPanel.byScreen.functions.none")}
          </p>
        )}
      </section>
      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("internalTeam.screensPanel.byScreen.people", {
            n: opens.length,
            total: rows.length,
          })}
        </h3>
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr>
                <th className={th}>
                  {t("internalTeam.screensPanel.col.person")}
                </th>
                <th className={th}>{t("internalTeam.col.position")}</th>
                <th className={th}>{t("internalTeam.col.area")}</th>
                <th className={th}>
                  {t("internalTeam.screensPanel.col.opens")}
                </th>
                <th className={th}>
                  {t("internalTeam.screensPanel.col.origin")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, access }) => (
                <tr
                  key={member.id}
                  data-team-screen-person={member.id}
                  data-team-screen-opens={access.opens ? "1" : "0"}
                >
                  <td className={td}>
                    <Link
                      href={href({
                        mode: "scope",
                        scope: "user",
                        id: member.id,
                      })}
                      scroll={false}
                      className={linkClass}
                    >
                      {member.name}
                    </Link>
                  </td>
                  <td className={cx(td, "text-zinc-600")}>
                    {positionName(member.positionId)}
                  </td>
                  <td className={cx(td, "text-zinc-600")}>
                    {areaName(member.areaId)}
                  </td>
                  <td className={td}>{yesNo(t, access.opens)}</td>
                  <td className={cx(td, "text-zinc-600")}>
                    {originText(t, access.origin, label)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {usedPositions.length ? (
        <section className="space-y-1.5" data-team-screens-by-position>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("internalTeam.screensPanel.byScreen.positions")}
          </h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {usedPositions.map((p) => {
              const s = share((m) => m.positionId, p.id);
              return (
                <Link
                  key={p.id}
                  href={href({ mode: "scope", scope: "position", id: p.id })}
                  scroll={false}
                  className={linkClass}
                >
                  {p.name}: {t("internalTeam.screensPanel.byScreen.share", s)}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
      {usedAreas.length ? (
        <section className="space-y-1.5" data-team-screens-by-area>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("internalTeam.screensPanel.byScreen.areas")}
          </h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {usedAreas.map((a) => {
              const s = share((m) => m.areaId, a.id);
              return (
                <Link
                  key={a.id}
                  href={href({ mode: "scope", scope: "area", id: a.id })}
                  scroll={false}
                  className={linkClass}
                >
                  {a.name}: {t("internalTeam.screensPanel.byScreen.share", s)}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
      <p className="text-xs text-zinc-500">
        {t("internalTeam.screensPanel.menuReadOnly")}
      </p>
    </div>
  );
}

/** Estado do painel lido do endereço. */
export function parseScreensState(
  sp: Record<string, string | string[] | undefined>,
): ScreensState {
  const one = (key: string) =>
    typeof sp[key] === "string" ? (sp[key] as string) : "";
  const screen = one("screen");
  return {
    mode: one("mode") === "screen" ? "screen" : "scope",
    scope: isScreensScope(one("scope"))
      ? (one("scope") as ScreensScope)
      : "user",
    id: one("id").slice(0, 100) || null,
    screen: isScreen(screen) ? screen : "orders",
  };
}
