import type { ComponentProps, ReactNode } from "react";
import { translator, type Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { PantoneColorRef, Product, ProductLine } from "@/lib/db";
import { realName } from "@/lib/placeholder-name";
import { productSpecLabels, sameSpec } from "@/lib/product-spec";
import { MAX_PANTONE_PER_SHEET } from "@/lib/pantone";
import { ProductSpecField } from "@/components/product-spec-field";
import { PantonePicker } from "@/components/pantone-picker";
import { MoneyInput } from "@/components/money-input";
import { CurrencySelect } from "@/components/currency-select";
import { CartonSizeWarning, InnerQtyHints } from "@/components/carton-hints";
import { cartonSizeTexts, innerQtyTexts } from "@/components/carton-texts";
import {
  FieldRow,
  FoldCard,
  Input,
  Select,
  TextLink,
  Textarea,
  formatDate,
} from "@/components/ui";

/*
 * Cadastro do produto em quadros recolhidos (Produto, Fornecedor e
 * negociação, Embalagem e Observações): os mesmos campos na tela do produto
 * e na tela "Novo produto" (dono, 17/11/2026; docs/NEW_PRODUCT.md). O que
 * muda entre as duas vem de fora: o campo do fornecedor (lista na ficha,
 * busca no produto novo), a situação (caixa "Produto ativo" ou o aviso da
 * aprovação) e a origem.
 */

/** Rascunho do formulário da tela "Novo produto" (FormDraftGuard). */
export const NEW_PRODUCT_DRAFT_KEY = "product-form:new";

/* Campos maiores para uso no celular (fábrica/feira): py-2.5 em vez de py-2. */
export function NumberInput({
  integer = false,
  className,
  ...props
}: ComponentProps<"input"> & { integer?: boolean }) {
  return (
    <Input
      type="number"
      step={integer ? 1 : "any"}
      min={0}
      inputMode={integer ? "numeric" : "decimal"}
      className={className}
      dense
      {...props}
    />
  );
}

/** Marcação de campo que a ficha mestre também usa (âncora e obrigatório). */
export interface SheetFieldMark {
  anchor: string;
  required?: boolean;
  requiredTitle?: string;
  missing?: boolean;
  missingText?: string;
}

export function ProductFormCards({
  t,
  product,
  isNew = false,
  lines,
  seesPrice,
  autoSpec,
  specExtras,
  pantones,
  notesView,
  cbmComputed,
  cbmShown,
  sheetField,
  sheetRequired,
  supplier,
  supplierControl,
  status,
  sourcing,
}: {
  t: Translate;
  /** O produto (no "Novo produto", um em branco). */
  product: Product;
  isNew?: boolean;
  lines: Pick<ProductLine, "id" | "name">[];
  seesPrice: boolean;
  /** Especificação montada com os dados do produto e da ficha mestre. */
  autoSpec: string;
  specExtras: ComponentProps<typeof ProductSpecField>["extras"];
  pantones: PantoneColorRef[];
  notesView: { text: string; toEcommerce: boolean };
  cbmComputed: number | null;
  cbmShown: number | null;
  sheetField: (...keys: string[]) => SheetFieldMark;
  sheetRequired: (...keys: string[]) => SheetFieldMark;
  /** Fornecedor principal gravado (link "Abrir fornecedor"). */
  supplier: { id: string } | null;
  /** Campo do fornecedor (name="supplierId"). */
  supplierControl: ReactNode;
  /** Conteúdo da linha Situação. */
  status: ReactNode;
  /** Item de sourcing de origem (só na ficha). */
  sourcing: { name: string; foundAt: string | null } | null;
}) {
  return (
    <div className="grid items-start gap-2 lg:grid-cols-2">
      <FoldCard
        title={t("catalog.section.product")}
        fold="product"
        defaultOpen={isNew ? true : undefined}
      >
        <div className="space-y-2">
          <FieldRow
            label={t("common.name")}
            size="full"
            required
            // Nome de exemplo ("Produto novo XPTO") não é nome: o campo
            // vem vazio, com a dica, e o nome real é pedido ao salvar.
            // Produto novo: o campo só começa vazio.
            missing={!isNew && !realName(product.name)}
            hint={
              isNew || realName(product.name) ? undefined : (
                <span data-product-name-unnamed>
                  {t("productName.unnamedHint")}
                </span>
              )
            }
          >
            <Input
              name="name"
              maxLength={160}
              required
              minLength={2}
              defaultValue={realName(product.name) ?? ""}
              dense
            />
          </FieldRow>
          <FieldRow label="SKU" size="sm">
            <Input
              name="sku"
              maxLength={60}
              defaultValue={product.sku ?? ""}
              dense
            />
          </FieldRow>
          <FieldRow label={t("catalog.line")} size="md" required>
            <Select name="lineId" required defaultValue={product.lineId} dense>
              {/* Produto novo: a linha é escolhida (nenhuma de partida). */}
              {!product.lineId ? (
                <option value="" disabled>
                  {t("common.select")}
                </option>
              ) : null}
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label={t("catalog.category")} size="md">
            <Input
              name="category"
              maxLength={80}
              defaultValue={product.category ?? ""}
              dense
            />
          </FieldRow>
          <FieldRow label={t("common.status")} size="full">
            {status}
          </FieldRow>
          <FieldRow label={t("requests.specification")} size="full">
            <ProductSpecField
              name="specification"
              defaultValue={
                product.specification?.trim() ? product.specification : autoSpec
              }
              initialAuto={
                !product.specification?.trim() ||
                sameSpec(product.specification, autoSpec)
              }
              extras={specExtras}
              labels={productSpecLabels(translator("pt"))}
              texts={{
                auto: t("productSpec.hint.auto"),
                manual: t("productSpec.hint.manual"),
                rebuild: t("productSpec.rebuild"),
                empty: t("productSpec.empty"),
              }}
            />
          </FieldRow>
          <FieldRow
            label={t("catalog.material")}
            size="md"
            {...sheetRequired("material")}
          >
            <Input
              name="material"
              maxLength={120}
              defaultValue={product.material ?? ""}
              dense
            />
          </FieldRow>
          <FieldRow label={t("catalog.brand")} size="md">
            <Input
              name="brand"
              maxLength={80}
              defaultValue={product.brand ?? ""}
              dense
            />
          </FieldRow>
          <FieldRow
            label={t("catalog.pantone")}
            size="full"
            hint={t("pantone.productHint")}
          >
            <PantonePicker
              name="colorPantones"
              initial={pantones}
              max={MAX_PANTONE_PER_SHEET}
              syncName="color"
              syncMax={60}
              labels={{
                search: t("pantone.search"),
                scaleAll: t("pantone.scale.all"),
                scales: {
                  C: t("pantone.scale.C"),
                  U: t("pantone.scale.U"),
                  M: t("pantone.scale.M"),
                  P: t("pantone.scale.P"),
                  TCX: t("pantone.scale.TCX"),
                },
                loading: t("pantone.loading"),
                none: t("pantone.none"),
                more: t("pantone.more"),
                remove: t("pantone.remove"),
                max: t("pantone.max"),
                empty: t("pantone.empty"),
              }}
            />
          </FieldRow>
          {/* Cor depois do Pantone: as cores escolhidas já entram no texto. */}
          <FieldRow
            label={t("catalog.color")}
            size="md"
            {...sheetRequired("colorAssortment")}
          >
            <Input
              name="color"
              maxLength={60}
              defaultValue={product.color ?? ""}
              dense
            />
          </FieldRow>
          <FieldRow label={t("catalog.dimensions")} size="full">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              <span>{t("catalog.length")}</span>
              <NumberInput
                name="lengthCm"
                defaultValue={product.lengthCm ?? ""}
                aria-label={t("catalog.length")}
                className="w-16"
              />
              <span aria-hidden>×</span>
              <span>{t("catalog.width")}</span>
              <NumberInput
                name="widthCm"
                defaultValue={product.widthCm ?? ""}
                aria-label={t("catalog.width")}
                className="w-16"
              />
              <span aria-hidden>×</span>
              <span>{t("catalog.height")}</span>
              <NumberInput
                name="heightCm"
                defaultValue={product.heightCm ?? ""}
                aria-label={t("catalog.height")}
                className="w-16"
              />
            </div>
          </FieldRow>
          <FieldRow
            label={t("catalog.netWeight")}
            size="xs"
            {...sheetRequired("netWeightPcKg")}
          >
            <NumberInput
              name="netWeightKg"
              defaultValue={product.netWeightKg ?? ""}
            />
          </FieldRow>
          <FieldRow
            label={t("catalog.grossWeight")}
            size="xs"
            {...sheetRequired("grossWeightPcKg")}
          >
            <NumberInput
              name="grossWeightKg"
              defaultValue={product.grossWeightKg ?? ""}
            />
          </FieldRow>
        </div>
      </FoldCard>

      <FoldCard
        title={t("catalog.section.supplier")}
        fold="supplier"
        defaultOpen={isNew ? true : undefined}
      >
        <div className="space-y-2">
          <FieldRow
            label={t("common.supplier")}
            size="lg"
            {...sheetRequired("supplierName")}
            hint={
              supplier ? (
                <TextLink href={`/app/parties/${supplier.id}`}>
                  {t("catalog.openSupplier")}
                </TextLink>
              ) : undefined
            }
          >
            {supplierControl}
          </FieldRow>
          <FieldRow
            label={t("catalog.supplierSku")}
            size="md"
            {...sheetField("factoryItemCode")}
          >
            <Input
              name="supplierSku"
              maxLength={60}
              defaultValue={product.supplierSku ?? ""}
              dense
            />
          </FieldRow>
          <FieldRow
            label={t("catalog.moq")}
            size="sm"
            {...sheetRequired("moq")}
          >
            <NumberInput name="moq" integer defaultValue={product.moq ?? ""} />
          </FieldRow>
          {seesPrice ? (
            <>
              <FieldRow
                label={t("common.price")}
                size="md"
                {...sheetRequired("price")}
              >
                <MoneyInput
                  locale={t.intl}
                  name="price"
                  watchField="currency"
                  defaultAmount={product.price ?? null}
                  decimals={4}
                  size="sm"
                />
              </FieldRow>
              <FieldRow
                label={t("common.currency")}
                size="sm"
                {...sheetRequired("currency")}
              >
                <CurrencySelect
                  name="currency"
                  value={product.currency}
                  t={t}
                  allowEmpty
                  dense
                />
              </FieldRow>
            </>
          ) : null}
          <FieldRow label={t("catalog.negotiatedAt")} size="sm">
            <Input
              name="negotiatedAt"
              type="date"
              defaultValue={product.negotiatedAt?.slice(0, 10) ?? ""}
              dense
            />
          </FieldRow>
          <FieldRow
            label={t("catalog.source")}
            size="md"
            hint={t("catalog.readOnly")}
          >
            <Input
              readOnly
              value={
                product.source
                  ? t(`catalog.source.${product.source}` as DictionaryKey)
                  : "—"
              }
              className="bg-zinc-50 text-zinc-600"
              dense
            />
          </FieldRow>
          {product.sourcingItemId ? (
            <p className="pt-1 text-xs text-zinc-600">
              <span className="font-semibold uppercase tracking-wide text-zinc-500">
                {t("catalog.sourcingOrigin")}
              </span>{" "}
              <TextLink href={`/app/sourcing/items/${product.sourcingItemId}`}>
                {sourcing?.name ?? t("catalog.openSourcing")}
              </TextLink>
              {sourcing?.foundAt ? ` · ${formatDate(sourcing.foundAt, t)}` : ""}
            </p>
          ) : null}
        </div>
      </FoldCard>

      <FoldCard
        title={t("catalog.section.packaging")}
        fold="packaging"
        defaultOpen={isNew ? true : undefined}
      >
        <div className="space-y-2">
          <FieldRow
            label={t("catalog.masterBoxQty")}
            size="xs"
            {...sheetRequired("masterCartonQty")}
          >
            <NumberInput
              name="masterBoxQty"
              integer
              defaultValue={product.masterBoxQty ?? ""}
            />
          </FieldRow>
          <FieldRow
            label={t("catalog.innerBoxQty")}
            size="xs"
            {...sheetField("innerQty")}
            hint={
              <InnerQtyHints
                masterName="masterBoxQty"
                innerName="innerBoxQty"
                initialMaster={product.masterBoxQty ?? null}
                initialInner={product.innerBoxQty ?? null}
                intl={t.intl}
                texts={innerQtyTexts(t)}
              />
            }
          >
            <NumberInput
              name="innerBoxQty"
              integer
              defaultValue={product.innerBoxQty ?? ""}
            />
          </FieldRow>
          <FieldRow
            label={t("catalog.boxDimensions")}
            size="full"
            {...sheetRequired("heightCm", "widthCm", "lengthCm")}
            hint={
              <CartonSizeWarning
                sideNames={["boxLengthCm", "boxWidthCm", "boxHeightCm"]}
                cbmName="cbm"
                initialSides={[
                  product.boxLengthCm,
                  product.boxWidthCm,
                  product.boxHeightCm,
                ]}
                // CBM desabilitado (vem das medidas salvas) não vai no envio.
                initialCbm={cbmComputed !== null ? null : (product.cbm ?? null)}
                cbmIgnoreDisabled
                intl={t.intl}
                texts={cartonSizeTexts(t)}
              />
            }
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              <span>{t("catalog.length")}</span>
              <NumberInput
                name="boxLengthCm"
                defaultValue={product.boxLengthCm ?? ""}
                aria-label={t("catalog.length")}
                className="w-16"
              />
              <span aria-hidden>×</span>
              <span>{t("catalog.width")}</span>
              <NumberInput
                name="boxWidthCm"
                defaultValue={product.boxWidthCm ?? ""}
                aria-label={t("catalog.width")}
                className="w-16"
              />
              <span aria-hidden>×</span>
              <span>{t("catalog.height")}</span>
              <NumberInput
                name="boxHeightCm"
                defaultValue={product.boxHeightCm ?? ""}
                aria-label={t("catalog.height")}
                className="w-16"
              />
            </div>
          </FieldRow>
          <FieldRow
            label={t("catalog.cbmPerBox")}
            size="xs"
            {...sheetRequired("cbmPerCarton")}
            hint={
              <>
                <strong className="text-zinc-800">
                  {cbmShown !== null
                    ? `${cbmShown.toLocaleString(t.intl, { maximumFractionDigits: 4 })} m³`
                    : "—"}
                </strong>
                {cbmComputed !== null
                  ? ` · ${t("catalog.cbmComputed")}`
                  : ` · ${t("catalog.cbmHint")}`}
              </>
            }
          >
            <NumberInput
              name="cbm"
              defaultValue={product.cbm ?? ""}
              disabled={cbmComputed !== null}
              className={cbmComputed !== null ? "bg-zinc-50" : undefined}
            />
          </FieldRow>
        </div>
      </FoldCard>

      {/* Um texto só: as observações do cadastro, as da ficha mestre e a
            descrição para e-commerce (a caixa diz se vai para lá). */}
      <FoldCard
        title={t("catalog.section.notes")}
        fold="notes"
        defaultOpen={isNew ? true : undefined}
      >
        <div data-field-anchor="notes ecommerceDescription">
          <Textarea
            name="notes"
            rows={4}
            maxLength={4000}
            defaultValue={notesView.text}
            dense
          />
          <label className="mt-2 flex items-start gap-2 text-sm text-zinc-800">
            <input type="hidden" name="notesToEcommerce" value="off" />
            <input
              type="checkbox"
              name="notesToEcommerce"
              value="on"
              defaultChecked={notesView.toEcommerce}
              className="mt-0.5 h-4 w-4 accent-brand-600"
              data-notes-ecommerce
            />
            <span>
              <span className="font-medium">
                {t("catalog.notes.ecommerce")}
              </span>
              <span className="block text-xs text-zinc-500">
                {t("catalog.notes.ecommerceHint")}
              </span>
            </span>
          </label>
        </div>
      </FoldCard>
    </div>
  );
}
