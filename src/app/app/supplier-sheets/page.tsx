import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import { listSupplierSheets } from "@/lib/services/supplier-sheets";
import {
  Badge,
  Card,
  OpenLink,
  PageHeader,
  Table,
  Td,
  Th,
  cx,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";

/*
 * Fichas técnicas dos fornecedores (dono, 20/11/2026; docs/PURCHASE_DEMAND.md,
 * "Ficha técnica na cotação"): o que cada fornecedor informou, confirmou ou
 * corrigiu, com as correções esperando a revisão do Cadastro primeiro. Fora
 * do menu: chega-se pelas Pendências e pelo comparativo da cotação.
 */
export default async function SupplierSheetsPage({
  searchParams,
}: PageProps<"/app/supplier-sheets">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "products");
  if (!isWellmix(user)) notFound();
  const sp = await searchParams;
  const t = await getT();
  const filter = sp.review === "all" ? "all" : "pending";
  const rows = await listSupplierSheets(user, { review: filter });
  const chip = (key: "pending" | "all", label: string) => (
    <Link
      href={`/app/supplier-sheets?review=${key}`}
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-medium",
        filter === key
          ? "border-brand-600 bg-brand-50 text-brand-800"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400",
      )}
      aria-current={filter === key ? "page" : undefined}
      data-supplier-sheets-filter={key}
    >
      {label}
    </Link>
  );
  return (
    <div data-supplier-sheets>
      <PageHeader
        t={t}
        title={t("supplierSheet.list.title")}
        subtitle={t("supplierSheet.list.subtitle")}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {chip("pending", t("supplierSheet.list.pending"))}
        {chip("all", t("supplierSheet.list.all"))}
      </div>
      <Card>
        {rows.length ? (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("common.product")}</Th>
                <Th>{t("quote.supplier")}</Th>
                <Th>{t("supplierSheet.board.col.kind")}</Th>
                <Th>{t("supplierSheet.list.col.review")}</Th>
                <Th>{t("supplierSheet.list.col.date")}</Th>
                <Th>
                  <span className="sr-only">{t("supplierSheet.open")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sheet, product, supplier }) => (
                <tr
                  key={sheet.id}
                  className={rowClass}
                  data-supplier-sheet-row={sheet.id}
                >
                  <Td>
                    {product
                      ? productNameText(t, product.name)
                      : sheet.productId}
                  </Td>
                  <Td>{supplier?.name ?? sheet.supplierId}</Td>
                  <Td>
                    <Badge
                      tone={sheet.kind === "corrected" ? "warning" : "neutral"}
                    >
                      {t(`supplierSheet.kind.${sheet.kind}`)}
                    </Badge>
                  </Td>
                  <Td>
                    {sheet.review ? (
                      <Badge
                        tone={
                          sheet.review === "pending"
                            ? "warning"
                            : sheet.review === "accepted"
                              ? "success"
                              : "neutral"
                        }
                      >
                        {t(`supplierSheet.review.${sheet.review}`)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="tabular-nums">
                    {formatDate(sheet.confirmedAt, t)}
                  </Td>
                  <Td>
                    <OpenLink
                      href={`/app/supplier-sheets/${sheet.id}`}
                      label={t("supplierSheet.open")}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-zinc-600" data-supplier-sheets-empty>
            {t("supplierSheet.list.empty")}
          </p>
        )}
      </Card>
      <p className="mt-3 text-xs text-zinc-500">
        <Link href="/app/products" className={linkClass}>
          {t("nav.products")}
        </Link>
      </p>
    </div>
  );
}
