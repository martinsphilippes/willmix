import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import { addDays } from "@/lib/supplier-terms";
import { loadCashflow, type CashBucket } from "@/lib/services/cashflow";
import {
  Alert,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatMoney,
  rowClass,
} from "@/components/ui";

/**
 * Fluxo de caixa previsto: semana a semana, o que entra dos clientes e o que
 * sai para os fornecedores, com o saldo acumulado. Só quem abre Finanças;
 * leitura no servidor, nada é gravado.
 */
export default async function CashflowPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "dashboards");
  if (!canOpen(user, "finance")) redirect("/app/dashboards");
  const t = await getT();
  const d = await loadCashflow();

  const day = (s: string) =>
    new Date(`${s}T12:00:00Z`).toLocaleDateString(t.intl, {
      day: "2-digit",
      month: "2-digit",
      timeZone: "UTC",
    });
  const label = (b: CashBucket) => {
    if (b.key === "overdue") return t("cash.bucket.overdue");
    if (b.key === "nodate") return t("cash.bucket.nodate");
    if (b.key === "later")
      return t("cash.bucket.later", { date: day(addDays(b.start!, -1)) });
    return t("cash.week", {
      from: day(b.start!),
      to: day(addDays(b.start!, 6)),
    });
  };
  const multi = (m: Map<string, number>) =>
    m.size ? [...m].map(([c, v]) => formatMoney(v, c, t)).join(" + ") : "—";
  const brl = (v: number | null) =>
    v === null ? "—" : formatMoney(v, "BRL", t);
  const shown = d.buckets.filter(
    (b) => b.items.length > 0 || b.key.startsWith("w"),
  );
  const firstNegative = d.buckets.find(
    (b) => b.cumulative !== null && b.cumulative < 0,
  );
  const empty = d.buckets.every((b) => b.items.length === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        t={t}
        title={t("cash.title")}
        subtitle={t("cash.subtitle")}
        actions={
          <span className="flex flex-wrap gap-2">
            <LinkButton href="/app/dashboards/owner">
              {t("owner.title")}
            </LinkButton>
            <LinkButton href="/app/payables">{t("nav.payables")}</LinkButton>
          </span>
        }
      />
      {d.missingRates.length ? (
        <Alert tone="warning">
          {t("cash.missingRate", { list: d.missingRates.join(", ") })}
        </Alert>
      ) : null}
      {firstNegative ? (
        <Alert tone="danger">
          {t("cash.firstNegative", { when: label(firstNegative) })}
        </Alert>
      ) : null}
      {empty ? (
        <Empty>{t("cash.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("cash.col.week")}</Th>
              <Th className="text-right">{t("cash.col.in")}</Th>
              <Th className="text-right">{t("cash.col.out")}</Th>
              <Th className="text-right">{t("cash.col.net")}</Th>
              <Th className="text-right">{t("cash.col.cum")}</Th>
            </tr>
          </thead>
          <tbody data-cashflow>
            {shown.map((b) => (
              <tr key={b.key} className={rowClass}>
                <Td>
                  <div data-cash-bucket={b.key}>
                    <span
                      className={cx(
                        "font-medium",
                        b.key === "overdue" && "text-rose-700",
                      )}
                    >
                      {label(b)}
                    </span>
                    {b.key === "w0" ? (
                      <span className="ml-1 text-xs text-brand-700">
                        ({t("cash.thisWeek")})
                      </span>
                    ) : null}
                    {b.items.length ? (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-brand-700">
                          {t("cash.details", { n: b.items.length })}
                        </summary>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {b.items.map(({ kind, item }, i) => (
                            <li key={i} className="flex flex-wrap gap-x-2">
                              <span className="text-zinc-500">
                                {item.day ? day(item.day) : "—"}
                              </span>
                              <span className="text-zinc-500">
                                {t(`cash.type.${item.type}`)}
                              </span>
                              <TextLink href={item.href}>{item.label}</TextLink>
                              <span
                                className={cx(
                                  "tabular-nums font-medium",
                                  kind === "in"
                                    ? "text-emerald-700"
                                    : "text-rose-700",
                                )}
                              >
                                {kind === "in" ? "+" : "−"}
                                {formatMoney(item.amount, item.currency, t)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                </Td>
                <Td className="text-right tabular-nums text-emerald-700">
                  {multi(b.inflow)}
                </Td>
                <Td className="text-right tabular-nums text-rose-700">
                  {multi(b.outflow)}
                </Td>
                <Td
                  className={cx(
                    "text-right tabular-nums font-medium",
                    b.net !== null && b.net < 0 && "text-rose-700",
                  )}
                >
                  {b.items.length ? brl(b.net) : "—"}
                </Td>
                <Td
                  className={cx(
                    "text-right tabular-nums font-semibold",
                    b.cumulative !== null &&
                      b.cumulative < 0 &&
                      "text-rose-700",
                  )}
                >
                  {b.key === "nodate" ? "—" : brl(b.cumulative)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
