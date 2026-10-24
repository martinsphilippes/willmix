import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import {
  SHEET_IMPORT_ENTITY,
  batchProductIds,
} from "@/lib/services/product-sheet-import";
import { missingForCompletion } from "@/lib/services/purchase-sheet-calc";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  formatMoney,
  rowClass,
  type Tone,
} from "@/components/ui";

/*
 * Resultado de uma importação da ficha técnica: cada produto criado ou
 * atualizado com o fornecedor, o preço, as fotos que entraram e o que ainda
 * falta na ficha mestre (a mesma regra do produto), sempre pelo estado atual.
 */
const STATUS_TONE: Record<string, Tone> = {
  created: "success",
  updated: "info",
  error: "danger",
};

export default async function ProductSheetImportResultPage({
  params,
}: PageProps<"/app/products/import/[batchId]">) {
  const { batchId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const t = await getT();
  const store = getStore();
  const batch = await store.get("import_batches", batchId);
  if (!batch || batch.entity !== SHEET_IMPORT_ENTITY) notFound();
  const ids = batchProductIds(batch);
  const [products, sheets, photos, suppliers] = await Promise.all([
    ids.length ? store.list("products", { filter: { id: ids } }) : [],
    ids.length
      ? store.list("purchase_sheets", { filter: { orderId: ids } })
      : [],
    ids.length
      ? store.list("product_photos", { filter: { productId: ids } })
      : [],
    store.list("parties", { filter: { type: "supplier" } }),
  ]);
  const rows = Object.entries(batch.decisions)
    .map(([index, decision]) => {
      const sep = decision.indexOf(":");
      const status = decision.slice(0, sep);
      const value = decision.slice(sep + 1);
      const product = status === "error" ? null : products.find((p) => p.id === value) ?? null;
      const sheet = product ? sheets.find((s) => s.orderId === product.id) ?? null : null;
      const kinds = product
        ? photos.filter((p) => p.productId === product.id).map((p) => p.kind as string)
        : [];
      // Lotes e início da produção são de cada compra, não da ficha mestre.
      const missing = product
        ? missingForCompletion(sheet, kinds).filter(
            (m) => m !== "lot1" && m !== "productionStartAt",
          )
        : [];
      return {
        index: Number(index),
        status,
        error: status === "error" ? value : null,
        product,
        sheet,
        photos: kinds.length,
        missing,
        supplier: product?.supplierId
          ? (suppliers.find((s) => s.id === product.supplierId)?.name ?? "—")
          : "—",
      };
    })
    .sort((a, b) => a.index - b.index);
  const s = batch.summary ?? {};
  const incomplete = rows.filter((r) => r.product && r.missing.length).length;

  return (
    <>
      <PageHeader
        help={{ body: "help.sheetImport.body" }}
        t={t}
        title={t("sheetImport.result.title", { file: batch.fileName })}
        subtitle={t("sheetImport.result.summary", {
          created: s.created ?? 0,
          updated: s.updated ?? 0,
          errors: s.errors ?? 0,
          suppliers: s.suppliersCreated ?? 0,
          photos: s.photos ?? 0,
        })}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/app/products/import">
              {t("sheetImport.result.again")}
            </LinkButton>
            <LinkButton href="/app/products" variant="primary">
              {t("sheetImport.result.goList")}
            </LinkButton>
          </div>
        }
      />
      <div className="mb-3">
        {rows.length === 0 ? null : incomplete > 0 ? (
          <Alert tone="warning">
            {t("sheetImport.result.incomplete", { n: incomplete })}
          </Alert>
        ) : (
          <Alert tone="success">{t("sheetImport.result.allComplete")}</Alert>
        )}
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty>{t("common.none")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("sheetImport.result.product")}</Th>
                <Th>{t("common.supplier")}</Th>
                <Th className="text-right">{t("common.price")}</Th>
                <Th className="text-right">{t("sheetImport.result.photos")}</Th>
                <Th>{t("sheetImport.result.missing")}</Th>
                <Th>{t("sheetImport.result.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.index}
                  className={rowClass}
                  data-sheet-import-row={r.status}
                >
                  <Td>
                    {r.product ? (
                      <TextLink href={`/app/products/${r.product.id}`}>
                        {r.product.name}
                      </TextLink>
                    ) : (
                      <span className="text-zinc-500">
                        {t("sheetImport.result.group", { n: r.index + 1 })}
                      </span>
                    )}
                    {r.product?.supplierSku ? (
                      <span className="ml-2 font-mono text-xs text-zinc-500">
                        {" "}
                        {r.product.supplierSku}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{r.supplier}</Td>
                  <Td className="text-right tabular-nums">
                    {r.product?.price !== null && r.product?.price !== undefined
                      ? formatMoney(r.product.price, r.product.currency, t)
                      : "—"}
                  </Td>
                  <Td className="text-right tabular-nums">{r.product ? r.photos : "—"}</Td>
                  <Td>
                    {r.error ? (
                      <span className="text-sm text-red-700">{r.error}</span>
                    ) : r.missing.length === 0 ? (
                      <Badge tone="success">{t("sheetImport.result.complete")}</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-1" data-sheet-import-missing={r.missing.length}>
                        {r.missing.map((m) => (
                          <Badge key={m} tone="warning">
                            {t(`sheet.field.${m}` as DictionaryKey)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {t(`sheetImport.status.${r.status}` as DictionaryKey)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
