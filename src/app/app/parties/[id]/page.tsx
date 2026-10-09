import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix, isAdmin } from "@/lib/auth/permissions";
import {
  getStore,
  LOCALES,
  OPERATION_MODES,
  RADAR_STATUSES,
  ROLES,
} from "@/lib/db";
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
import { SubmitButton } from "@/components/submit-button";
import { listCertifications } from "@/lib/services/compliance";
import { radarProblem } from "@/lib/services/operations";
import { createUserAction } from "../../actions";
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

const roleForType: Record<string, string> = {
  customer: "customer",
  supplier: "supplier",
  agency: "agency",
  broker: "broker",
  shipping_line: "shipping_line",
  carrier: "carrier",
  legal: "legal",
};

export default async function PartyPage({
  params,
  searchParams,
}: PageProps<"/app/parties/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { id } = await params;
  const { error, saved } = await searchParams;
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
  const errorText = partyError(t, error);
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
  const roles = isAdmin(user)
    ? ROLES
    : ROLES.filter((r) => r !== "admin" && r !== "operator");

  return (
    <>
      <PageHeader
        help={{ body: "help.party.body", steps: "help.catalog.party.steps" }}
        t={t}
        title={party.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{t(`party.${party.type}`)}</Badge>
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
      {saved ? (
        <Alert tone="success">
          {saved === "operation"
            ? t("operations.mode.saved")
            : t("catalog.saved")}
        </Alert>
      ) : null}
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title={t("common.edit")}>
          <PartyForm party={party} t={t} />
        </Card>
        <div className="space-y-6">
          {/* Visão de Produto: modalidade de operação do cliente (importação própria / via trade / outra) e RADAR. */}
          {isCustomer ? (
            <Card title={t("operations.mode.title")}>
              <p className="mb-4 text-xs text-zinc-500">
                {t("operations.mode.hint")}
              </p>
              {radarIssue ? (
                <div className="mb-4">
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
              <form action={saveCustomerOperationAction} className="space-y-4">
                <input type="hidden" name="partyId" value={party.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("operations.mode.operationMode")}>
                    <Select
                      name="operationMode"
                      defaultValue={party.operationMode ?? ""}
                      className="py-2.5"
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
                    <Select
                      name="radar"
                      defaultValue={party.radar ?? ""}
                      className="py-2.5"
                    >
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
                  <div className="sm:col-span-2">
                    <Field
                      label={t("operations.mode.radarNotes")}
                      hint={t("operations.mode.radarNotesHint")}
                    >
                      <Textarea
                        name="radarNotes"
                        rows={3}
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
            <form action={updatePartyExtraAction} className="space-y-4">
              <input type="hidden" name="id" value={party.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("catalog.party.city")}>
                  <Input
                    name="city"
                    maxLength={80}
                    defaultValue={party.city ?? ""}
                    className="py-2.5"
                  />
                </Field>
                <Field label={t("catalog.party.contactName")}>
                  <Input
                    name="contactName"
                    maxLength={120}
                    defaultValue={party.contactName ?? ""}
                    className="py-2.5"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={t("catalog.party.address")}>
                    <Input
                      name="address"
                      maxLength={255}
                      defaultValue={party.address ?? ""}
                      className="py-2.5"
                    />
                  </Field>
                </div>
                <Field label={t("catalog.party.wechat")}>
                  <Input
                    name="wechat"
                    maxLength={80}
                    defaultValue={party.wechat ?? ""}
                    className="py-2.5"
                  />
                </Field>
                {party.type === "supplier" ? (
                  <Field
                    label={t("catalog.party.storeNumber")}
                    hint={t("catalog.party.storeNumberHint")}
                  >
                    <Input
                      name="storeNumber"
                      maxLength={60}
                      placeholder={t("ph.party.storeNumber")}
                      defaultValue={party.storeNumber ?? ""}
                      className="py-2.5"
                    />
                  </Field>
                ) : null}
              </div>
              {party.type === "supplier" ? (
                <fieldset
                  id="bank"
                  className="scroll-mt-24 space-y-3 border-t border-zinc-100 pt-4"
                >
                  <legend className="text-sm font-semibold text-zinc-900">
                    {t("supplierPay.bankTitle")}
                  </legend>
                  <p className="text-xs text-zinc-500">
                    {t("supplierPay.bankHint")}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("supplierPay.field.bankBeneficiary")}>
                      <Input
                        name="bankBeneficiary"
                        maxLength={160}
                        defaultValue={party.bankBeneficiary ?? ""}
                        className="py-2.5"
                      />
                    </Field>
                    <Field label={t("supplierPay.field.bankName")}>
                      <Input
                        name="bankName"
                        maxLength={160}
                        defaultValue={party.bankName ?? ""}
                        className="py-2.5"
                      />
                    </Field>
                    <Field label={t("supplierPay.field.bankAccount")}>
                      <Input
                        name="bankAccount"
                        maxLength={80}
                        defaultValue={party.bankAccount ?? ""}
                        className="py-2.5 font-mono"
                      />
                    </Field>
                    <Field label={t("supplierPay.field.bankSwift")}>
                      <Input
                        name="bankSwift"
                        maxLength={20}
                        defaultValue={party.bankSwift ?? ""}
                        className="py-2.5 font-mono uppercase"
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label={t("supplierPay.field.bankAddress")}>
                        <Input
                          name="bankAddress"
                          maxLength={255}
                          defaultValue={party.bankAddress ?? ""}
                          className="py-2.5"
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
          <Card title={t("parties.users")}>
            <ul className="mb-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 break-words">
                    <span className="font-medium text-zinc-900">{u.name}</span>{" "}
                    <span className="text-zinc-500">· {u.email}</span>
                  </span>
                  <span className="shrink-0">
                    <Badge>{t(`role.${u.role}`)}</Badge>
                  </span>
                </li>
              ))}
              {users.length === 0 ? (
                <li className="px-3 py-2.5 text-zinc-500">
                  {t("common.none")}
                </li>
              ) : null}
            </ul>
            <form
              action={createUserAction}
              className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4"
            >
              <input type="hidden" name="partyId" value={party.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t("common.name")}>
                  <Input name="name" required />
                </Field>
                <Field label={t("common.email")}>
                  <Input name="email" type="email" required />
                </Field>
                <Field label={t("common.role")}>
                  <Select
                    name="role"
                    defaultValue={roleForType[party.type] ?? "customer"}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {t(`role.${r}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("common.language")}>
                  <Select
                    name="locale"
                    defaultValue={party.country === "CN" ? "zh" : "pt"}
                  >
                    {LOCALES.map((l) => (
                      <option key={l} value={l}>
                        {LOCALE_NAMES[l]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("login.password")}>
                  <Input name="password" type="text" minLength={6} required />
                </Field>
              </div>
              <SubmitButton variant="secondary">
                + {t("parties.users")}
              </SubmitButton>
            </form>
          </Card>
        </div>
      </div>

      {isSupplier ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
        <Card title={t("catalog.cert.party.title")} className="mt-6">
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
