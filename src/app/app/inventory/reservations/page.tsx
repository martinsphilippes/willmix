import { listByIds } from "@/lib/db/lookup";
import { PartyPicker } from "@/components/party-picker";
import { partyPickerLabels } from "@/components/party-picker-labels";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore, type StockReservation } from "@/lib/db";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import { listStockReservations, loadInventory } from "@/lib/services/inventory";
import {
  RESERVATION_DEFAULT_DAYS,
  RESERVATION_MAX_DAYS,
  freeStock,
  reservationState,
} from "@/lib/services/reservation-rules";
import { brazilDay } from "@/lib/supplier-terms";
import { SubmitButton } from "@/components/submit-button";
import { TabLink } from "@/components/customer-account";
import {
  cancelReservationAction,
  createReservationAction,
  consumeReservationAction,
} from "../../actions/stock";
import { stockErrorText } from "../_errors";
import {
  Alert,
  Badge,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
} from "@/components/ui";

const TABS = ["active", "expired", "used", "cancelled"] as const;
type Tab = (typeof TABS)[number];
const TONE = {
  active: "info",
  expired: "warning",
  used: "success",
  cancelled: "neutral",
} as const;

/**
 * Reservas de estoque para clientes (Wellmix com a tela Produtos): criar,
 * usar (vira baixa por venda) e cancelar. Vencida não segura mais o estoque.
 */
export default async function ReservationsPage({
  searchParams,
}: PageProps<"/app/inventory/reservations">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  if (!isWellmix(user)) redirect("/app");
  const t = await getT();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(String(sp.tab))
    ? (sp.tab as Tab)
    : "active";
  const today = brazilDay(new Date().toISOString()) as string;
  const store = getStore();
  const [all, inventory, users] = await Promise.all([
    listStockReservations(),
    loadInventory(),
    store.list("users"),
  ]);
  // Só os clientes das reservas; o campo de cliente busca pelo nome (com a
  // carga do Sankhya são ~26 mil, que não cabem numa lista).
  const customers = (
    await listByIds(
      store,
      "parties",
      all.map((r) => r.customerId),
    )
  ).filter((p) => p.type === "customer");
  const free = inventory
    .map((r) => ({ ...r, free: freeStock(r.brazil, r.reserved ?? 0) }))
    .filter((r) => r.free > 0);
  const productIds = [
    ...new Set([
      ...all.map((r) => r.productId),
      ...free.map((r) => r.productId),
    ]),
  ];
  const products = productIds.length
    ? await store.list("products", { filter: { id: productIds } })
    : [];
  const product = (id: string) => products.find((p) => p.id === id) ?? null;
  const counts = Object.fromEntries(
    TABS.map((k) => [
      k,
      all.filter((r) => reservationState(r, today) === k).length,
    ]),
  ) as Record<Tab, number>;
  const shown = all
    .filter((r) => reservationState(r, today) === tab)
    .sort((a, b) =>
      tab === "active"
        ? (a.expiresAt ?? "").localeCompare(b.expiresAt ?? "")
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const orders =
    tab === "active" && shown.length
      ? (
          await store.list("orders", {
            filter: {
              customerId: [...new Set(shown.map((r) => r.customerId))],
            },
            orderBy: "number",
            direction: "desc",
          })
        ).filter((o) => o.status !== "CANCELLED")
      : [];
  const daysLeft = (r: StockReservation) =>
    r.expiresAt
      ? Math.round(
          (Date.parse(`${r.expiresAt.slice(0, 10)}T12:00:00Z`) -
            Date.parse(`${today}T12:00:00Z`)) /
            86_400_000,
        )
      : null;
  const num = (n: number) => n.toLocaleString(t.intl);
  const errorCode = typeof sp.error === "string" ? sp.error : null;
  const done = typeof sp.done === "string" ? sp.done : null;

  return (
    <>
      <PageHeader
        t={t}
        title={t("res.title")}
        subtitle={t("res.subtitle")}
        actions={
          <>
            <LinkButton href="/app/inventory">{t("inv.title")}</LinkButton>
            <LinkButton href="/app/inventory/movements">
              {t("stockMov.title")}
            </LinkButton>
          </>
        }
      />
      {done === "created" || done === "used" || done === "cancelled" ? (
        <Alert tone="success">{t(`res.${done}`)}</Alert>
      ) : null}
      {errorCode ? (
        <Alert tone="danger">{stockErrorText(t, errorCode)}</Alert>
      ) : null}
      <details
        className="my-3 rounded-2xl border border-zinc-200/80 bg-white shadow-sm"
        data-reservation-new
        open={all.length === 0 && free.length > 0 ? true : undefined}
      >
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
          {t("res.new")}
        </summary>
        {free.length === 0 ? (
          <div className="border-t border-zinc-200/80 p-4">
            <Empty>{t("res.noFree")}</Empty>
          </div>
        ) : (
          <form
            action={createReservationAction}
            className="grid gap-3 border-t border-zinc-200/80 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_7rem_7rem_minmax(0,2fr)_auto] md:items-end"
          >
            <Field label={t("res.product")}>
              <Select name="productId" required defaultValue="">
                <option value="" disabled>
                  {t("common.select")}
                </option>
                {free.map((r) => {
                  const p = product(r.productId);
                  return (
                    <option key={r.productId} value={r.productId}>
                      {p ? productNameText(t, p.name) : r.productId}
                      {p?.sku ? ` (${p.sku})` : ""} ·{" "}
                      {t("res.free", { n: num(r.free) })}
                    </option>
                  );
                })}
              </Select>
            </Field>
            <Field label={t("res.customer")}>
              <PartyPicker
                name="customerId"
                type="customer"
                required
                ariaLabel={t("res.customer")}
                labels={partyPickerLabels(t)}
              />
            </Field>
            <Field label={t("res.quantity")}>
              <Input
                name="quantity"
                type="number"
                min="1"
                step="1"
                required
                inputMode="numeric"
              />
            </Field>
            <Field label={t("res.days")}>
              <Input
                name="days"
                type="number"
                min="1"
                max={RESERVATION_MAX_DAYS}
                step="1"
                required
                defaultValue={RESERVATION_DEFAULT_DAYS}
                inputMode="numeric"
              />
            </Field>
            <Field label={t("res.note")}>
              <Input name="note" maxLength={500} />
            </Field>
            <SubmitButton>{t("res.submit")}</SubmitButton>
          </form>
        )}
      </details>
      <nav className="mb-4 flex flex-wrap gap-4 border-b border-zinc-200">
        {TABS.map((k) => (
          <TabLink
            key={k}
            href={`/app/inventory/reservations${k === "active" ? "" : `?tab=${k}`}`}
            active={tab === k}
          >
            {t(`res.tab.${k}`)} ({counts[k]})
          </TabLink>
        ))}
      </nav>
      {tab === "expired" && shown.length ? (
        <p className="mb-2 text-sm text-amber-800">{t("res.expiredHint")}</p>
      ) : null}
      {shown.length === 0 ? (
        <Empty>{t("res.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("res.product")}</Th>
              <Th>{t("res.customer")}</Th>
              <Th className="text-right">{t("res.quantity")}</Th>
              <Th>{t("res.col.expires")}</Th>
              <Th>{t("res.col.by")}</Th>
              <Th>{t("res.note")}</Th>
              <Th className="text-right">
                {tab === "active" ? "" : t("res.col.closed")}
              </Th>
            </tr>
          </thead>
          <tbody data-reservations>
            {shown.map((r) => {
              const p = product(r.productId);
              const c = customers.find((x) => x.id === r.customerId);
              const left = daysLeft(r);
              const state = reservationState(r, today);
              return (
                <tr key={r.id} className={rowClass}>
                  <Td className="min-w-44 font-medium">
                    <div data-reservation={state}>
                      {p ? (
                        <TextLink
                          href={`/app/products/${p.id}`}
                          className="text-zinc-900"
                        >
                          {p.name}
                        </TextLink>
                      ) : (
                        r.productId
                      )}
                      {p?.sku ? (
                        <span className="block font-mono text-xs font-normal text-zinc-500">
                          {p.sku}
                        </span>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    {c ? (
                      <TextLink href={`/app/customers/${c.id}`}>
                        {c.name}
                      </TextLink>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {num(r.quantity)} {r.unit ?? "un"}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {r.expiresAt ? formatDate(r.expiresAt, t) : "—"}
                    <span className="block">
                      {state === "active" && left !== null ? (
                        <Badge tone={left <= 2 ? "warning" : "info"}>
                          {left <= 0
                            ? t("res.expiresToday")
                            : t("res.expiresIn", { n: left })}
                        </Badge>
                      ) : (
                        <Badge tone={TONE[state]}>
                          {t(`res.tab.${state}`)}
                        </Badge>
                      )}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {users.find((u) => u.id === r.createdByUserId)?.name ?? "—"}
                    <span className="block text-xs text-zinc-500">
                      {formatDate(r.createdAt, t)}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className="block max-w-56 truncate"
                      title={r.note ?? undefined}
                    >
                      {r.note ?? "—"}
                    </span>
                  </Td>
                  <Td className="text-right">
                    {state === "active" ? (
                      <div className="flex flex-wrap items-end justify-end gap-2">
                        <form
                          action={consumeReservationAction}
                          className="flex items-end gap-2"
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <Select
                            name="orderId"
                            defaultValue=""
                            aria-label={t("res.useOrder")}
                            className="max-w-40"
                          >
                            <option value="">{t("res.useOrder")}</option>
                            {orders
                              .filter((o) => o.customerId === r.customerId)
                              .slice(0, 50)
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  #{o.number}
                                </option>
                              ))}
                          </Select>
                          <SubmitButton>{t("res.use")}</SubmitButton>
                        </form>
                        <form action={cancelReservationAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <SubmitButton variant="secondary">
                            {t("res.cancel")}
                          </SubmitButton>
                        </form>
                      </div>
                    ) : (
                      <span className="whitespace-nowrap text-xs text-zinc-500">
                        {r.closedAt ? formatDate(r.closedAt, t) : "—"}
                      </span>
                    )}
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
