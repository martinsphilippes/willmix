import type { Translate } from "@/i18n";
import type { RequestSchedule } from "@/lib/workflow/request-schedule";
import { scheduleTotal } from "@/lib/workflow/request-schedule";
import type { RoundPacking } from "@/lib/services/request-packing";
import { formatDate } from "./ui";

/**
 * Programação de entregas pedida pelo cliente (solicitação, cotação, ficha).
 * Com a embalagem (dono, 22/11/2026): as caixas master, a cubagem e os
 * containers de cada programação, a mesma conta da tabela das empresas do
 * grupo econômico (`roundPackingOf`); o cliente também vê.
 */
export function RequestScheduleTable({
  schedule,
  unit,
  t,
  typed,
  packing,
}: {
  schedule: RequestSchedule | null | undefined;
  unit: string;
  t: Translate;
  /**
   * Rascunho (dono, 19/11/2026): em cada entrega, se a quantidade foi
   * digitada. A entrega em branco mostra "—" (não um zero que ninguém
   * digitou). Sem isto, todas como gravadas.
   */
  typed?: readonly boolean[] | null;
  /** Caixas, m³ e containers de cada programação e o container ("40HC"). */
  packing?: { rounds: RoundPacking; container: string | null } | null;
}) {
  if (!schedule?.items.length) return null;
  const cbmText = (n: number) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: 3 });
  const dash = <span className="text-zinc-400">—</span>;
  /** A célula de uma programação; em branco no rascunho, "—" (não zero). */
  const cell = (
    values: number[] | null,
    i: number,
    text: (n: number) => string,
  ) =>
    (typed && typed[i] === false) || !values || values[i] === undefined
      ? dash
      : text(values[i]);
  const int = (n: number) => n.toLocaleString(t.intl);
  const packingCols = packing
    ? ([
        [
          "boxes",
          t("reqSchedule.boxes"),
          packing.rounds.boxes,
          packing.rounds.totals.boxes,
          int,
        ],
        [
          "cbm",
          t("reqSchedule.cbm"),
          packing.rounds.cbm,
          packing.rounds.totals.cbm,
          cbmText,
        ],
        [
          "containers",
          t("reqSchedule.containers", { code: packing.container ?? "—" }),
          packing.rounds.containers,
          packing.rounds.totals.containers,
          int,
        ],
      ] as const)
    : [];
  return (
    <div className="mt-3 space-y-1.5" data-request-schedule-table>
      <p className="text-sm font-medium text-zinc-800">
        {t("reqSchedule.title")}
        <span className="ml-2 text-xs font-normal text-zinc-500">
          {t("reqSchedule.summary", {
            n: schedule.items.length,
            days: schedule.intervalDays,
            date: formatDate(schedule.firstDate, t),
          })}
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-[20rem] text-[13px]">
          <thead>
            <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <th className="py-1 pr-4 font-medium">#</th>
              <th className="py-1 pr-4 text-right font-medium">
                {t("reqSchedule.quantity")}
              </th>
              {packingCols.map(([key, label]) => (
                <th
                  key={key}
                  className="py-1 pr-4 text-right font-medium"
                  data-request-schedule-col={key}
                >
                  {label}
                </th>
              ))}
              <th className="py-1 font-medium">{t("reqSchedule.expected")}</th>
            </tr>
          </thead>
          <tbody>
            {schedule.items.map((item, i) => (
              <tr key={item.index} className="border-t border-zinc-100">
                <td className="py-1 pr-4 font-semibold text-zinc-800">
                  {item.index}
                </td>
                <td className="py-1 pr-4 text-right tabular-nums">
                  {typed && typed[i] === false ? (
                    <span
                      className="text-zinc-400"
                      title={t("reqDraft.scheduleBlank")}
                      data-request-schedule-blank={item.index}
                    >
                      —
                    </span>
                  ) : (
                    <>
                      {item.quantity.toLocaleString(t.intl)} {unit}
                    </>
                  )}
                </td>
                {packingCols.map(([key, , values, , text]) => (
                  <td
                    key={key}
                    className="py-1 pr-4 text-right tabular-nums"
                    data-request-schedule-packing={`${key}:${item.index}`}
                  >
                    {cell(values, i, text)}
                  </td>
                ))}
                <td
                  className="py-1 tabular-nums"
                  data-request-schedule-date={item.index}
                  data-request-schedule-manual={item.manual ? "1" : undefined}
                >
                  {formatDate(item.expectedAt, t)}
                  {/* Data trocada à mão na Nova solicitação (dono, 15/11/2026). */}
                  {item.manual ? (
                    <span className="ml-1.5 text-[11px] font-medium text-sky-700">
                      ({t("reqSchedule.manual")})
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
            <tr className="border-t border-zinc-200 font-semibold">
              <td className="py-1 pr-4" />
              <td className="py-1 pr-4 text-right tabular-nums">
                {/* Nenhuma entrega digitada (rascunho): sem total, não zero. */}
                {typed && !typed.some(Boolean) ? (
                  <span className="text-zinc-400">—</span>
                ) : (
                  <>
                    {scheduleTotal(schedule).toLocaleString(t.intl)} {unit}
                  </>
                )}
              </td>
              {packingCols.map(([key, , , total, text]) => (
                <td
                  key={key}
                  className="py-1 pr-4 text-right tabular-nums"
                  data-request-schedule-packing={`${key}:total`}
                >
                  {total === null || (typed && !typed.some(Boolean))
                    ? dash
                    : text(total)}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
