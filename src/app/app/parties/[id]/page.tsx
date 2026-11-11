import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { isAdmin } from "@/lib/auth/permissions";
import {
  getStore,
  LOCALES,
  OPERATION_MODES,
  PAYMENT_TERM_BASES,
  RADAR_STATUSES,
  ROLES,
} from "@/lib/db";
import { parseTerms } from "@/lib/supplier-terms";
import { PaymentTermsEditor } from "@/components/payment-terms-editor";
import { paymentTermsTexts } from "@/components/supplier-terms-text";
import {
  saveSupplierProductionStartAction,
  saveSupplierTermsAction,
} from "../../actions/supplier-terms";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import { LOCALE_NAMES, type Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  TextLink,
  Th,
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { PartyForm } from "@/components/party-form";
import {
  partnerTypeName,
  partyTypeLabel,
  partyTypeValue,
} from "@/lib/partner-types";
import {
  getPartnerTypeCatalog,
  loginRoleOfParty,
} from "@/lib/services/partner-types";
import { SubmitButton } from "@/components/submit-button";
import { listCertifications } from "@/lib/services/compliance";
import { radarProblem } from "@/lib/services/operations";
import { createUserAction } from "../../actions";
import {
  PORTAL_MIN_PASSWORD,
  suggestPassword,
} from "@/lib/services/portal-access";
import { loginLabel, suggestLoginName } from "@/lib/auth/login-id";
import { PartyProfile } from "@/components/party-profile";
import { AccessCopy } from "@/components/access-copy";
import { updatePartyExtraAction } from "../../actions/catalog";
import { saveCustomerOperationAction } from "../../actions/vision";
import { CertificationsSection } from "../../products/_components/certifications-section";
import { listSupplierProducts } from "@/lib/services/product-suppliers";
import { catalogError } from "../../products/_components/shared";

/**
 * Visão de Produto (módulo operações): erros de saveCustomerOperationAction
 * (not_found, not_customer, invalid_input) traduzidos em operations.error.*;
 * os demais seguem o padrão do catálogo. Só entra quando o catálogo não tem o código.
 */
function partyError(t: Translate, code: string | string[] | undefined) {
  if (typeof code !== "string" || !code) return null;
  const catalogKey = `catalog.error.${code}` as DictionaryKey;
  const opKey = `operations.error.${code}` as DictionaryKey;
  if (t(catalogKey) === catalogKey && t(opKey) !== opKey) return t(opKey);
  return catalogError(t, code);
}

/** País da China como a ficha técnica e o cadastro escrevem (CN, China, 中国). */
const isChina = (country: string | null | undefined) =>
  /^(cn|china|中国)$/i.test((country ?? "").trim());

const roleForType: Record<string, string> = {
  customer: "customer",
  supplier: "supplier",
  agency: "agency",
  broker: "broker",
  shipping_line: "shipping_line",
  carrier: "carrier",
  legal: "legal",
  comex: "comex",
  logistics: "logistics",
  ocp: "ocp",
};

export default async function PartyPage({
  params,
  searchParams,
}: PageProps<"/app/parties/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const { id } = await params;
  const { error, saved, login: savedLogin } = await searchParams;
  const store = getStore();
  const party = await store.get("parties", id);
  if (!party) notFound();
  const t = await getT();
  const isSupplier = party.type === "supplier";
  const isCustomer = party.type === "customer";
  const [users, visits, products, certs, allUsers, settings] =
    await Promise.all([
      store.list("users", { filter: { partyId: id } }),
      isSupplier
        ? store.list("supplier_visits", {
            filter: { supplierId: id },
            orderBy: "visitedAt",
            direction: "desc",
          })
        : Promise.resolve([]),
      isSupplier
        ? store.list("products", {
            filter: { supplierId: id },
            orderBy: "name",
          })
        : Promise.resolve([]),
      isSupplier ? listCertifications("party", id) : Promise.resolve([]),
      store.list("users"),
      isCustomer ? getSettings() : Promise.resolve(null),
    ]);
  // Início da produção: o prazo deste fornecedor e o padrão das Configurações.
  const allSettings = await getSettings();
  const productionStart = {
    own: allSettings.productionStartDaysBySupplier?.[id] ?? null,
    fallback: allSettings.productionStartDays,
  };
  // Produtos que o fornecedor fornece: os em que é o principal e os em que
  // entrou pela cotação (cada um com o código, preço e MOQ dele).
  const links = isSupplier ? await listSupplierProducts(id) : [];
  const extraIds = links
    .map((l) => l.productId)
    .filter((pid) => !products.some((p) => p.id === pid));
  const extraProducts = extraIds.length
    ? await store.list("products", { filter: { id: extraIds } })
    : [];
  const supplierProducts = [
    ...products.map((p) => ({
      product: p,
      main: true,
      code: p.supplierSku,
      price: p.price,
      currency: p.currency,
      moq: p.moq,
    })),
    ...links.flatMap((l) => {
      const p = extraProducts.find((x) => x.id === l.productId);
      return p
        ? [
            {
              product: p,
              main: false,
              code: l.supplierSku,
              price: l.price,
              currency: l.currency,
              moq: l.moq,
            },
          ]
        : [];
    }),
  ].sort((a, b) => a.product.name.localeCompare(b.product.name));
  /* Erros da condição de pagamento aparecem no card dela (âncora #payment-terms). */
  const termsError = typeof error === "string" && error.startsWith("terms_");
  /* Erros da criação do login aparecem no quadro de acesso (âncora #access). */
  const userError = typeof error === "string" && error.startsWith("user_");
  const accessError = userError ? partyError(t, error) : null;
  const errorText = termsError || userError ? null : partyError(t, error);
  const currentTerms = isSupplier
    ? parseTerms(party.paymentTerms ?? null)
    : null;
  /* Modalidade de operação do cliente (RADAR): nada presumido; aviso só na importação própria sem RADAR.
     O serviço decide se há problema; o texto vem do dicionário (radar nulo = não informado, "none" = sem habilitação). */
  const radarIssue = isCustomer ? radarProblem(party) : null;
  const radarIssueText = radarIssue
    ? t(
        party.radar === null
          ? "operations.radarProblem.not_informed"
          : "operations.radarProblem.none",
      )
    : null;
  // Função do acesso: a do tipo deste cadastro (o servidor recusa as outras);
  // as da Wellmix continuam só para o administrador.
  // Perfil: cartão do fabricante mais recente e o responsável na Wellmix.
  const [profileCard] = isSupplier
    ? await store
        .list("manufacturer_cards", {
          filter: { supplierId: id },
          orderBy: "createdAt",
          direction: "desc",
          limit: 1,
        })
        .catch(() => [])
    : [];
  const ownerName = party.ownerUserId
    ? (allUsers.find((u) => u.id === party.ownerUserId)?.name ?? null)
    : null;
  // Criar acesso: login sugerido pelo nome (sem e-mail) e senha sugerida.
  const loginSuggestion = suggestLoginName(
    party.name,
    party.storeNumber,
    allUsers.map((u) => u.email),
  );
  const passwordSuggestion = suggestPassword();
  // Tipos do formulário (docs/PARTNER_TYPES.md): os ativos de "Outros
  // parceiros" e o do próprio cadastro (cliente, fornecedor ou um inativo).
  const catalog = await getPartnerTypeCatalog();
  const ownValue = partyTypeValue(party);
  const typeOptions = [
    // Cliente e fornecedor continuam podendo trocar entre si, como antes.
    ...(["customer", "supplier"] as const).map((type) => ({
      value: type as string,
      label: t(`party.${type}`),
    })),
    ...catalog
      .filter((e) => e.active || e.value === ownValue)
      .map((e) => ({
        value: e.value,
        label: `${partnerTypeName(e, t.locale)}${e.active ? "" : ` ${t("partnerTypes.inactiveSuffix")}`}`,
      })),
  ];
  // O papel do login é o do tipo (os tipos novos entram como o Fornecedor).
  const loginRole = await loginRoleOfParty(party);
  // Perfil de telas dos logins deste cadastro (Gestão de telas).
  const typeEntry = catalog.find((e) => e.value === ownValue) ?? null;
  const accessProfile = loginRole
    ? {
        key: typeEntry?.profileKey ?? `role:${loginRole}`,
        label: typeEntry
          ? partnerTypeName(typeEntry, t.locale)
          : t(`role.${loginRole}` as DictionaryKey),
      }
    : null;
  const roles = [
    ...ROLES.filter((r) => r === loginRole),
    ...ROLES.filter(
      (r) => isAdmin(user) && (r === "admin" || r === "operator"),
    ),
  ];

  return (
    <>
      <PageHeader
        help={{ body: "help.party.body", steps: "help.catalog.party.steps" }}
        t={t}
        title={party.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{partyTypeLabel(party, catalog, t)}</Badge>
            {isCustomer && party.operationMode ? (
              <Badge tone={radarIssue ? "warning" : "info"}>
                {t(
                  `operations.mode.badge.${party.operationMode}` as DictionaryKey,
                )}
              </Badge>
            ) : null}
            {party.city || party.country ? (
              <span>
                {[party.city, party.country].filter(Boolean).join(", ")}
              </span>
            ) : null}
          </span>
        }
        actions={
          party.type === "supplier" ? (
            <LinkButton href={`/app/account?supplier=${party.id}`}>
              {t("nav.account")}
            </LinkButton>
          ) : null
        }
      />
      {saved && saved !== "terms" && saved !== "user" ? (
        <Alert tone="success">
          {saved === "operation"
            ? t("operations.mode.saved")
            : t("catalog.saved")}
        </Alert>
      ) : null}
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <PartyProfile
        party={party}
        users={users}
        ownerName={ownerName}
        productCount={isSupplier ? supplierProducts.length : null}
        card={profileCard ?? null}
        t={t}
      />
      {/* Dois cartões por linha no iPad/desktop: cadastro e usuários à esquerda; modalidade e sourcing/banco à direita. */}
      <div className="mt-3 grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <Card title={t("common.edit")}>
            <PartyForm
              party={party}
              t={t}
              types={typeOptions}
              selected={partyTypeValue(party)}
            />
          </Card>
          {/* Acesso ao portal: o login nasce aqui, preso a este cadastro
              (o Booking traz para cá o fornecedor sem login). */}
          <div id="access" className="scroll-mt-24" data-party-access>
            <Card title={t("parties.users")}>
              {saved === "user" ? (
                <div className="mb-3" data-party-access-saved>
                  <Alert tone="success">
                    {typeof savedLogin === "string" && savedLogin
                      ? t("portalAccess.saved.login", {
                          name: party.name,
                          login: savedLogin.slice(0, 254),
                        })
                      : t("portalAccess.saved", { name: party.name })}
                  </Alert>
                </div>
              ) : null}
              {accessError ? (
                <div className="mb-3">
                  <Alert tone="danger">{accessError}</Alert>
                </div>
              ) : null}
              {!users.some((u) => u.active) ? (
                <div className="mb-3" data-party-no-access>
                  <Alert tone="warning">{t("portalAccess.party.none")}</Alert>
                </div>
              ) : null}
              <p className="mb-3 text-xs text-zinc-500">
                {t("portalAccess.party.linked", { name: party.name })}
              </p>
              {isAdmin(user) && accessProfile ? (
                <p className="mb-3 text-sm" data-party-access-profile>
                  <Link
                    href={`/app/parties/access?profile=${encodeURIComponent(accessProfile.key)}`}
                    className="font-medium text-brand-700 underline"
                  >
                    {t("partnerAccess.configure")}
                  </Link>{" "}
                  <span className="text-zinc-600">
                    ·{" "}
                    {t("partnerAccess.partyProfile", {
                      profile: accessProfile.label,
                    })}
                  </span>
                </p>
              ) : null}
              <ul className="mb-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="min-w-0 break-words">
                      <span className="font-medium text-zinc-900">
                        {u.name}
                      </span>{" "}
                      <span className="text-zinc-500">
                        · {loginLabel(u.email)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {u.active ? null : (
                        <Badge tone="neutral">
                          {t("portalAccess.party.inactive")}
                        </Badge>
                      )}
                      <Badge>{t(`role.${u.role}`)}</Badge>
                    </span>
                  </li>
                ))}
                {users.length === 0 ? (
                  <li className="px-3 py-2 text-zinc-500">
                    {t("common.none")}
                  </li>
                ) : null}
              </ul>
              {!loginRole ? (
                // Tipo criado no painel: ainda sem classe de login (a criação
                // do acesso recusaria; docs/PARTNER_TYPES.md).
                <div data-party-no-login-class>
                  <Alert tone="info">{t("partnerTypes.noLogin")}</Alert>
                </div>
              ) : (
                <form
                  action={createUserAction}
                  className="@container space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3"
                >
                  <input type="hidden" name="partyId" value={party.id} />
                  <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-6">
                    <div className="min-w-0 @lg:col-span-3">
                      <Field label={t("common.name")}>
                        <Input
                          name="name"
                          defaultValue={
                            users.length
                              ? ""
                              : (party.contactName ?? party.name)
                          }
                          required
                        />
                      </Field>
                    </div>
                    <div className="min-w-0 @lg:col-span-3">
                      <Field
                        label={t("portalAccess.login.label")}
                        hint={t("portalAccess.login.hint")}
                      >
                        <Input
                          name="login"
                          defaultValue={loginSuggestion}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          autoComplete="off"
                          maxLength={254}
                          required
                        />
                      </Field>
                    </div>
                    <div className="min-w-0 @lg:col-span-2">
                      <Field label={t("common.role")}>
                        <Select
                          name="role"
                          defaultValue={
                            loginRole ?? roleForType[party.type] ?? "customer"
                          }
                        >
                          {roles.map((r) => (
                            <option key={r} value={r}>
                              {t(`role.${r}`)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="min-w-0 @lg:col-span-2">
                      <Field label={t("common.language")}>
                        <Select
                          name="locale"
                          defaultValue={isChina(party.country) ? "zh" : "pt"}
                        >
                          {LOCALES.map((l) => (
                            <option key={l} value={l}>
                              {LOCALE_NAMES[l]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="min-w-0 @lg:col-span-2">
                      <Field
                        label={t("login.password")}
                        hint={t("portalAccess.password.hint", {
                          n: PORTAL_MIN_PASSWORD,
                        })}
                      >
                        <Input
                          name="password"
                          type="text"
                          minLength={PORTAL_MIN_PASSWORD}
                          maxLength={128}
                          defaultValue={passwordSuggestion}
                          autoComplete="off"
                          required
                        />
                      </Field>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {t("portalAccess.copy.hint")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <AccessCopy
                      labels={{
                        copy: t("portalAccess.copy"),
                        copied: t("portalAccess.copied"),
                        empty: t("portalAccess.copy.empty"),
                        portal: t("portalAccess.copy.portal"),
                        login: t("portalAccess.login.label"),
                        password: t("login.password"),
                      }}
                    />
                    <SubmitButton variant="primary" data-party-access-create="">
                      + {t("portalAccess.create")}
                    </SubmitButton>
                  </div>
                </form>
              )}
            </Card>
          </div>
        </div>
        <div className="min-w-0 space-y-4">
          {/* Visão de Produto: modalidade de operação do cliente (importação própria / via trade / outra) e RADAR. */}
          {isCustomer ? (
            <Card title={t("operations.mode.title")}>
              <p className="mb-3 text-xs text-zinc-500">
                {t("operations.mode.hint")}
              </p>
              {radarIssue ? (
                <div className="mb-3">
                  <Alert tone="warning">
                    {t("operations.mode.warning", {
                      problem: radarIssueText ?? radarIssue,
                    })}
                    {settings && !settings.radarGateEnabled ? (
                      <span className="mt-1 block text-xs">
                        {t("operations.mode.gateOff")}
                      </span>
                    ) : null}
                  </Alert>
                </div>
              ) : null}
              <form
                action={saveCustomerOperationAction}
                className="@container space-y-3"
              >
                <input type="hidden" name="partyId" value={party.id} />
                <div className="grid gap-3 @sm:grid-cols-2">
                  <Field label={t("operations.mode.operationMode")}>
                    <Select
                      name="operationMode"
                      defaultValue={party.operationMode ?? ""}
                    >
                      <option value="">
                        {t("operations.mode.notInformed")}
                      </option>
                      {OPERATION_MODES.map((m) => (
                        <option key={m} value={m}>
                          {t(`operations.operationMode.${m}` as DictionaryKey)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label={t("operations.mode.radar")}
                    hint={t("operations.mode.radarHint")}
                  >
                    <Select name="radar" defaultValue={party.radar ?? ""}>
                      <option value="">
                        {t("operations.mode.notInformed")}
                      </option>
                      {RADAR_STATUSES.map((r) => (
                        <option key={r} value={r}>
                          {t(`operations.radar.${r}` as DictionaryKey)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="min-w-0 @sm:col-span-2">
                    <Field
                      label={t("operations.mode.radarNotes")}
                      hint={t("operations.mode.radarNotesHint")}
                    >
                      <Textarea
                        name="radarNotes"
                        rows={2}
                        maxLength={2000}
                        defaultValue={party.radarNotes ?? ""}
                      />
                    </Field>
                  </div>
                </div>
                <SubmitButton variant="secondary">
                  {t("operations.mode.save")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}
          <Card title={t("catalog.party.sourcing")}>
            <form
              action={updatePartyExtraAction}
              className="@container space-y-3"
            >
              <input type="hidden" name="id" value={party.id} />
              <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-6">
                <div className="min-w-0 @lg:col-span-2">
                  <Field label={t("catalog.party.city")}>
                    <Input
                      name="city"
                      maxLength={80}
                      defaultValue={party.city ?? ""}
                    />
                  </Field>
                </div>
                <div className="min-w-0 @lg:col-span-4">
                  <Field label={t("catalog.party.contactName")}>
                    <Input
                      name="contactName"
                      maxLength={120}
                      defaultValue={party.contactName ?? ""}
                    />
                  </Field>
                </div>
                <div className="min-w-0 @sm:col-span-2 @lg:col-span-6">
                  <Field label={t("catalog.party.address")}>
                    <Input
                      name="address"
                      maxLength={255}
                      defaultValue={party.address ?? ""}
                    />
                  </Field>
                </div>
                <div className="min-w-0 @lg:col-span-3">
                  <Field label={t("catalog.party.wechat")}>
                    <Input
                      name="wechat"
                      maxLength={80}
                      defaultValue={party.wechat ?? ""}
                    />
                  </Field>
                </div>
                {party.type === "supplier" ? (
                  <div className="min-w-0 @lg:col-span-3">
                    <Field
                      label={t("catalog.party.storeNumber")}
                      hint={t("catalog.party.storeNumberHint")}
                    >
                      <Input
                        name="storeNumber"
                        maxLength={60}
                        placeholder={t("ph.party.storeNumber")}
                        defaultValue={party.storeNumber ?? ""}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
              {party.type === "supplier" ? (
                <fieldset
                  id="bank"
                  className="scroll-mt-24 space-y-2 border-t border-zinc-100 pt-3"
                >
                  <legend className="text-sm font-semibold text-zinc-900">
                    {t("supplierPay.bankTitle")}
                  </legend>
                  <p className="text-xs text-zinc-500">
                    {t("supplierPay.bankHint")}
                  </p>
                  <div className="grid gap-3 @sm:grid-cols-2 @lg:grid-cols-6">
                    <div className="min-w-0 @lg:col-span-3">
                      <Field label={t("supplierPay.field.bankBeneficiary")}>
                        <Input
                          name="bankBeneficiary"
                          maxLength={160}
                          defaultValue={party.bankBeneficiary ?? ""}
                        />
                      </Field>
                    </div>
                    <div className="min-w-0 @lg:col-span-3">
                      <Field label={t("supplierPay.field.bankName")}>
                        <Input
                          name="bankName"
                          maxLength={160}
                          defaultValue={party.bankName ?? ""}
                        />
                      </Field>
                    </div>
                    <div className="min-w-0 @lg:col-span-4">
                      <Field label={t("supplierPay.field.bankAccount")}>
                        <Input
                          name="bankAccount"
                          maxLength={80}
                          defaultValue={party.bankAccount ?? ""}
                          className="font-mono"
                        />
                      </Field>
                    </div>
                    <div className="min-w-0 @lg:col-span-2">
                      <Field label={t("supplierPay.field.bankSwift")}>
                        <Input
                          name="bankSwift"
                          maxLength={20}
                          defaultValue={party.bankSwift ?? ""}
                          className="font-mono uppercase"
                        />
                      </Field>
                    </div>
                    <div className="min-w-0 @sm:col-span-2 @lg:col-span-6">
                      <Field label={t("supplierPay.field.bankAddress")}>
                        <Input
                          name="bankAddress"
                          maxLength={255}
                          defaultValue={party.bankAddress ?? ""}
                        />
                      </Field>
                    </div>
                  </div>
                </fieldset>
              ) : null}
              <SubmitButton variant="secondary">
                {t("common.save")}
              </SubmitButton>
            </form>
          </Card>
          {isSupplier && isAdmin(user) ? (
            /* Início da produção: dias depois do contrato assinado, por
               fornecedor (só o administrador). Vazio: o padrão das Configurações. */
            <Card
              title={
                <span id="production-start" className="scroll-mt-24">
                  {t("prodStart.title")}
                </span>
              }
            >
              <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                {t("prodStart.hint", {
                  days: String(productionStart.fallback),
                })}
              </p>
              {saved === "production" ? (
                <div className="mb-3">
                  <Alert tone="success">{t("prodStart.saved")}</Alert>
                </div>
              ) : null}
              <form
                action={saveSupplierProductionStartAction}
                className="flex flex-wrap items-end gap-2"
                data-production-start-form
              >
                <input type="hidden" name="id" value={party.id} />
                <Field label={t("prodStart.label")}>
                  <Input
                    name="productionStartDays"
                    type="number"
                    step="1"
                    min="0"
                    max="365"
                    defaultValue={productionStart.own ?? ""}
                    placeholder={String(productionStart.fallback)}
                  />
                </Field>
                <SubmitButton variant="secondary">
                  {t("common.save")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}
          {isSupplier && canOpen(user, "finance") ? (
            /* Condição de pagamento negociada com o fornecedor: os pedidos novos
               copiam; vira parcelas em Contas a pagar. Financeiro: só o admin. */
            <Card
              title={
                <span id="payment-terms" className="scroll-mt-24">
                  {t("payTerms.title")}
                </span>
              }
            >
              <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                {t("payTerms.hint")}
              </p>
              {saved === "terms" ? (
                <div className="mb-3">
                  <Alert tone="success">{t("payTerms.saved")}</Alert>
                </div>
              ) : null}
              {termsError ? (
                <div className="mb-3">
                  <Alert tone="danger">{partyError(t, error)}</Alert>
                </div>
              ) : null}
              {!currentTerms ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {t("payTerms.empty")}
                </p>
              ) : null}
              <form action={saveSupplierTermsAction}>
                <input type="hidden" name="id" value={party.id} />
                <PaymentTermsEditor
                  initial={currentTerms ?? []}
                  bases={PAYMENT_TERM_BASES}
                  texts={paymentTermsTexts(t)}
                  locale={t.intl}
                >
                  <Field
                    label={t("payTerms.note")}
                    hint={t("payTerms.noteHint")}
                  >
                    <Textarea
                      name="paymentTermsNote"
                      maxLength={500}
                      rows={2}
                      defaultValue={party.paymentTermsNote ?? ""}
                      placeholder={t("payTerms.notePlaceholder")}
                    />
                  </Field>
                </PaymentTermsEditor>
              </form>
            </Card>
          ) : null}
        </div>
      </div>

      {isSupplier ? (
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
          <Card
            title={t("catalog.party.visits")}
            actions={
              <LinkButton href="/app/sourcing" className="px-3 py-1.5 text-xs">
                {t("nav.sourcing")}
              </LinkButton>
            }
          >
            {visits.length === 0 ? (
              <Empty>{t("catalog.party.visits.empty")}</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("common.date")}</Th>
                    <Th>{t("catalog.party.visit.location")}</Th>
                    <Th>{t("common.status")}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id} className={rowClass}>
                      <Td className="whitespace-nowrap">
                        {formatDate(v.visitedAt, t)}
                      </Td>
                      <Td>
                        {[v.factoryName, v.location, v.city]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                        {v.followUp ? (
                          <span className="block text-xs text-zinc-500">
                            {v.followUp}
                          </span>
                        ) : null}
                      </Td>
                      <Td>
                        <Badge tone={v.status === "done" ? "success" : "info"}>
                          {t(
                            `catalog.visitStatus.${v.status}` as DictionaryKey,
                          )}
                        </Badge>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <TextLink href={`/app/sourcing/visits/${v.id}`}>
                          {t("catalog.party.visit.open")}
                        </TextLink>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card title={t("catalog.party.products")}>
            {supplierProducts.length === 0 ? (
              <Empty>{t("catalog.party.products.empty")}</Empty>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("common.product")}</Th>
                    <Th>{t("catalog.supplierSku")}</Th>
                    <Th className="text-right">{t("common.price")}</Th>
                    <Th className="text-right">{t("catalog.moq")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {supplierProducts.map(
                    ({ product: p, main, code, price, currency, moq }) => (
                      <tr
                        key={p.id}
                        className={rowClass}
                        data-party-product={p.id}
                      >
                        <Td className="font-medium">
                          <TextLink
                            href={`/app/products/${p.id}`}
                            className="text-zinc-900"
                          >
                            {p.name}
                          </TextLink>
                          <span className="block text-xs font-normal text-zinc-500">
                            {p.sku ? (
                              <span className="font-mono">{p.sku} · </span>
                            ) : null}
                            {main
                              ? t("productSuppliers.partyRole.main")
                              : t("productSuppliers.partyRole.linked")}
                          </span>
                        </Td>
                        <Td>
                          <span className="font-mono text-xs">
                            {code ?? "—"}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {price !== null
                            ? formatMoney(price, currency, t)
                            : "—"}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {moq !== null ? moq.toLocaleString(t.intl) : "—"}
                        </Td>
                      </tr>
                    ),
                  )}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      ) : null}

      {/* Segunda Onda: certificações da fábrica (ISO, BSCI, auditorias). */}
      {isSupplier ? (
        <Card title={t("catalog.cert.party.title")} className="mt-4">
          <CertificationsSection
            entity="party"
            entityId={party.id}
            certs={certs}
            users={allUsers}
            user={user}
            t={t}
          />
        </Card>
      ) : null}
    </>
  );
}
