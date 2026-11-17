import { LiveSearch } from "@/components/live-search";
import { AutoSubmit } from "@/components/auto-submit";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canSeePurchasePrice } from "@/lib/auth/function-access";
import { getStore } from "@/lib/db";
import { listColumns } from "@/lib/db/lookup";
import { PartyPicker } from "@/components/party-picker";
import { partyPickerLabels } from "@/components/party-picker-labels";
import { missingForCompletion } from "@/lib/services/purchase-sheet-calc";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
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
  Empty,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Th,
  formatMoney,
  rowClass,
} from "@/components/ui";
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
  readProductOrder,
  sortProducts,
} from "@/lib/services/product-list";
import { awaitingApproval } from "@/lib/product-approval";

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
  // Preço de compra: só com "Ver preço de compra" (docs/LINHA_DE_VISAO.md).
  const seesPrice = canSeePurchasePrice(user);
  const sp = await searchParams;
  const { error, view, deleted, restored, purged, blocked } = sp;
  const filter = readProductFilter(sp);
  // Ordem da lista inteira (nome ou mais recentes primeiro), antes das páginas.
  const order = readProductOrder(sp);
  const filtering = !!(filter.q || filter.lineId || filter.supplierId);
  const showDeleted = view === "deleted";
  // Produtos novos aguardando a aprovação (ou recusados): lista à parte, nem
  // ativos nem excluídos (docs/NEW_PRODUCT.md).
  const showApproval = view === "approval";
  const viewParam = showDeleted ? "deleted" : showApproval ? "approval" : null;
  const t = await getT();
  const store = getStore();
  const [allProducts, lines, suppliers] = await Promise.all([
    store.list("products", { orderBy: "name" }),
    store.list("product_lines", { orderBy: "name" }),
    // Fornecedores: só id e nome (nome na coluna e na busca); o filtro
    // escolhe por busca (~5,7 mil fornecedores não cabem numa lista).
    listColumns(store, "parties", ["name"], { filter: { type: "supplier" } }),
  ]);
  // Excluídos (inativos) ficam fora da lista, em "Ver excluídos"; os novos
  // aguardando a aprovação, em "Aguardando aprovação".
  const deletedCount = allProducts.filter(
    (p) => !p.active && !awaitingApproval(p),
  ).length;
  const approvalCount = allProducts.filter((p) => awaitingApproval(p)).length;
  const listed = allProducts.filter((p) =>
    showApproval
      ? awaitingApproval(p)
      : showDeleted
        ? !p.active && !awaitingApproval(p)
        : p.active,
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
  // Busca e filtros (linha, fornecedor principal ou vinculado) pela URL, no
  // catálogo inteiro; depois a ordem pedida.
  const products = sortProducts(
    listed.filter(
      (p) =>
        inProductFilter(
          p,
          filter,
          linkedToFilter.has(p.id) ? filterSupplier : noSupplier,
        ) && matchesProduct(p, supplierName(p.supplierId), filter.q),
    ),
    order,
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
  /** Endereço de outra página, com a busca, os filtros, a ordem e "Ver excluídos". */
  const pageHref = (n: number) => {
    const q = new URLSearchParams(listQuery());
    if (order !== "name") q.set("order", order);
    if (viewParam) q.set("view", viewParam);
    if (n > 1) q.set("page", String(n));
    const out = q.toString();
    return `/app/products${out ? `?${out}` : ""}`;
  };
  /** "Limpar": tira a busca e os filtros; a ordem e a lista escolhidas ficam. */
  const clearHref = (() => {
    const q = new URLSearchParams();
    if (viewParam) q.set("view", viewParam);
    if (order !== "name") q.set("order", order);
    const out = q.toString();
    return `/app/products${out ? `?${out}` : ""}`;
  })();
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
            {/* Novo produto: a ficha completa em branco (dono, 17/11/2026). */}
            <LinkButton
              href="/app/products/new"
              variant="primary"
              data-product-new
            >
              + {t("prodList.new")}
            </LinkButton>
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
            : error === "product_name_placeholder"
              ? t("productName.error.product_name_placeholder")
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
        {showDeleted || showApproval ? (
          <>
            <h2 className="text-base font-semibold text-zinc-900">
              {showApproval
                ? t("productApproval.listTitle")
                : t("productDelete.deletedTitle")}
            </h2>
            <TextLink href="/app/products" className="ml-auto">
              {t("productDelete.showActive")}
            </TextLink>
          </>
        ) : (
          <span className="ml-auto flex flex-wrap items-center gap-3">
            {approvalCount > 0 ? (
              <TextLink
                href="/app/products?view=approval"
                data-products-show-approval
              >
                {t("productApproval.showList", { n: approvalCount })}
              </TextLink>
            ) : null}
            {deletedCount > 0 ? (
              <TextLink
                href="/app/products?view=deleted"
                data-products-show-deleted
              >
                {t("productDelete.showDeleted", { n: deletedCount })}
              </TextLink>
            ) : null}
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Até o notebook (iPad, celular) a busca ocupa a linha inteira e o
            total e o "Exportar" descem; antes ela ficava espremida ao lado. */}
        <form
          method="get"
          action="/app/products"
          className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:w-auto lg:flex-1"
          data-product-search
        >
          {viewParam ? (
            <input type="hidden" name="view" value={viewParam} />
          ) : null}
          {/* A busca da tela (dono, 17/11/2026): procura no catálogo inteiro,
              não só na página; a tabela não tem outra caixa de busca. */}
          <span className="relative w-full max-w-md">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            >
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.2-4.2" />
            </svg>
            <Input
              type="search"
              name="q"
              defaultValue={filter.q}
              placeholder={t("prodList.search")}
              aria-label={t("prodList.search")}
              className="w-full border-zinc-400 pl-8"
              data-product-search-input
            />
          </span>
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
          {/* Vazio = todos os fornecedores, como a opção da lista antiga. */}
          <PartyPicker
            name="supplier"
            type="supplier"
            initial={
              filter.supplierId
                ? {
                    id: filter.supplierId,
                    name: supplierNames.get(filter.supplierId) ?? "—",
                  }
                : null
            }
            ariaLabel={t("common.supplier")}
            labels={{
              ...partyPickerLabels(t),
              placeholder: t("prodList.allSuppliers"),
            }}
            className="w-full sm:w-64"
          />
          {/* Ordem da lista inteira; trocar já aplica (o "Buscar" também vale). */}
          <Select
            name="order"
            // A de sempre (nome) vai vazia: o endereço fica como antes.
            defaultValue={order === "name" ? "" : order}
            aria-label={t("prodList.order.label")}
            title={t("prodList.order.label")}
            className="w-auto"
            data-auto-submit
            data-product-order
          >
            <option value="">{t("prodList.order.name")}</option>
            <option value="recent">{t("prodList.order.recent")}</option>
          </Select>
          <AutoSubmit />
          <Button type="submit" variant="primary">
            {t("prodList.searchButton")}
          </Button>
          {filtering ? (
            <TextLink href={clearHref}>{t("prodList.clear")}</TextLink>
          ) : null}
        </form>
        <span className="text-sm text-zinc-500" data-product-total>
          {t("prodList.total", { n: products.length })}
        </span>
        {!viewParam ? (
          <LinkButton
            href={`/app/products/export${listQuery()}`}
            data-product-export
          >
            {t("prodList.export")}
          </LinkButton>
        ) : null}
      </div>
      <div className="mt-4">
        <div className="min-w-0">
          {/* Aguardando aprovação: nada a excluir ou restaurar em lote (a
              aprovação é na ficha de cada um). */}
          {products.length > 0 && !showApproval ? (
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
            // Uma página do catálogo (50): a busca e as páginas são as da
            // tela, no catálogo inteiro. Sem a busca e as páginas da tabela,
            // que só olhavam os 50 desta página (dono, 17/11/2026). Clicar no
            // cabeçalho continua ordenando a página, como antes.
            <Table searchable={false} paginated={false}>
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
                  {seesPrice ? (
                    <Th className="text-right">{t("common.price")}</Th>
                  ) : null}
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
                      {showApproval ? null : (
                        <input
                          type="checkbox"
                          name="ids"
                          value={p.id}
                          form={BULK_FORM}
                          aria-label={`${t("productDelete.selectOne")}: ${productNameText(t, p.name)}`}
                          className="h-4 w-4 accent-brand-600"
                          data-product-select={p.id}
                        />
                      )}
                    </Td>
                    <Td className="w-14">
                      <PhotoGallery
                        name={productNameText(t, p.name)}
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
                        {productNameText(t, p.name)}
                      </TextLink>
                      {awaitingApproval(p) ? (
                        <span
                          className="ml-1.5 align-middle"
                          data-product-approval-badge={p.approvalStatus ?? ""}
                        >
                          <Badge
                            tone={
                              p.approvalStatus === "rejected"
                                ? "danger"
                                : "warning"
                            }
                          >
                            {t(
                              p.approvalStatus === "rejected"
                                ? "productApproval.badge.rejected"
                                : "productApproval.badge.pending",
                            )}
                          </Badge>
                        </span>
                      ) : null}
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
                    {seesPrice ? (
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {/* Com variações: o preço é o da variação de referência, "a partir de". */}
                        {(() => {
                          const list = variants.get(p.id) ?? [];
                          const ref = referenceVariant(list);
                          if (ref && ref.price !== null)
                            return (
                              <span data-product-price-from>
                                {t("productVariants.from", {
                                  price: formatMoney(
                                    ref.price,
                                    ref.currency,
                                    t,
                                  ),
                                })}
                              </span>
                            );
                          return p.price !== null
                            ? formatMoney(p.price, p.currency, t)
                            : "—";
                        })()}
                      </Td>
                    ) : null}
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
