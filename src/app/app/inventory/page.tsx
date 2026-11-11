import { LiveSearch } from "@/components/live-search";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  IDLE_DAYS,
  INVENTORY_SITUATIONS,
  limitStatus,
  reorderQuantity,
} from "@/lib/services/inventory";
import { productPhotoList } from "@/lib/services/product-list";
import { STOCK_OPTION, STOCK_PARTY_ID } from "@/lib/services/stock-party";
import { SubmitButton } from "@/components/submit-button";
import { setMinStockAction, stockOutAction } from "../actions/stock";
import { stockErrorText } from "./_errors";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Field,
  Input,
  Select,
  LinkButton,
  PageHeader,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { IconLink } from "@/components/customer-account";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import {
  inventoryData,
  lineValue,
  qtyFor,
  readInventoryFilter,
  valueByCurrency,
} from "./_data";
import { canSeeMoney } from "@/lib/auth/function-access";

const LIMIT_TONE = {
  ok: "success",
  incoming: "warning",
  reorder: "danger",
} as const;

/**
 * Estoque da Wellmix por produto: no Brasil, em trânsito e em produção, com
 * caixas, totais e (só para quem abre Finanças) o valor de custo. Só a
 * Wellmix; leitura no servidor.
 */
export default async function InventoryPage({
  searchParams,
}: PageProps<"/app/inventory">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  if (!isWellmix(user)) redirect("/app");
  const t = await getT();
  const sp = await searchParams;
  const filter = readInventoryFilter(sp);
  const { situation, q } = filter;
  const money = canSeeMoney(user);
  const { lines, counts, hasAny } = await inventoryData(filter);
  // Locais de estoque (CODLOCAL do Sankhya); banco sem a tabela = nenhum.
  const locations = await getStore()
    .list("stock_locations")
    .catch(() => []);
  const locationLabel = (id: string) => {
    const l = locations.find((x) => x.id === id);
    return l ? `${l.code} ${l.name}` : "?";
  };
  const photos = lines.length
    ? await getStore().list("product_photos", {
        filter: { productId: lines.map((l) => l.productId) },
      })
    : [];
  const listQuery = (over: { situ?: string | null }) => {
    const p = new URLSearchParams();
    const situ = over.situ === undefined ? situation : over.situ;
    if (situ && situ !== "all") p.set("situ", situ);
    if (q) p.set("q", q);
    const out = p.toString();
    return out ? `?${out}` : "";
  };
  const totalUnits = lines.reduce((s, l) => s + qtyFor(l, situation), 0);
  const totalBoxes = lines.reduce((s, l) => s + l.boxes, 0);
  const totals = valueByCurrency(lines, situation);
  const num = (n: number) => n.toLocaleString(t.intl);
  // Baixa por venda: produtos com estoque no Brasil e pedidos de clientes.
  const outChoices = (await inventoryData({ situation: "brazil", q: "" }))
    .lines;
  const customerOrders = outChoices.length
    ? (
        await getStore().list("orders", {
          orderBy: "number",
          direction: "desc",
        })
      )
        .filter(
          (o) => o.status !== "CANCELLED" && o.customerId !== STOCK_PARTY_ID,
        )
        .slice(0, 200)
    : [];
  const parties = customerOrders.length
    ? await getStore().list("parties", { filter: { type: "customer" } })
    : [];
  const errorCode = typeof sp.error === "string" ? sp.error : null;

  return (
    <>
      <PageHeader
        t={t}
        title={t("inv.title")}
        subtitle={t("inv.subtitle")}
        actions={
          <>
            <LinkButton href="/app/inventory/counts" data-inventory-counts>
              {t("stockCount.link")}
            </LinkButton>
            <LinkButton
              href="/app/inventory/reservations"
              data-inventory-reservations
            >
              {t("res.link")}
            </LinkButton>
            <LinkButton
              href="/app/inventory/movements"
              data-inventory-movements
            >
              {t("stockMov.link")}
            </LinkButton>
            <LinkButton
              href={`/app/requests/new?customerId=${STOCK_OPTION}`}
              variant="primary"
              data-inventory-new
            >
              {t("inv.newPurchase")}
            </LinkButton>
          </>
        }
      />
      {sp.limit === "saved" ? (
        <Alert tone="success">{t("inv.limit.saved")}</Alert>
      ) : null}
      {sp.stockOut === "done" ? (
        <Alert tone="success">{t("stockOut.done")}</Alert>
      ) : null}
      {errorCode ? (
        <Alert tone="danger">{stockErrorText(t, errorCode)}</Alert>
      ) : null}
      {outChoices.length ? (
        <details
          className="mb-3 rounded-2xl border border-zinc-200/80 bg-white shadow-sm"
          data-stock-out
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
            {t("stockOut.open")}
          </summary>
          <form
            action={stockOutAction}
            className="grid gap-3 border-t border-zinc-200/80 p-4 md:grid-cols-[minmax(0,2fr)_8rem_minmax(0,2fr)_minmax(0,2fr)_auto] md:items-end"
          >
            <Field label={t("stockOut.product")}>
              <Select name="productId" required defaultValue="">
                <option value="" disabled>
                  {t("common.select")}
                </option>
                {outChoices.map((l) => (
                  <option key={l.productId} value={l.productId}>
                    {l.product?.name ?? l.productId}
                    {l.product?.sku ? ` (${l.product.sku})` : ""} ·{" "}
                    {t("stockOut.available", { n: num(l.brazil) })}
                    {l.reserved
                      ? ` · ${t("inv.reserved.free", { n: num(Math.max(0, l.brazil - l.reserved)) })}`
                      : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("stockOut.quantity")}>
              <Input
                name="quantity"
                type="number"
                min="1"
                step="1"
                required
                inputMode="numeric"
              />
            </Field>
            <Field label={t("stockOut.order")}>
              <Select name="orderId" defaultValue="">
                <option value="">{t("stockOut.noOrder")}</option>
                {customerOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.number} ·{" "}
                    {parties.find((p) => p.id === o.customerId)?.name ?? ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("stockOut.note")}>
              <Input name="note" maxLength={500} />
            </Field>
            <SubmitButton variant="danger">{t("stockOut.submit")}</SubmitButton>
            <p className="text-xs text-zinc-500 md:col-span-5">
              {t("stockOut.hint")}
            </p>
          </form>
        </details>
      ) : null}
      <div className="mb-3 space-y-2" data-inventory-filters>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {INVENTORY_SITUATIONS.map((k) => (
            <Stat
              key={k}
              compact
              label={t(`inv.situ.${k}`)}
              value={counts[k]}
              href={`/app/inventory${listQuery({ situ: k })}`}
              active={situation === k}
              tone={
                k === "below" && counts.below > 0 && situation !== k
                  ? "danger"
                  : k === "idle" && counts.idle > 0 && situation !== k
                    ? "warning"
                    : "neutral"
              }
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form
            method="get"
            action="/app/inventory"
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            data-inventory-search
          >
            {situation !== "all" ? (
              <input type="hidden" name="situ" value={situation} />
            ) : null}
            <Input
              name="q"
              defaultValue={q}
              placeholder={t("inv.search")}
              aria-label={t("inv.search")}
              className="w-full max-w-md"
            />
            <LiveSearch />
            <Button type="submit" variant="primary">
              {t("inv.searchButton")}
            </Button>
          </form>
          <LinkButton
            href={`/app/inventory/export${listQuery({})}`}
            data-inventory-export
          >
            {t("inv.export")}
          </LinkButton>
        </div>
        {/* Totais da lista mostrada, como no rodapé do sistema antigo. */}
        <div
          className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm text-zinc-700"
          data-inventory-totals
        >
          <span>
            {t("inv.total.boxes")}:{" "}
            <strong className="tabular-nums">{num(totalBoxes)}</strong>
          </span>
          <span>
            {t("inv.total.units")}:{" "}
            <strong className="tabular-nums">{num(totalUnits)}</strong>
          </span>
          {money ? (
            <span title={t("inv.total.valueHint")} data-inventory-value>
              {t("inv.total.value")}:{" "}
              <strong className="tabular-nums">
                {totals.size
                  ? [...totals]
                      .map(([c, v]) => formatMoney(v, c, t))
                      .join(" + ")
                  : "—"}
              </strong>
            </span>
          ) : null}
        </div>
      </div>
      {lines.length === 0 ? (
        <Empty>{hasAny ? t("inv.emptyFilter") : t("inv.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-14">{t("prodList.col.photo")}</Th>
              <Th>{t("prodList.col.category")}</Th>
              <Th>{t("common.name")}</Th>
              <Th>{t("inv.col.spec")}</Th>
              <Th>{t("inv.col.color")}</Th>
              <Th>{t("prodList.col.supplierSku")}</Th>
              <Th className="text-right">{t("inv.col.boxes")}</Th>
              <Th className="text-right">{t("inv.col.brazil")}</Th>
              <Th className="text-right">{t("inv.col.reserved")}</Th>
              <Th className="text-right">{t("inv.col.transit")}</Th>
              <Th className="text-right">{t("inv.col.production")}</Th>
              <Th className="text-right">{t("inv.col.total")}</Th>
              <Th>
                <span title={t("inv.limit.hint")}>{t("inv.col.limit")}</span>
              </Th>
              {money ? (
                <>
                  <Th className="text-right">{t("inv.col.cost")}</Th>
                  <Th className="text-right">{t("inv.col.value")}</Th>
                </>
              ) : null}
              <Th>{t("prodList.col.notes")}</Th>
              <Th>{t("inv.col.last")}</Th>
              <Th className="text-right">{t("prodList.col.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const p = l.product;
              const value = lineValue(l, situation);
              const qty = (n: number) =>
                n > 0 ? num(n) : <span className="text-zinc-400">0</span>;
              return (
                <tr
                  key={l.productId}
                  className={rowClass}
                  data-inventory-row={l.productId}
                >
                  <Td className="w-14">
                    <PhotoGallery
                      name={p?.name ?? ""}
                      {...galleryProps(t, p ? productPhotoList(p, photos) : [])}
                    />
                  </Td>
                  <Td>{p?.category ?? "—"}</Td>
                  <Td className="min-w-44 font-medium">
                    {p ? (
                      <TextLink
                        href={`/app/products/${p.id}`}
                        className="text-zinc-900"
                      >
                        {p.name}
                      </TextLink>
                    ) : (
                      "—"
                    )}
                    <span className="block font-mono text-xs font-normal text-zinc-500">
                      {p?.sku ?? ""}
                    </span>
                    {(l.idleDays ?? -1) >= IDLE_DAYS ? (
                      <span
                        className="mt-1 block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                        title={t("inv.idle.hint")}
                        data-inventory-idle
                      >
                        {t("inv.idle.badge", { n: l.idleDays ?? 0 })}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <span
                      className="block max-w-48 truncate"
                      title={p?.specification ?? undefined}
                    >
                      {p?.specification ?? "—"}
                    </span>
                  </Td>
                  <Td>{p?.color ?? "—"}</Td>
                  <Td>
                    <span className="whitespace-nowrap font-mono text-xs text-zinc-700">
                      {p?.supplierSku ?? "—"}
                    </span>
                  </Td>
                  <Td className="text-right tabular-nums">{num(l.boxes)}</Td>
                  <Td className="text-right tabular-nums">
                    {qty(l.brazil)}
                    {l.locations
                      ? Object.entries(l.locations)
                          .filter(([, n]) => n !== 0)
                          .map(([id, n]) => (
                            <span
                              key={id}
                              className="block whitespace-nowrap text-[11px] font-normal text-zinc-500"
                              title={t("inv.locations")}
                              data-stock-location={id}
                            >
                              {locationLabel(id)}: {num(n)}
                            </span>
                          ))
                      : null}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {l.reserved ? (
                      <TextLink
                        href="/app/inventory/reservations"
                        className="font-semibold text-amber-800"
                      >
                        {num(l.reserved)}
                      </TextLink>
                    ) : (
                      <span className="text-zinc-400">0</span>
                    )}
                    {l.reserved ? (
                      <span className="block text-xs text-zinc-500">
                        {t("inv.reserved.free", {
                          n: num(Math.max(0, l.brazil - l.reserved)),
                        })}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-right tabular-nums">{qty(l.transit)}</Td>
                  <Td className="text-right tabular-nums">
                    {qty(l.production)}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {num(l.total)} {l.unit}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <div data-inventory-limit>
                      {(() => {
                        const st = limitStatus(l, p?.minStock);
                        const buy =
                          st === "reorder" && p
                            ? reorderQuantity({
                                minStock: p.minStock,
                                total: l.total,
                                moq: p.moq,
                                unitsPerBox: p.masterBoxQty,
                              })
                            : 0;
                        return st ? (
                          <span className="flex flex-wrap items-center gap-1">
                            <Badge tone={LIMIT_TONE[st]}>
                              {t(`inv.limit.${st}`)}
                            </Badge>
                            {buy > 0 && p ? (
                              <LinkButton
                                href={`/app/requests/new?customerId=${STOCK_OPTION}&productId=${p.id}&quantity=${buy}`}
                                variant="primary"
                                className="px-2 py-0.5 text-xs"
                                title={t("inv.reorder.hint")}
                                data-inventory-reorder={buy}
                              >
                                {t("inv.reorder.buy", { n: num(buy) })}
                              </LinkButton>
                            ) : null}
                          </span>
                        ) : null;
                      })()}
                      {p ? (
                        <form
                          action={setMinStockAction}
                          className="mt-1 flex items-center gap-1"
                        >
                          <input type="hidden" name="productId" value={p.id} />
                          <input
                            type="hidden"
                            name="back"
                            value={`/app/inventory${listQuery({})}`}
                          />
                          <Input
                            name="minStock"
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            defaultValue={p.minStock ?? ""}
                            aria-label={`${t("inv.col.limit")}: ${p.name}`}
                            className="w-20 px-2 py-1 text-xs"
                          />
                          <SubmitButton
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            title={t("inv.limit.save")}
                            pendingText="…"
                          >
                            ✓
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </Td>
                  {money ? (
                    <>
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {formatMoney(p?.price ?? null, p?.currency, t)}
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {formatMoney(value, p?.currency, t)}
                      </Td>
                    </>
                  ) : null}
                  <Td>
                    <span
                      className="block max-w-48 truncate"
                      title={p?.notes ?? undefined}
                    >
                      {p?.notes ?? "—"}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {l.lastAt ? formatDate(l.lastAt, t) : "—"}
                    {l.brazil > 0 ? (
                      <span className="block text-xs text-zinc-500">
                        {l.lastSaleAt
                          ? t("inv.idle.lastSale", {
                              date: formatDate(l.lastSaleAt, t),
                            })
                          : t("inv.idle.never")}
                      </span>
                    ) : null}
                    <span className="block text-xs text-zinc-500">
                      {t("inv.where", {
                        c: l.containerIds.length,
                        o: l.orderIds.length,
                      })}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {p ? (
                      <IconLink
                        href={`/app/products/${p.id}`}
                        icon="eye"
                        label={t("inv.open")}
                      />
                    ) : null}
                    {l.containerIds[0] ? (
                      <IconLink
                        href={`/app/containers/${l.containerIds[0]}`}
                        icon="box"
                        label={t("inv.openContainer")}
                      />
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
