import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { dictionaries } from "@/i18n/dictionaries";
import { bookingCostOf } from "@/lib/booking-cost";
import type { BookingCost } from "@/lib/db/schema";
import { Badge, formatDate, formatMoney, type Tone } from "@/components/ui";

/*
 * Custo de um item de book pela cotação V2 do Sankhya (dono, 24/11/2026;
 * docs/BOOKING.md, "Custo no Sankhya"): o retrato gravado, sem refazer a
 * conta. Mostra o sinal do Sankhya, o custo por peça, o preço meta e o lucro;
 * sem retrato, "na fila" (o cálculo do book está rodando) ou "sem custo".
 * Quem vê confere "Ver preço de compra" antes de pôr na tela.
 */

const SIGNAL_TONE: Record<NonNullable<BookingCost["verdict"]>, Tone> = {
  viable: "success",
  below: "warning",
  loss: "danger",
};

/** Os dados que foram ao Sankhya, numa linha (dica ao passar o mouse). */
export function bookingCostSent(cost: BookingCost, t: Translate): string {
  const s = cost.sent;
  const n = (v: number | null | undefined) =>
    typeof v === "number"
      ? v.toLocaleString(t.intl, { maximumFractionDigits: 4 })
      : "—";
  return t("bookingCost.sentTitle", {
    date: formatDate(cost.at, t),
    price: n(s?.price),
    currency: s?.currency ?? "—",
    ncm: s?.ncm ?? "—",
    pcs: n(s?.pcsPerCarton),
    cbm: n(s?.cbmPerCarton),
  });
}

/** "peso bruto, CBM da caixa master" (o que faltou para ir ao Sankhya). */
export function bookingCostMissingList(cost: BookingCost, t: Translate) {
  return cost.missing
    .map((m) => {
      const key = `bookingCost.missing.${m}`;
      return key in dictionaries.pt ? t(key as DictionaryKey) : m;
    })
    .join(", ");
}

export function BookingItemCost({
  item,
  queued = false,
  t,
}: {
  item: { sankhyaCost?: unknown };
  /** O cálculo do book está rodando: o item sem retrato está na fila. */
  queued?: boolean;
  t: Translate;
}) {
  const cost = bookingCostOf(item);
  if (!cost)
    return (
      <span
        className="text-xs text-zinc-500"
        data-booking-item-cost={queued ? "queued" : "none"}
      >
        {t(queued ? "bookingCost.queued" : "bookingCost.none")}
      </span>
    );
  if (cost.error)
    return (
      <span
        className="flex flex-col items-start gap-0.5"
        data-booking-item-cost="error"
      >
        <Badge tone="neutral">{t("bookingCost.failed")}</Badge>
        <span
          className="line-clamp-2 max-w-44 text-xs whitespace-normal text-zinc-500"
          title={cost.error}
        >
          {cost.error}
        </span>
      </span>
    );
  if (cost.missing.length)
    return (
      <span
        className="flex flex-col items-start gap-0.5"
        data-booking-item-cost="missing"
      >
        <Badge tone="neutral">{t("bookingCost.missingTitle")}</Badge>
        <span className="max-w-44 text-xs whitespace-normal text-zinc-500">
          {t("bookingCost.missing", { list: bookingCostMissingList(cost, t) })}
        </span>
      </span>
    );
  const pct = (n: number) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: 1 });
  const statusKey = `bookingCost.status.${cost.status ?? ""}`;
  return (
    <span
      className="flex flex-col items-start gap-0.5"
      title={bookingCostSent(cost, t)}
      data-booking-item-cost={cost.verdict ?? "costed"}
    >
      {cost.verdict ? (
        <Badge tone={SIGNAL_TONE[cost.verdict]}>
          {t(`booking.signal.${cost.verdict}` as DictionaryKey)}
        </Badge>
      ) : null}
      {cost.costBrl !== null ? (
        <span className="text-xs font-semibold whitespace-nowrap text-zinc-800">
          {t("bookingCost.cost", {
            price: formatMoney(cost.costBrl, "BRL", t),
          })}
        </span>
      ) : null}
      {cost.targetPriceBrl !== null ? (
        <span className="text-xs whitespace-nowrap text-zinc-600">
          {t("bookingCost.target", {
            price: formatMoney(cost.targetPriceBrl, "BRL", t),
          })}
        </span>
      ) : null}
      {cost.profitPct !== null ? (
        <span className="text-xs whitespace-nowrap text-zinc-600">
          {cost.goalPct !== null
            ? t("bookingCost.profitGoal", {
                pct: pct(cost.profitPct),
                goal: pct(cost.goalPct),
              })
            : t("bookingCost.profit", { pct: pct(cost.profitPct) })}
        </span>
      ) : null}
      {cost.status && statusKey in dictionaries.pt ? (
        <span className="text-xs whitespace-nowrap text-amber-700">
          {t(statusKey as DictionaryKey)}
        </span>
      ) : null}
    </span>
  );
}
