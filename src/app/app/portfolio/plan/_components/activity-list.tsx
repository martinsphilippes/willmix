import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { TradeActivityStatus } from "@/lib/db/schema";
import type { TradeActivityRow } from "@/lib/services/trade-plan";
import { Badge, TextLink, type Tone } from "@/components/ui";
import { dateBr } from "../../_components/shared";

/** Cor da situação da ação. */
export const TRADE_TONE: Record<TradeActivityStatus, Tone> = {
  pending: "warning",
  investigating: "info",
  pilot: "brand",
  done: "success",
  cancelled: "neutral",
};

/** Situação (e atrasada / no prazo) de uma ação. */
export function TradeStatus({
  t,
  row,
}: {
  t: Translate;
  row: Pick<TradeActivityRow, "status" | "late" | "onTime">;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span data-trade-status={row.status}>
        <Badge tone={TRADE_TONE[row.status]}>
          {t(`tradePlan.status.${row.status}` as DictionaryKey)}
        </Badge>
      </span>
      {row.late ? (
        <span data-trade-late>
          <Badge tone="danger">{t("tradePlan.late")}</Badge>
        </span>
      ) : null}
      {row.onTime === true ? (
        <span className="text-xs text-emerald-700">
          {t("tradePlan.onTime")}
        </span>
      ) : row.onTime === false ? (
        <span className="text-xs text-red-700">{t("tradePlan.offTime")}</span>
      ) : null}
    </span>
  );
}

/** Lista curta das ações (fichas do cliente e do grupo na carteira). */
export function ActivityList({
  t,
  rows,
  showScope = false,
}: {
  t: Translate;
  rows: TradeActivityRow[];
  showScope?: boolean;
}) {
  return (
    <ul className="divide-y divide-zinc-100" data-trade-list>
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm"
          data-trade-row={r.id}
        >
          <span className="min-w-0">
            <TextLink href={`/app/portfolio/plan/${r.id}`}>{r.title}</TextLink>
            <span className="block text-xs text-zinc-500">
              {[
                showScope ? r.scopeName : null,
                r.productName,
                r.responsibleName,
                `${t("tradePlan.col.due")}: ${dateBr(t, r.dueDate)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <TradeStatus t={t} row={r} />
        </li>
      ))}
    </ul>
  );
}
