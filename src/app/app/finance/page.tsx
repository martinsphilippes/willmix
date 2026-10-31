import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { loadFinance } from "@/lib/services/finance";
import {
  approx,
  costEstimateNote,
  fxEffectText,
  fxRateLines,
} from "@/components/finance-fx-text";
import { getT } from "@/i18n/server";
import type { ReactNode } from "react";
import {
  Badge,
  cx,
  Empty,
  PageHeader,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  formatMoney,
  rowClass,
} from "@/components/ui";

/** Valor no card: um pouco menor que o padrão do Stat, para caber seis cards numa linha. */
function Money({ children }: { children: ReactNode }) {
  return (
    // Valor inteiro numa linha (no celular a letra diminui em vez de quebrar o número).
    <span className="block whitespace-nowrap text-base leading-tight tabular-nums sm:text-xl">
      {children}
    </span>
  );
}

/** Financeiro: venda, recebimentos, custo, pagamentos e margem por pedido. Só Wellmix. */
export default async function FinancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "finance");
  const t = await getT();
  const { rows, summary } = await loadFinance();
  const fmtBy = (map: Record<string, number>) =>
    Object.entries(map)
      .filter(([, v]) => v > 0.005)
      .map(([c, v]) => formatMoney(v, c, t))
      .join(" · ") || formatMoney(0, "USD", t);

  return (
    <>
      <PageHeader
        title={t("finance.title")}
        help={{ body: "help.finance.body", steps: "help.finance.steps" }}
        t={t}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat
          label={t("finance.sold")}
          value={
            <Money>{formatMoney(summary.sell, summary.currency, t)}</Money>
          }
        />
        <Stat
          label={t("finance.received")}
          value={
            <Money>{formatMoney(summary.received, summary.currency, t)}</Money>
          }
        />
        <Stat
          label={t("finance.receivable")}
          value={
            <Money>
              {formatMoney(summary.receivable, summary.currency, t)}
            </Money>
          }
          tone={summary.receivable > 0 ? "warning" : undefined}
        />
        <Stat
          label={t("finance.paid")}
          value={<Money>{fmtBy(summary.paidByCurrency)}</Money>}
        />
        <Stat
          label={t("finance.payable")}
          value={<Money>{fmtBy(summary.payableByCurrency)}</Money>}
          tone={
            Object.values(summary.payableByCurrency).some((v) => v > 0.005)
              ? "warning"
              : undefined
          }
        />
        <Stat
          label={[
            t("finance.margin"),
            summary.estimated > 0
              ? `(${t("finance.fx.estimatedCount", { n: String(summary.estimated) })})`
              : null,
            summary.missingFx > 0
              ? `(${t("finance.fxMissing")}: ${summary.missingFx})`
              : null,
          ]
            .filter(Boolean)
            .join(" ")}
          value={
            <>
              <Money>
                {summary.marginPct !== null
                  ? approx(
                      formatMoney(summary.margin, summary.currency, t),
                      summary.estimated > 0,
                    )
                  : "—"}
              </Money>
              {/* Percentual embaixo: com o "~" o valor e o % não cabem numa linha do card. */}
              {summary.marginPct !== null ? (
                <span className="mt-0.5 block text-xs font-medium text-zinc-600 tabular-nums">
                  {approx(
                    `${summary.marginPct.toLocaleString(t.intl, { maximumFractionDigits: 1 })}%`,
                    summary.estimated > 0,
                  )}
                </span>
              ) : null}
              {summary.fxEffect !== null &&
              Math.abs(summary.fxEffect) >= 0.01 ? (
                <span
                  className={cx(
                    "mt-1 block text-xs font-medium",
                    summary.fxEffect < 0 ? "text-red-700" : "text-emerald-700",
                  )}
                  data-fx-effect-total=""
                >
                  {t("finance.fx.effect", {
                    value: approx(
                      `${summary.fxEffect > 0 ? "+" : ""}${formatMoney(summary.fxEffect, summary.currency, t)}`,
                      summary.fxEffectEstimated,
                    ),
                  })}
                </span>
              ) : null}
            </>
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

      <div className="mt-4">
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
                <tr key={r.order.id} className={rowClass}>
                  <Td>
                    <TextLink href={`/app/orders/${r.order.id}`}>
                      #{r.order.number}
                    </TextLink>
                    {/* Cancelado fica no histórico, mas fora de vendido, custo e margem. */}
                    {r.order.status === "CANCELLED" ? (
                      <div className="mt-0.5">
                        <Badge tone="danger">{t("stage.CANCELLED")}</Badge>
                      </div>
                    ) : (
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {t(`stage.${r.order.status}`)}
                      </div>
                    )}
                  </Td>
                  <Td>{r.customerName}</Td>
                  <Td>{r.productName}</Td>
                  <Td
                    className={cx(
                      "whitespace-nowrap font-semibold",
                      r.order.status === "CANCELLED"
                        ? "text-zinc-400 line-through"
                        : "text-zinc-900",
                    )}
                  >
                    {formatMoney(r.sell, r.sellCurrency, t)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatMoney(r.received, r.sellCurrency, t)}
                  </Td>
                  <Td className="whitespace-nowrap font-medium">
                    <span
                      className={
                        r.receivable > 0 ? "text-amber-700" : "text-emerald-700"
                      }
                    >
                      {formatMoney(r.receivable, r.sellCurrency, t)}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatMoney(r.fob, r.fobCurrency, t)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatMoney(r.paid, r.fobCurrency, t)}
                    {/* Pago em outra moeda: à parte, na moeda dele. */}
                    {Object.entries(r.paidOther).map(([c, v]) => (
                      <div
                        key={c}
                        className="text-xs font-normal text-zinc-500"
                        data-paid-other={c}
                      >
                        + {formatMoney(v, c, t)}
                      </div>
                    ))}
                  </Td>
                  <Td className="whitespace-nowrap font-medium">
                    <span
                      className={
                        r.payable > 0 ? "text-amber-700" : "text-emerald-700"
                      }
                    >
                      {formatMoney(r.payable, r.fobCurrency, t)}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {(() => {
                      // Cancelado: fora de custo e margem, sem câmbio a mostrar.
                      const fx =
                        r.order.status === "CANCELLED"
                          ? null
                          : fxRateLines(t, r);
                      if (!fx) return "—";
                      return (
                        <>
                          <span
                            className="tabular-nums"
                            data-fx-basis={r.fxBasis ?? "none"}
                          >
                            {fx.main}
                          </span>
                          {/* Notas quebram linha: não empurram custo e margem para fora. */}
                          {fx.notes.map((note, i) => (
                            <div
                              key={i}
                              className="max-w-44 whitespace-normal text-xs font-normal text-zinc-500"
                            >
                              {note}
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {r.order.status === "CANCELLED" ? (
                      "—"
                    ) : r.cost !== null ? (
                      <span title={costEstimateNote(t, r) ?? undefined}>
                        {approx(
                          formatMoney(r.cost, r.sellCurrency, t),
                          r.estimated,
                        )}
                      </span>
                    ) : (
                      <Badge tone="warning">{t("finance.fxMissing")}</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap font-semibold text-zinc-900">
                    {r.margin !== null && r.order.status !== "CANCELLED" ? (
                      <>
                        <span className={cx(r.margin < 0 && "text-red-700")}>
                          {approx(
                            formatMoney(r.margin, r.sellCurrency, t),
                            r.estimated,
                          )}
                        </span>
                        {r.marginPct !== null ? (
                          <div className="text-xs font-normal text-zinc-500">
                            {approx(
                              `${r.marginPct.toLocaleString(t.intl, { maximumFractionDigits: 1 })}%`,
                              r.estimated,
                            )}
                          </div>
                        ) : null}
                        {(() => {
                          const effect = fxEffectText(t, r);
                          return effect ? (
                            <div
                              title={effect.title}
                              className={cx(
                                "text-xs font-medium",
                                effect.negative
                                  ? "text-red-700"
                                  : "text-emerald-700",
                              )}
                              data-fx-effect=""
                            >
                              {effect.text}
                            </div>
                          ) : null;
                        })()}
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
        {/* Legenda do "~" sempre que alguma linha mostra estimativa (inclusive
            pedidos vendidos em outra moeda, fora do total). */}
        {rows.some((r) => r.estimated && r.order.status !== "CANCELLED") ? (
          <p className="mt-2 text-xs text-zinc-500">
            {t("finance.fx.estimateNote")}
          </p>
        ) : null}
      </div>
    </>
  );
}
