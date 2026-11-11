import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { PARTY_TYPE_SCREEN, isOtherPartyType } from "@/lib/party-types";
import { isAdmin } from "@/lib/auth/permissions";
import {
  partnerTypeName,
  partyTypeLabel,
  partyTypeValue,
} from "@/lib/partner-types";
import { getPartnerTypeCatalog } from "@/lib/services/partner-types";
import { getT } from "@/i18n/server";
import {
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  rowClass,
} from "@/components/ui";

/** Filtro por tipo: selecionado na cor da marca, demais neutros. */
const chipClass = (selected: boolean) =>
  cx(
    "rounded-full px-3 py-1 font-medium ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
    selected
      ? "bg-brand-600 text-white ring-brand-600"
      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  );

export default async function PartiesPage({
  searchParams,
}: PageProps<"/app/parties">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const { type: rawType } = await searchParams;
  // Clientes e fornecedores têm telas próprias: o endereço antigo
  // (?type=supplier, ?type=customer) leva para lá.
  const own =
    typeof rawType === "string"
      ? PARTY_TYPE_SCREEN[rawType as keyof typeof PARTY_TYPE_SCREEN]
      : undefined;
  if (own) redirect(own);
  const t = await getT();
  const store = getStore();
  // Só os outros parceiros (agência, despachante, transportadora, OCP… e os
  // tipos criados no painel).
  const [all, catalog] = await Promise.all([
    store.list("parties", { orderBy: "name" }),
    getPartnerTypeCatalog(),
  ]);
  const parties = all.filter((p) => isOtherPartyType(p.type));
  // Filtros: os tipos ativos e os inativos que ainda têm cadastro.
  const inUse = new Set(parties.map(partyTypeValue));
  const chips = catalog.filter((e) => e.active || inUse.has(e.value));
  const type =
    typeof rawType === "string" && chips.some((e) => e.value === rawType)
      ? rawType
      : "";
  const filtered = type
    ? parties.filter((p) => partyTypeValue(p) === type)
    : parties;

  return (
    <>
      <PageHeader
        help={{ body: "help.parties.body", steps: "help.parties.steps" }}
        t={t}
        title={t("parties.other.title")}
        subtitle={
          <span data-parties-other>
            {t("parties.other.subtitle")}{" "}
            <TextLink href="/app/customers">{t("nav.customers")}</TextLink>
            {" · "}
            <TextLink href="/app/suppliers">{t("nav.suppliers")}</TextLink>
          </span>
        }
        actions={
          <>
            {isAdmin(user) ? (
              <>
                <LinkButton href="/app/parties/access" data-partner-access-link>
                  {t("partnerAccess.link")}
                </LinkButton>
                <LinkButton href="/app/parties/types" data-partner-types-link>
                  {t("partnerTypes.manage")}
                </LinkButton>
              </>
            ) : null}
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
      <div className="mb-3 flex flex-wrap gap-2 text-sm" data-party-type-chips>
        <Link
          href="/app/parties"
          aria-current={!type ? "page" : undefined}
          className={chipClass(!type)}
        >
          {t("common.all")}
        </Link>
        {chips.map((entry) => (
          <Link
            key={entry.value}
            href={`/app/parties?type=${encodeURIComponent(entry.value)}`}
            aria-current={type === entry.value ? "page" : undefined}
            className={chipClass(type === entry.value)}
            data-party-type-chip={entry.key}
          >
            {partnerTypeName(entry, t.locale)}
            {entry.active ? "" : ` ${t("partnerTypes.inactiveSuffix")}`}
          </Link>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Empty>{t("common.none")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("common.name")}</Th>
              <Th>{t("parties.type")}</Th>
              <Th>{t("parties.country")}</Th>
              <Th>{t("common.email")}</Th>
              <Th>{t("common.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={rowClass}>
                <Td>
                  <TextLink href={`/app/parties/${p.id}`}>{p.name}</TextLink>
                </Td>
                <Td>{partyTypeLabel(p, catalog, t)}</Td>
                <Td>{p.country ?? "—"}</Td>
                <Td>
                  <span className="text-zinc-600">{p.email ?? "—"}</span>
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
      )}
    </>
  );
}
