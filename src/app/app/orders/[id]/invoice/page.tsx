import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getT } from "@/i18n/server";
import { canSeeStep } from "@/lib/services/import-flow";
import { PageHeader } from "@/components/ui";

/*
 * Invoice comercial e packing list gerados dos dados do pedido (itens, preço
 * da cotação e ficha de compra: caixas, pesos e CBM). O comex confere,
 * imprime em PDF e envia no passo "Invoice e packing list"; o fornecedor
 * valida e devolve assinado. Só quem vê esse passo abre a página.
 */
export default async function InvoicePage({
  params,
}: PageProps<"/app/orders/[id]/invoice">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const store = getStore();
  const order = await store.get("orders", id);
  if (!order || !canSeeStep(user, order, "invoice_packing")) notFound();
  const t = await getT();
  const [items, supplier, [sheet], settings] = await Promise.all([
    store.list("order_items", { filter: { orderId: order.id } }),
    store.get("parties", order.supplierId),
    store.list("purchase_sheets", { filter: { orderId: order.id }, limit: 1 }),
    getSettings(),
  ]);
  const currency = order.fobCurrency ?? sheet?.currency ?? "USD";
  const perCarton = sheet?.masterCartonQty ?? null;
  const rows = items.map((item) => {
    const unitPrice = item.unitPrice ?? sheet?.price ?? null;
    const cartons =
      perCarton && perCarton > 0 ? Math.ceil(item.quantity / perCarton) : null;
    return {
      item,
      unitPrice,
      total: unitPrice !== null ? unitPrice * item.quantity : null,
      cartons,
      net:
        sheet?.netWeightPcKg != null
          ? sheet.netWeightPcKg * item.quantity
          : null,
      gross:
        sheet?.grossWeightPcKg != null
          ? sheet.grossWeightPcKg * item.quantity
          : null,
      cbm:
        cartons !== null && sheet?.cbmPerCarton != null
          ? cartons * sheet.cbmPerCarton
          : null,
    };
  });
  const sum = (k: "total" | "cartons" | "net" | "gross" | "cbm") =>
    rows.every((r) => r[k] !== null)
      ? rows.reduce((acc, r) => acc + (r[k] ?? 0), 0)
      : null;
  const fmt = (n: number | null, digits = 2) =>
    n === null
      ? "—"
      : n.toLocaleString(t.intl, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        });
  const today = new Date().toISOString().slice(0, 10);

  const head = (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <p className="font-semibold">{t("importFlow.invoice.exporter")}</p>
        <p>{supplier?.name ?? "—"}</p>
        <p>
          {[supplier?.address, supplier?.city, supplier?.country]
            .filter(Boolean)
            .join(", ")}
        </p>
      </div>
      <div>
        <p className="font-semibold">{t("importFlow.invoice.importer")}</p>
        <p>{settings.importerName}</p>
        <p>
          {t("importFlow.invoice.orderRef", { n: String(order.number) })} ·{" "}
          {today}
          {sheet?.incoterm ? ` · ${sheet.incoterm}` : ""}
        </p>
      </div>
    </div>
  );
  const cell = "border border-zinc-300 px-2 py-1";

  return (
    <div className="mx-auto max-w-4xl space-y-8 bg-white p-4 print:p-0">
      <PageHeader
        title={t("importFlow.invoice.title", { n: String(order.number) })}
        subtitle={t("importFlow.invoice.hint")}
      />
      <section data-invoice>
        <h2 className="mb-3 text-lg font-bold">COMMERCIAL INVOICE</h2>
        {head}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-50">
              <th className={cell}>{t("importFlow.invoice.item")}</th>
              <th className={cell}>{t("importFlow.invoice.qty")}</th>
              <th className={cell}>{t("importFlow.invoice.unitPrice")}</th>
              <th className={cell}>{t("importFlow.invoice.total")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item.id}>
                <td className={cell}>
                  {r.item.name}
                  {r.item.variant?.name ? ` · ${r.item.variant.name}` : ""}
                </td>
                <td className={`${cell} text-right tabular-nums`}>
                  {r.item.quantity.toLocaleString(t.intl)} {r.item.unit}
                </td>
                <td className={`${cell} text-right tabular-nums`}>
                  {currency} {fmt(r.unitPrice, 4)}
                </td>
                <td className={`${cell} text-right tabular-nums`}>
                  {currency} {fmt(r.total)}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={cell} colSpan={3}>
                TOTAL {sheet?.incoterm ?? "FOB"}
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {currency} {fmt(sum("total"))}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <section data-packing>
        <h2 className="mb-3 text-lg font-bold">PACKING LIST</h2>
        {head}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-50">
              <th className={cell}>{t("importFlow.invoice.item")}</th>
              <th className={cell}>{t("importFlow.invoice.qty")}</th>
              <th className={cell}>{t("importFlow.invoice.cartons")}</th>
              <th className={cell}>{t("importFlow.invoice.net")}</th>
              <th className={cell}>{t("importFlow.invoice.gross")}</th>
              <th className={cell}>CBM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.item.id}>
                <td className={cell}>{r.item.name}</td>
                <td className={`${cell} text-right tabular-nums`}>
                  {r.item.quantity.toLocaleString(t.intl)}
                </td>
                <td className={`${cell} text-right tabular-nums`}>
                  {fmt(r.cartons, 0)}
                </td>
                <td className={`${cell} text-right tabular-nums`}>
                  {fmt(r.net)}
                </td>
                <td className={`${cell} text-right tabular-nums`}>
                  {fmt(r.gross)}
                </td>
                <td className={`${cell} text-right tabular-nums`}>
                  {fmt(r.cbm, 3)}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={cell} colSpan={2}>
                TOTAL
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {fmt(sum("cartons"), 0)}
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {fmt(sum("net"))}
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {fmt(sum("gross"))}
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {fmt(sum("cbm"), 3)}
              </td>
            </tr>
          </tbody>
        </table>
        {!sheet ? (
          <p className="mt-2 text-sm text-amber-700">
            {t("importFlow.invoice.noSheet")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
