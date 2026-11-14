import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
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
  Empty,
  Field,
  Input,
  LinkButton,
  Table,
  Td,
  TextLink,
  Th,
  rowClass,
} from "@/components/ui";
import { AutoApply } from "@/components/auto-apply";
import { FilterCombobox } from "@/components/filter-combobox";
import { ServerPager, SortTh } from "@/components/server-table";
import { PartiesHeader } from "./_components/parties-header";
import {
  SERVER_TABLE_FROM,
  parseServerPage,
  parseServerSort,
  serverTable,
  type ServerColumn,
} from "@/lib/server-table";

export default async function PartiesPage({
  searchParams,
}: PageProps<"/app/parties">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const sp = await searchParams;
  const rawType = sp.type;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const q = (one(sp.q) ?? "").slice(0, 120);
  const t = await getT();
  const store = getStore();
  // Parceiros numa tela só (decisão do dono, 12/11/2026): clientes,
  // fornecedores e os demais tipos (agência, despachante, armador, OCP… e os
  // criados no painel), com filtro por tipo. A ficha de cliente e de
  // fornecedor continua na tela própria (conta, scorecard, exportação).
  const [parties, catalog, users] = await Promise.all([
    store.list("parties", { orderBy: "name" }),
    getPartnerTypeCatalog(),
    store.list("users"),
  ]);
  // Logins ativos de cada parceiro (a coluna leva ao quadro de acesso).
  const logins = new Map<string, number>();
  for (const u of users)
    if (u.active && u.partyId)
      logins.set(u.partyId, (logins.get(u.partyId) ?? 0) + 1);
  // Filtros: Clientes, Fornecedores e os tipos ativos e os inativos que ainda
  // têm cadastro.
  const inUse = new Set(parties.map(partyTypeValue));
  const own = [
    { value: "customer", label: t("nav.customers") },
    { value: "supplier", label: t("nav.suppliers") },
  ];
  const chips = catalog.filter((e) => e.active || inUse.has(e.value));
  const type =
    typeof rawType === "string" &&
    (own.some((e) => e.value === rawType) ||
      chips.some((e) => e.value === rawType))
      ? rawType
      : "";
  const filtered = type
    ? parties.filter((p) => partyTypeValue(p) === type)
    : parties;
  /** Ficha do parceiro: cliente e fornecedor na tela própria. */
  const detailHref = (p: (typeof parties)[number]) => {
    const base = PARTY_TYPE_SCREEN[p.type as keyof typeof PARTY_TYPE_SCREEN];
    return `${base ?? "/app/parties"}/${p.id}`;
  };
  const loginsLabel = (p: (typeof parties)[number]) =>
    logins.get(p.id)
      ? t("partnerAccess.login.count", { n: logins.get(p.id) ?? 0 })
      : t("partnerAccess.login.create");
  // Busca, ordem e página no servidor (auditoria de performance, 14/11/2026):
  // com os 32 mil parceiros a tela mandava todas as linhas ao navegador (108 MB
  // de HTML medidos com o volume de produção). Mesmas regras da TableTools
  // (src/lib/server-table.ts), sobre a lista inteira.
  const columns: ServerColumn<(typeof parties)[number]>[] = [
    { key: "name", text: (p) => p.name },
    { key: "type", text: (p) => partyTypeLabel(p, catalog, t) },
    { key: "country", text: (p) => p.country ?? "—" },
    { key: "email", text: (p) => p.email ?? "—" },
    { key: "logins", text: loginsLabel },
    {
      key: "active",
      text: (p) => (p.active ? t("common.yes") : t("common.no")),
    },
  ];
  // Lista curta: inteira, com a ordem e as páginas da TableTools. Longa: no
  // servidor. A busca é sempre a do filtro (um campo só; dono, 14/11/2026).
  const serverMode = filtered.length > SERVER_TABLE_FROM;
  const sort = serverMode ? parseServerSort(one(sp.sort), columns) : null;
  const shown = serverTable(filtered, columns, {
    q,
    sort,
    page: parseServerPage(one(sp.page)),
    size: serverMode ? undefined : Math.max(filtered.length, 1),
    decimalComma: t.locale === "pt",
  });
  const listHref = (patch: { sort?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (q) params.set("q", q);
    const sortValue =
      patch.sort !== undefined
        ? patch.sort
        : sort
          ? `${sort.desc ? "-" : ""}${sort.key}`
          : null;
    if (sortValue) params.set("sort", sortValue);
    if (patch.page) params.set("page", String(patch.page + 1));
    const query = params.toString();
    return query ? `/app/parties?${query}` : "/app/parties";
  };
  const sortHref = (value: string | null) => listHref({ sort: value });
  const pageHref = (page: number) => listHref({ page });
  /** Cabeçalho: ordena no servidor (lista longa) ou na TableTools (curta). */
  const header = (label: string, column: string) =>
    serverMode ? (
      <SortTh label={label} column={column} sort={sort} href={sortHref} t={t} />
    ) : (
      <Th>{label}</Th>
    );

  // Filtro por tipo com busca (no lugar da fileira de botões; dono,
  // 14/11/2026): Clientes, Fornecedores e os tipos de Outros parceiros.
  const typeOptions = [
    { value: "", label: t("parties.filter.typeAll") },
    ...own,
    ...chips.map((entry) => ({
      value: entry.value,
      label: `${partnerTypeName(entry, t.locale)}${
        entry.active ? "" : ` ${t("partnerTypes.inactiveSuffix")}`
      }`,
    })),
  ];

  return (
    <>
      <PartiesHeader
        t={t}
        user={user}
        active="registry"
        subtitle={
          <span data-parties-all>
            {t("parties.all.subtitle")}{" "}
            <TextLink href="/app/customers">{t("nav.customers")}</TextLink>
            {" · "}
            <TextLink href="/app/suppliers">{t("nav.suppliers")}</TextLink>
          </span>
        }
        actions={
          <>
            <LinkButton href="/app/import?entity=parties">
              {t("parties.import")}
            </LinkButton>
            <LinkButton
              // Aberto com um tipo filtrado: o cadastro novo já vem com ele.
              href={
                type
                  ? `/app/parties/new?type=${encodeURIComponent(type)}`
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
      <Card className="mb-3">
        <form
          method="get"
          action="/app/parties"
          className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:items-end"
          data-parties-filter
        >
          {sort ? (
            <input
              type="hidden"
              name="sort"
              value={`${sort.desc ? "-" : ""}${sort.key}`}
            />
          ) : null}
          <Field label={t("parties.filter.type")}>
            <FilterCombobox
              key={type}
              name="type"
              value={type}
              options={typeOptions}
              label={t("parties.filter.type")}
              placeholder={t("parties.filter.typePlaceholder")}
              emptyText={t("parties.filter.typeNone")}
              marker="party-type-filter"
            />
          </Field>
          <Field label={t("parties.filter.search")}>
            <Input
              name="q"
              type="search"
              defaultValue={q}
              placeholder={t("parties.filter.searchPlaceholder")}
              aria-label={t("parties.filter.search")}
              data-parties-search
            />
          </Field>
          <AutoApply />
        </form>
        <p
          className="mt-2 text-xs text-zinc-500"
          data-parties-count={shown.matched}
        >
          {t("parties.filter.count", { n: shown.matched })}
        </p>
      </Card>
      {filtered.length === 0 ? (
        <Empty>{t("common.none")}</Empty>
      ) : (
        <>
          {shown.matched === 0 ? (
            <Empty>{t("tableTools.none")}</Empty>
          ) : (
            <>
              <Table tools={!serverMode} searchable={false}>
                <thead>
                  <tr>
                    {header(t("common.name"), "name")}
                    {header(t("parties.type"), "type")}
                    {header(t("parties.country"), "country")}
                    {header(t("common.email"), "email")}
                    {header(t("partnerAccess.login.col"), "logins")}
                    {header(t("common.status"), "active")}
                  </tr>
                </thead>
                <tbody>
                  {shown.rows.map((p) => (
                    <tr key={p.id} className={rowClass}>
                      <Td>
                        <TextLink href={detailHref(p)}>{p.name}</TextLink>
                      </Td>
                      <Td>{partyTypeLabel(p, catalog, t)}</Td>
                      <Td>{p.country ?? "—"}</Td>
                      <Td>
                        <span className="text-zinc-600">{p.email ?? "—"}</span>
                      </Td>
                      <Td>
                        <TextLink href={`/app/parties/${p.id}#access`}>
                          <span data-party-logins={logins.get(p.id) ?? 0}>
                            {loginsLabel(p)}
                          </span>
                        </TextLink>
                      </Td>
                      <Td>
                        <Badge tone={p.active ? "success" : "neutral"}>
                          {p.active ? t("common.yes") : t("common.no")}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {serverMode ? (
                <ServerPager page={shown} href={pageHref} t={t} />
              ) : null}
            </>
          )}
        </>
      )}
    </>
  );
}
