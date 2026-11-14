import { listByIds, listColumns } from "@/lib/db/lookup";
import { PartyPicker } from "@/components/party-picker";
import { ProductPicker } from "@/components/product-picker";
import {
  partyPickerLabels,
  productPickerLabels,
} from "@/components/party-picker-labels";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  MARKETING_KIT_STATUSES,
  type MarketingKitStatus,
} from "@/lib/db";
import { listKits } from "@/lib/services/marketing";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Card,
  Empty,
  Field,
  LinkButton,
  PageHeader,
  Select,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { KitStatusBadge, marketingError } from "./_components/shared";

/**
 * /app/marketing: lista de kits de marketing.
 * Wellmix: contagem por situação, filtros GET (status, cliente, produto) e tabela.
 * Cliente: só os próprios kits a partir da oferta (listKits já filtra);
 * nunca preço FOB nem fornecedor. Demais papéis voltam ao início.
 */
export default async function MarketingPage({
  searchParams,
}: PageProps<"/app/marketing">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const wellmix = isWellmix(user);
  requireScreen(user, "marketing");
  const params = await searchParams;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : "";
  const status = (MARKETING_KIT_STATUSES as readonly string[]).includes(
    one(params.status),
  )
    ? (one(params.status) as MarketingKitStatus)
    : undefined;
  const customerId = wellmix ? one(params.customerId) : "";
  const productId = one(params.productId);
  const t = await getT();
  const store = getStore();
  const [settings, kits] = await Promise.all([
    getSettings(),
    listKits(user, {
      customerId: customerId || undefined,
      productId: productId || undefined,
    }),
  ]);
  // Só os produtos dos kits e o do filtro (o filtro busca pelo nome ou
  // código: ~17 mil produtos não cabem numa lista; a página saía com 5,5 MB).
  const products = await listColumns(store, "products", ["name", "sku"], {
    filter: {
      id: [...new Set([...kits.map((k) => k.productId), productId])].filter(
        Boolean,
      ),
    },
  });
  // Só os clientes dos kits e o do filtro; o filtro busca pelo nome (com a
  // carga do Sankhya são ~26 mil clientes, que não cabem numa lista).
  const customers = wellmix
    ? (
        await listByIds(store, "parties", [
          ...kits.map((k) => k.customerId),
          customerId,
        ])
      ).filter((p) => p.type === "customer")
    : [];
  const filterCustomer = customers.find((c) => c.id === customerId) ?? null;
  const rows = status ? kits.filter((k) => k.status === status) : kits;
  const productById = new Map(products.map((p) => [p.id, p]));
  const productName = (id: string) => productById.get(id)?.name ?? "—";
  const filterProduct = productId ? productById.get(productId) : undefined;
  const customerName = (id: string | null) =>
    id
      ? (customers.find((c) => c.id === id)?.name ?? "—")
      : t("marketing.noCustomer");
  const counts = Object.fromEntries(
    MARKETING_KIT_STATUSES.map((s) => [
      s,
      kits.filter((k) => k.status === s).length,
    ]),
  ) as Record<MarketingKitStatus, number>;
  const statusHref = (s?: MarketingKitStatus) => {
    const q = new URLSearchParams();
    if (s) q.set("status", s);
    if (customerId) q.set("customerId", customerId);
    if (productId) q.set("productId", productId);
    const qs = q.toString();
    return `/app/marketing${qs ? `?${qs}` : ""}`;
  };
  const errorText = marketingError(t, params.error);

  return (
    <>
      <PageHeader
        help={
          wellmix
            ? {
                body: "marketing.help.list.body",
                steps: "marketing.help.list.steps",
              }
            : {
                body: "marketing.help.customer.body",
                steps: "marketing.help.customer.steps",
              }
        }
        t={t}
        title={t("marketing.title")}
        subtitle={t("marketing.subtitle")}
        actions={
          wellmix ? (
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/app/marketing/price-table">
                {t("priceTable.title")}
              </LinkButton>
              {settings.marketingEnabled ? (
                <LinkButton href="/app/marketing/new" variant="primary">
                  + {t("marketing.newKit")}
                </LinkButton>
              ) : null}
            </div>
          ) : undefined
        }
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {params.ok ? <Alert tone="success">{t("marketing.ok")}</Alert> : null}
      {!settings.marketingEnabled ? (
        <div className="mb-3">
          <Alert tone="warning">{t("marketing.disabled")}</Alert>
        </div>
      ) : null}
      {!wellmix ? (
        <div className="mb-3">
          <Alert tone="info">{t("marketing.customer.intro")}</Alert>
        </div>
      ) : null}

      {wellmix ? (
        <>
          {/* Contagem por situação: uma linha só no desktop. */}
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <Stat
              label={t("common.all")}
              value={kits.length}
              href={statusHref()}
              active={!status}
            />
            {MARKETING_KIT_STATUSES.map((s) => (
              <Stat
                key={s}
                label={t(`marketing.status.${s}` as DictionaryKey)}
                value={counts[s]}
                href={statusHref(s)}
                active={status === s}
                tone={
                  s === "purchased" && counts[s] > 0 ? "warning" : "neutral"
                }
              />
            ))}
          </div>
          <Card className="mb-3">
            {/* Situação é curta; cliente e produto ficam com o espaço que sobra. */}
            <form
              method="get"
              action="/app/marketing"
              className="grid gap-3 sm:grid-cols-2 sm:items-end md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <Field label={t("marketing.filter.status")}>
                <Select name="status" defaultValue={status ?? ""}>
                  <option value="">{t("common.all")}</option>
                  {MARKETING_KIT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`marketing.status.${s}` as DictionaryKey)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("marketing.filter.customer")}>
                <PartyPicker
                  name="customerId"
                  type="customer"
                  initial={
                    filterCustomer
                      ? { id: filterCustomer.id, name: filterCustomer.name }
                      : null
                  }
                  ariaLabel={t("marketing.filter.customer")}
                  labels={partyPickerLabels(t)}
                />
              </Field>
              <Field label={t("marketing.filter.product")}>
                {/* Vazio = todos os produtos, como a opção da lista antiga. */}
                <ProductPicker
                  name="productId"
                  scope="all"
                  initial={
                    filterProduct
                      ? {
                          id: filterProduct.id,
                          name: `${productNameText(t, filterProduct.name)}${filterProduct.sku ? ` (${filterProduct.sku})` : ""}`,
                        }
                      : null
                  }
                  ariaLabel={t("marketing.filter.product")}
                  labels={{
                    ...productPickerLabels(t),
                    placeholder: t("common.all"),
                  }}
                />
              </Field>
              <div className="flex gap-2">
                <SubmitButton
                  type="submit"
                  variant="secondary"
                  className="flex-1"
                >
                  {t("marketing.filter.apply")}
                </SubmitButton>
                {status || customerId || productId ? (
                  <LinkButton href="/app/marketing" variant="ghost">
                    {t("marketing.filter.clear")}
                  </LinkButton>
                ) : null}
              </div>
            </form>
          </Card>
        </>
      ) : null}

      {rows.length === 0 ? (
        <Empty>
          {wellmix ? t("marketing.none") : t("marketing.none.customer")}
        </Empty>
      ) : (
        <>
          {/* Celular: cards */}
          <ul className="space-y-2 sm:hidden">
            {rows.map((kit) => (
              <li
                key={kit.id}
                className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm shadow-zinc-900/[0.03]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <TextLink
                    href={`/app/marketing/${kit.id}`}
                    className="min-w-0 break-words text-sm"
                  >
                    {kit.name}
                  </TextLink>
                  <KitStatusBadge t={t} status={kit.status} />
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("common.product")}
                    </dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {productName(kit.productId)}
                    </dd>
                  </div>
                  {wellmix ? (
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {t("common.customer")}
                      </dt>
                      <dd className="mt-0.5 text-zinc-900">
                        {customerName(kit.customerId)}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("common.price")}
                    </dt>
                    <dd className="mt-0.5 font-medium text-zinc-900">
                      {formatMoney(kit.price, kit.currency, t)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("marketing.col.offered")}
                    </dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {formatDate(kit.offeredAt, t)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("marketing.col.created")}
                    </dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {formatDate(kit.createdAt, t)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("marketing.col.released")}
                    </dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {formatDate(kit.releasedAt, t)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-2 border-t border-zinc-100 pt-2">
                  <LinkButton
                    href={`/app/marketing/${kit.id}`}
                    className="w-full py-2"
                  >
                    {t("marketing.open")}
                  </LinkButton>
                </div>
              </li>
            ))}
          </ul>
          {/* Mesa: tabela */}
          <div className="hidden sm:block">
            <Table>
              <thead>
                <tr>
                  <Th>{t("marketing.col.kit")}</Th>
                  <Th>{t("common.product")}</Th>
                  {wellmix ? <Th>{t("common.customer")}</Th> : null}
                  <Th>{t("common.price")}</Th>
                  <Th>{t("common.status")}</Th>
                  <Th>{t("marketing.col.created")}</Th>
                  <Th>{t("marketing.col.offered")}</Th>
                  <Th>{t("marketing.col.released")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((kit) => (
                  <tr key={kit.id} className={rowClass}>
                    <Td>
                      <TextLink href={`/app/marketing/${kit.id}`}>
                        {kit.name}
                      </TextLink>
                    </Td>
                    <Td>{productName(kit.productId)}</Td>
                    {wellmix ? <Td>{customerName(kit.customerId)}</Td> : null}
                    <Td className="whitespace-nowrap font-medium">
                      {formatMoney(kit.price, kit.currency, t)}
                    </Td>
                    <Td>
                      <KitStatusBadge t={t} status={kit.status} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(kit.createdAt, t)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(kit.offeredAt, t)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(kit.releasedAt, t)}
                    </Td>
                    <Td className="text-right">
                      <TextLink
                        href={`/app/marketing/${kit.id}`}
                        className="whitespace-nowrap"
                      >
                        {t("marketing.open")}
                      </TextLink>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
