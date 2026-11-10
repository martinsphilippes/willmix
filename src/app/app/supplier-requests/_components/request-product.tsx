import Link from "next/link";
import type { Product, ProductLine, SupplierRequest } from "@/lib/db/schema";
import type {
  ErpSearch,
  ItemChoice,
} from "@/lib/services/supplier-request-product";
import type { Translate } from "@/i18n";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  Select,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  linkMoreRequestItemsAction,
  releaseRequestProductAction,
  requestProductAction,
  setRequestErpCodeAction,
} from "../../actions/supplier-requests";

/*
 * Bloco "Produto" da solicitação aprovada (docs/SUPPLIER_REQUESTS.md):
 * buscar itens, produto do catálogo e Sankhya (formulários GET que guardam as
 * outras buscas), criar ou associar o produto ligando os itens marcados,
 * liberar na vitrine e gravar o CODPROD.
 */

export interface RequestProductData {
  request: SupplierRequest;
  product: Product | null;
  linkedCount: number;
  lines: ProductLine[];
  choices: { suggested: ItemChoice[]; found: ItemChoice[] };
  catalog: Product[];
  erp: ErpSearch | null;
  query: { items: string; products: string; erp: string };
  /** Nome sugerido para o produto novo. */
  suggestedName: string;
}

function SearchForm({
  name,
  label,
  value,
  query,
  t,
}: {
  name: "iq" | "pq" | "eq";
  label: string;
  value: string;
  query: RequestProductData["query"];
  t: Translate;
}) {
  const keep = { iq: query.items, pq: query.products, eq: query.erp };
  return (
    <form method="get" className="flex flex-wrap items-end gap-2">
      {(Object.keys(keep) as Array<keyof typeof keep>)
        .filter((k) => k !== name && keep[k])
        .map((k) => (
          <input key={k} type="hidden" name={k} value={keep[k]} />
        ))}
      <div className="min-w-52 flex-1">
        <Field label={label}>
          <Input
            name={name}
            type="search"
            defaultValue={value}
            maxLength={80}
          />
        </Field>
      </div>
      <SubmitButton variant="secondary">{t("srProduct.search")}</SubmitButton>
    </form>
  );
}

function ItemList({
  choices,
  chosenId,
  checkedIds,
  t,
}: {
  choices: ItemChoice[];
  chosenId: string;
  /** Marcados de partida (as alternativas). */
  checkedIds: Set<string>;
  t: Translate;
}) {
  return (
    <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
      {choices.map(({ item, lot, supplierName }) => {
        const chosen = item.id === chosenId;
        return (
          <li key={item.id} className="flex items-start gap-2 px-3 py-2">
            <input
              type="checkbox"
              name="itemIds"
              value={item.id}
              defaultChecked={chosen || checkedIds.has(item.id)}
              disabled={chosen}
              className="mt-1"
              aria-label={item.description ?? item.factoryItemCode ?? item.id}
              data-request-product-item={item.id}
            />
            {chosen ? (
              <input type="hidden" name="itemIds" value={item.id} />
            ) : null}
            <span className="flex-1">
              <span className="font-medium">
                {item.description ?? item.productName ?? "—"}
              </span>{" "}
              <span className="text-xs text-zinc-500">
                {[
                  item.factoryItemCode,
                  supplierName,
                  lot ? `nº ${lot.number}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            {chosen ? (
              <Badge tone="brand">{t("srProduct.chosen")}</Badge>
            ) : !checkedIds.has(item.id) ? (
              <Badge tone="neutral">{t("srProduct.found")}</Badge>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function RequestProductCard({
  data,
  t,
}: {
  data: RequestProductData;
  t: Translate;
}) {
  const { request: r, product, choices, query } = data;
  const alternatives = new Set(r.alternativeItemIds ?? []);
  const free = (list: ItemChoice[]) =>
    list.filter((c) => !c.item.productId || c.item.productId === product?.id);

  if (!product) {
    const all = [...choices.suggested, ...free(choices.found)];
    return (
      <Card title={t("srProduct.title")}>
        <p className="mb-3 text-sm text-zinc-600">{t("srProduct.intro")}</p>
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <SearchForm
            name="iq"
            label={t("srProduct.searchItems")}
            value={query.items}
            query={query}
            t={t}
          />
          <SearchForm
            name="pq"
            label={t("srProduct.searchProducts")}
            value={query.products}
            query={query}
            t={t}
          />
        </div>
        <form
          action={requestProductAction}
          className="space-y-4"
          data-request-product-form
        >
          <input type="hidden" name="id" value={r.id} />
          <div>
            <h3 className="mb-1 text-sm font-semibold text-zinc-900">
              {t("srProduct.items")}
            </h3>
            <p className="mb-2 text-xs text-zinc-500">
              {t("srProduct.itemsHint")}
            </p>
            <ItemList
              choices={all}
              chosenId={r.bookingItemId}
              checkedIds={alternatives}
              t={t}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-zinc-200 p-3">
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">
                {t("srProduct.create.title")}
              </h3>
              <div className="space-y-2">
                <Field label={t("srProduct.create.name")}>
                  <Input
                    name="name"
                    defaultValue={data.suggestedName}
                    maxLength={160}
                    data-request-product-name
                  />
                </Field>
                <Field label={t("srProduct.create.line")}>
                  <Select
                    name="lineId"
                    defaultValue=""
                    data-request-product-line
                  >
                    <option value="">{t("common.select")}</option>
                    {data.lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-xs text-zinc-500">
                  {t("srProduct.create.hint")}
                </p>
                <SubmitButton
                  name="mode"
                  value="create"
                  pendingText={t("srProduct.pending")}
                  data-request-product-create
                >
                  {t("srProduct.create.submit")}
                </SubmitButton>
              </div>
            </section>
            <section className="rounded-lg border border-zinc-200 p-3">
              <h3 className="mb-2 text-sm font-semibold text-zinc-900">
                {t("srProduct.link.title")}
              </h3>
              {!query.products ? (
                <p className="text-sm text-zinc-500">
                  {t("srProduct.link.none")}
                </p>
              ) : data.catalog.length ? (
                <div className="space-y-2">
                  <ul className="max-h-64 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 text-sm">
                    {data.catalog.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        <input
                          type="radio"
                          name="productId"
                          value={p.id}
                          aria-label={p.name}
                          data-request-product-choose={p.id}
                        />
                        <span className="flex-1">
                          {p.name}{" "}
                          <span className="text-xs text-zinc-500">
                            {[
                              p.sku,
                              p.supplierSku,
                              p.erpCode ? `CODPROD ${p.erpCode}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <SubmitButton
                    name="mode"
                    value="link"
                    variant="secondary"
                    pendingText={t("srProduct.pending")}
                    data-request-product-link
                  >
                    {t("srProduct.link.submit")}
                  </SubmitButton>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  {t("srProduct.link.empty")}
                </p>
              )}
            </section>
          </div>
        </form>
      </Card>
    );
  }

  const found = free(choices.found).filter(
    (c) => c.item.productId !== product.id,
  );
  const erp = data.erp;
  return (
    <Card title={t("srProduct.title")}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="success">
          {t(
            r.productAction === "linked"
              ? "srProduct.done.linked"
              : "srProduct.done.created",
          )}
        </Badge>
        <Link
          href={`/app/products/${product.id}`}
          className={linkClass}
          data-request-product-open
        >
          {product.name}
        </Link>
        <span className="text-zinc-500">
          {t("srProduct.linkedItems", { n: data.linkedCount })}
        </span>
      </div>

      {r.productAction === "created" ? (
        r.showcaseReleasedAt ? (
          <p className="mb-3 text-sm text-zinc-600">
            {t("srProduct.released", {
              date: formatDate(r.showcaseReleasedAt, t),
            })}
          </p>
        ) : (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Alert tone="warning">{t("srProduct.hidden")}</Alert>
            <form action={releaseRequestProductAction}>
              <input type="hidden" name="id" value={r.id} />
              <SubmitButton
                variant="secondary"
                pendingText={t("srProduct.pending")}
                data-request-product-release
              >
                {t("srProduct.release")}
              </SubmitButton>
            </form>
          </div>
        )
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 p-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">
            {t("srProduct.moreItems")}
          </h3>
          <SearchForm
            name="iq"
            label={t("srProduct.searchItems")}
            value={query.items}
            query={query}
            t={t}
          />
          {found.length ? (
            <form
              action={linkMoreRequestItemsAction}
              className="mt-2 space-y-2"
            >
              <input type="hidden" name="id" value={r.id} />
              <ItemList
                choices={found}
                chosenId=""
                checkedIds={new Set()}
                t={t}
              />
              <SubmitButton
                variant="secondary"
                pendingText={t("srProduct.pending")}
              >
                {t("srProduct.moreSubmit")}
              </SubmitButton>
            </form>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">
              {t("srProduct.moreNone")}
            </p>
          )}
        </section>

        <section
          className="rounded-lg border border-zinc-200 p-3"
          data-request-product-erp
        >
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">
            {t("srProduct.erp.title")}
          </h3>
          <p
            className="mb-2 text-sm text-zinc-700"
            data-request-product-erp-code
          >
            {product.erpCode
              ? t(
                  r.erpCheckedAt
                    ? "srProduct.erp.checked"
                    : "srProduct.erp.unchecked",
                  { code: product.erpCode },
                )
              : t("srProduct.erp.none")}
          </p>
          <SearchForm
            name="eq"
            label={t("srProduct.searchErp")}
            value={query.erp}
            query={query}
            t={t}
          />
          {erp?.status === "not_configured" ? (
            <p className="mt-2 text-xs text-amber-800">
              {t("srProduct.erp.notConfigured")}
            </p>
          ) : erp?.status === "error" ? (
            <p className="mt-2 text-xs text-amber-800">
              {t("srProduct.erp.error", { code: erp.code })}
            </p>
          ) : erp?.status === "ok" && query.erp ? (
            erp.rows.length ? (
              <ul className="mt-2 max-h-56 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 text-sm">
                {erp.rows.map((row) => (
                  <li
                    key={row.code}
                    className="flex items-center justify-between gap-2 px-3 py-1.5"
                  >
                    <span>
                      <span className="tabular-nums font-medium">
                        {row.code}
                      </span>{" "}
                      {row.name}
                      {row.ref ? (
                        <span className="text-xs text-zinc-500">
                          {" "}
                          · {row.ref}
                        </span>
                      ) : null}
                    </span>
                    <form action={setRequestErpCodeAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="erpCode" value={row.code} />
                      <SubmitButton variant="ghost">
                        {t("srProduct.erp.use")}
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                {t("srProduct.erp.empty")}
              </p>
            )
          ) : null}
          <form
            action={setRequestErpCodeAction}
            className="mt-3 flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="id" value={r.id} />
            <div className="w-40">
              <Field label={t("srProduct.erp.code")}>
                <Input
                  name="erpCode"
                  inputMode="numeric"
                  defaultValue={product.erpCode ?? ""}
                  maxLength={10}
                  data-request-product-erp-input
                />
              </Field>
            </div>
            <SubmitButton
              variant="secondary"
              pendingText={t("srProduct.pending")}
              data-request-product-erp-save
            >
              {t("srProduct.erp.save")}
            </SubmitButton>
          </form>
        </section>
      </div>
    </Card>
  );
}
