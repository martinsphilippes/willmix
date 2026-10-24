import { Fragment } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import {
  SHEET_IMPORT_ENTITY,
  batchDecision,
  batchProductIds,
  batchVariantDecisions,
  importBatchMode,
} from "@/lib/services/product-sheet-import";
import { getProductVariants } from "@/lib/services/product-variants";
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
 * No modo "um produto com variações", o produto único traz a lista das
 * variações criadas/atualizadas (nome, preço, MOQ, foto, situação).
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
  const mode = importBatchMode(batch);
  const ids = batchProductIds(batch);
  const variantDecisions =
    mode === "variants" ? batchVariantDecisions(batch) : [];
  const [products, sheets, photos, suppliers, variants] = await Promise.all([
    ids.length ? store.list("products", { filter: { id: ids } }) : [],
    ids.length
      ? store.list("purchase_sheets", { filter: { orderId: ids } })
      : [],
    ids.length
      ? store.list("product_photos", { filter: { productId: ids } })
      : [],
    store.list("parties", { filter: { type: "supplier" } }),
    getProductVariants(
      variantDecisions
        .map((v) => v.variantId)
        .filter((id): id is string => !!id),
    ),
  ]);
  const rows = Object.entries(batch.decisions)
    .filter(([key]) => !key.startsWith("variant:"))
    .map(([index, decision]) => {
      const { status, productId, error } = batchDecision(decision);
      const product = productId
        ? (products.find((p) => p.id === productId) ?? null)
        : null;
      const sheet = product
        ? (sheets.find((s) => s.orderId === product.id) ?? null)
        : null;
      const kinds = product
        ? photos
            .filter((p) => p.productId === product.id)
            .map((p) => p.kind as string)
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
        error,
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
  // Variações do lote (modo "variants"), pelo estado atual de cada uma.
  const variantRows = variantDecisions.map((d) => ({
    ...d,
    variant: d.variantId
      ? (variants.find((v) => v.id === d.variantId) ?? null)
      : null,
  }));
  const s = batch.summary ?? {};
  const incomplete = rows.filter(
    (r) => r.status !== "error" && r.product && r.missing.length,
  ).length;
  const failed = rows.filter((r) => r.status === "error").length;
  const variantsFailed = variantRows.filter((v) => v.status === "error").length;
  const summaryText = t("sheetImport.result.summary", {
    created: s.created ?? 0,
    updated: s.updated ?? 0,
    errors: s.errors ?? 0,
    suppliers: s.suppliersCreated ?? 0,
    photos: s.photos ?? 0,
  });

  return (
    <>
      <PageHeader
        help={{ body: "help.sheetImport.body" }}
        t={t}
        title={t("sheetImport.result.title", { file: batch.fileName })}
        subtitle={
          mode === "variants"
            ? `${summaryText} · ${t("sheetImport.result.variantsSummary", {
                created: s.variantsCreated ?? 0,
                updated: s.variantsUpdated ?? 0,
                errors: s.variantErrors ?? 0,
              })}`
            : summaryText
        }
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
      <div className="mb-3 space-y-2">
        {failed > 0 ? (
          <Alert tone="danger">
            {t("sheetImport.result.failed", { n: failed })}
          </Alert>
        ) : null}
        {variantsFailed > 0 ? (
          <Alert tone="danger">
            {t("sheetImport.result.variantErrors", { n: variantsFailed })}
          </Alert>
        ) : null}
        {rows.length === 0 ? null : incomplete > 0 ? (
          <Alert tone="warning">
            {t("sheetImport.result.incomplete", { n: incomplete })}
          </Alert>
        ) : failed === 0 ? (
          <Alert tone="success">{t("sheetImport.result.allComplete")}</Alert>
        ) : null}
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
                <Fragment key={r.index}>
                  <tr className={rowClass} data-sheet-import-row={r.status}>
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
                      {r.product?.price !== null &&
                      r.product?.price !== undefined
                        ? formatMoney(r.product.price, r.product.currency, t)
                        : "—"}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {r.product ? r.photos : "—"}
                    </Td>
                    <Td>
                      {r.error ? (
                        <span className="text-sm text-red-700">
                          {t("sheetImport.result.error", { code: r.error })}
                        </span>
                      ) : r.missing.length === 0 ? (
                        <Badge tone="success">
                          {t("sheetImport.result.complete")}
                        </Badge>
                      ) : (
                        <div
                          className="flex flex-wrap gap-1"
                          data-sheet-import-missing={r.missing.length}
                        >
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
                  {/* Modo "variants": a lista das variações ocupa a largura toda da tabela. */}
                  {mode === "variants" && variantRows.length ? (
                    <tr
                      className="bg-zinc-50/60"
                      data-sheet-import-variants-row
                    >
                      <Td colSpan={6} className="pt-0">
                        {/* Modo "variants": as variações do produto, na ordem da planilha. */}
                        {mode === "variants" && variantRows.length ? (
                          <div className="mt-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              {t("sheetImport.result.variants")} (
                              {variantRows.length})
                            </p>
                            <ul
                              className="mt-1 divide-y divide-zinc-100 rounded-md border border-zinc-200 text-xs"
                              data-sheet-import-variants={variantRows.length}
                            >
                              {variantRows.map((v) => (
                                <li
                                  key={v.index}
                                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1"
                                  data-sheet-import-variant={v.status}
                                >
                                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">
                                    {v.variant?.name ??
                                      t("sheetImport.result.group", {
                                        n: v.index + 1,
                                      })}
                                    {v.variant?.factoryItemCode ? (
                                      <span className="ml-1.5 font-mono font-normal text-zinc-500">
                                        {v.variant.factoryItemCode}
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="tabular-nums text-zinc-700">
                                    {v.variant?.price != null
                                      ? formatMoney(
                                          v.variant.price,
                                          v.variant.currency,
                                          t,
                                        )
                                      : "—"}
                                  </span>
                                  <span className="tabular-nums text-zinc-600">
                                    {t("catalog.moq")}{" "}
                                    {v.variant?.moq != null
                                      ? v.variant.moq.toLocaleString(t.intl)
                                      : "—"}
                                  </span>
                                  <span className="text-zinc-600">
                                    {v.variant?.photoDocumentId
                                      ? t("sheetImport.result.variantPhoto")
                                      : t("sheetImport.result.variantNoPhoto")}
                                  </span>
                                  {v.error ? (
                                    <span className="text-red-700">
                                      {t("sheetImport.result.error", {
                                        code: v.error,
                                      })}
                                    </span>
                                  ) : null}
                                  <Badge
                                    tone={STATUS_TONE[v.status] ?? "neutral"}
                                  >
                                    {t(
                                      `sheetImport.status.${v.status}` as DictionaryKey,
                                    )}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </Td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
