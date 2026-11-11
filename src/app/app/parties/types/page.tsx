import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import { partnerTypeName, partyTypeValue } from "@/lib/partner-types";
import { isOtherPartyType } from "@/lib/party-types";
import { getPartnerTypeCatalog } from "@/lib/services/partner-types";
import { savePartnerTypeAction } from "../../actions/partner-types";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/*
 * Tipos de parceiro (docs/PARTNER_TYPES.md): os de fábrica e os criados no
 * painel. Quem abre Cadastros vê; só o administrador cria, renomeia e inativa.
 */
export default async function PartnerTypesPage({
  searchParams,
}: PageProps<"/app/parties/types">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const t = await getT();
  const query = await searchParams;
  const one = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const admin = isAdmin(user);
  const [catalog, parties] = await Promise.all([
    getPartnerTypeCatalog(),
    getStore().list("parties"),
  ]);
  const count = new Map<string, number>();
  for (const p of parties)
    if (isOtherPartyType(p.type)) {
      const value = partyTypeValue(p);
      count.set(value, (count.get(value) ?? 0) + 1);
    }
  const error = one("error");
  const errorKey = `partnerTypes.error.${error}`;
  const saved = one("saved");
  const optional = (label: string) =>
    `${label} (${t("partnerTypes.optional")})`;

  return (
    <>
      <PageHeader
        t={t}
        title={t("partnerTypes.title")}
        subtitle={t("partnerTypes.subtitle")}
        actions={
          <LinkButton href="/app/parties">{t("partnerTypes.back")}</LinkButton>
        }
      />
      <div className="mb-3 space-y-2">
        {error ? (
          <Alert tone="danger">
            {errorKey in dictionaries.pt
              ? t(errorKey as DictionaryKey)
              : t("common.error")}
          </Alert>
        ) : null}
        {saved ? (
          <div data-partner-type-saved>
            <Alert tone="success">
              {t(
                saved === "new" ? "partnerTypes.created" : "partnerTypes.saved",
              )}
            </Alert>
          </div>
        ) : null}
        {admin ? null : (
          <Alert tone="info">{t("partnerTypes.adminOnly")}</Alert>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        {admin ? (
          <Card title={t("partnerTypes.new")}>
            <form
              action={savePartnerTypeAction}
              className="space-y-3"
              data-partner-type-new
            >
              <Field label={t("partnerTypes.name")}>
                <Input name="name" required minLength={2} maxLength={120} />
              </Field>
              <Field label={optional(t("partnerTypes.nameEn"))}>
                <Input name="nameEn" maxLength={120} />
              </Field>
              <Field label={optional(t("partnerTypes.nameZh"))}>
                <Input name="nameZh" maxLength={120} />
              </Field>
              <Field label={optional(t("partnerTypes.description"))}>
                <Textarea name="description" rows={2} maxLength={500} />
              </Field>
              <label className="flex w-fit cursor-pointer items-start gap-2 text-sm text-zinc-800">
                <input type="hidden" name="allowLogin" value="off" />
                <input
                  type="checkbox"
                  name="allowLogin"
                  value="on"
                  defaultChecked
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-600"
                />
                <span>
                  <span className="block font-medium">
                    {t("partnerTypes.allowLogin")}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    {t("partnerTypes.allowLoginHint")}
                  </span>
                </span>
              </label>
              <SubmitButton>{t("partnerTypes.create")}</SubmitButton>
            </form>
          </Card>
        ) : null}

        <div className={admin ? "lg:col-span-2" : "lg:col-span-3"}>
          <Card title={t("partnerTypes.title")}>
            <ul className="divide-y divide-zinc-100" data-partner-type-list>
              {catalog.map((entry) => (
                <li
                  key={entry.value}
                  className="py-3 first:pt-0 last:pb-0"
                  data-partner-type={entry.key}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">
                      {partnerTypeName(entry, t.locale)}
                    </span>
                    <Badge tone={entry.active ? "success" : "neutral"}>
                      {t(
                        entry.active
                          ? "partnerTypes.active"
                          : "partnerTypes.inactive",
                      )}
                    </Badge>
                    <Badge>
                      {t(
                        entry.builtin
                          ? "partnerTypes.origin.builtin"
                          : "partnerTypes.origin.custom",
                      )}
                    </Badge>
                    <Badge tone={entry.loginRole ? "info" : "neutral"}>
                      {t(
                        entry.loginRole
                          ? "partnerTypes.login.yes"
                          : "partnerTypes.login.no",
                      )}
                    </Badge>
                    {admin && entry.profileKey ? (
                      <Link
                        href={`/app/parties/access?profile=${encodeURIComponent(entry.profileKey)}`}
                        className="text-sm font-medium text-brand-700 underline"
                        data-partner-type-access={entry.key}
                      >
                        {t("partnerAccess.configure")}
                      </Link>
                    ) : null}
                    <span className="text-xs text-zinc-500">
                      {t("partnerTypes.key")}: {entry.key} ·{" "}
                      {t("partnerTypes.parties")}: {count.get(entry.value) ?? 0}
                    </span>
                  </div>
                  {entry.description ? (
                    <p className="mt-1 text-sm text-zinc-600">
                      {entry.description}
                    </p>
                  ) : null}
                  {admin ? (
                    <details className="mt-2 text-sm">
                      <summary className="w-fit cursor-pointer font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                        {t("partnerTypes.edit")}
                      </summary>
                      <form
                        action={savePartnerTypeAction}
                        className="@container mt-2 space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3"
                      >
                        <input type="hidden" name="value" value={entry.value} />
                        <div className="grid gap-3 @sm:grid-cols-3">
                          <Field label={t("partnerTypes.name")}>
                            <Input
                              name="name"
                              required
                              minLength={2}
                              maxLength={120}
                              defaultValue={partnerTypeName(entry, "pt")}
                            />
                          </Field>
                          <Field label={optional(t("partnerTypes.nameEn"))}>
                            <Input
                              name="nameEn"
                              maxLength={120}
                              defaultValue={entry.names.en ?? ""}
                            />
                          </Field>
                          <Field label={optional(t("partnerTypes.nameZh"))}>
                            <Input
                              name="nameZh"
                              maxLength={120}
                              defaultValue={entry.names.zh ?? ""}
                            />
                          </Field>
                        </div>
                        <Field label={optional(t("partnerTypes.description"))}>
                          <Textarea
                            name="description"
                            rows={2}
                            maxLength={500}
                            defaultValue={entry.description ?? ""}
                          />
                        </Field>
                        {entry.builtin ? null : (
                          <label className="flex w-fit cursor-pointer items-start gap-2 text-zinc-800">
                            <input
                              type="hidden"
                              name="allowLogin"
                              value="off"
                            />
                            <input
                              type="checkbox"
                              name="allowLogin"
                              value="on"
                              defaultChecked={!!entry.loginRole}
                              className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-600"
                            />
                            <span>
                              <span className="block font-medium">
                                {t("partnerTypes.allowLogin")}
                              </span>
                              <span className="block text-xs text-zinc-500">
                                {t("partnerTypes.allowLoginHint")}
                              </span>
                            </span>
                          </label>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <label className="flex w-fit cursor-pointer items-center gap-2 font-medium text-zinc-800">
                            <input type="hidden" name="active" value="off" />
                            <input
                              type="checkbox"
                              name="active"
                              value="on"
                              defaultChecked={entry.active}
                              className="h-4 w-4 cursor-pointer accent-brand-600"
                            />
                            {t("partnerTypes.active")}
                          </label>
                          <SubmitButton>{t("partnerTypes.save")}</SubmitButton>
                        </div>
                        <p className="text-xs text-zinc-500">
                          {t("partnerTypes.activeHint")}
                        </p>
                      </form>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
