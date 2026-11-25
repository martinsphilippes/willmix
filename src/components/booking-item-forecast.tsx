import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { BookingAnalysis } from "@/lib/db/schema";
import { Badge, formatDate, formatMoney, type Tone } from "@/components/ui";

/*
 * Previsão de preço de um item do book (dono, 24/11/2026;
 * src/lib/booking-forecast.ts): o retrato que a API de preço do Sankhya
 * devolveu, sem refazer a conta. Mostra o sinal da meta, a venda prevista,
 * com frete, a meta e o que faltou. Só a Wellmix com "Ver preço de compra"
 * (quem chama confere). Sem o retrato da API, "Sem previsão" (o job de hora
 * em hora completa os books fechados).
 */

const SIGNAL_TONE: Record<string, Tone> = {
  viable: "success",
  below: "warning",
  loss: "danger",
};

/** O retrato só quando veio da API de preço (os antigos ficam de fora). */
export function bookingForecastOf(
  analysis: BookingAnalysis | null | undefined,
): BookingAnalysis | null {
  return analysis?.source === "price_forecast" ? analysis : null;
}

/** Custo por peça previsto (R$), o número para decidir. */
export function bookingItemCost(
  analysis: BookingAnalysis | null | undefined,
): number | null {
  const cost = bookingForecastOf(analysis)?.costBrl;
  return typeof cost === "number" && Number.isFinite(cost) ? cost : null;
}

/** O que faltou, no idioma da tela. */
export function forecastMissingText(a: BookingAnalysis, t: Translate) {
  if (!a.missing.length) return null;
  return a.missing
    .map((m) =>
      m === "error" && a.message
        ? a.message
        : t(`bookingForecast.missing.${m}` as DictionaryKey),
    )
    .join(", ");
}

export function BookingItemForecast({
  analysis,
  t,
}: {
  analysis: BookingAnalysis | null | undefined;
  t: Translate;
}) {
  const a = bookingForecastOf(analysis);
  if (!a)
    return (
      <span className="text-xs text-zinc-500" data-booking-item-analysis="none">
        {t("bookingForecast.none")}
      </span>
    );
  const missing = forecastMissingText(a, t);
  const pct = (n: number) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: 1 });
  return (
    <span
      className="flex flex-col items-start gap-0.5"
      title={t("bookingForecast.at", { date: formatDate(a.at, t) })}
      data-booking-item-analysis={a.verdict ?? "missing"}
    >
      {missing ? (
        <>
          <Badge tone="neutral">{t("bookingForecast.none")}</Badge>
          <span className="max-w-44 text-xs whitespace-normal text-zinc-500">
            {t("bookingLots.item.missingData", { list: missing })}
          </span>
        </>
      ) : a.verdict ? (
        <Badge tone={SIGNAL_TONE[a.verdict]}>
          {t(`booking.signal.${a.verdict}` as DictionaryKey)}
        </Badge>
      ) : null}
      {a.salePriceBrl !== null ? (
        <span className="text-xs whitespace-nowrap text-zinc-600">
          {t("bookingForecast.sale", {
            price: formatMoney(a.salePriceBrl, "BRL", t),
          })}
        </span>
      ) : null}
      {a.withFreightBrl != null ? (
        <span className="text-xs whitespace-nowrap text-zinc-600">
          {t("bookingForecast.withFreight", {
            price: formatMoney(a.withFreightBrl, "BRL", t),
          })}
        </span>
      ) : null}
      {a.profitPct !== null ? (
        <span className="text-xs whitespace-nowrap text-zinc-600">
          {t("bookingForecast.profit", { pct: pct(a.profitPct) })}
        </span>
      ) : null}
      {a.targetPriceBrl !== null && a.targetPct ? (
        <span
          className="text-xs whitespace-nowrap text-zinc-600"
          data-booking-item-target
        >
          {t("bookingForecast.target", {
            pct: pct(a.targetPct),
            price: formatMoney(a.targetPriceBrl, "BRL", t),
          })}
        </span>
      ) : null}
    </span>
  );
}
