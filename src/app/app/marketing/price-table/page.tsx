import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { priceTable } from "@/lib/services/price-table";
import {
  Card,
  Empty,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  formatMoney,
} from "@/components/ui";

/** Tabela de preços (Fase F): último preço praticado por produto. Só a Wellmix. */
export default async function PriceTablePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isWellmix(user)) notFound();
  const t = await getT();
  const rows = await priceTable(user);
  return (
    <div className="space-y-4">
      <PageHeader
        title={t("priceTable.title")}
        subtitle={t("priceTable.subtitle")}
        actions={
          <a
            href="/api/marketing/price-table"
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            data-price-table-csv
          >
            {t("priceTable.csv")}
          </a>
        }
      />
      <Card>
        {!rows.length ? (
          <Empty>{t("priceTable.empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("priceTable.product")}</Th>
                <Th>{t("priceTable.line")}</Th>
                <Th>{t("priceTable.moq")}</Th>
                <Th>{t("priceTable.unitPrice")}</Th>
                <Th>{t("priceTable.fob")}</Th>
                <Th>{t("priceTable.soldAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId} data-price-row={r.productId}>
                  <Td>
                    {r.name}
                    {r.sku ? (
                      <span className="text-zinc-500"> · {r.sku}</span>
                    ) : null}
                  </Td>
                  <Td>{r.line}</Td>
                  <Td>{r.moq?.toLocaleString(t.intl) ?? "—"}</Td>
                  <Td>
                    {r.unitPrice !== null
                      ? formatMoney(r.unitPrice, r.currency ?? "BRL", t)
                      : "—"}
                  </Td>
                  <Td>
                    {r.fobUnit !== null
                      ? formatMoney(r.fobUnit, r.fobCurrency ?? "USD", t)
                      : "—"}
                  </Td>
                  <Td>{formatDate(r.soldAt, t)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
