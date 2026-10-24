import type { ProductVariant } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { referenceVariant } from "@/lib/variants";
import {
  saveProductVariantAction,
  toggleProductVariantAction,
} from "../../actions/product-variants";
import {
  Alert,
  Badge,
  Card,
  Table,
  Td,
  Th,
  formatMoney,
  inputDenseClass,
  rowClass,
} from "@/components/ui";
import { CurrencySelect } from "@/components/currency-select";
import { SubmitButton, SubmitTextButton } from "@/components/submit-button";

/*
 * "Variações" do produto (modelo, tamanho, acabamento): tabela com foto,
 * nome, código, tamanho, preço, MOQ, caixa, pesos, medidas, CBM, cores,
 * material e situação; cada linha abre um formulário de edição e tem
 * Desativar/Reativar; no fim, "Adicionar variação" (fechado). Sem variações a
 * seção some e fica só o "Adicionar variação" fechado. Só Wellmix (a página
 * do produto já exige).
 */

const num = (
  v: number | null | undefined,
  t: Translate,
  digits = 3,
): string | null =>
  v === null || v === undefined
    ? null
    : v.toLocaleString(t.intl, { maximumFractionDigits: digits });

const pair = (
  a: number | null | undefined,
  b: number | null | undefined,
  t: Translate,
  digits = 3,
) => {
  const x = num(a, t, digits);
  const y = num(b, t, digits);
  return x === null && y === null ? "—" : `${x ?? "—"} / ${y ?? "—"}`;
};

const dims = (v: ProductVariant, t: Translate) =>
  v.lengthCm === null && v.widthCm === null && v.heightCm === null
    ? "—"
    : `${num(v.lengthCm, t) ?? "—"} × ${num(v.widthCm, t) ?? "—"} × ${num(v.heightCm, t) ?? "—"}`;

export function VariantsCard({
  t,
  productId,
  variants,
  done,
  errorText,
}: {
  t: Translate;
  productId: string;
  variants: ProductVariant[];
  /** Resultado da última ação (?variants=saved|added|toggled). */
  done?: string | null;
  /** Erro da última ação (?error=…&from=variants), já traduzido. */
  errorText?: string | null;
}) {
  const ref = referenceVariant(variants);
  const doneText =
    done && ["saved", "added", "toggled"].includes(done)
      ? t(`productVariants.done.${done}` as DictionaryKey)
      : null;
  const notices = (
    <>
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {doneText ? <Alert tone="success">{doneText}</Alert> : null}
    </>
  );
  const addForm = (
    <details
      className="rounded-lg border border-dashed border-zinc-300 px-3 py-2"
      data-add-product-variant
    >
      <summary className="cursor-pointer text-sm font-medium text-brand-700">
        {t("productVariants.add")}
      </summary>
      <div className="mt-3">
        <VariantForm t={t} productId={productId} variant={null} />
      </div>
    </details>
  );

  if (variants.length === 0) {
    // Sem variações: a seção não aparece; só o "Adicionar variação", fechado.
    return (
      <div className="space-y-2" data-product-variants="0">
        <div id="variants" className="scroll-mt-4" />
        {notices}
        {addForm}
      </div>
    );
  }

  return (
    <Card title={t("productVariants.title")} dense>
      <div id="variants" className="scroll-mt-4" />
      <div className="space-y-3" data-product-variants={variants.length}>
        <p className="text-xs leading-5 text-zinc-500">
          {t("productVariants.hint")}
        </p>
        {notices}
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>{t("productVariants.col.photo")}</Th>
                <Th>{t("productVariants.col.name")}</Th>
                <Th>{t("productVariants.col.code")}</Th>
                <Th>{t("productVariants.col.size")}</Th>
                <Th className="text-right">{t("productVariants.col.price")}</Th>
                <Th className="text-right">{t("productVariants.col.moq")}</Th>
                <Th className="text-right">{t("productVariants.col.box")}</Th>
                <Th className="text-right">
                  {t("productVariants.col.weight")}
                </Th>
                <Th className="text-right">{t("productVariants.col.dims")}</Th>
                <Th className="text-right">{t("productVariants.col.cbm")}</Th>
                <Th>{t("productVariants.col.colors")}</Th>
                <Th>{t("productVariants.col.material")}</Th>
                <Th>{t("productVariants.col.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <VariantRow
                  key={v.id}
                  t={t}
                  productId={productId}
                  variant={v}
                  isReference={ref?.id === v.id}
                />
              ))}
            </tbody>
          </Table>
        </div>
        {addForm}
      </div>
    </Card>
  );
}

function VariantRow({
  t,
  productId,
  variant: v,
  isReference,
}: {
  t: Translate;
  productId: string;
  variant: ProductVariant;
  isReference: boolean;
}) {
  return (
    <>
      <tr
        className={rowClass}
        data-product-variant={v.id}
        data-active={v.active ? "true" : "false"}
      >
        <Td>
          {v.photoDocumentId ? (
            <a
              href={`/api/files/${v.photoDocumentId}`}
              target="_blank"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- arquivo servido pela API com controle de acesso */}
              <img
                src={`/api/files/${v.photoDocumentId}`}
                alt={v.name}
                loading="lazy"
                className="h-10 w-10 rounded-md border border-zinc-200 bg-zinc-50 object-cover"
              />
            </a>
          ) : (
            <span className="text-xs text-zinc-400">
              {t("productVariants.noPhoto")}
            </span>
          )}
        </Td>
        <Td className="font-medium text-zinc-900">
          <div className="flex flex-wrap items-center gap-1.5">
            <span>{v.name}</span>
            {isReference ? (
              <span title={t("productVariants.referenceTitle")}>
                <Badge tone="brand">{t("productVariants.reference")}</Badge>
              </span>
            ) : null}
          </div>
        </Td>
        <Td>
          <span className="font-mono text-xs text-zinc-700">
            {v.factoryItemCode ?? "—"}
          </span>
        </Td>
        <Td>{v.sizeText ?? "—"}</Td>
        <Td className="whitespace-nowrap text-right tabular-nums">
          {v.price !== null ? formatMoney(v.price, v.currency, t) : "—"}
        </Td>
        <Td className="text-right tabular-nums">{num(v.moq, t, 0) ?? "—"}</Td>
        <Td className="whitespace-nowrap text-right tabular-nums">
          {pair(v.masterBoxQty, v.innerBoxQty, t, 0)}
        </Td>
        <Td className="whitespace-nowrap text-right tabular-nums">
          {pair(v.netWeightKg, v.grossWeightKg, t)}
        </Td>
        <Td className="whitespace-nowrap text-right tabular-nums">
          {dims(v, t)}
        </Td>
        <Td className="text-right tabular-nums">{num(v.cbm, t, 4) ?? "—"}</Td>
        <Td className="max-w-40">
          <span className="block truncate" title={v.colorAssortment ?? ""}>
            {v.colorAssortment ?? "—"}
          </span>
        </Td>
        <Td className="max-w-32">
          <span className="block truncate" title={v.material ?? ""}>
            {v.material ?? "—"}
          </span>
        </Td>
        <Td>
          <div className="flex flex-wrap items-center gap-2">
            {v.active ? (
              <Badge tone="success">{t("productVariants.active")}</Badge>
            ) : (
              <Badge tone="neutral">{t("productVariants.inactive")}</Badge>
            )}
            <form action={toggleProductVariantAction}>
              <input type="hidden" name="productId" value={productId} />
              <input type="hidden" name="variantId" value={v.id} />
              <input type="hidden" name="active" value={v.active ? "0" : "1"} />
              <SubmitTextButton
                className="text-xs"
                data-toggle-product-variant={v.id}
              >
                {v.active
                  ? t("productVariants.deactivate")
                  : t("productVariants.reactivate")}
              </SubmitTextButton>
            </form>
          </div>
        </Td>
      </tr>
      <tr>
        <td colSpan={13} className="px-2 pb-2">
          <details className="rounded-md bg-zinc-50 px-3 py-1.5">
            <summary className="cursor-pointer text-xs font-medium text-brand-700">
              {t("productVariants.edit")}
            </summary>
            <div className="mt-2">
              <VariantForm
                key={v.updatedAt}
                t={t}
                productId={productId}
                variant={v}
              />
            </div>
          </details>
        </td>
      </tr>
    </>
  );
}

const TEXT_FIELDS: Array<[keyof ProductVariant & string, number]> = [
  ["factoryItemCode", 60],
  ["sizeText", 60],
  ["colorAssortment", 200],
  ["material", 200],
  ["packageType", 120],
];
const NUMBER_FIELDS: Array<[keyof ProductVariant & string, boolean]> = [
  ["price", false],
  ["moq", true],
  ["masterBoxQty", true],
  ["innerBoxQty", true],
  ["netWeightKg", false],
  ["grossWeightKg", false],
  ["lengthCm", false],
  ["widthCm", false],
  ["heightCm", false],
  ["cbm", false],
  ["capacityMl", false],
  ["sortOrder", true],
];

/** Formulário de uma variação (nova ou existente): todos os campos. */
function VariantForm({
  t,
  productId,
  variant,
}: {
  t: Translate;
  productId: string;
  variant: ProductVariant | null;
}) {
  const value = (k: keyof ProductVariant) => {
    const v = variant?.[k];
    return v === null || v === undefined ? "" : String(v);
  };
  const label = (k: string) => t(`productVariants.field.${k}` as DictionaryKey);
  const field = (k: string, input: React.ReactNode) => (
    <label key={k} className="block min-w-0 text-xs font-medium text-zinc-700">
      {label(k)}
      {input}
    </label>
  );
  return (
    <form
      action={saveProductVariantAction}
      className="space-y-2"
      data-product-variant-form={variant?.id ?? "new"}
    >
      <input type="hidden" name="productId" value={productId} />
      {variant ? (
        <input type="hidden" name="variantId" value={variant.id} />
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block min-w-0 text-xs font-medium text-zinc-700 sm:col-span-2">
          {label("name")}
          <input
            name="name"
            required
            maxLength={160}
            defaultValue={variant?.name ?? ""}
            className={`${inputDenseClass} mt-1`}
          />
        </label>
        {TEXT_FIELDS.slice(0, 2).map(([k, max]) =>
          field(
            k,
            <input
              name={k}
              maxLength={max}
              defaultValue={value(k)}
              className={`${inputDenseClass} mt-1 ${k === "factoryItemCode" ? "font-mono" : ""}`}
            />,
          ),
        )}
        {NUMBER_FIELDS.slice(0, 1).map(([k, integer]) =>
          field(
            k,
            <input
              name={k}
              type="number"
              step={integer ? 1 : "any"}
              min={0}
              inputMode={integer ? "numeric" : "decimal"}
              defaultValue={value(k)}
              className={`${inputDenseClass} mt-1`}
            />,
          ),
        )}
        {field(
          "currency",
          <div className="mt-1">
            <CurrencySelect
              name="currency"
              value={variant?.currency ?? null}
              t={t}
              allowEmpty
              dense
            />
          </div>,
        )}
        {NUMBER_FIELDS.slice(1).map(([k, integer]) =>
          field(
            k,
            <input
              name={k}
              type="number"
              step={integer ? 1 : "any"}
              min={0}
              inputMode={integer ? "numeric" : "decimal"}
              defaultValue={value(k)}
              className={`${inputDenseClass} mt-1`}
            />,
          ),
        )}
        {TEXT_FIELDS.slice(2).map(([k, max]) =>
          field(
            k,
            <input
              name={k}
              maxLength={max}
              defaultValue={value(k)}
              className={`${inputDenseClass} mt-1`}
            />,
          ),
        )}
        <label className="block min-w-0 text-xs font-medium text-zinc-700 sm:col-span-2 lg:col-span-4">
          {label("notes")}
          <textarea
            name="notes"
            rows={2}
            maxLength={4000}
            defaultValue={variant?.notes ?? ""}
            className={`${inputDenseClass} mt-1`}
          />
        </label>
      </div>
      <SubmitButton variant="secondary" className="py-1.5">
        {variant ? t("productVariants.save") : t("productVariants.add")}
      </SubmitButton>
    </form>
  );
}
