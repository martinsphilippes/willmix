import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { loadFinance } from "@/lib/services/finance";
import { getT } from "@/i18n/server";
import {
  Badge,
  Empty,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
  formatMoney,
} from "@/components/ui";

/** Financeiro: venda, recebimentos, custo, pagamentos e margem por pedido. Só Wellmix. */
export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const t = await getT();
  const { rows, summary } = await loadFinance();
  const fmtBy = (map: Record<string, number>) =>
    Object.entries(map)
      .filter(([, v]) => v > 0.005)
      .map(([c, v]) => formatMoney(v, c))
      .join(" · ") || formatMoney(0, "USD");

  return (
    <>
      <PageHeader
        title={t("finance.title")}
        help={{ body: "help.finance.body", steps: "help.finance.steps" }}
        t={t}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          label={t("finance.sold")}
          value={formatMoney(summary.sell, summary.currency)}
        />
        <Stat
          label={t("finance.received")}
          value={formatMoney(summary.received, summary.currency)}
        />
        <Stat
          label={t("finance.receivable")}
          value={formatMoney(summary.receivable, summary.currency)}
          tone={summary.receivable > 0 ? "warning" : undefined}
        />
        <Stat label={t("finance.paid")} value={fmtBy(summary.paidByCurrency)} />
        <Stat
          label={t("finance.payable")}
          value={fmtBy(summary.payableByCurrency)}
          tone={
            Object.values(summary.payableByCurrency).some((v) => v > 0.005)
              ? "warning"
              : undefined
          }
        />
        <Stat
          label={
            summary.missingFx > 0
              ? `${t("finance.margin")} (${t("finance.fxMissing")}: ${summary.missingFx})`
              : t("finance.margin")
          }
          value={
            summary.marginPct !== null
              ? `${formatMoney(summary.margin, summary.currency)} (${summary.marginPct.toFixed(1)}%)`
              : "—"
          }
          tone={
            summary.margin < 0
              ? "danger"
              : summary.missingFx > 0
                ? "warning"
                : undefined
          }
        />
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <Empty>{t("common.none")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>{t("common.customer")}</Th>
                <Th>{t("common.product")}</Th>
                <Th>{t("finance.sale")}</Th>
                <Th>{t("finance.received")}</Th>
                <Th>{t("finance.receivable")}</Th>
                <Th>{t("orders.fob")}</Th>
                <Th>{t("finance.paid")}</Th>
                <Th>{t("finance.payable")}</Th>
                <Th>{t("finance.fx")}</Th>
                <Th>{t("finance.cost")}</Th>
                <Th>{t("finance.margin")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.order.id} className="hover:bg-zinc-50">
                  <Td>
                    <Link
                      href={`/app/orders/${r.order.id}`}
                      className="font-medium underline"
                    >
                      #{r.order.number}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      {t(`stage.${r.order.status}`)}
                    </div>
                  </Td>
                  <Td>{r.customerName}</Td>
                  <Td>{r.productName}</Td>
                  <Td className="font-medium">
                    {formatMoney(r.sell, r.sellCurrency)}
                  </Td>
                  <Td>{formatMoney(r.received, r.sellCurrency)}</Td>
                  <Td
                    className={
                      r.receivable > 0 ? "text-amber-700" : "text-emerald-700"
                    }
                  >
                    {formatMoney(r.receivable, r.sellCurrency)}
                  </Td>
                  <Td>{formatMoney(r.fob, r.fobCurrency)}</Td>
                  <Td>{formatMoney(r.paid, r.fobCurrency)}</Td>
                  <Td
                    className={
                      r.payable > 0 ? "text-amber-700" : "text-emerald-700"
                    }
                  >
                    {formatMoney(r.payable, r.fobCurrency)}
                  </Td>
                  <Td>
                    {r.avgFx !== null
                      ? r.avgFx.toFixed(4)
                      : r.fobCurrency === r.sellCurrency
                        ? "1"
                        : "—"}
                  </Td>
                  <Td>
                    {r.cost !== null ? (
                      formatMoney(r.cost, r.sellCurrency)
                    ) : (
                      <Badge tone="warning">{t("finance.fxMissing")}</Badge>
                    )}
                    {r.estimated ? (
                      <span className="ml-1 text-xs text-zinc-500">~</span>
                    ) : null}
                  </Td>
                  <Td
                    className={
                      r.margin !== null && r.margin < 0
                        ? "text-red-700"
                        : "text-zinc-900"
                    }
                  >
                    {r.margin !== null ? (
                      <>
                        {formatMoney(r.margin, r.sellCurrency)}
                        <div className="text-xs text-zinc-500">
                          {r.marginPct?.toFixed(1)}%
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
