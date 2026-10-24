import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { missingForCompletion } from "@/lib/services/purchase-sheet-calc";
import { getT } from "@/i18n/server";
import { listLinksForProducts } from "@/lib/services/product-suppliers";
import { variantsByProduct } from "@/lib/services/product-variants";
import { referenceVariant } from "@/lib/variants";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Textarea,
  Th,
  formatMoney,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveProductAction } from "../actions";
import {
  deleteProductsAction,
  purgeProductsAction,
  restoreProductsAction,
} from "../actions/products";
import { isAdmin } from "@/lib/auth/permissions";
import { BulkDeleteBar, BulkSelectAll } from "@/components/bulk-delete";

const BULK_FORM = "products-bulk";

/** Origem do produto: manual, sourcing (visita na China) ou importação de planilha. */
const sourceTone = {
  manual: "neutral",
  sourcing: "brand",
  import: "info",
} as const;

export default async function ProductsPage({
  searchParams,
}: PageProps<"/app/products">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { error, view, deleted, restored, purged, blocked } =
    await searchParams;
  const showDeleted = view === "deleted";
  const t = await getT();
  const store = getStore();
  const [allProducts, lines, suppliers] = await Promise.all([
    store.list("products", { orderBy: "name" }),
    store.list("product_lines", { orderBy: "name" }),
    store.list("parties", { filter: { type: "supplier" } }),
  ]);
  // Excluídos (inativos) ficam fora da lista, em "Ver excluídos".
  const deletedCount = allProducts.filter((p) => !p.active).length;
  const products = allProducts.filter((p) =>
    showDeleted ? !p.active : p.active,
  );
  // Ficha mestre de cada produto (uma consulta): completa, parcial ou sem ficha.
  const masters = products.length
    ? await store.list("purchase_sheets", {
        filter: { orderId: products.map((p) => p.id) },
      })
    : [];
  // Fotos dos produtos (uma consulta): as 5 da ficha contam para "completa".
  const productPhotos = products.length
    ? await store.list("product_photos", {
        filter: { productId: products.map((p) => p.id) },
      })
    : [];
  const masterState = (productId: string) => {
    const m = masters.find((x) => x.orderId === productId);
    if (!m) return "none" as const;
    const kinds = productPhotos
      .filter((ph) => ph.productId === productId)
      .map((ph) => ph.kind as string);
    const missing = missingForCompletion(m, kinds).filter(
      (k) => k !== "lot1" && k !== "productionStartAt",
    );
    return missing.length ? ("partial" as const) : ("complete" as const);
  };
  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? "—") : "—";
  // Outros fornecedores de cada produto (além do principal), numa consulta.
  const links = await listLinksForProducts(products.map((p) => p.id));
  // Variações ativas (uma consulta): preço "a partir de" e selo "N variações".
  const variants = await variantsByProduct(products.map((p) => p.id));
  const otherSuppliers = (p: { id: string; supplierId: string | null }) =>
    new Set(
      links
        .filter((l) => l.productId === p.id && l.supplierId !== p.supplierId)
        .map((l) => l.supplierId),
    ).size;

  return (
    <>
      <PageHeader
        help={{
          body: "help.products.body",
          steps: "help.catalog.products.steps",
        }}
        t={t}
        title={t("products.title")}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/app/import?entity=products">
              {t("parties.import")}
            </LinkButton>
            <LinkButton
              href="/app/products/import"
              variant="primary"
              data-products-import-sheet
            >
              {t("sheetImport.title")}
            </LinkButton>
          </div>
        }
      />
      {error ? (
        <Alert tone="danger">
          {error === "nothing_deleted" ||
          error === "nothing_restored" ||
          error === "nothing_purged" ||
          error === "purge_blocked"
            ? t(`productDelete.error.${error}` as DictionaryKey)
            : t("common.error")}
        </Alert>
      ) : null}
      {deleted ? (
        <Alert tone="success">
          {t("productDelete.done", { n: Number(deleted) || 0 })}
        </Alert>
      ) : null}
      {purged ? (
        <Alert tone="success">
          {t("productDelete.purged", { n: Number(purged) || 0 })}
        </Alert>
      ) : null}
      {blocked ? (
        <Alert tone="warning">
          {t("productDelete.blocked", { n: Number(blocked) || 0 })}
        </Alert>
      ) : null}
      {restored ? (
        <Alert tone="success">
          {t("productDelete.restored", { n: Number(restored) || 0 })}
        </Alert>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {showDeleted ? (
          <>
            <h2 className="text-base font-semibold text-zinc-900">
              {t("productDelete.deletedTitle")}
            </h2>
            <TextLink href="/app/products" className="ml-auto">
              {t("productDelete.showActive")}
            </TextLink>
          </>
        ) : deletedCount > 0 ? (
          <TextLink
            href="/app/products?view=deleted"
            className="ml-auto"
            data-products-show-deleted
          >
            {t("productDelete.showDeleted", { n: deletedCount })}
          </TextLink>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 lg:col-span-2">
          {products.length > 0 ? (
            <BulkDeleteBar
              formId={BULK_FORM}
              action={
                showDeleted ? restoreProductsAction : deleteProductsAction
              }
              primaryTone={showDeleted ? "neutral" : "danger"}
              extra={
                showDeleted && isAdmin(user)
                  ? {
                      action: purgeProductsAction,
                      label: t("productDelete.purgeSelected"),
                      confirmText: t("productDelete.confirmPurge"),
                    }
                  : undefined
              }
              labels={{
                selectAll: t("productDelete.selectAll"),
                clear: t("productDelete.clear"),
                selected: t("productDelete.selected"),
                deleteSelected: showDeleted
                  ? t("productDelete.restoreSelected")
                  : t("productDelete.deleteSelected"),
                confirmMany: showDeleted
                  ? t("productDelete.confirmRestore")
                  : t("productDelete.confirmMany"),
              }}
            />
          ) : null}
          {products.length === 0 ? (
            <Empty>{t("common.none")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <BulkSelectAll
                      formId={BULK_FORM}
                      label={t("productDelete.selectAll")}
                    />
                  </Th>
                  <Th>{t("common.name")}</Th>
                  <Th>SKU</Th>
                  <Th>{t("nav.lines")}</Th>
                  <Th>{t("common.supplier")}</Th>
                  <Th className="text-right">{t("common.price")}</Th>
                  <Th className="text-right">{t("catalog.moq")}</Th>
                  <Th className="text-right">{t("catalog.cbmPerBox")}</Th>
                  <Th>{t("catalog.source")}</Th>
                  <Th>{t("productSheet.column")}</Th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className={rowClass} data-product-row={p.id}>
                    <Td className="w-10">
                      <input
                        type="checkbox"
                        name="ids"
                        value={p.id}
                        form={BULK_FORM}
                        aria-label={`${t("productDelete.selectOne")}: ${p.name}`}
                        className="h-4 w-4 accent-brand-600"
                        data-product-select={p.id}
                      />
                    </Td>
                    <Td className="font-medium">
                      <TextLink
                        href={`/app/products/${p.id}`}
                        className="text-zinc-900"
                        title={t("catalog.open")}
                      >
                        {p.name}
                      </TextLink>
                      {(variants.get(p.id)?.length ?? 0) > 0 ? (
                        <span
                          className="ml-1.5 align-middle"
                          data-product-variants={variants.get(p.id)!.length}
                        >
                          <Badge tone="brand">
                            {t("productVariants.count", {
                              n: variants.get(p.id)!.length,
                            })}
                          </Badge>
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-zinc-700">
                        {p.sku ?? "—"}
                      </span>
                    </Td>
                    <Td>{lines.find((l) => l.id === p.lineId)?.name ?? "—"}</Td>
                    <Td className="whitespace-nowrap">
                      {supplierName(p.supplierId)}
                      {otherSuppliers(p) ? (
                        <span
                          className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600"
                          title={t("productSuppliers.moreTitle", {
                            n: otherSuppliers(p),
                          })}
                        >
                          {t("productSuppliers.more", { n: otherSuppliers(p) })}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {/* Com variações: o preço é o da variação de referência, "a partir de". */}
                      {(() => {
                        const list = variants.get(p.id) ?? [];
                        const ref = referenceVariant(list);
                        if (ref && ref.price !== null)
                          return (
                            <span data-product-price-from>
                              {t("productVariants.from", {
                                price: formatMoney(ref.price, ref.currency, t),
                              })}
                            </span>
                          );
                        return p.price !== null
                          ? formatMoney(p.price, p.currency, t)
                          : "—";
                      })()}
                    </Td>
                    <Td className="text-right tabular-nums">{p.moq ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {p.cbm !== null
                        ? `${p.cbm.toLocaleString(t.intl, { maximumFractionDigits: 4 })} m³`
                        : "—"}
                    </Td>
                    <Td>
                      {p.source ? (
                        <Badge tone={sourceTone[p.source]}>
                          {t(`catalog.source.${p.source}` as DictionaryKey)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      {masterState(p.id) === "complete" ? (
                        <Badge tone="success">
                          {t("productSheet.badge.complete")}
                        </Badge>
                      ) : masterState(p.id) === "partial" ? (
                        <Badge tone="warning">
                          {t("productSheet.badge.partial")}
                        </Badge>
                      ) : (
                        t("productSheet.badge.none")
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        <Card title={`${t("common.new")} ${t("common.product").toLowerCase()}`}>
          <form action={saveProductAction} className="space-y-2">
            <Field label={t("common.name")}>
              <Input name="name" required />
            </Field>
            {/* SKU (curto) ao lado da linha. */}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
              <Field label="SKU">
                <Input name="sku" />
              </Field>
              <Field label={t("nav.lines")}>
                <Select name="lineId" required defaultValue="">
                  <option value="" disabled>
                    {t("common.select")}
                  </option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={t("requests.specification")}>
              <Textarea name="specification" rows={2} />
            </Field>
            <SubmitButton>{t("common.save")}</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
