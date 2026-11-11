import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PartyForm } from "@/components/party-form";
import { PARTY_DRAFT_COOKIE, parsePartyDraft } from "@/lib/party-draft";
import { partnerTypeName } from "@/lib/partner-types";
import { getPartnerTypeCatalog } from "@/lib/services/partner-types";

/*
 * Novo parceiro (docs/PARTNER_TYPES.md). Aberto por "Outros parceiros": só os
 * tipos de lá (de fábrica e criados no painel), sem nenhum marcado. Aberto
 * por Clientes ou Fornecedores (?type=customer|supplier): o tipo de lá,
 * já marcado.
 */
export default async function NewPartyPage({
  searchParams,
}: PageProps<"/app/parties/new">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const query = await searchParams;
  const one = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const t = await getT();
  const catalog = await getPartnerTypeCatalog();
  const wanted = one("type");
  const own = wanted === "customer" || wanted === "supplier" ? wanted : null;
  const types = own
    ? [{ value: own, label: t(`party.${own}`) }]
    : catalog
        .filter((e) => e.active)
        .map((e) => ({ value: e.value, label: partnerTypeName(e, t.locale) }));
  const selected = own ?? (types.some((o) => o.value === wanted) ? wanted : "");
  // Voltando do atalho "+ Novo tipo": o que já estava digitado.
  const draft = one("draft")
    ? parsePartyDraft((await cookies()).get(PARTY_DRAFT_COOKIE)?.value)
    : undefined;
  const error = one("error");
  const errorKey = `partnerTypes.error.${error}`;
  return (
    <>
      <PageHeader
        help={{ body: "help.parties.body" }}
        t={t}
        title={t("parties.new")}
      />
      {error ? (
        <Alert tone="danger">
          {errorKey in dictionaries.pt
            ? t(errorKey as DictionaryKey)
            : t("common.error")}
        </Alert>
      ) : one("typeCreated") ? (
        <Alert tone="success">{t("partnerTypes.quick.done")}</Alert>
      ) : null}
      <Card className="mt-3 max-w-2xl">
        <PartyForm
          t={t}
          types={types}
          selected={selected}
          draft={draft}
          quickType={!own && isAdmin(user)}
        />
      </Card>
    </>
  );
}
