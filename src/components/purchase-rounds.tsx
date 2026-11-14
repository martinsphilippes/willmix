import Link from "next/link";
import type { Translate } from "@/i18n";
import type { PurchaseRound, RequestSchedule } from "@/lib/db/schema";
import { scheduleSummary } from "@/lib/purchase-rounds";
import { formatDate } from "./ui";
import { ColorLines } from "./color-lines";

/*
 * Programação de compra (docs/PURCHASE_SCHEDULE.md) mostrada ao responsável
 * pelo booking e à Wellmix: rodadas, peças por rodada e total, com as datas.
 */

/** "3 rodadas de 1.000 peças · total 3.000 peças" (ou a lista, se diferentes). */
export function roundsLine(
  schedule: RequestSchedule | null | undefined,
  t: Translate,
): string | null {
  const s = scheduleSummary(schedule);
  if (!s) return null;
  const n = (v: number) => v.toLocaleString(t.intl);
  return s.sameQuantity !== null
    ? t("purchaseRounds.summary.same", {
        rounds: s.rounds,
        perRound: n(s.sameQuantity),
        total: n(s.total),
      })
    : t("purchaseRounds.summary.mixed", {
        rounds: s.rounds,
        list: s.perRound.map(n).join(" / "),
        total: n(s.total),
      });
}

/** "A cada 45 dias, de 01/12/2026 a 14/03/2027". */
export function roundsDates(
  schedule: RequestSchedule | null | undefined,
  t: Translate,
): string | null {
  const s = scheduleSummary(schedule);
  if (!s) return null;
  return t("purchaseRounds.summary.dates", {
    days: s.intervalDays,
    first: formatDate(s.firstDate, t),
    last: formatDate(s.lastDate, t),
  });
}

/** Bloco com o resumo e a tabela das rodadas (solicitação ao fornecedor). */
export function PurchaseScheduleTable({
  schedule,
  t,
}: {
  schedule: RequestSchedule | null | undefined;
  t: Translate;
}) {
  const s = scheduleSummary(schedule);
  if (!s || !schedule) return null;
  return (
    <div
      className="mt-3 space-y-1.5 rounded-lg border border-brand-100 bg-brand-50/40 p-3"
      data-purchase-schedule
    >
      <p className="text-sm font-semibold text-zinc-900">
        {t("purchaseRounds.summary.title")}
      </p>
      <p className="text-sm text-zinc-800" data-purchase-schedule-line>
        {roundsLine(schedule, t)}
      </p>
      <p className="text-xs text-zinc-500">{roundsDates(schedule, t)}</p>
      <div className="overflow-x-auto">
        <table className="min-w-[18rem] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="py-1 pr-4 font-medium">
                {t("purchaseRounds.col.round")}
              </th>
              <th className="py-1 pr-4 font-medium">
                {t("purchaseRounds.col.date")}
              </th>
              <th className="py-1 text-right font-medium">
                {t("purchaseRounds.col.pieces")}
              </th>
            </tr>
          </thead>
          <tbody>
            {schedule.items.map((item) => (
              <tr key={item.index} className="border-t border-zinc-100">
                <td className="py-1 pr-4 font-semibold text-zinc-800">
                  {item.index}
                </td>
                <td className="py-1 pr-4 tabular-nums">
                  {formatDate(item.expectedAt, t)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {item.quantity.toLocaleString(t.intl)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-zinc-200 font-semibold">
              <td className="py-1 pr-4">{t("purchaseRounds.col.total")}</td>
              <td />
              <td className="py-1 text-right tabular-nums">
                {s.total.toLocaleString(t.intl)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Rodadas do pedido pai, com o pedido filho de cada uma. */
export function OrderRoundsCard({
  rounds,
  childOrders,
  products,
  today,
  preparationDone,
  t,
  action,
}: {
  rounds: PurchaseRound[];
  /** Pedidos filhos (id → número). */
  childOrders: Map<string, number>;
  /** Produto (id → nome). */
  products: Map<string, string>;
  /** AAAA-MM-DD de hoje (Brasília). */
  today: string;
  preparationDone: boolean;
  t: Translate;
  /** Botão "Gerar as rodadas do dia" (só a Wellmix). */
  action?: React.ReactNode;
}) {
  const multi =
    new Set(rounds.flatMap((r) => r.items.map((i) => i.productId))).size > 1;
  return (
    <div className="space-y-2" data-order-rounds>
      <p className="text-sm text-zinc-600">
        {t("purchaseRounds.order.parentHint")}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-[22rem] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="py-1 pr-4 font-medium">
                {t("purchaseRounds.col.round")}
              </th>
              <th className="py-1 pr-4 font-medium">
                {t("purchaseRounds.col.date")}
              </th>
              <th className="py-1 pr-4 text-right font-medium">
                {t("purchaseRounds.col.pieces")}
              </th>
              <th className="py-1 font-medium">
                {t("purchaseRounds.col.order")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => {
              const number = r.orderId ? childOrders.get(r.orderId) : undefined;
              return (
                <tr
                  key={r.index}
                  className="border-t border-zinc-100 align-top"
                  data-order-round={r.index}
                >
                  <td className="py-1 pr-4 font-semibold text-zinc-800">
                    {r.index}
                  </td>
                  <td className="py-1 pr-4 tabular-nums">
                    {formatDate(r.expectedAt, t)}
                  </td>
                  <td className="py-1 pr-4 text-right tabular-nums">
                    {multi
                      ? r.items.map((i) => (
                          <span key={i.productId} className="block">
                            {products.get(i.productId) ?? "—"}:{" "}
                            {i.quantity.toLocaleString(t.intl)}
                          </span>
                        ))
                      : r.items
                          .reduce((sum, i) => sum + i.quantity, 0)
                          .toLocaleString(t.intl)}
                    {/* Variações de cor: cada cor da rodada na própria linha. */}
                    {r.items.map((i) => (
                      <ColorLines
                        key={`c-${i.productId}`}
                        colors={i.colors}
                        name={products.get(i.productId) ?? "—"}
                        intl={t.intl}
                        className="text-left"
                      />
                    ))}
                  </td>
                  <td className="py-1">
                    {r.orderId ? (
                      <Link
                        href={`/app/orders/${r.orderId}`}
                        className="font-medium text-brand-700 underline underline-offset-2"
                        data-order-round-child={r.index}
                      >
                        {t("purchaseRounds.order.child", {
                          n: number ?? "—",
                        })}
                      </Link>
                    ) : (
                      <span className="text-zinc-500">
                        {r.expectedAt <= today && !preparationDone
                          ? t("purchaseRounds.order.waitingPrep")
                          : t("purchaseRounds.order.waiting", {
                              date: formatDate(r.expectedAt, t),
                            })}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {action}
    </div>
  );
}
