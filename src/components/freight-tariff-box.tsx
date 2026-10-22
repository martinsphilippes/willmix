import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { OrderTariffView } from "@/lib/services/freight-tariff";
import { Badge, LinkButton, TextLink, cx, formatDate, formatMoney } from "./ui";

/**
 * Cartão Embarque (só Wellmix): botão para importar a planilha da companhia
 * marítima e o frete do tarifário vigente para a rota do pedido (origem pelo
 * local do fornecedor na ficha), do mais barato para o mais caro.
 */
export function FreightTariffBox({
  t,
  orderId,
  view,
}: {
  t: Translate;
  orderId: string;
  view: OrderTariffView | null;
}) {
  const tariffHref = `/app/freight/tariff?from=${encodeURIComponent(`/app/orders/${orderId}`)}`;
  const options = view?.options.slice(0, 4) ?? [];
  return (
    <div
      className="mb-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-3"
      data-tariff-box=""
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">
          {t("tariff.order.title")}
        </p>
        <LinkButton
          href={tariffHref}
          variant="primary"
          className="text-xs"
          data-tariff-import-link=""
        >
          {t("tariff.order.import")}
        </LinkButton>
      </div>
      <div className="mt-2 text-sm text-zinc-700">
        {!view ? (
          <p>{t("tariff.order.none")}</p>
        ) : !view.location ? (
          <p>{t("tariff.order.noLocation")}</p>
        ) : !view.origin ? (
          <p>{t("tariff.order.noOrigin", { location: view.location })}</p>
        ) : !options.length ? (
          <p>{t("tariff.order.noRates", { origin: view.origin })}</p>
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              {t("tariff.order.from", {
                date: formatDate(`${view.referenceDate}T12:00:00Z`, t),
                origin: view.origin,
              })}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {options.map((o, i) => (
                <li
                  key={`${o.destinationCode}-${o.forwarder}-${o.route}`}
                  className={cx(
                    "flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-xl border bg-white px-3 py-2",
                    i === 0 ? "border-emerald-300" : "border-zinc-200",
                  )}
                  data-tariff-option={`${o.forwarder}|${o.destinationCode}`}
                >
                  <span className="min-w-0">
                    <span className="font-medium text-zinc-900">
                      {o.forwarder} → {o.destination}
                    </span>
                    <span className="block text-[11px] text-zinc-500">
                      {formatMoney(o.oceanUsd, "USD", t)} ·{" "}
                      {t(`tariff.route.${o.route}` as DictionaryKey)}
                      {o.paymentTermDays !== null
                        ? ` · ${t("tariff.table.term", { n: String(o.paymentTermDays) })}`
                        : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {o.assigned ? (
                      <Badge tone="brand">{t("tariff.order.assigned")}</Badge>
                    ) : null}
                    <span
                      className={cx(
                        "font-semibold tabular-nums",
                        i === 0 ? "text-emerald-800" : "text-zinc-900",
                      )}
                    >
                      {formatMoney(o.totalBrl, "BRL", t)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">{t("tariff.order.hint")}</p>
        {view ? (
          <TextLink href={tariffHref} className="text-xs">
            {t("tariff.order.viewAll")}
          </TextLink>
        ) : null}
      </div>
    </div>
  );
}
