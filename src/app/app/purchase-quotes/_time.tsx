import type { Translate } from "@/i18n";

/*
 * Prazo da cotação de compra (docs/PURCHASE_DEMAND.md): o que falta e a hora
 * exata em Brasília e na China (o prazo é gravado em UTC).
 */
export function QuoteDeadline({
  t,
  dueAt,
  now,
}: {
  t: Translate;
  dueAt: string;
  now: Date;
}) {
  const due = new Date(dueAt);
  const left = due.getTime() - now.getTime();
  const fmt = (timeZone: string) =>
    new Intl.DateTimeFormat(t.intl, {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(due);
  const hours = Math.floor(Math.max(0, left) / 3_600_000);
  const minutes = Math.floor((Math.max(0, left) % 3_600_000) / 60_000);
  return (
    <span className="text-xs" data-quote-deadline={dueAt}>
      <span
        className={
          left > 0
            ? "font-semibold text-zinc-900"
            : "font-semibold text-red-700"
        }
        data-quote-left={left > 0 ? `${hours}h${minutes}` : "expired"}
      >
        {left > 0
          ? t("quote.left", { h: hours, m: minutes })
          : t("quote.expired")}
      </span>
      <span className="block text-zinc-500">
        {t("quote.dueAt", {
          br: fmt("America/Sao_Paulo"),
          cn: fmt("Asia/Shanghai"),
        })}
      </span>
    </span>
  );
}
