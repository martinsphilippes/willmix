import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { OrderTariffView } from "@/lib/services/freight-tariff";
import { Badge, LinkButton, TextLink, cx, formatDate, formatMoney } from "./ui";

/** Opções mostradas no cartão (as mais baratas; a companhia do pedido sempre aparece). */
const TOP = 4;

/**
 * Cartão Embarque (só Wellmix): botão para importar a planilha da companhia
 * marítima e o frete do tarifário vigente para a rota do pedido (origem pelo
 * local do fornecedor na ficha ou escolhida aqui), do mais barato para o
 * mais caro.
 */
export function FreightTariffBox({
  t,
  orderId,
  stageId,
  view,
  keepParams = {},
}: {
  t: Translate;
  orderId: string;
  stageId: string;
  /** Parâmetros da tela que o "Ver frete" mantém (ex.: remeasure=1). */
  keepParams?: Record<string, string>;
  /** null = nenhum tarifário importado; "failed" = não deu para ler agora. */
  view: OrderTariffView | "failed" | null;
}) {
  const tariffHref = `/app/freight/tariff?from=${encodeURIComponent(`/app/orders/${orderId}`)}`;
  const data = view && view !== "failed" ? view : null;
  const top = data?.options.slice(0, TOP) ?? [];
  const options = data
    ? [...top, ...data.options.slice(TOP).filter((o) => o.assigned)]
    : [];
  const cheapest = data?.options[0];
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
        {view === "failed" ? (
          <p>{t("tariff.order.unavailable")}</p>
        ) : !data ? (
          <p>{t("tariff.order.none")}</p>
        ) : !data.origin ? (
          <p>
            {data.location
              ? t("tariff.order.noOrigin", { location: data.location })
              : t("tariff.order.noLocation")}
          </p>
        ) : !options.length ? (
          <p>{t("tariff.order.noRates", { origin: data.origin })}</p>
        ) : (
          <>
            <p className="text-xs text-zinc-500">
              {t("tariff.order.from", {
                date: formatDate(`${data.referenceDate}T12:00:00Z`, t),
                origin: data.origin,
              })}
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {options.map((o) => {
                const best = o === cheapest;
                return (
                  <li
                    key={`${o.destinationCode}-${o.forwarder}-${o.route}`}
                    className={cx(
                      "flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-xl border bg-white px-3 py-2",
                      best ? "border-emerald-300" : "border-zinc-200",
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
                        {o.containerQty > 1
                          ? ` · ${t("tariff.order.containers", { n: String(o.containerQty) })}`
                          : ""}
                        {o.paymentTermDays !== null
                          ? ` · ${t("tariff.table.term", { n: String(o.paymentTermDays) })}`
                          : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {o.assigned ? (
                        <Badge tone="brand">{t("tariff.order.assigned")}</Badge>
                      ) : null}
                      <span className="text-right">
                        <span
                          className={cx(
                            "block font-semibold tabular-nums",
                            best ? "text-emerald-800" : "text-zinc-900",
                          )}
                        >
                          {formatMoney(o.totalBrl, "BRL", t)}
                        </span>
                        {/* Ordem e destaque são por container: com mais de um, mostra o valor que comparou. */}
                        {o.containerQty > 1 ? (
                          <span className="block text-[11px] tabular-nums text-zinc-500">
                            {t("tariff.order.perContainer", {
                              value: formatMoney(
                                o.totalBrl / o.containerQty,
                                "BRL",
                                t,
                              ),
                            })}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      {data && data.origins.length ? (
        /* Porto de embarque à mão (ex.: fornecedor em Yiwu embarca por Ningbo). */
        <form
          method="get"
          action={`/app/orders/${encodeURIComponent(orderId)}#stage-${stageId}`}
          className="mt-2 flex flex-wrap items-end gap-2"
          data-tariff-origin-form=""
        >
          {Object.entries(keepParams).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <label className="text-xs font-medium text-zinc-700">
            <span className="mb-1 block">{t("tariff.order.pickOrigin")}</span>
            <select
              name="tariffOrigin"
              defaultValue={data.selectedOrigin ?? ""}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {!data.selectedOrigin ? <option value="">—</option> : null}
              {data.origins.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm hover:border-brand-400 hover:text-brand-700"
          >
            {t("tariff.order.pickSubmit")}
          </button>
        </form>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">{t("tariff.order.hint")}</p>
        {data ? (
          <TextLink href={tariffHref} className="text-xs">
            {t("tariff.order.viewAll")}
          </TextLink>
        ) : null}
      </div>
    </div>
  );
}
