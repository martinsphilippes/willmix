import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import {
  OTHER_PARTY_TYPES,
  PARTY_TYPE_SCREEN,
  isOtherPartyType,
} from "@/lib/party-types";
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
  const type =
    typeof rawType === "string" && isOtherPartyType(rawType) ? rawType : "";
  const t = await getT();
  const store = getStore();
  // Só os outros parceiros (agência, despachante, transportadora, OCP…).
  const parties = (await store.list("parties", { orderBy: "name" })).filter(
    (p) => isOtherPartyType(p.type),
  );
  const filtered = type ? parties.filter((p) => p.type === type) : parties;

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
            <LinkButton href="/app/import?entity=parties">
              {t("parties.import")}
            </LinkButton>
            <LinkButton href="/app/parties/new" variant="primary">
              + {t("parties.new")}
            </LinkButton>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <Link
          href="/app/parties"
          aria-current={!type ? "page" : undefined}
          className={chipClass(!type)}
        >
          {t("common.all")}
        </Link>
        {OTHER_PARTY_TYPES.map((pt) => (
          <Link
            key={pt}
            href={`/app/parties?type=${pt}`}
            aria-current={type === pt ? "page" : undefined}
            className={chipClass(type === pt)}
          >
            {t(`party.${pt}`)}
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
                <Td>{t(`party.${p.type}`)}</Td>
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
