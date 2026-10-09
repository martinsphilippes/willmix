import type { Party } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { ProductSupplierRow } from "@/lib/services/product-suppliers";
import {
  addProductSupplierAction,
  removeProductSupplierAction,
  setMainSupplierAction,
  setProductSupplierCodeAction,
} from "../../actions/product-suppliers";
import {
  Alert,
  Badge,
  Card,
  Empty,
  TextLink,
  formatDate,
  formatMoney,
  inputDenseClass,
} from "@/components/ui";
import { SubmitButton, SubmitTextButton } from "@/components/submit-button";

/**
 * "Fornecedores deste produto": o principal primeiro, depois quem cotou por
 * último. Cada um com o código do item na fábrica, a última cotação e o
 * histórico (cotações e escolhas). Só Wellmix (a página do produto já exige).
 */
export function SuppliersCard({
  t,
  productId,
  rows,
  suppliers,
  done,
}: {
  t: Translate;
  productId: string;
  rows: ProductSupplierRow[];
  /** Todos os fornecedores cadastrados (para incluir um que ainda não está). */
  suppliers: Pick<Party, "id" | "name" | "active">[];
  /** Resultado da última ação (?suppliers=added|saved|main|removed). */
  done?: string | null;
}) {
  const listed = new Set(rows.map((r) => r.supplier.id));
  const available = suppliers.filter((s) => s.active && !listed.has(s.id));
  const doneText =
    done && ["added", "saved", "main", "removed"].includes(done)
      ? t(`productSuppliers.done.${done}` as DictionaryKey)
      : null;
  return (
    <Card title={t("productSuppliers.title")} dense>
      <div id="suppliers" className="scroll-mt-4" />
      <div className="space-y-3" data-product-suppliers>
        <p className="text-xs leading-5 text-zinc-500">
          {t("productSuppliers.hint")}
        </p>
        {doneText ? <Alert tone="success">{doneText}</Alert> : null}
        {rows.length === 0 ? (
          <Empty>{t("productSuppliers.empty")}</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {rows.map((row) => {
              const link = row.link;
              const quoted = link?.price != null && link.currency;
              return (
                <li
                  key={row.supplier.id}
                  data-product-supplier={row.supplier.id}
                  data-main={row.main ? "true" : undefined}
                  className="grid gap-2 px-3 py-2 text-sm lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] lg:items-center lg:gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <TextLink
                      href={`/app/parties/${row.supplier.id}`}
                      className="font-medium text-zinc-900"
                    >
                      {row.supplier.name}
                    </TextLink>
                    <div className="flex flex-wrap gap-1">
                      {row.main ? (
                        <Badge tone="brand">{t("productSuppliers.main")}</Badge>
                      ) : null}
                      {link ? (
                        <Badge tone="neutral">
                          {t(
                            `productSuppliers.source.${link.source}` as DictionaryKey,
                          )}
                        </Badge>
                      ) : null}
                      {!row.supplier.active ? (
                        <Badge tone="warning">
                          {t("productSuppliers.inactive")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2 sm:items-center">
                    <form
                      action={setProductSupplierCodeAction}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <input type="hidden" name="productId" value={productId} />
                      <input
                        type="hidden"
                        name="supplierId"
                        value={row.supplier.id}
                      />
                      <input
                        name="supplierSku"
                        maxLength={60}
                        defaultValue={row.supplierSku ?? ""}
                        aria-label={`${t("productSuppliers.col.code")}: ${row.supplier.name}`}
                        placeholder={t("productSuppliers.col.code")}
                        className={`${inputDenseClass} max-w-40 font-mono`}
                      />
                      <SubmitTextButton className="shrink-0 text-xs">
                        {t("productSuppliers.saveCode")}
                      </SubmitTextButton>
                    </form>
                    <div className="min-w-0 text-xs leading-5 text-zinc-600">
                      {quoted ? (
                        <p>
                          <span className="font-medium text-zinc-900 tabular-nums">
                            {formatMoney(link.price, link.currency, t)}
                          </span>
                          {link.leadTimeDays
                            ? ` · ${t("productSuppliers.leadTime", { days: link.leadTimeDays })}`
                            : ""}
                          {link.moq
                            ? ` · MOQ ${link.moq.toLocaleString(t.intl)}`
                            : ""}
                          {link.lastQuotedAt
                            ? ` · ${formatDate(link.lastQuotedAt, t)}`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-zinc-400">
                          {t("productSuppliers.noQuote")}
                        </p>
                      )}
                      {link && (link.quoteCount || link.selectedCount) ? (
                        <p>
                          {t("productSuppliers.history", {
                            quotes: link.quoteCount ?? 0,
                            wins: link.selectedCount ?? 0,
                          })}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {row.main ? (
                    <div />
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <form action={setMainSupplierAction}>
                        <input
                          type="hidden"
                          name="productId"
                          value={productId}
                        />
                        <input
                          type="hidden"
                          name="supplierId"
                          value={row.supplier.id}
                        />
                        <SubmitTextButton className="text-xs">
                          {t("productSuppliers.makeMain")}
                        </SubmitTextButton>
                      </form>
                      <form action={removeProductSupplierAction}>
                        <input
                          type="hidden"
                          name="productId"
                          value={productId}
                        />
                        <input
                          type="hidden"
                          name="supplierId"
                          value={row.supplier.id}
                        />
                        <SubmitTextButton className="text-xs text-red-700 hover:text-red-800">
                          {t("productSuppliers.remove")}
                        </SubmitTextButton>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {available.length ? (
          <form
            action={addProductSupplierAction}
            className="flex flex-wrap items-end gap-2"
            data-add-product-supplier
          >
            <input type="hidden" name="productId" value={productId} />
            <label className="block min-w-0 text-xs font-medium text-zinc-700">
              {t("productSuppliers.addPick")}
              <select
                name="supplierId"
                required
                defaultValue=""
                className={`${inputDenseClass} mt-1 w-56 max-w-full`}
              >
                <option value="" disabled>
                  {t("supplierPick.placeholder")}
                </option>
                {available.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 text-xs font-medium text-zinc-700">
              {t("productSuppliers.addCode")}
              <input
                name="supplierSku"
                maxLength={60}
                className={`${inputDenseClass} mt-1 w-40 font-mono`}
              />
            </label>
            <SubmitButton variant="secondary" className="py-1.5">
              {t("productSuppliers.addButton")}
            </SubmitButton>
            <TextLink href="/app/parties/new" className="pb-1.5 text-xs">
              {t("productSuppliers.registerSupplier")}
            </TextLink>
          </form>
        ) : (
          <p className="text-xs text-zinc-500">
            {t("productSuppliers.allIn")}{" "}
            <TextLink href="/app/parties/new">
              {t("productSuppliers.registerSupplier")}
            </TextLink>
          </p>
        )}
      </div>
    </Card>
  );
}
