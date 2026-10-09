import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { ProductCycle } from "@/lib/services/product-cycle";
import {
  Badge,
  Empty,
  Stat,
  TextLink,
  formatDate,
  type Tone,
} from "@/components/ui";

/*
 * Card "Ciclo do produto": sourcing → produto → solicitações → pedidos →
 * pós-venda → reposição → kits de marketing. Só leitura, tudo por
 * relacionamento (loadProductCycle); FOB e margem não aparecem aqui.
 */

const kitTone: Record<string, Tone> = {
  draft: "neutral",
  preview: "info",
  offered: "brand",
  purchased: "warning",
  paid: "success",
  released: "success",
  cancelled: "danger",
};
const sourcingTone: Record<string, Tone> = {
  negotiating: "brand",
  approved: "success",
  promoted: "success",
  discarded: "danger",
};
const afterSalesTone: Record<string, Tone> = {
  open: "warning",
  answered: "success",
  closed: "neutral",
};

function stars(rating: number) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function CycleCard({
  cycle,
  productId,
  t,
}: {
  cycle: ProductCycle;
  productId: string;
  t: Translate;
}) {
  const { counts, sourcing, requests, orders, kits, schedules } = cycle;
  return (
    <div className="space-y-5">
      <div id="cycle" className="scroll-mt-4" />
      <p className="text-sm text-zinc-600">{t("vision.cycle.hint")}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t("vision.cycle.requests")} value={counts.requests} />
        <Stat label={t("vision.cycle.orders")} value={counts.orders} />
        <Stat label={t("vision.cycle.delivered")} value={counts.delivered} />
        <Stat
          label={t("vision.cycle.afterSales")}
          value={counts.afterSalesAnswered}
        />
        <Stat
          label={t("vision.cycle.replenishments")}
          value={counts.replenishments}
        />
        <Stat
          label={t("vision.cycle.schedules")}
          value={schedules}
          href="#schedules"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Sourcing de origem */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("vision.cycle.sourcing")}
          </h3>
          {sourcing ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <TextLink href={`/app/sourcing/items/${sourcing.itemId}`}>
                {sourcing.name}
              </TextLink>
              <Badge tone={sourcingTone[sourcing.status] ?? "neutral"}>
                {t(`sourcing.status.${sourcing.status}` as DictionaryKey)}
              </Badge>
              {sourcing.supplierName ? (
                <span className="text-zinc-600">· {sourcing.supplierName}</span>
              ) : null}
              {sourcing.visitId ? (
                <TextLink
                  href={`/app/sourcing/visits/${sourcing.visitId}`}
                  className="text-xs"
                >
                  {t("vision.cycle.visit")}
                  {sourcing.visitDate
                    ? ` · ${formatDate(sourcing.visitDate, t)}`
                    : ""}
                </TextLink>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              {t("vision.cycle.sourcing.none")}
            </p>
          )}
        </section>

        {/* Kits de marketing */}
        <section>
          <h3 className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <span>{t("vision.cycle.kits")}</span>
            <TextLink
              href={`/app/marketing/new?productId=${productId}`}
              className="normal-case tracking-normal"
            >
              + {t("vision.cycle.kits.create")}
            </TextLink>
          </h3>
          {kits.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {t("vision.cycle.kits.empty")}
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
              {kits.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2"
                >
                  <TextLink href={`/app/marketing/${k.id}`}>{k.name}</TextLink>
                  <Badge tone={kitTone[k.status] ?? "neutral"}>
                    {t(`marketing.status.${k.status}` as DictionaryKey)}
                  </Badge>
                  {k.customerName ? (
                    <span className="text-zinc-600">· {k.customerName}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Solicitações */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("vision.cycle.requests")}
          </h3>
          {requests.length === 0 ? (
            <Empty>{t("vision.cycle.requests.empty")}</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2"
                >
                  <span className="tabular-nums text-zinc-600">
                    {formatDate(r.createdAt, t)}
                  </span>
                  <span className="font-medium text-zinc-900">
                    {r.customerName}
                  </span>
                  <span className="tabular-nums text-zinc-700">
                    {r.quantity} {r.unit}
                  </span>
                  <Badge>
                    {t(`reqStatusLabel.${r.status}` as DictionaryKey)}
                  </Badge>
                  {r.origin && r.origin !== "manual" ? (
                    <Badge tone="brand">
                      {t(`orders.origin.${r.origin}` as DictionaryKey)}
                    </Badge>
                  ) : null}
                  <TextLink
                    href={`/app/requests/${r.id}`}
                    className="ml-auto text-xs"
                  >
                    {t("catalog.schedules.request")}
                  </TextLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pedidos e pós-venda */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {t("vision.cycle.orders")}
          </h3>
          {orders.length === 0 ? (
            <Empty>{t("vision.cycle.orders.empty")}</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
              {orders.map((o) => (
                <li key={o.id} className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <TextLink href={`/app/orders/${o.id}`}>
                      #{o.number}
                    </TextLink>
                    <Badge
                      tone={
                        o.status === "DELIVERED" || o.status === "CLOSED"
                          ? "success"
                          : "brand"
                      }
                    >
                      {t(`stage.${o.status}` as DictionaryKey)}
                    </Badge>
                    <span className="tabular-nums text-zinc-700">
                      {o.quantity}
                    </span>
                    <span className="font-medium text-zinc-900">
                      {o.customerName}
                    </span>
                    <span className="ml-auto tabular-nums text-xs text-zinc-500">
                      {formatDate(o.createdAt, t)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600">
                    <span>{t("orders.afterSales.title")}:</span>
                    {o.rating !== null ? (
                      <span
                        className="text-amber-600"
                        aria-label={`${o.rating}/5`}
                      >
                        {stars(o.rating)}
                      </span>
                    ) : null}
                    {o.afterSalesStatus ? (
                      <Badge
                        tone={afterSalesTone[o.afterSalesStatus] ?? "neutral"}
                      >
                        {t(
                          `orders.afterSales.status.${o.afterSalesStatus}` as DictionaryKey,
                        )}
                      </Badge>
                    ) : (
                      <span>{t("vision.cycle.afterSales.none")}</span>
                    )}
                    {o.repurchaseInterest ? (
                      <span>
                        · {t("vision.cycle.repurchase")}:{" "}
                        {t(
                          `orders.afterSales.repurchase.${o.repurchaseInterest}` as DictionaryKey,
                        )}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
