import type { Translate } from "@/i18n";
import type { RequestSchedule } from "@/lib/workflow/request-schedule";
import { scheduleTotal } from "@/lib/workflow/request-schedule";
import { formatDate } from "./ui";

/** Programação de entregas pedida pelo cliente (solicitação, cotação, ficha). */
export function RequestScheduleTable({
  schedule,
  unit,
  t,
  typed,
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
}) {
  if (!schedule?.items.length) return null;
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
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
