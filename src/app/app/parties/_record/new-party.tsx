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
import { loadFormDraft, partyDraftKey } from "@/lib/services/form-drafts";
import { discardPartyDraftAction } from "@/app/app/actions/form-drafts";

/*
 * Novo parceiro (docs/PARTNER_TYPES.md). Aberto por "Outros parceiros": só os
 * tipos de lá (de fábrica e criados no painel), sem nenhum marcado. Aberto
 * por Clientes ou Fornecedores (?type=customer|supplier): o tipo de lá,
 * já marcado.
 */
export async function renderNewParty({
  query,
}: {
  query: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
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
  // Rascunho no banco, por login (D11): o que a pessoa digitou antes (fechou
  // a aba, perdeu a conexão, criou um tipo pelo atalho). O cookie de antes
  // (5 minutos) ainda vale na volta do atalho, para quem estava no meio.
  const draftForm = partyDraftKey(own);
  const stored = await loadFormDraft(user, draftForm);
  const cookieDraft = one("draft")
    ? parsePartyDraft((await cookies()).get(PARTY_DRAFT_COOKIE)?.value)
    : {};
  const draft =
    stored || Object.keys(cookieDraft).length
      ? { ...cookieDraft, ...(stored?.payload ?? {}) }
      : undefined;
  const backHref =
    own === "customer"
      ? "/app/customers/new"
      : `/app/parties/new${own ? `?type=${own}` : ""}`;
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
      {stored ? (
        <div className="mt-3 max-w-2xl" data-party-draft-restored>
          <Alert tone="info">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {t("formDraft.restored", {
                  time: new Date(stored.updatedAt).toLocaleString(t.intl, {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Sao_Paulo",
                  }),
                })}
              </span>
              <form action={discardPartyDraftAction}>
                <input type="hidden" name="form" value={draftForm} />
                <input type="hidden" name="back" value={backHref} />
                <button
                  type="submit"
                  className="text-sm font-semibold text-brand-700 underline"
                  data-party-draft-discard
                >
                  {t("formDraft.discard")}
                </button>
              </form>
            </span>
          </Alert>
        </div>
      ) : null}
      <Card className="mt-3 max-w-2xl">
        <PartyForm
          key={stored?.updatedAt ?? "new"}
          t={t}
          types={types}
          selected={selected}
          draft={draft}
          quickType={!own && isAdmin(user)}
          autosave={{ form: draftForm, savedText: t("formDraft.saved") }}
        />
      </Card>
    </>
  );
}
