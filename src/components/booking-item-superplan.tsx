import type { Translate } from "@/i18n";
import { dictionaries, type DictionaryKey } from "@/i18n/dictionaries";
import type { BookingAnalysis } from "@/lib/db/schema";
import { Badge, formatDate, formatMoney, type Tone } from "@/components/ui";

/*
 * Resultado do Superplan de um item de booking (docs/SUPPLIER_REQUESTS.md,
 * "Superplan na seleção"): o retrato gravado ao fechar o booking, sem refazer
 * a conta. Mostra o preço mínimo, o preço para a meta e o que deixa o custo
 * menos confiável (II/IPI sem NCM, peso bruto estimado, dado faltando).
 *
 * O sinal (viável, abaixo da meta, prejuízo) só aparece quando a conta foi
 * feita num preço de venda testado: no preço mínimo (custo × markup) o lucro
 * depende quase só dos parâmetros e todo item daria o mesmo sinal
 * (docs/SUPERPLAN.md, seção 5.2).
 */

const SIGNAL_TONE: Record<string, Tone> = {
  viable: "success",
  below: "warning",
  loss: "danger",
};

/** Custo por peça posto no depósito (R$), o número para decidir. */
export function bookingItemCost(
  analysis: BookingAnalysis | null | undefined,
): number | null {
  const cost = analysis?.costBrl;
  return typeof cost === "number" && Number.isFinite(cost) ? cost : null;
}

/** Os pressupostos da conta, numa linha (dica ao passar o mouse). */
export function superplanAssumptions(a: BookingAnalysis, t: Translate) {
  const i = a.inputs;
  return t("supplierRequests.superplan.assumptions", {
    date: formatDate(a.at, t),
    type: a.businessType,
    container: i?.container ?? "—",
    freight: i?.freightUsd != null ? formatMoney(i.freightUsd, "USD", t) : "—",
    fx:
      i?.officialRate != null
        ? i.officialRate.toLocaleString(t.intl, { maximumFractionDigits: 4 })
        : "—",
  });
}

export function BookingItemSuperplan({
  analysis: a,
  t,
}: {
  analysis: BookingAnalysis;
  t: Translate;
}) {
  const missing = a.missing.length
    ? a.missing
        .map((m) => {
          const key = `superplan.missing.${m}`;
          return key in dictionaries.pt ? t(key as DictionaryKey) : m;
        })
        .join(", ")
    : null;
  const showSignal = !!a.verdict && !a.usesMinimum;
  const pct = (n: number) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: 1 });
  return (
    <span
      className="flex flex-col items-start gap-0.5"
      title={superplanAssumptions(a, t)}
      data-booking-item-superplan={a.verdict ?? "missing"}
    >
      {missing ? (
        <>
          <Badge tone="neutral">{t("booking.signal.missing")}</Badge>
          <span className="max-w-40 text-xs whitespace-normal text-zinc-500">
            {t("bookingLots.item.missingData", { list: missing })}
          </span>
        </>
      ) : showSignal ? (
        <Badge tone={SIGNAL_TONE[a.verdict!]}>
          {t(`booking.signal.${a.verdict}` as DictionaryKey)}
        </Badge>
      ) : null}
      {a.minimumBrl !== null ? (
        <span className="text-xs whitespace-nowrap text-zinc-600">
          {t("bookingLots.item.minimum", {
            price: formatMoney(a.minimumBrl, "BRL", t),
          })}
        </span>
      ) : null}
      {a.costBrl !== null ? (
        <span
          className="text-xs whitespace-nowrap text-zinc-600"
          data-booking-item-target
        >
          {a.targetPriceBrl !== null
            ? t("supplierRequests.superplan.target", {
                pct: pct(a.targetPct),
                price: formatMoney(a.targetPriceBrl, "BRL", t),
              })
            : t("supplierRequests.superplan.targetNone", {
                pct: pct(a.targetPct),
              })}
        </span>
      ) : null}
      {a.costBrl !== null && a.inputs && !a.inputs.ncmFound ? (
        <span
          className="max-w-44 text-xs whitespace-normal text-amber-700"
          data-booking-item-no-ncm
        >
          {t("supplierRequests.superplan.noNcm")}
        </span>
      ) : null}
      {a.costBrl !== null && a.inputs?.grossEstimated ? (
        <span className="max-w-44 text-xs whitespace-normal text-zinc-500">
          {t("supplierRequests.superplan.grossEstimated")}
        </span>
      ) : null}
    </span>
  );
}
