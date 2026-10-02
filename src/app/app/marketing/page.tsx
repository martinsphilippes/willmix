import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  MARKETING_KIT_STATUSES,
  type MarketingKitStatus,
} from "@/lib/db";
import { listKits } from "@/lib/services/marketing";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
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
  if (!(wellmix || user.role === "customer")) redirect("/app");
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
  const [settings, kits, products, customers] = await Promise.all([
    getSettings(),
    listKits(user, {
      customerId: customerId || undefined,
      productId: productId || undefined,
    }),
    store.list("products", { orderBy: "name" }),
    wellmix
      ? store.list("parties", { filter: { type: "customer" }, orderBy: "name" })
      : Promise.resolve([]),
  ]);
  const rows = status ? kits.filter((k) => k.status === status) : kits;
  const productName = (id: string) =>
    products.find((p) => p.id === id)?.name ?? "—";
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
          wellmix && settings.marketingEnabled ? (
            <LinkButton href="/app/marketing/new" variant="primary">
              + {t("marketing.newKit")}
            </LinkButton>
          ) : undefined
        }
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {params.ok ? <Alert tone="success">{t("marketing.ok")}</Alert> : null}
      {!settings.marketingEnabled ? (
        <div className="mb-4">
          <Alert tone="warning">{t("marketing.disabled")}</Alert>
        </div>
      ) : null}
      {!wellmix ? (
        <div className="mb-4">
          <Alert tone="info">{t("marketing.customer.intro")}</Alert>
        </div>
      ) : null}

      {wellmix ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <Card className="mb-4">
            <form
              method="get"
              action="/app/marketing"
              className="grid gap-3 sm:grid-cols-4 sm:items-end"
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
                <Select name="customerId" defaultValue={customerId}>
                  <option value="">{t("common.all")}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("marketing.filter.product")}>
                <Select name="productId" defaultValue={productId}>
                  <option value="">{t("common.all")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.sku ? ` (${p.sku})` : ""}
                    </option>
                  ))}
                </Select>
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
          <ul className="space-y-3 sm:hidden">
            {rows.map((kit) => (
              <li
                key={kit.id}
                className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03]"
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
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
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
                      {formatMoney(kit.price, kit.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("marketing.col.offered")}
                    </dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {formatDate(kit.offeredAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("marketing.col.created")}
                    </dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {formatDate(kit.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("marketing.col.released")}
                    </dt>
                    <dd className="mt-0.5 text-zinc-900">
                      {formatDate(kit.releasedAt)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <LinkButton
                    href={`/app/marketing/${kit.id}`}
                    className="w-full py-2.5"
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
                      {formatMoney(kit.price, kit.currency)}
                    </Td>
                    <Td>
                      <KitStatusBadge t={t} status={kit.status} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(kit.createdAt)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(kit.offeredAt)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(kit.releasedAt)}
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
