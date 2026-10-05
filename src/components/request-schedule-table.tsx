import type { Translate } from "@/i18n";
import type { RequestSchedule } from "@/lib/workflow/request-schedule";
import { scheduleTotal } from "@/lib/workflow/request-schedule";
import { formatDate } from "./ui";

/** Programação de entregas pedida pelo cliente (solicitação, cotação, ficha). */
export function RequestScheduleTable({
  schedule,
  unit,
  t,
}: {
  schedule: RequestSchedule | null | undefined;
  unit: string;
  t: Translate;
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
            date: formatDate(schedule.firstDate),
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
            {schedule.items.map((item) => (
              <tr key={item.index} className="border-t border-zinc-100">
                <td className="py-1 pr-4 font-semibold text-zinc-800">
                  {item.index}
                </td>
                <td className="py-1 pr-4 text-right tabular-nums">
                  {item.quantity.toLocaleString("pt-BR")} {unit}
                </td>
                <td className="py-1 tabular-nums">
                  {formatDate(item.expectedAt)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-zinc-200 font-semibold">
              <td className="py-1 pr-4" />
              <td className="py-1 pr-4 text-right tabular-nums">
                {scheduleTotal(schedule).toLocaleString("pt-BR")} {unit}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
