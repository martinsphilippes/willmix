import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Order, OrderItem, Product, User } from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { CURRENCIES } from "@/lib/currencies";
import { containersFor, itemCargo } from "@/lib/order-sale-quote";
import { orderSaleView } from "@/lib/services/order-sale";
import {
  cachedItemPrices,
  canSeeSaleQuotes,
  saleQuoteContext,
  saleQuoteMode,
} from "@/lib/services/order-sale-quote";
import { OrderSaleForm } from "@/components/order-sale-form";
import { OrderSaleQuoteForm } from "@/components/order-sale-quote-form";
import { Alert } from "@/components/ui";

/*
 * Venda ao cliente por pedido e por produto no detalhe do pedido (dono,
 * 14/11/2026; docs/ORDER_SALE.md): o preço de cada produto e o total (a
 * soma). A rodada da programação (pedido filho) não tem venda própria: aponta
 * para o pai, que é a compra.
 *
 * Preços pela API (dono, 24/11/2026): com o Sankhya ligado, a Wellmix vê os
 * preços WD e Wellmix da cotação V2 lado a lado, só para leitura, escolhe o
 * formato e grava; sem ele, o preço continua digitado. Caixas, cubagem e
 * containers no topo do card (Wellmix).
 */

const r4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Caixas e cubagem de cada item e os totais com os containers do pedido. */
async function saleCargo(
  order: Order,
  items: OrderItem[],
  products: readonly Product[],
) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = new Map(
    items.map((i) => {
      const p = i.productId ? byId.get(i.productId) : null;
      return [
        i.id,
        itemCargo({
          quantity: i.quantity,
          unit: i.unit,
          perBox: i.variant?.masterBoxQty ?? p?.masterBoxQty ?? null,
          cbmPerBox: i.variant?.cbm ?? p?.cbm ?? null,
        }),
      ] as const;
    }),
  );
  const known = [...lines.values()];
  const withBoxes = known.filter((l) => l.boxes !== null);
  const withCbm = known.filter((l) => l.cbm !== null);
  const boxes = withBoxes.length
    ? withBoxes.reduce((a, l) => a + l.boxes!, 0)
    : null;
  const cbm = withCbm.length
    ? r4(withCbm.reduce((a, l) => a + l.cbm!, 0))
    : null;
  // O tipo da ficha de compra do pedido; sem ele, o 40HC das Configurações.
  const [sheet] = await getStore().list("purchase_sheets", {
    filter: { orderId: order.id },
    limit: 1,
  });
  const { containerCapacity } = await import("@/lib/services/purchase-sheet");
  const container = await containerCapacity(sheet?.containerType ?? null);
  return {
    lines,
    boxes,
    cbm,
    containers: containersFor(cbm, container.capacity),
    containerType: container.type,
    // Produtos sem caixa master ou sem CBM ficam fora da soma.
    missing: known.length - Math.min(withBoxes.length, withCbm.length),
  };
}

function CargoSummary({
  cargo,
  t,
}: {
  cargo: Awaited<ReturnType<typeof saleCargo>>;
  t: Translate;
}) {
  const stat = (label: string, value: string, attr: string) => (
    <div className="min-w-0" {...{ [attr]: "" }}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="block text-sm font-semibold tabular-nums text-zinc-900">
        {value}
      </span>
    </div>
  );
  return (
    <div
      className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3 py-2.5"
      data-sale-cargo
    >
      <div className="grid grid-cols-3 gap-3">
        {stat(
          t("orderSale.cargo.boxes"),
          cargo.boxes !== null ? cargo.boxes.toLocaleString(t.intl) : "—",
          "data-sale-cargo-boxes",
        )}
        {stat(
          t("orderSale.cargo.cbm"),
          cargo.cbm !== null
            ? `${cargo.cbm.toLocaleString(t.intl, { maximumFractionDigits: 3 })} m³`
            : "—",
          "data-sale-cargo-cbm",
        )}
        {stat(
          t("orderSale.cargo.containers"),
          cargo.containers !== null
            ? `${cargo.containers.toLocaleString(t.intl, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}${cargo.containerType ? ` × ${cargo.containerType}` : ""}`
            : "—",
          "data-sale-cargo-containers",
        )}
      </div>
      {cargo.missing > 0 ? (
        <p className="mt-1.5 text-[11px] text-amber-700">
          {t("orderSale.cargo.missing", { n: String(cargo.missing) })}
        </p>
      ) : null}
    </div>
  );
}

export async function OrderSaleContent({
  order,
  items,
  user,
  products,
  editable,
  readOnlyNote,
  saved,
  t,
}: {
  order: Order;
  items: OrderItem[];
  /** Quem vê o pedido (a Wellmix vê caixas, cubagem e os preços da cotação). */
  user: User;
  /** Produtos dos itens (a caixa master e a cubagem). */
  products: readonly Product[];
  /** Grava (ação "Gravar a venda ao cliente", pedido não cancelado). */
  editable: boolean;
  /** Wellmix que vê os valores mas não grava: o aviso de quem altera. */
  readOnlyNote: boolean;
  /** Volta da gravação (?sale=saved). */
  saved: boolean;
  t: Translate;
}) {
  if (order.parentOrderId) {
    const parent = await getStore().get("orders", order.parentOrderId);
    const n = parent?.number ?? "—";
    return (
      <p className="text-sm text-zinc-600" data-order-sale-child>
        {t("orderSale.child", { n })}{" "}
        {parent ? (
          <Link
            href={`/app/orders/${parent.id}`}
            className="font-medium text-brand-700 underline underline-offset-2"
          >
            {t("orderSale.openParent", { n })}
          </Link>
        ) : null}
      </p>
    );
  }
  const view = orderSaleView(order, items);
  const wellmix = isWellmix(user);
  const cargo = wellmix ? await saleCargo(order, items, products) : null;
  const quotes =
    wellmix && canSeeSaleQuotes(user) && (await saleQuoteMode()) === "api";
  const notes =
    order.status === "CANCELLED" ? (
      <p className="mb-2 text-xs text-zinc-500">{t("orderSale.cancelled")}</p>
    ) : readOnlyNote ? (
      <p className="mb-2 text-xs text-zinc-500">{t("orderSale.readOnly")}</p>
    ) : null;

  let content: ReactNode;
  if (quotes) {
    // Preços pela cotação V2: os já cotados hoje vêm prontos; os outros a
    // tela busca aos poucos.
    const ctx = await saleQuoteContext(order, items);
    const tier = ctx.terms?.wellmixTier ?? null;
    content = (
      <>
        <p className="mb-3 text-xs leading-relaxed text-zinc-500">
          {t("orderSale.quote.hint", {
            tier: tier
              ? t(`orderTerms.tier.${tier}` as DictionaryKey)
              : t("orderSale.quote.tierDefault"),
          })}
        </p>
        {notes}
        <OrderSaleQuoteForm
          orderId={order.id}
          lines={items.map((i) => ({
            itemId: i.id,
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            boxes: cargo?.lines.get(i.id)?.boxes ?? null,
            cbm: cargo?.lines.get(i.id)?.cbm ?? null,
            initial: cachedItemPrices(ctx, i),
          }))}
          initialFormat={order.saleFormat ?? ctx.terms?.saleFormat ?? null}
          recordedFormat={order.saleFormat ?? null}
          recordedTotal={view.recordedTotal}
          recordedCurrency={order.sellCurrency ?? null}
          editable={editable}
          locale={t.intl}
          labels={{
            colProduct: t("orderSale.col.product"),
            colSubtotal: t("orderSale.col.subtotal"),
            lineBoxes: t("orderSale.line.boxes", { n: "{n}" }),
            lineCbm: t("orderSale.line.cbm", { n: "{n}" }),
            wd: t("orderTerms.format.wd"),
            wellmix: t("orderTerms.format.wellmix"),
            format: t("orderSale.quote.format"),
            pickFormat: t("orderSale.quote.pick"),
            total: t("orderSale.quote.total", { format: "{format}" }),
            partial: t("orderSale.partial", {
              sum: "{sum}",
              n: "{n}",
              total: "{total}",
            }),
            empty: t("orderSale.empty"),
            save: t("orderSale.save"),
            saving: t("orderSale.saving"),
            loading: t("orderSale.quote.loading", {
              n: "{n}",
              total: "{total}",
            }),
            recorded: t("orderSale.quote.recorded", {
              total: "{total}",
              format: "{format}",
            }),
            recordedTyped: t("orderSale.quote.recordedTyped", {
              total: "{total}",
            }),
            priceOf: t("orderSale.quote.priceOf", {
              format: "{format}",
              name: "{name}",
            }),
            missingPrice: t("orderSale.quote.missing", {
              format: "{format}",
              reason: "{reason}",
            }),
            reasonNoProduct: t("orderSale.quote.reason.noProduct"),
            reasonNoPrice: t("orderSale.quote.reason.noPrice"),
            reasonFailed: t("orderSale.quote.reason.failed"),
          }}
        />
      </>
    );
  } else {
    content = (
      <>
        <p className="mb-3 text-xs leading-relaxed text-zinc-500">
          {t("orderSale.hint")}
        </p>
        {notes}
        <OrderSaleForm
          orderId={order.id}
          lines={view.lines.map((l) => ({
            itemId: l.itemId,
            name: l.name,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice,
          }))}
          currency={view.currency}
          recordedTotal={view.recordedTotal}
          editable={editable}
          locale={t.intl}
          labels={{
            colProduct: t("orderSale.col.product"),
            colQty: t("orderSale.col.qty"),
            colUnit: t("orderSale.col.unit"),
            colSubtotal: t("orderSale.col.subtotal"),
            currency: t("orderSale.currency"),
            total: t("orderSale.total"),
            partial: t("orderSale.partial", {
              sum: "{sum}",
              n: "{n}",
              total: "{total}",
            }),
            legacy: t("orderSale.legacy", { total: "{total}" }),
            empty: t("orderSale.empty"),
            save: t("orderSale.save"),
            saving: t("orderSale.saving"),
            priceOf: t("orderSale.priceOf", { name: "{name}" }),
            currencyNames: Object.fromEntries(
              CURRENCIES.map((c) => [
                c,
                t(`currency.name.${c}` as DictionaryKey),
              ]),
            ),
          }}
        />
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      {saved ? (
        <div className="mb-3">
          <Alert tone="success">{t("orderSale.saved")}</Alert>
        </div>
      ) : null}
      {cargo ? <CargoSummary cargo={cargo} t={t} /> : null}
      {content}
    </div>
  );
}
