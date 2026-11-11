import { LiveSearch } from "@/components/live-search";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getStore } from "@/lib/db";
import { missingForCompletion } from "@/lib/services/purchase-sheet-calc";
import { getT } from "@/i18n/server";
import {
  listLinksForProducts,
  listLinksForSupplier,
} from "@/lib/services/product-suppliers";
import { variantsByProduct } from "@/lib/services/product-variants";
import { referenceVariant } from "@/lib/variants";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Button,
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
import { IconLink } from "@/components/customer-account";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import {
  inProductFilter,
  matchesProduct,
  productPage,
  productPhotoList,
  readProductFilter,
} from "@/lib/services/product-list";

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
  requireScreen(user, "products");
  const sp = await searchParams;
  const { error, view, deleted, restored, purged, blocked } = sp;
  const filter = readProductFilter(sp);
  const filtering = !!(filter.q || filter.lineId || filter.supplierId);
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
  const listed = allProducts.filter((p) =>
    showDeleted ? !p.active : p.active,
  );
  const supplierNames = new Map(suppliers.map((s) => [s.id, s.name]));
  const supplierName = (id: string | null) =>
    id ? (supplierNames.get(id) ?? "—") : "—";
  // Filtro por fornecedor: também os produtos em que ele é vinculado (uma
  // consulta pelo fornecedor, não pelos produtos todos).
  const linkedToFilter = new Set(
    filter.supplierId
      ? (await listLinksForSupplier(filter.supplierId)).map((l) => l.productId)
      : [],
  );
  const filterSupplier: ReadonlySet<string> = new Set(
    filter.supplierId ? [filter.supplierId] : [],
  );
  const noSupplier: ReadonlySet<string> = new Set();
  // Busca e filtros (linha, fornecedor principal ou vinculado) pela URL.
  const products = listed.filter(
    (p) =>
      inProductFilter(
        p,
        filter,
        linkedToFilter.has(p.id) ? filterSupplier : noSupplier,
      ) && matchesProduct(p, supplierName(p.supplierId), filter.q),
  );
  // Uma página por vez: ficha, fotos, variações e vínculos só dos produtos
  // mostrados (o cadastro tem dezenas de milhares de produtos).
  const paging = productPage(products.length, sp.page);
  const visible = products.slice(paging.start, paging.end);
  const visibleIds = visible.map((p) => p.id);
  // Outros fornecedores de cada produto (além do principal), numa consulta.
  const links = await listLinksForProducts(visibleIds);
  const listQuery = () => {
    const q = new URLSearchParams();
    if (filter.q) q.set("q", filter.q);
    if (filter.lineId) q.set("line", filter.lineId);
    if (filter.supplierId) q.set("supplier", filter.supplierId);
    const out = q.toString();
    return out ? `?${out}` : "";
  };
  /** Endereço de outra página, com a busca, os filtros e "Ver excluídos". */
  const pageHref = (n: number) => {
    const q = new URLSearchParams(listQuery());
    if (showDeleted) q.set("view", "deleted");
    if (n > 1) q.set("page", String(n));
    const out = q.toString();
    return `/app/products${out ? `?${out}` : ""}`;
  };
  // Ficha mestre de cada produto (uma consulta): completa, parcial ou sem ficha.
  const masters = visibleIds.length
    ? await store.list("purchase_sheets", {
        filter: { orderId: visibleIds },
      })
    : [];
  // Fotos dos produtos (uma consulta): as 5 da ficha contam para "completa".
  const productPhotos = visibleIds.length
    ? await store.list("product_photos", {
        filter: { productId: visibleIds },
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
  // Variações ativas (uma consulta): preço "a partir de" e selo "N variações".
  const variants = await variantsByProduct(visibleIds);
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
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form
          method="get"
          action="/app/products"
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          data-product-search
        >
          {showDeleted ? (
            <input type="hidden" name="view" value="deleted" />
          ) : null}
          <Input
            name="q"
            defaultValue={filter.q}
            placeholder={t("prodList.search")}
            aria-label={t("prodList.search")}
            className="w-full max-w-md"
          />
          <LiveSearch />
          <Select
            name="line"
            defaultValue={filter.lineId}
            aria-label={t("nav.lines")}
            className="w-auto"
          >
            <option value="">{t("prodList.allLines")}</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          <Select
            name="supplier"
            defaultValue={filter.supplierId}
            aria-label={t("common.supplier")}
            className="w-auto"
          >
            <option value="">{t("prodList.allSuppliers")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary">
            {t("prodList.searchButton")}
          </Button>
          {filtering ? (
            <TextLink
              href={
                showDeleted ? "/app/products?view=deleted" : "/app/products"
              }
            >
              {t("prodList.clear")}
            </TextLink>
          ) : null}
        </form>
        <span className="text-sm text-zinc-500" data-product-total>
          {t("prodList.total", { n: products.length })}
        </span>
        {!showDeleted ? (
          <LinkButton
            href={`/app/products/export${listQuery()}`}
            data-product-export
          >
            {t("prodList.export")}
          </LinkButton>
        ) : null}
      </div>
      {/* Novo produto: formulário curto que abre sob o botão; a tabela usa a largura toda. */}
      <details
        className="mt-3 rounded-2xl border border-zinc-200/80 bg-white shadow-sm [&[open]>summary]:border-b [&[open]>summary]:border-zinc-200/80"
        data-product-new
      >
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-brand-700">
          + {t("prodList.new")}
        </summary>
        <div className="p-4">
          <Card
            title={`${t("common.new")} ${t("common.product").toLowerCase()}`}
          >
            <form
              action={saveProductAction}
              className="grid gap-2 md:grid-cols-4 md:items-end"
            >
              <Field label={t("common.name")}>
                <Input name="name" required />
              </Field>
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
              <Field label={t("requests.specification")}>
                <Textarea name="specification" rows={1} />
              </Field>
              <div className="md:col-span-4">
                <SubmitButton>{t("common.save")}</SubmitButton>
              </div>
            </form>
          </Card>
        </div>
      </details>
      <div className="mt-4">
        <div className="min-w-0">
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
            <Empty>{filtering ? t("prodList.empty") : t("common.none")}</Empty>
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
                  <Th className="w-14">{t("prodList.col.photo")}</Th>
                  <Th>{t("prodList.col.category")}</Th>
                  <Th>{t("common.name")}</Th>
                  <Th>SKU</Th>
                  <Th>{t("prodList.col.supplierSku")}</Th>
                  <Th>{t("nav.lines")}</Th>
                  <Th className="text-right">{t("common.price")}</Th>
                  <Th className="text-right">{t("catalog.moq")}</Th>
                  <Th>{t("prodList.col.box")}</Th>
                  <Th>{t("prodList.col.material")}</Th>
                  <Th>{t("prodList.col.notes")}</Th>
                  <Th>{t("common.supplier")}</Th>
                  <Th>{t("catalog.source")}</Th>
                  <Th>{t("productSheet.column")}</Th>
                  <Th className="text-right">{t("prodList.col.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
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
                    <Td className="w-14">
                      <PhotoGallery
                        name={p.name}
                        {...galleryProps(t, productPhotoList(p, productPhotos))}
                      />
                    </Td>
                    <Td>
                      <span
                        className="block max-w-40 truncate"
                        title={p.category ?? undefined}
                      >
                        {p.category ?? "—"}
                      </span>
                    </Td>
                    <Td className="min-w-48 font-medium">
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
                      <span className="whitespace-nowrap font-mono text-xs text-zinc-700">
                        {p.sku ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-zinc-700">
                        {p.supplierSku ?? "—"}
                      </span>
                    </Td>
                    <Td>{lines.find((l) => l.id === p.lineId)?.name ?? "—"}</Td>
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
                    <Td className="whitespace-nowrap tabular-nums">
                      {p.masterBoxQty !== null || p.cbm !== null ? (
                        <>
                          {p.masterBoxQty !== null
                            ? t("prodList.boxQty", { n: p.masterBoxQty })
                            : "—"}
                          {p.cbm !== null ? (
                            <span className="block text-xs text-zinc-500">
                              {`${p.cbm.toLocaleString(t.intl, { maximumFractionDigits: 4 })} m³`}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <span
                        className="block max-w-40 truncate"
                        title={
                          [p.material, p.color].filter(Boolean).join(" / ") ||
                          undefined
                        }
                      >
                        {[p.material, p.color].filter(Boolean).join(" / ") ||
                          "—"}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="block max-w-48 truncate"
                        title={p.notes ?? undefined}
                      >
                        {p.notes ?? "—"}
                      </span>
                    </Td>
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
                    <Td className="text-right">
                      <IconLink
                        href={`/app/products/${p.id}`}
                        icon="pencil"
                        label={t("prodList.edit")}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {paging.pages > 1 ? (
            <nav
              className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600"
              aria-label={t("prodList.page.label")}
              data-product-pager={paging.page}
              data-product-pages={paging.pages}
            >
              <span>
                {t("prodList.page.showing", {
                  from: paging.start + 1,
                  to: paging.end,
                  n: products.length,
                })}
              </span>
              <span className="flex items-center gap-2">
                {paging.page > 1 ? (
                  <LinkButton
                    href={pageHref(paging.page - 1)}
                    data-product-page-prev
                  >
                    {t("prodList.page.prev")}
                  </LinkButton>
                ) : null}
                <span>
                  {t("prodList.page.of", {
                    page: paging.page,
                    pages: paging.pages,
                  })}
                </span>
                {paging.page < paging.pages ? (
                  <LinkButton
                    href={pageHref(paging.page + 1)}
                    data-product-page-next
                  >
                    {t("prodList.page.next")}
                  </LinkButton>
                ) : null}
              </span>
            </nav>
          ) : null}
        </div>
      </div>
    </>
  );
}
