import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { loadSaleSheet } from "@/lib/services/sale-sheet";
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
export default async function SaleSheetPage({
  params,
}: PageProps<"/app/customers/[id]/orders/[orderId]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  if (!isWellmix(user)) redirect("/app");
  const { id, orderId } = await params;
  const sheet = await loadSaleSheet(id, orderId);
  if (!sheet || !sheet.party) notFound();
  const t = await getT();
  const money = canOpen(user, "finance");
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
        ? t("sale.info.done", { date: formatDate(s.at, t) })
        : t("sale.info.planned", { date: formatDate(s.at, t) })
      : "—";
  const amountsText = [...totals.amounts]
    .map(([c, v]) => formatMoney(v, c, t))
    .join(" + ");

  return (
    <>
      <PageHeader
        t={t}
        title={t("sale.title", { n: order.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <TextLink href={`/app/customers/${party.id}`}>
              {party.name}
            </TextLink>
            {orders.length > 1 ? (
              <span className="text-zinc-500" data-sale-batch>
                {t("sale.batch", {
                  n: orders.length,
                  list: orders.map((o) => `#${o.number}`).join(", "),
                })}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <LinkButton href={`/app/customers/${party.id}`}>
              {t("sale.back")}
            </LinkButton>
            <LinkButton
              href={`/app/customers/${party.id}/orders/${order.id}/export`}
              data-sale-export
            >
              {t("sale.export")}
            </LinkButton>
            <PrintButton label={t("sale.print")} />
            {money ? (
              <LinkButton href={`/app/orders/${order.id}#payments`}>
                {t("sale.receive")}
              </LinkButton>
            ) : null}
            <LinkButton
              href={`/app/orders/${order.id}`}
              variant="primary"
              data-sale-open-full
            >
              {t("sale.openFull")}
            </LinkButton>
          </>
        }
      />
      <p className="-mt-3 mb-4 text-sm text-zinc-600 print:hidden">
        {t("sale.subtitle")}
      </p>

      {/* Cabeçalho do pedido, como no topo da nota de venda. */}
      <Card dense>
        <dl
          className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4"
          data-sale-info
        >
          {(
            [
              [t("sale.info.date"), formatDate(order.createdAt, t)],
              [t("sale.info.shipping"), stageText(sheet.shipping)],
              [t("sale.info.delivery"), stageText(sheet.delivery)],
              [
                t("sale.info.status"),
                t(`stage.${order.status}` as DictionaryKey),
              ],
              [t("sale.info.owner"), owner?.name ?? "—"],
              [
                t("sale.info.address"),
                [party.address, party.city].filter(Boolean).join(" · ") || "—",
              ],
              ...(money
                ? ([
                    [
                      t("sale.info.contract"),
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
          {t("sale.items")}
        </h2>
        {lines.length === 0 ? (
          <Empty>{t("common.none")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-10 text-right">{t("sale.col.n")}</Th>
                <Th className="w-14">{t("sale.col.photo")}</Th>
                <Th>{t("sale.col.product")}</Th>
                <Th>{t("sale.col.code")}</Th>
                <Th>{t("sale.col.supplierSku")}</Th>
                <Th>{t("sale.col.spec")}</Th>
                <Th>{t("sale.col.color")}</Th>
                <Th className="text-right">{t("sale.col.weight")}</Th>
                <Th className="text-right">{t("sale.col.qty")}</Th>
                <Th className="text-right">{t("sale.col.perBox")}</Th>
                <Th className="text-right">{t("sale.col.boxes")}</Th>
                <Th className="text-right">{t("sale.col.cbm")}</Th>
                {money ? (
                  <>
                    <Th className="text-right">{t("sale.col.price")}</Th>
                    <Th className="text-right">{t("sale.col.amount")}</Th>
                  </>
                ) : null}
                <Th className="text-right">{t("sale.col.delivered")}</Th>
                <Th>{t("sale.col.order")}</Th>
                <Th>{t("sale.col.notes")}</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr
                  key={`${l.orderId}-${i}`}
                  className={cx(
                    rowClass,
                    l.orderStatus === "CANCELLED" && "opacity-60",
                  )}
                  data-sale-line={l.orderNumber}
                >
                  <Td className="text-right tabular-nums">{i + 1}</Td>
                  <Td className="w-14">
                    <PhotoGallery
                      name={l.name}
                      {...galleryProps(t, l.photos)}
                    />
                  </Td>
                  <Td className="min-w-44 font-medium">
                    {l.productId ? (
                      <TextLink
                        href={`/app/products/${l.productId}`}
                        className="text-zinc-900"
                      >
                        {l.name}
                      </TextLink>
                    ) : (
                      l.name
                    )}
                    {l.variantName ? (
                      <span className="block text-xs font-normal text-zinc-500">
                        {l.variantName}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <span className="whitespace-nowrap font-mono text-xs text-zinc-700">
                      {l.sku ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <span className="whitespace-nowrap font-mono text-xs text-zinc-700">
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
                  <Td>{l.color ?? "—"}</Td>
                  <Td className="text-right tabular-nums">
                    {l.weightKg !== null ? num(l.weightKg) : "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-right font-semibold tabular-nums">
                    {num(l.quantity, 0)} {l.unit}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {l.unitsPerBox ?? "—"}
                  </Td>
                  <Td className="text-right tabular-nums">{num(l.boxes, 0)}</Td>
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
              ))}
              <tr className="bg-amber-50/60 font-semibold" data-sale-total>
                <Td colSpan={7}>{t("sale.total")}</Td>
                <Td className="text-right tabular-nums">
                  {num(totals.weightKg)}
                </Td>
                <Td className="text-right tabular-nums">
                  {num(totals.quantity, 0)}
                </Td>
                <Td />
                <Td className="text-right tabular-nums">
                  {num(totals.boxes, 0)}
                </Td>
                <Td className="text-right tabular-nums">
                  {num(totals.cbm, 3)}
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
            {t("sale.collect")}
          </h2>
          {money ? (
            <>
              <span className="text-sm text-zinc-700">
                {t("sale.collect.delivered", {
                  v: formatMoney(
                    sum((r) => r.delivered),
                    currency,
                    t,
                  ),
                })}
              </span>
              <span className="text-sm text-emerald-700">
                {t("sale.collect.received", {
                  v: formatMoney(
                    sum((r) => r.received),
                    currency,
                    t,
                  ),
                })}
              </span>
              <a
                href={`/app/orders/${order.id}#payments`}
                className={cx(linkClass, "text-sm")}
              >
                {t("sale.collect.open", {
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
          <Empty>{t("sale.money.hidden")}</Empty>
        ) : payments.length === 0 ? (
          <Empty>{t("sale.collect.empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("sale.col.payDate")}</Th>
                <Th className="text-right">{t("sale.col.payAmount")}</Th>
                <Th>{t("sale.col.payMethod")}</Th>
                <Th>{t("sale.col.payStatus")}</Th>
                <Th>{t("sale.col.payRef")}</Th>
                <Th>{t("sale.col.payNote")}</Th>
                <Th>{t("sale.col.payProof")}</Th>
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
                      ? t("sale.ref.order", { n: String(p.orderNumber ?? "?") })
                      : t("sale.ref.request", {
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
                        {t("sale.col.payProof")}
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
        <Card title={t("sale.notes")}>
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
            <p className="text-sm text-zinc-500">{t("sale.notes.empty")}</p>
          )}
        </Card>
        <Card title={t("sale.files")}>
          {sheet.documents.length === 0 ? (
            <p className="text-sm text-zinc-500">{t("sale.files.empty")}</p>
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
