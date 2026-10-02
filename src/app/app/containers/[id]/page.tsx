import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { CONTAINER_STATUSES, getStore } from "@/lib/db";
import { listOrderItemChoices, loadContainer } from "@/lib/services/containers";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Progress,
  Select,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  addContainerItemAction,
  removeContainerItemAction,
  setContainerStatusAction,
} from "../../actions/logistics";
import {
  bigField,
  containerTone,
  errorMessage,
  formatNumber,
  formatPercent,
} from "../_components/shared";

/** Container (Wellmix): situação, ocupação em CBM e peso, itens e visão comercial. */
export default async function ContainerPage({
  params,
  searchParams,
}: PageProps<"/app/containers/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { id } = await params;
  const { error } = await searchParams;
  const t = await getT();
  const view = await loadContainer(id);
  if (!view) notFound();
  const store = getStore();
  const orderIds = [
    ...new Set(
      view.items.map((i) => i.orderId).filter((x): x is string => !!x),
    ),
  ];
  const [settings, choices, products, orders, parties] = await Promise.all([
    getSettings(),
    listOrderItemChoices(),
    store.list("products", { filter: { active: true }, orderBy: "name" }),
    orderIds.length ? store.list("orders", { filter: { id: orderIds } }) : [],
    store.list("parties"),
  ]);
  const { container, items, usage, split, customerName } = view;
  const errorText = errorMessage(t, error);
  const closed = container.status === "closed";
  const nextStatus =
    CONTAINER_STATUSES[CONTAINER_STATUSES.indexOf(container.status) + 1] ??
    null;
  const overOccupancy =
    usage.occupancyPercent > settings.containerMaxOccupancyPercent;
  const customerOf = (orderId: string | null) => {
    if (!orderId) return t("containers.item.stock");
    const order = orders.find((o) => o.id === orderId);
    return parties.find((p) => p.id === order?.customerId)?.name ?? "—";
  };

  return (
    <>
      <PageHeader
        help={{ body: "help.container.body", steps: "help.container.steps" }}
        t={t}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {container.code}
            <Badge tone={containerTone(container.status)}>
              {t(`containers.status.${container.status}`)}
            </Badge>
          </span>
        }
        subtitle={
          <>
            {container.type} · {formatNumber(container.capacityCbm)} m³
            {container.maxWeightKg
              ? ` · ${formatNumber(container.maxWeightKg)} kg`
              : ""}{" "}
            · {customerName ?? t("containers.noCustomer")}
          </>
        }
        actions={
          <>
            <LinkButton href="/app/containers">{t("common.back")}</LinkButton>
            <form
              action={setContainerStatusAction}
              className="flex items-center gap-2"
            >
              <input type="hidden" name="id" value={container.id} />
              <Select
                name="status"
                defaultValue={nextStatus ?? container.status}
                aria-label={t("containers.changeStatus")}
                className="w-auto"
              >
                {CONTAINER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`containers.status.${s}`)}
                  </option>
                ))}
              </Select>
              <SubmitButton>{t("containers.changeStatus")}</SubmitButton>
            </form>
          </>
        }
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          className="min-w-0 lg:col-span-2"
          title={t("containers.occupancy")}
        >
          <div className="space-y-4">
            {usage.overCapacity ? (
              <Alert tone="danger">
                {t("containers.alert.overCapacity", {
                  total: formatNumber(usage.totalCbm, 4),
                  capacity: formatNumber(container.capacityCbm),
                })}
              </Alert>
            ) : overOccupancy ? (
              <Alert tone="warning">
                {t("containers.alert.overOccupancy", {
                  max: settings.containerMaxOccupancyPercent,
                  percent: formatNumber(usage.occupancyPercent, 1),
                })}
              </Alert>
            ) : null}
            {usage.overWeight ? (
              <Alert tone="danger">
                {t("containers.alert.overWeight", {
                  total: formatNumber(usage.totalWeightKg, 1),
                  max: formatNumber(container.maxWeightKg),
                })}
              </Alert>
            ) : null}
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-zinc-800">
                  {t("containers.cbmUsed")}
                </span>
                <span
                  className={cx(
                    "tabular-nums",
                    usage.overCapacity
                      ? "font-semibold text-red-700"
                      : "text-zinc-700",
                  )}
                >
                  {formatNumber(usage.totalCbm, 4)} /{" "}
                  {formatNumber(container.capacityCbm)} m³ ·{" "}
                  {formatPercent(usage.occupancyPercent)}
                </span>
              </div>
              <Progress percent={usage.occupancyPercent} tone="danger" />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-zinc-800">
                  {t("containers.weight")}
                </span>
                <span
                  className={cx(
                    "tabular-nums",
                    usage.overWeight
                      ? "font-semibold text-red-700"
                      : "text-zinc-700",
                  )}
                >
                  {usage.totalWeightKg !== null
                    ? `${formatNumber(usage.totalWeightKg, 1)}${
                        container.maxWeightKg
                          ? ` / ${formatNumber(container.maxWeightKg)}`
                          : ""
                      } kg${
                        usage.weightPercent !== null
                          ? ` · ${formatPercent(usage.weightPercent)}`
                          : ""
                      }`
                    : t("containers.weightUnknown")}
                </span>
              </div>
              {usage.weightPercent !== null ? (
                <Progress percent={usage.weightPercent} tone="danger" />
              ) : null}
            </div>
            <DescriptionList
              items={[
                [t("containers.boxes"), usage.boxes],
                [
                  t("containers.capacity"),
                  `${formatNumber(container.capacityCbm)} m³`,
                ],
                [t("containers.etd"), formatDate(container.etd)],
                [t("containers.eta"), formatDate(container.eta)],
                ...(container.notes
                  ? ([[t("containers.notes"), container.notes]] as Array<
                      [string, string]
                    >)
                  : []),
              ]}
            />
          </div>
        </Card>

        <Card className="min-w-0" title={t("containers.commercial")}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("containers.soldValue")}
              </dt>
              <dd className="mt-0.5 text-2xl font-bold tracking-tight text-zinc-900">
                {formatMoney(view.soldValue, view.soldCurrency)}
              </dd>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {t("containers.soldPercent")}
                </dt>
                <dd className="font-semibold tabular-nums text-emerald-700">
                  {formatPercent(split.soldPercent)}
                </dd>
              </div>
              <Progress percent={split.soldPercent} />
              <p className="mt-1 text-xs text-zinc-500">
                {formatNumber(split.soldCbm, 4)} m³
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("containers.availablePercent")}
              </dt>
              <dd className="font-semibold tabular-nums text-zinc-800">
                {formatPercent(split.availablePercent)}{" "}
                <span className="text-xs font-normal text-zinc-500">
                  ({formatNumber(split.availableCbm, 4)} m³)
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 ring-1 ring-inset ring-zinc-200">
            {t("containers.commercialHint")}
          </p>
        </Card>
      </div>

      <Card className="mt-6 min-w-0" title={t("containers.items")}>
        {items.length === 0 ? (
          <Empty>{t("containers.items.none")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("common.name")}</Th>
                <Th>{t("containers.item.order")}</Th>
                <Th>{t("common.customer")}</Th>
                <Th className="text-right">{t("common.quantity")}</Th>
                <Th className="text-right">
                  {t("containers.item.unitsPerBox")}
                </Th>
                <Th className="text-right">{t("containers.item.boxes")}</Th>
                <Th className="text-right">{t("containers.item.cbmPerBox")}</Th>
                <Th className="text-right">{t("containers.item.cbmTotal")}</Th>
                <Th className="text-right">{t("containers.item.weight")}</Th>
                <Th>{t("containers.soldAvailable")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={rowClass}>
                  <Td className="font-medium">{item.name}</Td>
                  <Td className="whitespace-nowrap">
                    {item.orderId ? (
                      <TextLink href={`/app/orders/${item.orderId}`}>
                        #{view.orderNumbers[item.orderId] ?? "?"}
                      </TextLink>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>{customerOf(item.orderId)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {formatNumber(item.quantity)} {item.unit}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {formatNumber(item.unitsPerBox)}
                  </Td>
                  <Td className="text-right tabular-nums">{item.boxCount}</Td>
                  <Td className="text-right tabular-nums">
                    {formatNumber(item.cbmPerBox, 4)}
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {formatNumber(item.boxCount * item.cbmPerBox, 4)}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {item.weightPerBoxKg !== null
                      ? formatNumber(item.boxCount * item.weightPerBoxKg, 1)
                      : "—"}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={item.orderId ? "success" : "neutral"}>
                      {item.orderId
                        ? t("containers.sold")
                        : t("containers.available")}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {closed ? null : (
                      <form action={removeContainerItemAction}>
                        <input
                          type="hidden"
                          name="containerId"
                          value={container.id}
                        />
                        <input type="hidden" name="itemId" value={item.id} />
                        <SubmitButton
                          type="submit"
                          variant="danger"
                          className="px-2.5 py-1 text-xs"
                        >
                          {t("containers.remove")}
                        </SubmitButton>
                      </form>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {closed ? null : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card
            className="min-w-0"
            title={`${t("containers.addItem")} · ${t("containers.addItem.byOrder")}`}
          >
            {choices.length === 0 ? (
              <Empty>{t("containers.addItem.noOrders")}</Empty>
            ) : (
              <form action={addContainerItemAction} className="space-y-3">
                <input type="hidden" name="containerId" value={container.id} />
                <input type="hidden" name="mode" value="order" />
                <Field
                  label={t("containers.addItem.order")}
                  hint={t("containers.addItem.orderHint")}
                >
                  <Select name="orderItemId" required className={bigField}>
                    {choices.map((c) => (
                      <option key={c.orderItemId} value={c.orderItemId}>
                        #{c.orderNumber} · {c.name} · {c.customerName} (
                        {formatNumber(c.quantity)} {c.unit})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t("common.quantity")}
                  hint={t("containers.addItem.quantityHint")}
                >
                  <Input
                    name="quantity"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    className={bigField}
                  />
                </Field>
                <BoxFields t={t} />
                <SubmitButton className="w-full py-2.5 text-base sm:w-auto sm:py-2 sm:text-sm">
                  {t("containers.addItem.submit")}
                </SubmitButton>
              </form>
            )}
          </Card>

          <Card
            className="min-w-0"
            title={`${t("containers.addItem")} · ${t("containers.addItem.byStock")}`}
          >
            <form action={addContainerItemAction} className="space-y-3">
              <input type="hidden" name="containerId" value={container.id} />
              <input type="hidden" name="mode" value="stock" />
              <Field label={t("containers.addItem.product")}>
                <Select name="productId" required className={bigField}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.sku ? ` (${p.sku})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("common.quantity")}>
                <Input
                  name="quantity"
                  type="number"
                  min="1"
                  step="1"
                  required
                  inputMode="numeric"
                  className={bigField}
                />
              </Field>
              <BoxFields t={t} open />
              <SubmitButton className="w-full py-2.5 text-base sm:w-auto sm:py-2 sm:text-sm">
                {t("containers.addItem.submit")}
              </SubmitButton>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

/** Campos de caixa/CBM/peso (opcionais; vazios = ficha do produto). */
function BoxFields({
  t,
  open = false,
}: {
  t: Awaited<ReturnType<typeof getT>>;
  open?: boolean;
}) {
  return (
    <details open={open} className="group rounded-xl border border-zinc-200/80">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-zinc-800 [&::-webkit-details-marker]:hidden">
        {t("containers.item.unitsPerBox")} · {t("containers.item.cbmPerBox")} ·{" "}
        {t("containers.item.weight")}
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-base font-normal text-zinc-500 transition group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="grid gap-3 border-t border-zinc-100 px-3 py-3 sm:grid-cols-2">
        <p className="text-xs text-zinc-500 sm:col-span-2">
          {t("containers.addItem.boxHint")}
        </p>
        <Field label={t("containers.item.unitsPerBox")}>
          <Input
            name="unitsPerBox"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className={bigField}
          />
        </Field>
        <Field label={t("containers.item.boxes")}>
          <Input
            name="boxCount"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className={bigField}
          />
        </Field>
        <Field label={`${t("containers.item.cbmPerBox")} (m³)`}>
          <Input
            name="cbmPerBox"
            type="number"
            min="0"
            step="0.0001"
            inputMode="decimal"
            className={bigField}
          />
        </Field>
        <Field label={t("containers.item.weightPerBox")}>
          <Input
            name="weightPerBoxKg"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className={bigField}
          />
        </Field>
      </div>
    </details>
  );
}
