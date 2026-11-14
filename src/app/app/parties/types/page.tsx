import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isAdmin } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import {
  foldTypeText,
  partnerTypeName,
  partyTypeValue,
  type PartnerTypeEntry,
} from "@/lib/partner-types";
import { OTHER_PARTY_TYPES, isOtherPartyType } from "@/lib/party-types";
import {
  editableTypeNames,
  getPartnerTypeCatalog,
} from "@/lib/services/partner-types";
import {
  editPartnerTypeAction,
  renamePartnerTypeAction,
  savePartnerTypeAction,
  setPartnerTypeActiveAction,
} from "../../actions/partner-types";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  Td,
  Textarea,
  Th,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { AutoApply } from "@/components/auto-apply";
import { RowMenu } from "@/components/row-menu";
import { SidePanel } from "@/components/side-panel";
import { PartiesHeader } from "../_components/parties-header";

/*
 * Tipos de parceiro (docs/PARTNER_TYPES.md), aba de Cadastros → Parceiros
 * (dono, 14/11/2026): tabela compacta (tipo, situação, login, parceiros),
 * "+ Novo tipo" num painel lateral e Editar, Renomear e Inativar no menu ⋯ de
 * cada linha. Quem abre Cadastros vê; só o administrador cria e altera (as
 * ações e o serviço conferem de novo). "Configurar telas" abre Acessos
 * externos já no perfil do tipo.
 */

const TYPES = "/app/parties/types";
const PANELS = ["new", "edit", "rename"] as const;
type Panel = (typeof PANELS)[number];

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
    // Só os tipos contados aqui (antes: os ~32 mil parceiros, clientes e
    // fornecedores do Sankhya inclusive).
    getStore().list("parties", {
      filter: { type: [...OTHER_PARTY_TYPES, "partner"] },
    }),
  ]);
  const count = new Map<string, number>();
  for (const p of parties)
    if (isOtherPartyType(p.type)) {
      const value = partyTypeValue(p);
      count.set(value, (count.get(value) ?? 0) + 1);
    }
  const error = one("error");
  const errorText = (code: string) => {
    const key = `partnerTypes.error.${code}`;
    return key in dictionaries.pt ? t(key as DictionaryKey) : t("common.error");
  };
  const saved = one("saved");
  const savedText: Record<string, DictionaryKey> = {
    new: "partnerTypes.created",
    "1": "partnerTypes.saved",
    renamed: "partnerTypes.renamed",
    activated: "partnerTypes.activated",
    deactivated: "partnerTypes.deactivated",
  };
  const optional = (label: string) =>
    `${label} (${t("partnerTypes.optional")})`;

  // Busca por nome (em qualquer idioma) ou identificador.
  const q = one("q").trim().slice(0, 120);
  const wanted = foldTypeText(q);
  const rows = wanted
    ? catalog.filter((e) =>
        [
          e.key,
          ...(["pt", "en", "zh"] as const).map((l) => partnerTypeName(e, l)),
        ]
          .map(foldTypeText)
          .some((text) => text.includes(wanted)),
      )
    : catalog;

  // Painel lateral (só o administrador): novo tipo, editar ou renomear.
  const rawPanel = one("panel");
  const panel: Panel | null =
    admin && (PANELS as readonly string[]).includes(rawPanel)
      ? (rawPanel as Panel)
      : null;
  const target =
    panel && panel !== "new"
      ? (catalog.find((e) => e.value === one("type")) ?? null)
      : null;
  const listHref = q ? `${TYPES}?q=${encodeURIComponent(q)}` : TYPES;
  const panelHref = (name: Panel, entry?: PartnerTypeEntry) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("panel", name);
    if (entry) p.set("type", entry.value);
    return `${TYPES}?${p.toString()}`;
  };
  const panelError = panel && error ? errorText(error) : null;

  const names = target ? editableTypeNames(target) : null;
  const nameFields = (entry: PartnerTypeEntry | null) => (
    <>
      <Field label={t("partnerTypes.name")}>
        <Input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={entry && names ? names.pt : ""}
          data-partner-type-field="name"
        />
      </Field>
      <Field label={optional(t("partnerTypes.nameEn"))}>
        <Input
          name="nameEn"
          maxLength={120}
          defaultValue={entry && names ? (names.en ?? "") : ""}
          data-partner-type-field="nameEn"
        />
      </Field>
      <Field label={optional(t("partnerTypes.nameZh"))}>
        <Input
          name="nameZh"
          maxLength={120}
          defaultValue={entry && names ? (names.zh ?? "") : ""}
          data-partner-type-field="nameZh"
        />
      </Field>
    </>
  );
  const loginBox = (checked: boolean) => (
    <label className="flex w-fit cursor-pointer items-start gap-2 text-sm text-zinc-800">
      <input type="hidden" name="allowLogin" value="off" />
      <input
        type="checkbox"
        name="allowLogin"
        value="on"
        defaultChecked={checked}
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
  );
  const closeLink = (
    <LinkButton href={listHref} replace scroll={false}>
      {t("common.cancel")}
    </LinkButton>
  );

  return (
    <>
      <PartiesHeader
        t={t}
        user={user}
        active="types"
        subtitle={t("partnerTypes.subtitle")}
        actions={
          admin ? (
            <LinkButton
              href={panelHref("new")}
              scroll={false}
              variant="primary"
              data-partner-type-new-open
            >
              {t("partnerTypes.quick.open")}
            </LinkButton>
          ) : null
        }
      />
      <div className="mb-3 space-y-2">
        {error && !panel ? (
          <Alert tone="danger">{errorText(error)}</Alert>
        ) : null}
        {saved && savedText[saved] ? (
          <div data-partner-type-saved={saved}>
            <Alert tone="success">{t(savedText[saved])}</Alert>
          </div>
        ) : null}
        {admin ? null : (
          <Alert tone="info">{t("partnerTypes.adminOnly")}</Alert>
        )}
      </div>

      <Card>
        <form
          method="get"
          action={TYPES}
          className="mb-3 flex flex-wrap items-end gap-3"
        >
          <div className="min-w-0 flex-1 sm:max-w-sm">
            <Field label={t("partnerTypes.search")}>
              <Input
                name="q"
                type="search"
                defaultValue={q}
                placeholder={t("partnerTypes.searchPlaceholder")}
                data-partner-type-search
              />
            </Field>
          </div>
          <AutoApply />
        </form>
        {rows.length === 0 ? (
          <Empty>{t("tableTools.none")}</Empty>
        ) : (
          <div className="-mx-3.5 overflow-x-auto sm:mx-0">
            <table className="w-full text-left text-sm" data-partner-type-list>
              <thead>
                <tr>
                  <Th>{t("partnerTypes.col.type")}</Th>
                  <Th>{t("common.status")}</Th>
                  <Th className="hidden sm:table-cell">
                    {t("partnerTypes.col.login")}
                  </Th>
                  <Th className="text-right">{t("partnerTypes.parties")}</Th>
                  {admin ? (
                    <>
                      <Th className="hidden md:table-cell">
                        <span className="sr-only">
                          {t("partnerAccess.configure")}
                        </span>
                      </Th>
                      <Th className="w-10">
                        <span className="sr-only">{t("common.actions")}</span>
                      </Th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const name = partnerTypeName(entry, t.locale);
                  const used = count.get(entry.value) ?? 0;
                  // "Configurar telas": na coluna própria; em tela estreita,
                  // embaixo do nome (outro marcador, para não duplicar).
                  const configureLink = (narrow: boolean) =>
                    admin && entry.profileKey ? (
                      <Link
                        href={`/app/parties/access?profile=${encodeURIComponent(entry.profileKey)}`}
                        className="whitespace-nowrap text-sm font-medium text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-600"
                        {...(narrow
                          ? { "data-partner-type-access-narrow": entry.key }
                          : { "data-partner-type-access": entry.key })}
                      >
                        {t("partnerAccess.configure")}
                      </Link>
                    ) : null;
                  const configure = configureLink(false);
                  return (
                    <tr
                      key={entry.value}
                      className={rowClass}
                      data-partner-type={entry.key}
                      data-partner-type-active={entry.active ? "1" : "0"}
                    >
                      <Td>
                        <span
                          className="block font-semibold text-zinc-900"
                          title={entry.description ?? undefined}
                        >
                          {name}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          {entry.key} ·{" "}
                          {t(
                            entry.builtin
                              ? "partnerTypes.origin.builtin"
                              : "partnerTypes.origin.custom",
                          )}
                          {entry.description ? ` · ${entry.description}` : ""}
                        </span>
                        {/* Telas estreitas: login e "Configurar telas" aqui. */}
                        <span className="mt-1 flex flex-wrap items-center gap-2 sm:hidden">
                          <Badge tone={entry.loginRole ? "info" : "neutral"}>
                            {t(
                              entry.loginRole
                                ? "partnerTypes.login.yes"
                                : "partnerTypes.login.no",
                            )}
                          </Badge>
                        </span>
                        {configure ? (
                          <span className="mt-1 block md:hidden">
                            {configureLink(true)}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <Badge tone={entry.active ? "success" : "neutral"}>
                          {t(
                            entry.active
                              ? "partnerTypes.active"
                              : "partnerTypes.inactive",
                          )}
                        </Badge>
                      </Td>
                      <Td className="hidden sm:table-cell">
                        {t(entry.loginRole ? "common.yes" : "common.no")}
                      </Td>
                      <Td
                        className="text-right tabular-nums"
                        data-partner-type-count={used}
                      >
                        {used}
                      </Td>
                      {admin ? (
                        <>
                          <Td className="hidden md:table-cell">
                            {configure ?? (
                              <span className="text-xs text-zinc-500">
                                {t("partnerTypes.login.no")}
                              </span>
                            )}
                          </Td>
                          <Td className="text-right">
                            <RowMenu
                              label={t("partnerTypes.menu", { name })}
                              data-partner-type-menu={entry.key}
                            >
                              <Link
                                href={panelHref("edit", entry)}
                                scroll={false}
                                role="menuitem"
                                data-partner-type-edit={entry.key}
                              >
                                {t("partnerTypes.edit")}
                              </Link>
                              <Link
                                href={panelHref("rename", entry)}
                                scroll={false}
                                role="menuitem"
                                data-partner-type-rename={entry.key}
                              >
                                {t("partnerTypes.menu.rename")}
                              </Link>
                              <form action={setPartnerTypeActiveAction}>
                                <input
                                  type="hidden"
                                  name="value"
                                  value={entry.value}
                                />
                                <input
                                  type="hidden"
                                  name="active"
                                  value={entry.active ? "off" : "on"}
                                />
                                <SubmitButton
                                  variant="ghost"
                                  role="menuitem"
                                  className="justify-start rounded-none font-normal"
                                  confirmText={t(
                                    entry.active
                                      ? "partnerTypes.deactivate.confirm"
                                      : "partnerTypes.activate.confirm",
                                    { name, n: used },
                                  )}
                                  data-partner-type-toggle={entry.key}
                                >
                                  {t(
                                    entry.active
                                      ? "partnerTypes.menu.deactivate"
                                      : "partnerTypes.menu.activate",
                                  )}
                                </SubmitButton>
                              </form>
                            </RowMenu>
                          </Td>
                        </>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {panel === "new" ? (
        <SidePanel
          title={t("partnerTypes.new")}
          closeHref={listHref}
          closeLabel={t("partnerTypes.close")}
          data-partner-type-panel="new"
          footer={
            <>
              {closeLink}
              <SubmitButton form="partner-type-new" data-partner-type-create>
                {t("partnerTypes.create")}
              </SubmitButton>
            </>
          }
        >
          {panelError ? (
            <div className="mb-3">
              <Alert tone="danger">{panelError}</Alert>
            </div>
          ) : null}
          <form
            id="partner-type-new"
            action={savePartnerTypeAction}
            className="space-y-3"
            data-partner-type-new
          >
            <input type="hidden" name="panel" value="new" />
            {nameFields(null)}
            <Field label={optional(t("partnerTypes.description"))}>
              <Textarea name="description" rows={3} maxLength={500} />
            </Field>
            {loginBox(true)}
          </form>
        </SidePanel>
      ) : null}

      {(panel === "edit" || panel === "rename") && target ? (
        <SidePanel
          title={t(
            panel === "edit"
              ? "partnerTypes.edit.title"
              : "partnerTypes.rename.title",
            { name: partnerTypeName(target, t.locale) },
          )}
          subtitle={`${t("partnerTypes.key")}: ${target.key} · ${t(
            target.builtin
              ? "partnerTypes.origin.builtin"
              : "partnerTypes.origin.custom",
          )}`}
          closeHref={listHref}
          closeLabel={t("partnerTypes.close")}
          data-partner-type-panel={panel}
          footer={
            <>
              {closeLink}
              <SubmitButton
                form="partner-type-panel"
                data-partner-type-panel-save
              >
                {t("partnerTypes.save")}
              </SubmitButton>
            </>
          }
        >
          {panelError ? (
            <div className="mb-3">
              <Alert tone="danger">{panelError}</Alert>
            </div>
          ) : null}
          <form
            id="partner-type-panel"
            action={
              panel === "edit" ? editPartnerTypeAction : renamePartnerTypeAction
            }
            className="space-y-3"
          >
            <input type="hidden" name="value" value={target.value} />
            {nameFields(target)}
            {panel === "edit" ? (
              <>
                <Field label={optional(t("partnerTypes.description"))}>
                  <Textarea
                    name="description"
                    rows={3}
                    maxLength={500}
                    defaultValue={target.description ?? ""}
                  />
                </Field>
                {target.builtin ? null : loginBox(!!target.loginRole)}
              </>
            ) : (
              <p className="text-xs text-zinc-500">
                {t("partnerTypes.rename.hint")}
              </p>
            )}
          </form>
        </SidePanel>
      ) : null}
    </>
  );
}
