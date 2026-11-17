import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { loginLabel } from "@/lib/auth/login-id";
import { getStore, type Party, type User } from "@/lib/db";
import { PARTY_TYPE_SCREEN } from "@/lib/party-types";
import {
  partnerTypeName,
  partyTypeLabel,
  partyTypeValue,
} from "@/lib/partner-types";
import { getPartnerTypeCatalog } from "@/lib/services/partner-types";
import { getT } from "@/i18n/server";
import {
  Badge,
  Card,
  Input,
  LinkButton,
  Select,
  Table,
  Td,
  TextLink,
  rowClass,
} from "@/components/ui";
import { AutoApply } from "@/components/auto-apply";
import { FilterCombobox } from "@/components/filter-combobox";
import { ServerPager, SortTh } from "@/components/server-table";
import { PartiesHeader } from "./_components/parties-header";
import { PartyLoginsPanel } from "./_components/logins-panel";
import {
  parseServerPage,
  parseServerSort,
  serverTable,
  type ServerColumn,
} from "@/lib/server-table";
import {
  NO_COUNTRY,
  activeFilterCount,
  applyPartnerFilters,
  parsePartnerFilters,
  partnerFilterOptions,
  partnerListHref,
  type PartnerRow,
} from "@/lib/partners-list";

/*
 * Equipe Externa (dono, 17/11/2026; docs/EQUIPE_ACESSOS.md): uma linha por
 * parceiro, nas colunas Nome | Tipo | Situação | Login de Acesso | País |
 * E-mail. Cada coluna tem o filtro no cabeçalho (texto em Nome e E-mail;
 * opções tiradas dos dados em Tipo, Situação, Login de Acesso e País) e a
 * busca percorre a tabela inteira, com os logins (e-mail ou usuário) só para
 * o administrador. Filtros, busca, ordem e página no servidor, antes da
 * paginação (a lista tem milhares de fornecedores). Sem os clientes: eles
 * ficam em Cadastros → Clientes (dono, 15/11/2026).
 *
 * Os parâmetros de antes continuam valendo (`type`, `q`, `sort`, `page`).
 * Login de Acesso abre o painel dos logins por cima da lista
 * (?panel=logins&party=…); fechar volta à lista como estava.
 */

type Row = PartnerRow<Party>;

export default async function PartiesPage({
  searchParams,
}: PageProps<"/app/parties">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const filters = parsePartnerFilters(sp);
  // Clientes saíram de Parceiros (dono, 15/11/2026): a lista deles é
  // Cadastros → Clientes (/app/customers). O endereço antigo leva para lá,
  // com a busca e a ordem que valem lá (por nome).
  if (filters.type === "customer")
    redirect(customersHref(filters.q, one(sp.sort)));
  const t = await getT();
  const store = getStore();
  const admin = isAdmin(user);
  const [allParties, catalog, users] = await Promise.all([
    store.list("parties", { orderBy: "name" }),
    getPartnerTypeCatalog(),
    store.list("users"),
  ]);
  const parties = allParties.filter((p) => p.type !== "customer");
  // Logins de cada cadastro (ativos e desativados).
  const loginsOf = new Map<string, User[]>();
  for (const u of users)
    if (u.partyId) {
      const list = loginsOf.get(u.partyId) ?? [];
      list.push(u);
      loginsOf.set(u.partyId, list);
    }
  const rows: Row[] = parties.map((p) => {
    const logins = loginsOf.get(p.id) ?? [];
    return {
      party: p,
      id: p.id,
      name: p.name,
      typeValue: partyTypeValue(p),
      typeLabel: partyTypeLabel(p, catalog, t),
      active: p.active,
      logins: logins.filter((u) => u.active).length,
      inactiveLogins: logins.filter((u) => !u.active).length,
      country: (p.country ?? "").trim(),
      email: (p.email ?? "").trim(),
      // Identificadores dos logins: só a busca do administrador (R8).
      loginIds: admin
        ? logins.flatMap((u) => [u.email, loginLabel(u.email)])
        : [],
    };
  });

  const statusLabel = (r: Row) =>
    r.active
      ? t("externalTeam.status.active")
      : t("externalTeam.status.inactive");
  const loginsText = (n: number) =>
    n ? t("externalTeam.logins.count", { n }) : t("externalTeam.logins.none");
  const columns: ServerColumn<Row>[] = [
    { key: "name", text: (r) => r.name },
    { key: "type", text: (r) => r.typeLabel },
    { key: "status", text: statusLabel },
    { key: "logins", text: (r) => loginsText(r.logins) },
    { key: "country", text: (r) => r.country || "—" },
    { key: "email", text: (r) => r.email || "—" },
    // Só a busca do administrador: os logins de cada parceiro (R8).
    ...(admin
      ? [
          {
            key: "loginIds",
            text: (r: Row) => r.loginIds.join(" "),
            sortable: false,
          },
        ]
      : []),
  ];
  const filtered = applyPartnerFilters(rows, filters);
  const sort = parseServerSort(one(sp.sort), columns);
  const shown = serverTable(filtered, columns, {
    q: filters.q,
    sort,
    page: parseServerPage(one(sp.page)),
    decimalComma: t.locale === "pt",
  });

  // Opções dos filtros de lista: o que existe nos dados.
  const options = partnerFilterOptions(rows);
  // Tipo: Fornecedores e os tipos do cadastro de tipos (os ativos e os
  // inativos que ainda têm parceiro), na ordem do catálogo, com busca.
  const inUse = new Set(rows.map((r) => r.typeValue));
  const typeOptions = [
    { value: "", label: t("parties.filter.typeAll") },
    { value: "supplier", label: t("nav.suppliers") },
    ...catalog
      .filter((e) => e.active || inUse.has(e.value))
      .map((e) => ({
        value: e.value,
        label: `${partnerTypeName(e, t.locale)}${
          e.active ? "" : ` ${t("partnerTypes.inactiveSuffix")}`
        }`,
      })),
  ];

  // Endereços: os filtros de agora com a ordem, a página e o painel.
  const sortValue = sort ? `${sort.desc ? "-" : ""}${sort.key}` : null;
  const pageValue = shown.page > 0 ? String(shown.page + 1) : null;
  const sortHref = (value: string | null) =>
    partnerListHref(filters, { sort: value });
  const pageHref = (page: number) =>
    partnerListHref(filters, {
      sort: sortValue,
      page: page > 0 ? String(page + 1) : null,
    });
  const listHref = partnerListHref(filters, {
    sort: sortValue,
    page: pageValue,
  });
  const loginsHref = (id: string) =>
    partnerListHref(filters, {
      sort: sortValue,
      page: pageValue,
      panel: "logins",
      party: id,
    });
  /** Ficha do parceiro: fornecedor na tela própria. */
  const detailHref = (p: Party) => {
    const base = PARTY_TYPE_SCREEN[p.type as keyof typeof PARTY_TYPE_SCREEN];
    return `${base ?? "/app/parties"}/${p.id}`;
  };
  /** Detalhe do tipo: os tipos do catálogo; o Fornecedor, no perfil dele. */
  const typeHref = (r: Row) => {
    if (catalog.some((e) => e.value === r.typeValue))
      return `/app/parties/types?q=${encodeURIComponent(r.typeLabel)}`;
    if (r.typeValue === "supplier" && admin)
      return "/app/parties/access?profile=role%3Asupplier";
    return null;
  };

  const panelRow =
    one(sp.panel) === "logins"
      ? rows.find((r) => r.id === one(sp.party))
      : undefined;

  const header = (label: string, column: string) => (
    <SortTh label={label} column={column} sort={sort} href={sortHref} t={t} />
  );
  const filterTh = "bg-zinc-50/80 px-2 py-1.5 align-top font-normal";
  const by = (col: string) => t("externalTeam.filter.by", { col });
  const hasFilters = activeFilterCount(filters) > 0;

  return (
    <>
      <PartiesHeader
        t={t}
        user={user}
        active="registry"
        subtitle={<span data-parties-all>{t("externalTeam.subtitle")}</span>}
        actions={
          <>
            <LinkButton href="/app/suppliers" data-parties-suppliers>
              {t("externalTeam.suppliers")}
            </LinkButton>
            <LinkButton href="/app/import?entity=parties">
              {t("parties.import")}
            </LinkButton>
            <LinkButton
              // Filtrado por um tipo: o cadastro novo já vem com ele.
              href={
                filters.type
                  ? `/app/parties/new?type=${encodeURIComponent(filters.type)}`
                  : "/app/parties/new"
              }
              variant="primary"
              data-party-new
            >
              + {t("parties.new")}
            </LinkButton>
          </>
        }
      />
      <form method="get" action="/app/parties" data-parties-filter>
        {sortValue ? (
          <input type="hidden" name="sort" value={sortValue} />
        ) : null}
        <Card className="mb-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 basis-72">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                {t("externalTeam.search")}
              </span>
              <Input
                name="q"
                type="search"
                defaultValue={filters.q}
                placeholder={
                  admin
                    ? t("externalTeam.search.placeholderAdmin")
                    : t("externalTeam.search.placeholder")
                }
                data-parties-search
              />
            </label>
            {hasFilters ? (
              <Link
                href="/app/parties"
                className="mb-2 text-sm font-medium text-brand-700 underline"
                data-parties-clear
              >
                {t("externalTeam.clear")}
              </Link>
            ) : null}
          </div>
          <p
            className="mt-2 text-xs text-zinc-500"
            data-parties-count={shown.matched}
          >
            {t("externalTeam.count", { n: shown.matched })}
          </p>
        </Card>
        <Table tools={false}>
          <thead>
            <tr>
              {header(t("externalTeam.col.name"), "name")}
              {header(t("externalTeam.col.type"), "type")}
              {header(t("externalTeam.col.status"), "status")}
              {header(t("externalTeam.col.logins"), "logins")}
              {header(t("externalTeam.col.country"), "country")}
              {header(t("externalTeam.col.email"), "email")}
            </tr>
            <tr data-parties-filters>
              <th className={filterTh}>
                <Input
                  dense
                  name="name"
                  type="search"
                  defaultValue={filters.name}
                  placeholder={t("externalTeam.filter.text")}
                  aria-label={by(t("externalTeam.col.name"))}
                  className="min-w-32"
                  data-parties-filter-name
                />
              </th>
              <th className={filterTh}>
                <div className="min-w-36">
                  <FilterCombobox
                    key={filters.type}
                    name="type"
                    value={filters.type}
                    options={typeOptions}
                    label={by(t("externalTeam.col.type"))}
                    placeholder={t("parties.filter.typePlaceholder")}
                    emptyText={t("parties.filter.typeNone")}
                    marker="party-type-filter"
                  />
                </div>
              </th>
              <th className={filterTh}>
                <Select
                  dense
                  name="status"
                  defaultValue={filters.status}
                  aria-label={by(t("externalTeam.col.status"))}
                  className="min-w-24"
                  data-parties-filter-status
                >
                  <option value="">{t("externalTeam.filter.all")}</option>
                  {options.statuses.map((s) => (
                    <option key={s} value={s}>
                      {t(`externalTeam.status.${s}`)}
                    </option>
                  ))}
                </Select>
              </th>
              <th className={filterTh}>
                <Select
                  dense
                  name="logins"
                  defaultValue={filters.logins}
                  aria-label={by(t("externalTeam.col.logins"))}
                  className="min-w-28"
                  data-parties-filter-logins
                >
                  <option value="">{t("externalTeam.filter.all")}</option>
                  {options.logins.map((n) => (
                    <option key={n} value={String(n)}>
                      {loginsText(n)}
                    </option>
                  ))}
                </Select>
              </th>
              <th className={filterTh}>
                <Select
                  dense
                  name="country"
                  defaultValue={filters.country}
                  aria-label={by(t("externalTeam.col.country"))}
                  className="min-w-24"
                  data-parties-filter-country
                >
                  <option value="">{t("externalTeam.filter.all")}</option>
                  {options.countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {options.noCountry ? (
                    <option value={NO_COUNTRY}>
                      {t("externalTeam.country.none")}
                    </option>
                  ) : null}
                </Select>
              </th>
              <th className={filterTh}>
                <Input
                  dense
                  name="email"
                  type="search"
                  defaultValue={filters.email}
                  placeholder={t("externalTeam.filter.text")}
                  aria-label={by(t("externalTeam.col.email"))}
                  className="min-w-32"
                  data-parties-filter-email
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.rows.map((r) => {
              const typeLink = typeHref(r);
              return (
                <tr key={r.id} className={rowClass} data-party-row={r.id}>
                  <Td>
                    <TextLink href={detailHref(r.party)}>{r.name}</TextLink>
                  </Td>
                  <Td>
                    {typeLink ? (
                      <TextLink href={typeLink} data-party-type-link>
                        {r.typeLabel}
                      </TextLink>
                    ) : (
                      r.typeLabel
                    )}
                  </Td>
                  <Td>
                    <span data-party-status={r.active ? "active" : "inactive"}>
                      <Badge tone={r.active ? "success" : "neutral"}>
                        {statusLabel(r)}
                      </Badge>
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={loginsHref(r.id)}
                      scroll={false}
                      className="font-medium text-brand-700 underline-offset-2 hover:underline"
                    >
                      <span data-party-logins={r.logins}>
                        {loginsText(r.logins)}
                      </span>
                    </Link>
                    {r.inactiveLogins ? (
                      <span
                        className="ml-1 text-xs text-zinc-500"
                        data-party-logins-inactive={r.inactiveLogins}
                      >
                        ·{" "}
                        {t("externalTeam.logins.inactive", {
                          n: r.inactiveLogins,
                        })}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{r.country || "—"}</Td>
                  <Td>
                    <span className="text-zinc-600">{r.email || "—"}</span>
                  </Td>
                </tr>
              );
            })}
            {shown.matched === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-sm text-zinc-500"
                  data-parties-empty
                >
                  {t("externalTeam.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
        <AutoApply />
      </form>
      <ServerPager page={shown} href={pageHref} t={t} />
      {panelRow ? (
        <PartyLoginsPanel
          t={t}
          party={panelRow.party}
          typeLabel={panelRow.typeLabel}
          logins={loginsOf.get(panelRow.id) ?? []}
          admin={admin}
          closeHref={listHref}
        />
      ) : null}
    </>
  );
}

/**
 * Cadastros → Clientes com o que vale lá do endereço antigo
 * (/app/parties?type=customer): a busca e a ordem por nome (as outras
 * colunas de Parceiros não existem em Clientes).
 */
function customersHref(q: string, sort: string | undefined) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort && /^-?name$/.test(sort)) params.set("sort", sort);
  const query = params.toString();
  return query ? `/app/customers?${query}` : "/app/customers";
}
