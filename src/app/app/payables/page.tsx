import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { InstallmentStatus } from "@/lib/supplier-terms";
import {
  listPayables,
  payableRows,
  releaseOffFlowStages,
  type PayableRow,
} from "@/lib/services/supplier-terms";
import {
  INSTALLMENT_TONE,
  formatDay,
  termWhen,
} from "@/components/supplier-terms-text";
import {
  Badge,
  Button,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Select,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatMoney,
  rowClass,
} from "@/components/ui";

/*
 * Contas a pagar (só Wellmix): uma linha por parcela de pagamento ao
 * fornecedor, pela condição combinada com cada um. Vencidas primeiro. Filtros
 * por situação e fornecedor são links/GET (funcionam sem JavaScript).
 */

const TABS = [
  "open",
  "overdue",
  "due_soon",
  "scheduled",
  "waiting",
  "requested",
  "settled",
  "all",
] as const;
type Tab = (typeof TABS)[number];

const OPEN: InstallmentStatus[] = [
  "overdue",
  "due_soon",
  "scheduled",
  "waiting",
  "requested",
];

function inTab(tab: Tab, status: InstallmentStatus) {
  if (tab === "all") return true;
  if (tab === "open") return OPEN.includes(status);
  if (tab === "settled") return status === "paid" || status === "received";
  return status === tab;
}

/** Quanto falta (ou, nas solicitadas, quanto foi pedido) por moeda. */
function sumBy(rows: PayableRow[]) {
  const out: Record<string, number> = {};
  for (const { payable, installment } of rows) {
    const value =
      installment.status === "requested"
        ? installment.requested
        : OPEN.includes(installment.status)
          ? installment.open
          : installment.amount;
    const c = payable.schedule.currency;
    out[c] = Math.round(((out[c] ?? 0) + value) * 100) / 100;
  }
  return out;
}

export default async function PayablesPage({
  searchParams,
}: PageProps<"/app/payables">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/payables");
  assertWellmix(user);
  const t = await getT();
  const params = await searchParams;
  const tab: Tab = TABS.find((s) => s === params.status) ?? "open";
  const supplierId =
    typeof params.supplier === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9_-]{0,35}$/.test(params.supplier)
      ? params.supplier
      : null;

  // Pedidos antigos parados na etapa de pagamento seguem o fluxo.
  await releaseOffFlowStages();
  const payables = await listPayables();
  const all = payableRows(payables);
  const suppliers = [
    ...new Map(
      payables
        .filter((p) => p.supplier)
        .map((p) => [p.supplier!.id, p.supplier!.name]),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const bySupplier = supplierId
    ? all.filter((r) => r.payable.order.supplierId === supplierId)
    : all;
  const shown = bySupplier.filter((r) => inTab(tab, r.installment.status));
  const count = (s: Tab) =>
    bySupplier.filter((r) => inTab(s, r.installment.status)).length;
  const fmtMap = (map: Record<string, number>) =>
    Object.entries(map)
      .filter(([, v]) => v > 0.005)
      .map(([c, v]) => formatMoney(v, c, t))
      .join(" · ") || "—";
  const href = (status: Tab) => {
    const q = new URLSearchParams();
    if (status !== "open") q.set("status", status);
    if (supplierId) q.set("supplier", supplierId);
    const s = q.toString();
    return `/app/payables${s ? `?${s}` : ""}`;
  };

  // Fornecedores sem condição: pedidos vivos com saldo, sem parcelas.
  const missing = new Map<
    string,
    { name: string; orders: number; balance: Record<string, number> }
  >();
  for (const p of payables) {
    if (p.schedule.terms || p.order.status === "CANCELLED") continue;
    if (!(p.schedule.open > 0.005)) continue;
    const key = p.order.supplierId;
    const entry = missing.get(key) ?? {
      name: p.supplier?.name ?? "—",
      orders: 0,
      balance: {},
    };
    entry.orders += 1;
    entry.balance[p.schedule.currency] =
      Math.round(
        ((entry.balance[p.schedule.currency] ?? 0) + p.schedule.open) * 100,
      ) / 100;
    missing.set(key, entry);
  }

  const stat = (s: Exclude<Tab, "open" | "settled" | "all">) => {
    const rows = bySupplier.filter((r) => r.installment.status === s);
    return (
      <Stat
        label={`${t(`payables.tab.${s}` as DictionaryKey)} (${rows.length})`}
        value={
          <span className="block text-base leading-tight tabular-nums sm:text-lg">
            {fmtMap(sumBy(rows))}
          </span>
        }
        href={href(s)}
        active={tab === s}
        tone={
          rows.length && s === "overdue"
            ? "danger"
            : rows.length && s === "due_soon"
              ? "warning"
              : undefined
        }
      />
    );
  };
  const chip = (on: boolean) =>
    cx(
      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition",
      on
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50",
    );

  return (
    <>
      <PageHeader
        title={t("payables.title")}
        subtitle={t("payables.subtitle")}
        help={{ body: "help.payables.body" }}
        t={t}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stat("overdue")}
        {stat("due_soon")}
        {stat("scheduled")}
        {stat("waiting")}
        {stat("requested")}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <nav
          className="flex flex-wrap items-center gap-2"
          aria-label={t("payables.title")}
          data-payables-tabs
        >
          {TABS.map((s) => (
            <Link
              key={s}
              href={href(s)}
              aria-current={tab === s ? "page" : undefined}
              className={chip(tab === s)}
              data-payables-tab={s}
            >
              {t(`payables.tab.${s}` as DictionaryKey)}
              <span
                className={cx(
                  "rounded-full px-1.5 text-xs",
                  tab === s ? "bg-white/20" : "bg-zinc-100 text-zinc-600",
                )}
              >
                {count(s)}
              </span>
            </Link>
          ))}
        </nav>
        {suppliers.length > 1 ? (
          <form
            action="/app/payables"
            className="flex items-end gap-2"
            data-payables-supplier
          >
            {tab !== "open" ? (
              <input type="hidden" name="status" value={tab} />
            ) : null}
            <label className="block min-w-48 space-y-1">
              <span className="block text-xs font-medium text-zinc-700">
                {t("payables.supplier")}
              </span>
              <Select name="supplier" defaultValue={supplierId ?? ""}>
                <option value="">{t("payables.allSuppliers")}</option>
                {suppliers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit" variant="secondary">
              {t("payables.filter")}
            </Button>
          </form>
        ) : null}
      </div>

      <div className="mt-3">
        {shown.length === 0 ? (
          <Empty>{t("payables.empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("payables.col.due")}</Th>
                <Th>{t("payables.supplier")}</Th>
                <Th>{t("payables.col.order")}</Th>
                <Th>{t("payables.col.installment")}</Th>
                <Th className="text-right">{t("payables.col.amount")}</Th>
                <Th>{t("payables.col.status")}</Th>
                <Th>
                  <span className="sr-only">{t("payables.open")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ payable, installment: i }) => {
                const money = (n: number) =>
                  formatMoney(n, payable.schedule.currency, t);
                const payable_ = OPEN.includes(i.status) && i.open > 0;
                return (
                  <tr
                    key={`${payable.order.id}-${i.index}`}
                    className={rowClass}
                    data-payable-row={`${payable.order.number}-${i.index}`}
                    data-status={i.status}
                  >
                    <Td className="whitespace-nowrap">
                      {i.dueDate ? (
                        <span
                          className={cx(
                            "tabular-nums",
                            i.status === "overdue" &&
                              "font-semibold text-red-700",
                          )}
                        >
                          {formatDay(i.dueDate, t)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {t("supplierTerms.waiting", {
                            when: termWhen(t, i.base, i.days),
                          })}
                        </span>
                      )}
                    </Td>
                    <Td className="min-w-32">
                      {payable.supplier ? (
                        <TextLink
                          href={`/app/parties/${payable.supplier.id}#payment-terms`}
                        >
                          {payable.supplier.name}
                        </TextLink>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="min-w-40">
                      <TextLink
                        href={`/app/orders/${payable.order.id}`}
                        className="font-medium"
                      >
                        #{payable.order.number}
                      </TextLink>
                      <span className="block text-xs text-zinc-500">
                        {payable.productName}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {i.index}/{i.count}{" "}
                      <span className="text-xs text-zinc-500">
                        {i.percent.toLocaleString(t.intl, {
                          maximumFractionDigits: 2,
                        })}
                        % · {termWhen(t, i.base, i.days)}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      <span className="font-semibold text-zinc-900">
                        {money(i.amount)}
                      </span>
                      {i.paid > 0 && i.paid < i.amount - 0.005 ? (
                        <span className="block text-xs text-zinc-500">
                          {t("supplierTerms.partial", { paid: money(i.paid) })}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={INSTALLMENT_TONE[i.status]}>
                        {t(`supplierTerms.status.${i.status}` as DictionaryKey)}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <LinkButton
                        href={`/app/orders/${payable.order.id}#supplier-payment`}
                        variant={payable_ ? "primary" : "secondary"}
                      >
                        {payable_ ? t("payables.pay") : t("payables.open")}
                      </LinkButton>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {shown.length ? (
          <p
            className="mt-2 text-right text-sm font-semibold tabular-nums text-zinc-700"
            data-payables-total
          >
            {t("payables.total", { amount: fmtMap(sumBy(shown)) })}
          </p>
        ) : null}
      </div>

      {missing.size ? (
        <Card title={t("payables.missing.title")} className="mt-4">
          <p className="mb-2 text-xs text-zinc-500">
            {t("payables.missing.hint")}
          </p>
          <ul
            className="divide-y divide-zinc-100 text-sm"
            data-terms-missing-list
          >
            {[...missing.entries()].map(([id, m]) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  <span className="font-medium text-zinc-900">{m.name}</span>{" "}
                  <span className="text-xs text-zinc-500">
                    {t("payables.missing.row", {
                      orders: m.orders,
                      balance: fmtMap(m.balance),
                    })}
                  </span>
                </span>
                <LinkButton href={`/app/parties/${id}#payment-terms`}>
                  {t("payables.configure")}
                </LinkButton>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
