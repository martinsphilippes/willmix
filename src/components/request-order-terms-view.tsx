import type { Translate } from "@/i18n";
import {
  formatCnpj,
  type CarrierChoice,
  type OrderTerms,
} from "@/lib/order-terms";

/**
 * Condições do pedido gravadas na solicitação (docs/ORDER_TERMS.md), só
 * leitura: tipo de operação, formato, entrega (transportador e re-despacho,
 * com a transportadora informada pelo cliente), país e família e a
 * confirmação do cliente (aviso "sem devoluções"). Solicitação sem
 * condições (antiga, estoque, aberta pelo cliente): nada aparece.
 */
export function RequestOrderTermsView({
  terms,
  t,
}: {
  terms: OrderTerms | null | undefined;
  t: Translate;
}) {
  if (!terms) return null;
  const carrier = (c: CarrierChoice | null | undefined) =>
    c
      ? `${c.name}${c.source === "sankhya" ? ` (Sankhya ${c.code})` : ""}`
      : "—";
  const confirmation = terms.confirmation ?? null;
  const caller = terms.carrierCaller;
  const pending = t("orderTerms.view.carrierPending");
  // Quem chama = Cliente (16/11/2026): as transportadoras vêm da confirmação.
  const mainCarrier =
    caller === "customer"
      ? confirmation?.carrier
        ? `${confirmation.carrier.name} (${formatCnpj(confirmation.carrier.cnpj)})`
        : pending
      : carrier(terms.carrier);
  const redispatch =
    terms.redispatchRequired === undefined
      ? carrier(terms.redispatch) // antes de 15/11/2026 (2ª rodada)
      : terms.redispatchRequired && caller === "wellmix"
        ? `${t("orderTerms.redispatchYes")} · ${carrier(terms.redispatch)}`
        : terms.redispatchRequired
          ? confirmation?.redispatchCarrier
            ? `${t("orderTerms.redispatchYes")} · ${confirmation.redispatchCarrier.name} (${formatCnpj(confirmation.redispatchCarrier.cnpj)})`
            : `${t("orderTerms.redispatchYes")} · ${t("orderTerms.view.redispatchPending")}`
          : t("orderTerms.redispatchNo");
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
    ...(caller
      ? ([
          [
            t("orderTerms.view.carrierCaller"),
            t(`orderTerms.carrierCaller.${caller}`),
          ],
        ] as Array<[string, string]>)
      : []),
    [t("orderTerms.carrier"), mainCarrier],
    [t("orderTerms.redispatch"), redispatch],
    // País - Porto (dono, 21/11/2026); as antigas, só o país.
    terms.originPort !== undefined
      ? [
          t("originPort.field"),
          t("originPort.option", {
            country: terms.originCountryName || terms.originCountry || "—",
            port: terms.originPortName || t("originPort.noPort"),
          }),
        ]
      : [
          t("orderTerms.country"),
          terms.originCountryName || terms.originCountry || "—",
        ],
    [
      t("orderTerms.group"),
      terms.productFamilyName || terms.productLineName || "—",
    ],
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
      <p
        className={
          confirmation
            ? "mt-2 text-xs text-emerald-800"
            : "mt-2 text-xs font-medium text-amber-800"
        }
        data-request-confirmation={confirmation ? "confirmed" : "pending"}
      >
        {confirmation
          ? t("orderTerms.view.confirmed", {
              name: confirmation.userName,
              date: new Date(confirmation.at).toLocaleString(t.intl),
            })
          : terms.noReturnsAccepted
            ? t("orderTerms.view.sellerAccepted")
            : t("orderTerms.view.awaiting")}
      </p>
    </div>
  );
}
