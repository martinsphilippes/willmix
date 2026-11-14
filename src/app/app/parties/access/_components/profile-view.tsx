import type { Translate } from "@/i18n";
import { SCREEN_GROUPS, type Screen } from "@/lib/auth/screens";
import { GRANTABLE_SCREENS, isLimitedFor } from "@/lib/partner-access";
import {
  ACCESS_BASE,
  ACCESS_STATES,
  type AccessUrlState,
} from "@/lib/partner-access-view";
import type { AccessProfileInfo } from "@/lib/services/partner-access";
import {
  resetPartnerAccessAction,
  savePartnerAccessAction,
} from "../../../actions/partner-access";
import { Badge, Field, Input, Select, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { AutoApply } from "@/components/auto-apply";
import { AccessMatrix } from "@/components/access-matrix";
import {
  ProfileOptions,
  StateBadge,
  kindLabel,
  originText,
  profileLabel,
  routesOf,
  screenName,
  sourceText,
  stateOf,
  type ScreenState,
} from "./shared";

/*
 * Visão "Por tipo ou perfil" (dono, 14/11/2026): uma busca por nome ou
 * endereço, o filtro de situação, as telas em módulos recolhíveis e, em cada
 * linha, Tela, Situação, Abre, No menu e Origem; "Feita para" e os endereços
 * no detalhe da linha. As internas, as bloqueadas e a sempre aberta continuam
 * no catálogo, cada uma só com os controles que ela permite.
 */

const checkClass =
  "h-4 w-4 cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50";

/** O módulo recolhido esconde as linhas dele (só CSS, como a "ver mais"). */
const inModule = "[tbody:has(.access-module:not(:checked))_tr&]:hidden";

const LockIcon = () => (
  <svg
    aria-hidden
    viewBox="0 0 20 20"
    className="h-3.5 w-3.5 text-zinc-500"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
    <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
  </svg>
);

const Chevron = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    viewBox="0 0 20 20"
    className={cx(
      "h-4 w-4 shrink-0 text-zinc-500 transition-transform",
      className,
    )}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 5l5 5-5 5" />
  </svg>
);

const matchesState = (state: ScreenState, filter: string) =>
  !filter ||
  (filter === "open"
    ? state === "open" || state === "always" || state === "hidden"
    : state === filter);

export function ProfileView({
  t,
  profiles,
  current,
  url,
}: {
  t: Translate;
  profiles: AccessProfileInfo[];
  current: AccessProfileInfo;
  url: AccessUrlState;
}) {
  const access = current.access;
  const q = url.q.toLowerCase();
  const shown = (s: Screen) =>
    (!q ||
      screenName(t, s).toLowerCase().includes(q) ||
      routesOf(s).some((r) => r.includes(q))) &&
    matchesState(stateOf(access, s), url.state);
  const filtering = !!(url.q || url.state);
  const name = profileLabel(current, t);
  const groups = SCREEN_GROUPS.map((g, index) => ({
    key: g.key,
    screens: g.screens.filter(shown),
    // Aberto: o primeiro módulo, o da tela em destaque e, com filtro, todos.
    expanded:
      filtering || index === 0 || g.screens.includes(url.focus as Screen),
  })).filter((g) => g.screens.length);

  return (
    <div data-access-view="profile">
      <form
        method="get"
        action={ACCESS_BASE}
        className="grid gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,12rem)] md:items-end"
        data-access-profile-form
      >
        <Field label={t("partnerAccess.profile")}>
          <Select
            name="profile"
            defaultValue={current.key}
            data-access-profile-select
          >
            <ProfileOptions profiles={profiles} t={t} />
          </Select>
        </Field>
        <Field label={t("partnerAccess.filter.search")}>
          <Input
            name="q"
            type="search"
            defaultValue={url.q}
            placeholder={t("partnerAccess.search.placeholder")}
            data-access-search
          />
        </Field>
        <Field label={t("partnerAccess.filter.state")}>
          <Select
            name="state"
            defaultValue={url.state}
            data-access-state-filter
          >
            <option value="">{t("partnerAccess.filter.all")}</option>
            {ACCESS_STATES.map((s) => (
              <option key={s} value={s}>
                {t(`partnerAccess.filter.state.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <AutoApply />
      </form>
      <p className="mt-2 text-xs text-zinc-500">
        {t("partnerAccess.kindHint")}
      </p>

      <div
        className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"
        data-access-profile={current.key}
      >
        <h2 className="text-xl font-bold tracking-tight text-zinc-900">
          {name}
        </h2>
        <span className="text-sm text-zinc-600">
          {kindLabel(current, t)} ·{" "}
          {t(
            access.custom
              ? "partnerAccess.custom"
              : current.kind === "type"
                ? "partnerAccess.factory.type"
                : "partnerAccess.factory",
          )}{" "}
          ·{" "}
          <span data-access-users={current.users}>
            {t("partnerAccess.users", { n: current.users })}
          </span>
        </span>
      </div>

      <form
        id="access-form"
        action={savePartnerAccessAction}
        className="mt-3"
        data-access-form
      >
        <input type="hidden" name="profile" value={current.key} />
        <input type="hidden" name="q" value={url.q} />
        <input type="hidden" name="state" value={url.state} />
        {/* O que o filtro esconde continua como está. */}
        {GRANTABLE_SCREENS.filter((s) => !shown(s)).flatMap((s) =>
          access.screens.includes(s)
            ? [
                <input key={`o${s}`} type="hidden" name="open" value={s} />,
                ...(access.menuHidden.includes(s)
                  ? []
                  : [
                      <input
                        key={`m${s}`}
                        type="hidden"
                        name="menu"
                        value={s}
                      />,
                    ]),
              ]
            : [],
        )}
        {groups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-4 text-center text-sm text-zinc-500">
            {t("partnerAccess.noMatch")}
          </p>
        ) : (
          <div className="-mx-3.5 overflow-x-auto border-y border-zinc-200 sm:mx-0 sm:rounded-xl sm:border">
            <table className="w-full text-left text-sm" data-access-table>
              <thead>
                <tr>
                  <th className="border-b border-zinc-200 bg-zinc-50/80 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t("partnerAccess.col.screen")}
                  </th>
                  <th className="hidden border-b border-zinc-200 bg-zinc-50/80 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:table-cell">
                    {t("partnerAccess.col.state")}
                  </th>
                  <th className="w-14 border-b border-zinc-200 bg-zinc-50/80 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t("partnerAccess.col.open")}
                  </th>
                  <th className="w-16 border-b border-zinc-200 bg-zinc-50/80 px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t("partnerAccess.col.menu")}
                  </th>
                  <th className="hidden border-b border-zinc-200 bg-zinc-50/80 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 md:table-cell">
                    {t("partnerAccess.col.sourceShort")}
                  </th>
                  <th className="w-10 border-b border-zinc-200 bg-zinc-50/80 px-1 py-2">
                    <span className="sr-only">
                      {t("partnerAccess.row.details")}
                    </span>
                  </th>
                </tr>
              </thead>
              {groups.map((g) => {
                const opened = g.screens.filter((s) =>
                  access.screens.includes(s),
                ).length;
                return (
                  <tbody key={g.key} data-access-module={g.key}>
                    <tr>
                      <td colSpan={6} className="border-b border-zinc-200 p-0">
                        <label className="flex min-h-10 cursor-pointer select-none items-center gap-2 bg-zinc-100/80 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand-600">
                          <input
                            type="checkbox"
                            className="access-module peer sr-only"
                            defaultChecked={g.expanded}
                            aria-label={t(g.key)}
                            data-access-module-toggle={g.key}
                          />
                          <Chevron className="peer-checked:rotate-90" />
                          <span className="min-w-0 flex-1">{t(g.key)}</span>
                          <span className="shrink-0 text-xs font-normal text-zinc-500">
                            {t("partnerAccess.module.count", {
                              open: opened,
                              n: g.screens.length,
                            })}
                          </span>
                        </label>
                      </td>
                    </tr>
                    {g.screens.flatMap((s) => {
                      const state = stateOf(access, s);
                      const focus = url.focus === s;
                      const limited = isLimitedFor(s, current.key);
                      const source = sourceText(t, profiles, current, s);
                      const label = screenName(t, s);
                      const openControl =
                        state === "internal" ? (
                          <span className="text-zinc-400">—</span>
                        ) : state === "always" ? (
                          <span
                            className="inline-flex items-center gap-1"
                            title={t("partnerAccess.locked")}
                            data-access-locked
                          >
                            <input type="hidden" name="open" value={s} />
                            <input
                              type="checkbox"
                              checked
                              disabled
                              readOnly
                              aria-label={`${t("partnerAccess.col.open")}: ${label} (${t("partnerAccess.locked")})`}
                              className={checkClass}
                            />
                            <LockIcon />
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            name="open"
                            value={s}
                            defaultChecked={state !== "blocked"}
                            aria-label={`${t("partnerAccess.col.open")}: ${label}`}
                            className={checkClass}
                            data-access-open={s}
                          />
                        );
                      const menuControl =
                        state === "internal" ? (
                          <span className="text-zinc-400">—</span>
                        ) : state === "always" ? (
                          <span
                            className="inline-flex items-center gap-1"
                            title={t("partnerAccess.locked")}
                            data-access-locked
                          >
                            <input type="hidden" name="menu" value={s} />
                            <input
                              type="checkbox"
                              checked
                              disabled
                              readOnly
                              aria-label={`${t("partnerAccess.col.menu")}: ${label} (${t("partnerAccess.locked")})`}
                              className={checkClass}
                            />
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            name="menu"
                            value={s}
                            // Só no menu se abrir: bloqueada, a caixa fica vazia e travada.
                            defaultChecked={state === "open"}
                            disabled={state === "blocked"}
                            aria-label={`${t("partnerAccess.col.menu")}: ${label}`}
                            title={
                              state === "blocked"
                                ? t("partnerAccess.menuNeedsOpen")
                                : undefined
                            }
                            className={checkClass}
                            data-access-menu={s}
                          />
                        );
                      return [
                        <tr
                          key={s}
                          id={`access-${s}`}
                          className={cx(
                            "scroll-mt-24 transition hover:bg-brand-50/40",
                            inModule,
                            focus &&
                              "bg-amber-50 ring-2 ring-inset ring-amber-300",
                          )}
                          data-access-screen={s}
                          data-access-state={
                            state === "always" || state === "hidden"
                              ? "open"
                              : state
                          }
                          data-access-situation={state}
                          data-access-focus={focus ? "1" : undefined}
                        >
                          <td className="border-b border-zinc-100 px-2.5 py-2 align-middle text-[13px] text-zinc-800">
                            <span className="block font-medium text-zinc-900">
                              {label}
                            </span>
                            <span className="mt-1 block sm:hidden">
                              <StateBadge t={t} state={state} />
                            </span>
                          </td>
                          <td className="hidden border-b border-zinc-100 px-2.5 py-2 align-middle sm:table-cell">
                            <StateBadge t={t} state={state} />
                            {limited ? (
                              <span
                                className="ml-1 align-middle text-amber-700"
                                title={t("partnerAccess.limited", {
                                  origin: originText(t, s),
                                })}
                                aria-hidden
                              >
                                ⚠
                              </span>
                            ) : null}
                          </td>
                          <td className="border-b border-zinc-100 px-1 py-2 text-center align-middle">
                            {openControl}
                          </td>
                          <td className="border-b border-zinc-100 px-1 py-2 text-center align-middle">
                            {menuControl}
                          </td>
                          <td
                            className="hidden border-b border-zinc-100 px-2.5 py-2 align-middle text-[13px] text-zinc-700 md:table-cell"
                            data-access-source={s}
                          >
                            {source}
                          </td>
                          <td className="border-b border-zinc-100 px-1 py-2 text-right align-middle">
                            <label
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-zinc-100 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-600"
                              title={t("partnerAccess.row.detailsOf", {
                                screen: label,
                              })}
                            >
                              <input
                                type="checkbox"
                                className="access-more peer sr-only"
                                aria-label={t("partnerAccess.row.detailsOf", {
                                  screen: label,
                                })}
                                data-access-more={s}
                              />
                              <Chevron className="peer-checked:rotate-90" />
                            </label>
                          </td>
                        </tr>,
                        <tr
                          key={`${s}-detail`}
                          className={cx(
                            "hidden bg-zinc-50/80 [tr:has(.access-more:checked)+&]:table-row",
                            inModule,
                          )}
                          data-access-detail={s}
                        >
                          <td
                            colSpan={6}
                            className="border-b border-zinc-200 px-3 py-2.5"
                          >
                            <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                              <div>
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                  {t("partnerAccess.col.origin")}
                                </dt>
                                <dd className="text-zinc-800">
                                  {originText(t, s)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                  {t("partnerAccess.row.routes")}
                                </dt>
                                <dd className="break-all font-mono text-xs text-zinc-700">
                                  {routesOf(s).join(" · ")}
                                </dd>
                              </div>
                              <div className="md:hidden">
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                                  {t("partnerAccess.col.source")}
                                </dt>
                                <dd className="text-zinc-800">{source}</dd>
                              </div>
                              {state === "hidden" ? (
                                <p className="text-sky-800 sm:col-span-2">
                                  {t("partnerAccess.hiddenNote")}
                                </p>
                              ) : null}
                              {state === "blocked" ? (
                                <p className="text-zinc-600 sm:col-span-2">
                                  {t("partnerAccess.blockedNote")}
                                </p>
                              ) : null}
                              {state === "internal" ? (
                                <p className="text-amber-800 sm:col-span-2">
                                  {t("partnerAccess.internalHint")}
                                </p>
                              ) : null}
                              {limited ? (
                                <p
                                  className="text-amber-800 sm:col-span-2"
                                  data-access-limited={s}
                                >
                                  {t("partnerAccess.limited", {
                                    origin: originText(t, s),
                                  })}
                                </p>
                              ) : null}
                            </dl>
                          </td>
                        </tr>,
                      ];
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}

        {/* Barra de salvar: sempre à vista, com o perfil que muda. */}
        <div className="sticky bottom-0 z-10 -mx-3.5 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-zinc-200 bg-white/95 px-3.5 py-3 backdrop-blur sm:mx-0 sm:rounded-b-xl sm:px-0">
          <p
            className="min-w-0 flex-1 text-sm text-zinc-700"
            data-access-target
          >
            {t("partnerAccess.saveTarget")}{" "}
            <strong className="text-zinc-900">{name}</strong>{" "}
            <Badge>{kindLabel(current, t)}</Badge>{" "}
            <span className="whitespace-nowrap text-xs text-zinc-500">
              {t("partnerAccess.users", { n: current.users })}
            </span>{" "}
            <AccessMatrix unsavedLabel={t("partnerAccess.unsaved")} />
          </p>
          <div className="flex flex-wrap gap-2">
            {access.custom ? (
              <SubmitButton
                form="access-reset"
                variant="secondary"
                confirmText={t("partnerAccess.reset.confirm", {
                  profile: name,
                  n: current.users,
                })}
                data-access-reset
              >
                {t("partnerAccess.reset")}
              </SubmitButton>
            ) : null}
            <SubmitButton
              confirmText={t("partnerAccess.save.confirm", {
                profile: name,
                n: current.users,
              })}
              data-access-save
            >
              {t("partnerAccess.saveAll")}
            </SubmitButton>
          </div>
        </div>
      </form>
      {access.custom ? (
        <form id="access-reset" action={resetPartnerAccessAction} hidden>
          <input type="hidden" name="profile" value={current.key} />
          <input type="hidden" name="q" value={url.q} />
          <input type="hidden" name="state" value={url.state} />
        </form>
      ) : null}
      <p className="mt-3 text-xs text-zinc-500">
        {t("partnerAccess.dataHint")} {t("partnerAccess.otherHint")}{" "}
        {t("partnerAccess.internalHint")}
      </p>
    </div>
  );
}
