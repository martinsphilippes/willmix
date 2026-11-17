import Link from "next/link";
import { Suspense } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { User } from "@/lib/db";
import { loginLabel } from "@/lib/auth/login-id";
import { isAdmin } from "@/lib/auth/permissions";
import { hasCustomScreens } from "@/lib/auth/screens";
import {
  TEAM_FILTERS,
  TEAM_NONE,
  activeTeamFilterCount,
  applyTeamFilters,
  teamFilterOptions,
  teamListHref,
  type TeamFilters,
  type TeamHrefPatch,
  type TeamRow,
} from "@/lib/team-list";
import {
  parseServerPage,
  parseServerSort,
  serverTable,
  type ServerColumn,
} from "@/lib/server-table";
import {
  Alert,
  Badge,
  Card,
  Input,
  Select,
  Table,
  Td,
  rowClass,
} from "@/components/ui";
import { AutoApply } from "@/components/auto-apply";
import { FormUrlSync } from "@/components/form-url-sync";
import { ServerPager, SortTh } from "@/components/server-table";

/*
 * Equipe Interna (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md, etapa 5): uma
 * linha por pessoa, Nome | Cargo | Área | Função | Responde a | Telas, cada
 * informação com o atalho dela:
 * - Nome: o painel da pessoa (Editar acessos: vínculos, funções e telas);
 * - Cargo e Área: o detalhe, as pessoas e a gestão de telas no escopo;
 * - Função (cada uma, quando há várias): o detalhe, as pessoas, telas e ações;
 * - Responde a: o gestor na hierarquia (cadeia de reporte e subordinados);
 * - Telas: quantas a pessoa abre ("Todas" no administrador), com a Gestão de
 *   telas já na pessoa.
 * Filtros e busca no servidor, antes da paginação; fechar um painel volta à
 * lista como estava (filtros, ordem, página e rolagem).
 */

export function TeamMembers({
  t,
  team,
  rows,
  filters,
  sp,
  formerCount = 0,
  pendingCount = 0,
}: {
  t: Translate;
  /** A equipe ativa (as linhas saem dela). */
  team: User[];
  rows: TeamRow[];
  filters: TeamFilters;
  sp: Record<string, string | string[] | undefined>;
  /** Quantos saíram da equipe (o painel para reativar). */
  formerCount?: number;
  /** Quem veio da planilha sem e-mail (o painel "Aguardando e-mail"). */
  pendingCount?: number;
}) {
  const one = (key: string) =>
    typeof sp[key] === "string" ? (sp[key] as string) : undefined;
  const byId = new Map(team.map((m) => [m.id, m]));
  const screensText = (r: TeamRow) => {
    const member = byId.get(r.id);
    if (r.screens === null) return t("internalTeam.screens.all");
    if (member && hasCustomScreens(member))
      return t("team.screens.custom", { n: r.screens });
    return r.screens === 1
      ? t("internalTeam.screens.one")
      : t("internalTeam.screens.count", { n: r.screens });
  };
  const columns: ServerColumn<TeamRow>[] = [
    { key: "name", text: (r) => `${r.name} ${r.login}` },
    { key: "position", text: (r) => r.positionName || "—" },
    { key: "area", text: (r) => r.areaName || "—" },
    {
      key: "function",
      text: (r) => r.functions.map((f) => f.label).join(", ") || "—",
    },
    { key: "manager", text: (r) => r.managerName || "—" },
    {
      key: "screens",
      // Ordem pelo número (todas = o maior).
      text: (r) => (r.screens === null ? "9999" : String(r.screens)),
    },
  ];
  const filtered = applyTeamFilters(rows, filters);
  const sort = parseServerSort(one("sort"), columns);
  const shown = serverTable(filtered, columns, {
    q: filters.q,
    sort,
    page: parseServerPage(one("page")),
    decimalComma: t.locale === "pt",
  });
  const options = teamFilterOptions(rows);
  const sortValue = sort ? `${sort.desc ? "-" : ""}${sort.key}` : null;
  const pageValue = shown.page > 0 ? String(shown.page + 1) : null;
  const href = (patch: TeamHrefPatch = {}) =>
    teamListHref(filters, { sort: sortValue, ...patch });
  const pageHref = (page: number) =>
    teamListHref(filters, {
      sort: sortValue,
      page: page > 0 ? String(page + 1) : null,
    });
  const panelHref = (patch: TeamHrefPatch) =>
    teamListHref(filters, { sort: sortValue, page: pageValue, ...patch });
  const header = (label: string, column: string) => (
    <SortTh
      label={label}
      column={column}
      sort={sort}
      href={(value) => href({ sort: value })}
      t={t}
    />
  );
  const filterTh = "bg-zinc-50/80 px-2 py-1.5 align-top font-normal";
  const by = (col: string) => t("internalTeam.filter.by", { col });
  const hasFilters = activeTeamFilterCount(filters) > 0;
  const link =
    "font-medium text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600";
  const toReview = rows.filter((r) => r.review).length;

  return (
    <>
      {/* "A conferir": os logins da importação com cargo, área ou funções
          para conferir à mão. */}
      {toReview || filters.review ? (
        <div className="mb-3" data-team-review-filter>
          <Alert tone="warning">
            {filters.review ? (
              <>
                {t("team.review.only", { n: toReview })}{" "}
                <Link
                  href={teamListHref({ ...filters, review: false })}
                  className="font-medium underline"
                >
                  {t("team.review.all")}
                </Link>
              </>
            ) : (
              <>
                {t("team.review.notice", { n: toReview })}{" "}
                <Link
                  href={teamListHref({ ...filters, review: true })}
                  className="font-medium underline"
                >
                  {t("team.review.show")}
                </Link>
              </>
            )}
          </Alert>
        </div>
      ) : null}
      <form method="get" action="/app/team" data-team-filter>
        {sortValue ? (
          <input type="hidden" name="sort" value={sortValue} />
        ) : null}
        {filters.review ? (
          <input type="hidden" name="review" value="1" />
        ) : null}
        <Card className="mb-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 basis-72">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                {t("internalTeam.search")}
              </span>
              <Input
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder={t("internalTeam.search.placeholder")}
                data-team-search
              />
            </label>
            {hasFilters ? (
              <Link
                href="/app/team"
                className="mb-2 text-sm font-medium text-brand-700 underline"
                data-team-clear
              >
                {t("internalTeam.clear")}
              </Link>
            ) : null}
          </div>
          <p
            className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-500"
            data-team-count={shown.matched}
          >
            <span>{t("internalTeam.count", { n: shown.matched })}</span>
            {formerCount ? (
              <Link
                href={panelHref({ panel: "former" })}
                scroll={false}
                className="font-medium text-brand-700 underline"
                data-team-former-open
              >
                {t("team.former.open", { n: formerCount })}
              </Link>
            ) : null}
            {pendingCount ? (
              <Link
                href={panelHref({ panel: "pending" })}
                scroll={false}
                className="font-medium text-amber-700 underline"
                data-team-pending-open
              >
                {t("team.pending.open", { n: pendingCount })}
              </Link>
            ) : null}
          </p>
        </Card>
        <Table tools={false}>
          <thead>
            <tr>
              {header(t("internalTeam.col.name"), "name")}
              {header(t("internalTeam.col.position"), "position")}
              {header(t("internalTeam.col.area"), "area")}
              {header(t("internalTeam.col.function"), "function")}
              {header(t("internalTeam.col.manager"), "manager")}
              {header(t("internalTeam.col.screens"), "screens")}
            </tr>
            <tr data-team-filters>
              <th className={filterTh}>
                <Input
                  dense
                  name="name"
                  type="search"
                  defaultValue={filters.name}
                  placeholder={t("internalTeam.filter.text")}
                  aria-label={by(t("internalTeam.col.name"))}
                  className="min-w-32"
                  data-team-filter-name
                />
              </th>
              <FilterSelect
                t={t}
                name="position"
                value={filters.position}
                label={by(t("internalTeam.col.position"))}
                options={options.positions}
                none={
                  options.noPosition
                    ? t("internalTeam.filter.none.position")
                    : null
                }
                className={filterTh}
              />
              <FilterSelect
                t={t}
                name="area"
                value={filters.area}
                label={by(t("internalTeam.col.area"))}
                options={options.areas}
                none={
                  options.noArea ? t("internalTeam.filter.none.area") : null
                }
                className={filterTh}
              />
              <FilterSelect
                t={t}
                name="function"
                value={filters.function}
                label={by(t("internalTeam.col.function"))}
                options={options.functions}
                none={
                  options.noFunction
                    ? t("internalTeam.filter.none.function")
                    : null
                }
                className={filterTh}
              />
              <FilterSelect
                t={t}
                name="manager"
                value={filters.manager}
                label={by(t("internalTeam.col.manager"))}
                options={options.managers}
                none={
                  options.noManager
                    ? t("internalTeam.filter.none.manager")
                    : null
                }
                className={filterTh}
              />
              <th className={filterTh} />
            </tr>
          </thead>
          <tbody>
            {shown.rows.map((r) => {
              const member = byId.get(r.id);
              const missingManager = !!member?.managerUserId && !r.managerId;
              return (
                <tr
                  key={r.id}
                  id={`u-${r.id}`}
                  className={`${rowClass} scroll-mt-24`}
                  data-team-member={r.id}
                >
                  <Td className="min-w-44">
                    {/* O painel da pessoa (Editar acessos), por cima da
                        lista; o endereço abre o mesmo painel. */}
                    <Link
                      href={panelHref({ panel: "person", id: r.id })}
                      scroll={false}
                      className={`${link} font-semibold`}
                      data-team-open={r.id}
                      data-team-edit={r.id}
                    >
                      {r.name}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      {member
                        ? `${t(`role.${member.role}` as DictionaryKey)} · `
                        : null}
                      {r.login}
                    </div>
                    {r.review ? (
                      <span
                        className="mt-0.5 inline-block"
                        title={r.review}
                        data-team-member-review={r.id}
                      >
                        <Badge tone="warning">{t("team.review.badge")}</Badge>
                      </span>
                    ) : null}
                    {member?.loginSuspended ? (
                      <span
                        className="ml-1 mt-0.5 inline-block"
                        data-team-login-suspended={r.id}
                      >
                        <Badge tone="warning">
                          {t("team.login.suspended")}
                        </Badge>
                      </span>
                    ) : null}
                  </Td>
                  <Td
                    className="whitespace-nowrap"
                    data-team-member-position={r.id}
                  >
                    {r.positionId ? (
                      <Link
                        href={panelHref({
                          panel: "position",
                          id: r.positionId,
                        })}
                        scroll={false}
                        className={link}
                        data-team-position-link={r.positionId}
                      >
                        {r.positionName || "—"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td
                    className="whitespace-nowrap"
                    data-team-member-area={r.id}
                  >
                    {r.areaId ? (
                      <Link
                        href={panelHref({ panel: "area", id: r.areaId })}
                        scroll={false}
                        className={link}
                        data-team-area-link={r.areaId}
                      >
                        {r.areaName || "—"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td data-team-member-functions={r.id}>
                    {r.functions.length ? (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {r.functions.map((f) => (
                          <Link
                            key={f.key}
                            href={panelHref({ panel: "function", id: f.key })}
                            scroll={false}
                            className={link}
                            data-team-function-link={f.key}
                          >
                            {f.label}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td
                    className="whitespace-nowrap"
                    data-team-member-manager={r.id}
                  >
                    {r.managerId ? (
                      <Link
                        href={panelHref({
                          panel: "manager",
                          id: r.managerId,
                          of: r.id,
                        })}
                        scroll={false}
                        className={link}
                        data-team-manager-link={r.managerId}
                      >
                        {r.managerName}
                      </Link>
                    ) : missingManager ? (
                      <Link
                        href={panelHref({
                          panel: "manager",
                          id: r.id,
                          of: r.id,
                        })}
                        scroll={false}
                        className="text-amber-700 underline"
                        title={t("internalTeam.manager.missing")}
                        data-team-manager-missing={r.id}
                      >
                        ⚠ —
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Link
                      href={panelHref({
                        panel: "screens",
                        scope: "user",
                        id: r.id,
                      })}
                      scroll={false}
                      className={link}
                    >
                      <span data-team-screens={r.id}>{screensText(r)}</span>
                    </Link>
                  </Td>
                </tr>
              );
            })}
            {shown.matched === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-zinc-500"
                  data-team-empty
                >
                  {t("internalTeam.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
        <AutoApply />
        <Suspense fallback={null}>
          <FormUrlSync names={["q", ...TEAM_FILTERS]} />
        </Suspense>
      </form>
      <ServerPager page={shown} href={pageHref} t={t} />
    </>
  );
}

/** Filtro de lista no cabeçalho, com as opções tiradas dos dados. */
function FilterSelect({
  t,
  name,
  value,
  label,
  options,
  none,
  className,
}: {
  t: Translate;
  name: string;
  value: string;
  label: string;
  options: { value: string; label: string }[];
  /** Texto da opção "—" (sem o campo), quando há linha sem ele. */
  none: string | null;
  className: string;
}) {
  return (
    <th className={className}>
      <Select
        dense
        name={name}
        defaultValue={value}
        aria-label={label}
        className="min-w-28"
        data-team-filter={name}
      >
        <option value="">{t("internalTeam.filter.all")}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {none ? <option value={TEAM_NONE}>{none}</option> : null}
      </Select>
    </th>
  );
}

/** As linhas da lista a partir da equipe (o que cada coluna mostra). */
export function teamRows(
  team: User[],
  names: {
    position: (id: string) => string | null;
    area: (id: string) => string | null;
    functionLabel: (key: string) => string;
    activeFunction: (key: string) => boolean;
    screens: (member: User) => number | null;
  },
): TeamRow[] {
  const ids = new Set(team.map((m) => m.id));
  const nameOf = new Map(team.map((m) => [m.id, m.name]));
  return team.map((m) => {
    const positionName = m.positionId ? names.position(m.positionId) : null;
    const areaName = m.areaId ? names.area(m.areaId) : null;
    const managerId =
      m.managerUserId && ids.has(m.managerUserId) ? m.managerUserId : null;
    return {
      id: m.id,
      name: m.name,
      login: loginLabel(m.email),
      // Cargo ou área que não está mais no cadastro: "—".
      positionId: positionName !== null ? (m.positionId ?? null) : null,
      positionName: positionName ?? "",
      areaId: areaName !== null ? (m.areaId ?? null) : null,
      areaName: areaName ?? "",
      functions: (m.functions ?? [])
        .filter((key) => names.activeFunction(key))
        .map((key) => ({ key, label: names.functionLabel(key) })),
      managerId,
      managerName: managerId ? (nameOf.get(managerId) ?? "") : "",
      screens: isAdmin(m) ? null : names.screens(m),
      review: m.reviewNote ?? null,
    };
  });
}
