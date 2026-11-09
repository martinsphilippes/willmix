import { Fragment, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { loadSaleSheet } from "@/lib/services/sale-sheet";
import type { AccountSide } from "@/lib/services/customer-accounts";
import { accountBase } from "./labels";
import {
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  formatMoney,
  linkClass,
  rowClass,
} from "@/components/ui";
import { ChatOpenButton } from "@/components/chat-open-button";
import { PrintButton } from "@/components/print-button";
import { PhotoGallery } from "@/components/photo-gallery";
import { RowMoreDetails, RowMoreToggle, oneLine } from "@/components/row-more";
import { galleryProps } from "@/components/photo-gallery-props";

const PAYMENT_TONE = {
  pending: "warning",
  confirmed: "info",
  received: "success",
} as const;

/**
 * Pedido de venda em lista (Clientes → cliente → registro de vendas →
 * pedido): cabeçalho, um produto por linha com total, recebimentos,
 * observações e anexos. Só leitura; registrar e aprovar continuam na tela
 * completa do pedido. Só a Wellmix; valores só para quem abre Finanças.
 */
export async function PartySaleSheet({
  side,
  params,
}: {
  side: AccountSide;
  params: Promise<{ id: string; orderId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  if (!isWellmix(user)) redirect("/app");
  const { id, orderId } = await params;
  const sheet = await loadSaleSheet(id, orderId, side);
  if (!sheet || !sheet.party) notFound();
  const t = await getT();
  const money = canOpen(user, "finance");
  const supplier = side === "supplier";
  const base = accountBase(side);
  // Pagamento ao fornecedor fica numa parte própria do pedido.
  const payAnchor = supplier ? "#supplier-payment" : "#payments";
  /** Texto do pedido em lista; no fornecedor, a versão de compra quando existe. */
  const S = (key: string, vars?: Record<string, string | number>) => {
    if (supplier) {
      const sk = `supp.sale.${key}` as DictionaryKey;
      const v = t(sk, vars);
      if (v !== sk) return v;
    }
    return t(`sale.${key}` as DictionaryKey, vars);
  };
  const { order, orders, party, lines, totals, rows, payments } = sheet;
  const owner = order.ownerUserId
    ? await getStore().get("users", order.ownerUserId)
    : null;
  const num = (n: number, d = 2) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: d });
  const currency = rows[0]?.currency ?? order.sellCurrency ?? "BRL";
  const sum = (f: (r: (typeof rows)[number]) => number) =>
    rows.reduce((s, r) => s + f(r), 0);
  const stageText = (s: { at: string; done: boolean } | null) =>
    s
      ? s.done
        ? S("info.done", { date: formatDate(s.at, t) })
        : S("info.planned", { date: formatDate(s.at, t) })
      : "—";
  const amountsText = [...totals.amounts]
    .map(([c, v]) => formatMoney(v, c, t))
    .join(" + ");

  return (
    <>
      <PageHeader
        t={t}
        title={S("title", { n: order.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <TextLink href={`${base}/${party.id}`}>{party.name}</TextLink>
            {orders.length > 1 ? (
              <span className="text-zinc-500" data-sale-batch>
                {S("batch", {
                  n: orders.length,
                  list: orders.map((o) => `#${o.number}`).join(", "),
                })}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <LinkButton href={`${base}/${party.id}`}>{S("back")}</LinkButton>
            <LinkButton
              href={`${base}/${party.id}/orders/${order.id}/export`}
              data-sale-export
            >
              {S("export")}
            </LinkButton>
            <PrintButton label={S("print")} />
            {money ? (
              <LinkButton href={`/app/orders/${order.id}${payAnchor}`}>
                {S("receive")}
              </LinkButton>
            ) : null}
            <LinkButton
              href={`/app/orders/${order.id}`}
              variant="primary"
              data-sale-open-full
            >
              {S("openFull")}
            </LinkButton>
          </>
        }
      />
      <p className="-mt-3 mb-4 text-sm text-zinc-600 print:hidden">
        {S("subtitle")}
      </p>

      {/* Cabeçalho do pedido, como no topo da nota de venda. */}
      <Card dense>
        <dl
          className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4"
          data-sale-info
        >
          {(
            [
              [S("info.date"), formatDate(order.createdAt, t)],
              [S("info.shipping"), stageText(sheet.shipping)],
              [S("info.delivery"), stageText(sheet.delivery)],
              [S("info.status"), t(`stage.${order.status}` as DictionaryKey)],
              [S("info.owner"), owner?.name ?? "—"],
              [
                S("info.address"),
                [party.address, party.city].filter(Boolean).join(" · ") || "—",
              ],
              ...(money
                ? ([
                    [
                      S("info.contract"),
                      <strong key="c" className="tabular-nums">
                        {amountsText || "—"}
                      </strong>,
                    ],
                  ] as [string, ReactNode][])
                : []),
            ] as [string, ReactNode][]
          ).map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {label}
              </dt>
              <dd className="mt-0.5 text-zinc-900">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <section className="mt-5" data-sale-items>
        <h2 className="mb-2 text-base font-semibold text-brand-700">
          {S("items")}
        </h2>
        {lines.length === 0 ? (
          <Empty>{t("common.none")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-10 text-right">{S("col.n")}</Th>
                <Th className="w-14">{S("col.photo")}</Th>
                <Th>{S("col.product")}</Th>
                <Th>{S("col.code")}</Th>
                <Th>{S("col.supplierSku")}</Th>
                <Th>{S("col.spec")}</Th>
                <Th>{S("col.color")}</Th>
                <Th className="text-right">{S("col.weight")}</Th>
                <Th className="text-right">{S("col.qty")}</Th>
                <Th className="text-right">{S("col.perBox")}</Th>
                <Th className="text-right">{S("col.boxes")}</Th>
                <Th className="text-right">{S("col.cbm")}</Th>
                {money ? (
                  <>
                    <Th className="text-right">{S("col.price")}</Th>
                    <Th className="text-right">{S("col.amount")}</Th>
                  </>
                ) : null}
                <Th className="text-right">{S("col.delivered")}</Th>
                <Th>{S("col.order")}</Th>
                <Th>{S("col.notes")}</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <Fragment key={`${l.orderId}-${i}`}>
                  <tr
                    className={cx(
                      rowClass,
                      l.orderStatus === "CANCELLED" && "opacity-60",
                    )}
                    data-sale-line={l.orderNumber}
                  >
                    {/* Linha fina: o que não cabe termina em "…"; a setinha abre tudo embaixo. */}
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      <RowMoreToggle label={S("more")} />
                      {i + 1}
                    </Td>
                    <Td className="w-14">
                      <PhotoGallery
                        name={l.name}
                        {...galleryProps(t, l.photos)}
                      />
                    </Td>
                    <Td className="max-w-64 font-medium">
                      {l.productId ? (
                        <TextLink
                          href={`/app/products/${l.productId}`}
                          className={cx(oneLine, "text-zinc-900")}
                        >
                          {l.name}
                        </TextLink>
                      ) : (
                        <span className={oneLine}>{l.name}</span>
                      )}
                      {l.variantName ? (
                        <span
                          className={cx(
                            oneLine,
                            "text-xs font-normal text-zinc-500",
                          )}
                        >
                          {l.variantName}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span
                        className={cx(
                          oneLine,
                          "max-w-28 font-mono text-xs text-zinc-700",
                        )}
                      >
                        {l.sku ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className={cx(
                          oneLine,
                          "max-w-28 font-mono text-xs text-zinc-700",
                        )}
                      >
                        {l.supplierSku ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="block max-w-48 truncate"
                        title={l.specification ?? undefined}
                      >
                        {l.specification ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className={cx(oneLine, "max-w-32")}>
                        {l.color ?? "—"}
                      </span>
                    </Td>
                    <Td className="text-right tabular-nums">
                      {l.weightKg !== null ? num(l.weightKg) : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {num(l.quantity, 0)} {l.unit}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {l.unitsPerBox ?? "—"}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {l.unitsPerBox !== null ? num(l.boxes, 0) : "—"}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {l.cbm !== null ? num(l.cbm, 3) : "—"}
                    </Td>
                    {money ? (
                      <>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {formatMoney(l.unitPrice, l.currency, t)}
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {formatMoney(l.amount, l.currency, t)}
                        </Td>
                      </>
                    ) : null}
                    <Td
                      className={cx(
                        "text-right tabular-nums",
                        l.delivered > 0 ? "text-emerald-700" : "text-zinc-400",
                      )}
                    >
                      {num(l.delivered, 0)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <TextLink href={`/app/orders/${l.orderId}`}>
                        #{l.orderNumber}
                      </TextLink>
                      <span className="block text-xs text-zinc-500">
                        {t(`stage.${l.orderStatus}` as DictionaryKey)}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="block max-w-56 truncate"
                        title={l.notes ?? undefined}
                      >
                        {l.notes ?? "—"}
                      </span>
                    </Td>
                  </tr>
                  <RowMoreDetails
                    colSpan={money ? 17 : 15}
                    items={[
                      [
                        S("col.product"),
                        l.variantName ? `${l.name} · ${l.variantName}` : l.name,
                      ],
                      [S("col.code"), l.sku],
                      [S("col.supplierSku"), l.supplierSku],
                      [S("col.color"), l.color],
                      [S("col.spec"), l.specification, true],
                      [S("col.notes"), l.notes, true],
                    ]}
                  />
                </Fragment>
              ))}
              <tr className="bg-amber-50/60 font-semibold" data-sale-total>
                <Td colSpan={7}>{S("total")}</Td>
                {/* Total sem o dado em nenhum produto: "—", não um 0. */}
                <Td className="text-right tabular-nums">
                  {lines.some((l) => l.weightKg !== null)
                    ? num(totals.weightKg)
                    : "—"}
                </Td>
                <Td className="text-right tabular-nums">
                  {num(totals.quantity, 0)}
                </Td>
                <Td />
                <Td className="text-right tabular-nums">
                  {lines.some((l) => l.unitsPerBox !== null)
                    ? num(totals.boxes, 0)
                    : "—"}
                </Td>
                <Td className="text-right tabular-nums">
                  {lines.some((l) => l.cbm !== null) ? num(totals.cbm, 3) : "—"}
                </Td>
                {money ? (
                  <>
                    <Td />
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {amountsText || "—"}
                    </Td>
                  </>
                ) : null}
                <Td className="text-right tabular-nums">
                  {num(totals.delivered, 0)}
                </Td>
                <Td colSpan={2} />
              </tr>
            </tbody>
          </Table>
        )}
      </section>

      <section className="mt-6" data-sale-collect>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <h2 className="text-base font-semibold text-brand-700">
            {S("collect")}
          </h2>
          {money ? (
            <>
              <span className="text-sm text-zinc-700">
                {S("collect.delivered", {
                  v: formatMoney(
                    sum((r) => r.delivered),
                    currency,
                    t,
                  ),
                })}
              </span>
              <span className="text-sm text-emerald-700">
                {S("collect.received", {
                  v: formatMoney(
                    sum((r) => r.received),
                    currency,
                    t,
                  ),
                })}
              </span>
              <a
                href={`/app/orders/${order.id}${payAnchor}`}
                className={cx(linkClass, "text-sm")}
              >
                {S("collect.open", {
                  v: formatMoney(
                    sum((r) => r.receivable),
                    currency,
                    t,
                  ),
                })}
              </a>
            </>
          ) : null}
        </div>
        {!money ? (
          <Empty>{S("money.hidden")}</Empty>
        ) : payments.length === 0 ? (
          <Empty>{S("collect.empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{S("col.payDate")}</Th>
                <Th className="text-right">{S("col.payAmount")}</Th>
                <Th>{S("col.payMethod")}</Th>
                <Th>{S("col.payStatus")}</Th>
                <Th>{S("col.payRef")}</Th>
                <Th>{S("col.payNote")}</Th>
                <Th>{S("col.payProof")}</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className={rowClass} data-sale-payment>
                  <Td className="whitespace-nowrap">
                    {formatDate(p.confirmedAt ?? p.createdAt, t)}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-medium tabular-nums">
                    {formatMoney(p.amount, p.currency, t)}
                  </Td>
                  <Td>{p.method ?? "—"}</Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={PAYMENT_TONE[p.status]}>
                      {t(`paymentStatus.${p.status}`)}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {p.orderId
                      ? S("ref.order", { n: String(p.orderNumber ?? "?") })
                      : S("ref.request", {
                          n: String(p.requestNumber ?? "?"),
                        })}
                  </Td>
                  <Td>{p.note ?? "—"}</Td>
                  <Td>
                    {p.proofDocumentId ? (
                      <a
                        href={`/api/files/${p.proofDocumentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className={linkClass}
                      >
                        {S("col.payProof")}
                      </a>
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title={S("notes")}>
          {orders.some((o) => o.notes) ? (
            <ul className="space-y-1 text-sm text-zinc-800" data-sale-notes>
              {orders
                .filter((o) => o.notes)
                .map((o) => (
                  <li key={o.id}>
                    {orders.length > 1 ? (
                      <span className="font-medium">#{o.number}: </span>
                    ) : null}
                    {o.notes}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">{S("notes.empty")}</p>
          )}
        </Card>
        <Card title={S("files")}>
          {sheet.documents.length === 0 ? (
            <p className="text-sm text-zinc-500">{S("files.empty")}</p>
          ) : (
            <ul className="space-y-1 text-sm" data-sale-files>
              {sheet.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <a
                    href={`/api/files/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className={linkClass}
                  >
                    {d.name}
                  </a>
                  <span className="text-xs text-zinc-500">
                    {formatDate(d.createdAt, t)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="mt-4 flex justify-end print:hidden">
        <ChatOpenButton target={{ orderId: order.id }} label={t("chat.open")} />
      </div>
    </>
  );
}
