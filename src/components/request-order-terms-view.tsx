import type { Translate } from "@/i18n";
import type { CarrierChoice, OrderTerms } from "@/lib/order-terms";

/**
 * Condições do pedido gravadas na solicitação (docs/ORDER_TERMS.md), só
 * leitura: tipo de operação, formato, entrega, país e grupo e o aviso de
 * que não há devoluções. Solicitação sem condições (antiga, estoque,
 * aberta pelo cliente): nada aparece.
 */
export function RequestOrderTermsView({
  terms,
  t,
}: {
  terms: OrderTerms | null | undefined;
  t: Translate;
}) {
  if (!terms) return null;
  const carrier = (c: CarrierChoice | null) =>
    c
      ? `${c.name}${c.source === "sankhya" ? ` (Sankhya ${c.code})` : ""}`
      : "—";
  const rows: Array<[string, string]> = [
    [
      t("orderTerms.operationType"),
      t(`orderTerms.operation.${terms.operationType}`),
    ],
    [
      t("orderTerms.saleFormat"),
      terms.saleFormat === "wellmix" && terms.wellmixTier
        ? `${t("orderTerms.format.wellmix")} · ${t(`orderTerms.tier.${terms.wellmixTier}`)}`
        : t(`orderTerms.format.${terms.saleFormat}`),
    ],
    [t("orderTerms.carrier"), carrier(terms.carrier)],
    [t("orderTerms.redispatch"), carrier(terms.redispatch)],
    [
      t("orderTerms.country"),
      terms.originCountry
        ? terms.originCountryName || terms.originCountry
        : t("orderTerms.countryUnknown"),
    ],
    [t("orderTerms.group"), terms.productLineName || "—"],
  ];
  return (
    <div
      className="mt-3 border-t border-zinc-100 pt-2.5"
      data-request-order-terms
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {t("orderTerms.view.title")}
      </h3>
      <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="break-words text-zinc-900">{value}</dd>
          </div>
        ))}
      </dl>
      {terms.noReturnsNotice ? (
        <p className="mt-2 text-xs text-red-800">
          <span className="font-semibold">
            {t("orderTerms.disclaimerTitle")}:
          </span>{" "}
          {t("orderTerms.disclaimer")}
        </p>
      ) : null}
    </div>
  );
}
