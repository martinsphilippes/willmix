import type { PurchaseSheet, RequestSchedule } from "@/lib/db";
import {
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  SHEET_POWER_SOURCES,
} from "@/lib/db/schema";
import type { SheetPlan } from "@/lib/services/purchase-sheet-calc";
import type { SheetRecords } from "@/lib/services/sheet-records";
import Link from "next/link";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Translate } from "@/i18n";
import {
  Card,
  FieldRow,
  cx,
  fieldRowWidth,
  inputDenseClass,
} from "@/components/ui";
import { MoneyInput } from "./money-input";
import { PantonePicker } from "./pantone-picker";
import { SheetSchedule } from "./sheet-schedule";
import { MAX_PANTONE_PER_SHEET } from "@/lib/pantone";

/*
 * Campos da ficha de compra (planilha COMPRAS), usados dentro de um <form>:
 * na Preparação do pedido e na resposta da RFQ pelo fornecedor. Peças, CBM,
 * containers e datas vêm calculados do servidor (`plan`).
 *
 * Formulário denso: um campo abaixo do outro, rótulo à esquerda, caixa do
 * tamanho do que se digita (FieldRow + inputDenseClass); os lotes da
 * programação formam uma tabela compacta.
 */
export function PurchaseSheetFields({
  t,
  sheet,
  plan,
  containerType,
  containerTypes,
  editSupplier,
  editCustoms,
  lotRequired = true,
  requestSchedule = null,
  requestUnit = "un",
  master = false,
  records = null,
}: {
  t: Translate;
  sheet: Partial<PurchaseSheet>;
  plan: SheetPlan;
  containerType: string | null;
  containerTypes: Array<{ code: string; capacityCbm: number }>;
  editSupplier: boolean;
  editCustoms: boolean;
  /** Lote 1 obrigatório (Preparação); na cotação os lotes são opcionais. */
  lotRequired?: boolean;
  /** Programação de entregas pedida pelo cliente na solicitação (referência por programação). */
  requestSchedule?: RequestSchedule | null;
  /** Unidade da solicitação (para "Pedido do cliente: 1.000 un"). */
  requestUnit?: string;
  /** Ficha mestre do produto: sem início de produção nem programações (são de cada compra). */
  master?: boolean;
  /** Bloco Fornecedor vem dos cadastros: o que falta neles e os atalhos para completar. */
  records?: SheetRecords | null;
}) {
  const dateValue = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");
  const numValue = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : String(v);
  const sup = !editSupplier;
  const lots = plan.lots;
  const view = { containerType, containerTypes };
  const access = { editCustoms };
  const required = t("sheet.required");
  const F = SheetField;
  return (
    <>
      {/* Fornecedor e Produto lado a lado: primeiro quem vende, depois o que se compra. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("sheet.section.supplier")} dense>
          <Rows>
            <F t={t} k="sheetDate" size="sm">
              <input
                type="date"
                name="sheetDate"
                defaultValue={dateValue(sheet.sheetDate)}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
            <F t={t} k="location" size="md">
              <input
                name="location"
                maxLength={80}
                placeholder="YIWU"
                defaultValue={sheet.location ?? ""}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
            <F t={t} k="supplierName" size="lg" req>
              <input
                name="supplierName"
                maxLength={160}
                defaultValue={sheet.supplierName ?? ""}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
            <F t={t} k="supplierStore" size="sm">
              <input
                name="supplierStore"
                maxLength={60}
                placeholder="A 154678"
                defaultValue={sheet.supplierStore ?? ""}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
            <F t={t} k="supplierPhone" size="md">
              <input
                name="supplierPhone"
                type="tel"
                maxLength={40}
                defaultValue={sheet.supplierPhone ?? ""}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
            <F t={t} k="factoryItemCode" size="md">
              <input
                name="factoryItemCode"
                maxLength={60}
                defaultValue={sheet.factoryItemCode ?? ""}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
          </Rows>
          {records ? (
            <div
              className="mt-3 space-y-1 text-xs text-zinc-500"
              data-sheet-records={
                records.missing.length ? "missing" : "complete"
              }
            >
              <p>{t("sheet.records.hint")}</p>
              {records.missing.length ? (
                <p className="text-amber-800">
                  {t("sheet.records.missing", {
                    fields: records.missing
                      .map((k) => t(`sheet.field.${k}` as DictionaryKey))
                      .join(", "),
                  })}
                </p>
              ) : (
                <p className="text-emerald-800">
                  {t("sheet.records.complete")}
                </p>
              )}
              {records.canEdit ? (
                <p className="flex flex-wrap gap-x-3 gap-y-1">
                  {records.supplierId &&
                  records.missing.some((k) => k !== "factoryItemCode") ? (
                    <Link
                      href={`/app/parties/${records.supplierId}`}
                      className="font-medium text-brand-700 underline-offset-2 hover:underline"
                      data-records-edit-supplier
                    >
                      {t("sheet.records.editSupplier")}
                    </Link>
                  ) : null}
                  {records.productId &&
                  records.missing.includes("factoryItemCode") ? (
                    <Link
                      href={`/app/products/${records.productId}`}
                      className="font-medium text-brand-700 underline-offset-2 hover:underline"
                      data-records-edit-product
                    >
                      {t("sheet.records.editProduct")}
                    </Link>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
        <Card title={t("sheet.section.product")} dense>
          <Rows>
            <F t={t} k="netWeightPcKg" size="xs" req>
              <Num
                name="netWeightPcKg"
                value={numValue(sheet.netWeightPcKg)}
                disabled={sup}
              />
            </F>
            <F t={t} k="grossWeightPcKg" size="xs" req>
              <Num
                name="grossWeightPcKg"
                value={numValue(sheet.grossWeightPcKg)}
                disabled={sup}
              />
            </F>
            <F t={t} k="capacityMl" size="xs">
              <Num
                name="capacityMl"
                value={numValue(sheet.capacityMl)}
                disabled={sup}
              />
            </F>
            <F t={t} k="colorAssortment" size="lg" req>
              <input
                name="colorAssortment"
                maxLength={200}
                placeholder="WHITE / BLACK / RED"
                defaultValue={sheet.colorAssortment ?? ""}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
            <FieldRow
              label={t("pantone.label")}
              size="full"
              hint={t("pantone.hint")}
            >
              <PantonePicker
                name="colorPantones"
                initial={sheet.colorPantones ?? []}
                disabled={sup}
                max={MAX_PANTONE_PER_SHEET}
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
            <F t={t} k="material" size="lg" req>
              <input
                name="material"
                maxLength={200}
                placeholder="PLASTIC / IRON"
                defaultValue={sheet.material ?? ""}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
            <F t={t} k="powerSource" size="sm">
              <select
                name="powerSource"
                defaultValue={sheet.powerSource ?? ""}
                disabled={sup}
                className={inputDenseClass}
              >
                <option value="">—</option>
                {SHEET_POWER_SOURCES.map((v) => (
                  <option key={v} value={v}>
                    {t(`sheet.power.${v}` as DictionaryKey)}
                  </option>
                ))}
              </select>
            </F>
            <F t={t} k="powerDetail" size="md">
              <input
                name="powerDetail"
                maxLength={60}
                placeholder="12V"
                defaultValue={sheet.powerDetail ?? ""}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
          </Rows>
        </Card>
      </div>

      <Card title={t("sheet.section.price")} dense>
        <Rows>
          <F t={t} k="incoterm" size="xs" req>
            <select
              name="incoterm"
              defaultValue={sheet.incoterm ?? ""}
              disabled={sup}
              className={inputDenseClass}
            >
              <option value="">—</option>
              {SHEET_INCOTERMS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </F>
          <F t={t} k="currency" size="sm" req>
            <select
              name="currency"
              defaultValue={sheet.currency ?? ""}
              disabled={sup}
              className={inputDenseClass}
            >
              <option value="">—</option>
              {SHEET_CURRENCIES.map((v) => (
                <option key={v} value={v}>
                  {v === "RMB"
                    ? "Yuan (RMB)"
                    : t(`currency.name.${v}` as DictionaryKey)}
                </option>
              ))}
            </select>
          </F>
          <F t={t} k="price" size="sm" req>
            <MoneyInput
              name="price"
              watchField="currency"
              defaultAmount={numValue(sheet.price) || null}
              disabled={sup}
              decimals={4}
              size="sm"
            />
          </F>
          <F t={t} k="moq" size="xs" req>
            <Num name="moq" value={numValue(sheet.moq)} disabled={sup} int />
          </F>
        </Rows>
      </Card>

      <Card title={t("sheet.section.carton")} dense>
        <Rows>
          <F t={t} k="masterCartonQty" size="xs" req>
            <Num
              name="masterCartonQty"
              value={numValue(sheet.masterCartonQty)}
              disabled={sup}
              int
            />
          </F>
          <F t={t} k="innerQty" size="xs">
            <Num
              name="innerQty"
              value={numValue(sheet.innerQty)}
              disabled={sup}
              int
            />
          </F>
          <F
            t={t}
            k="cbmPerCarton"
            size="xs"
            req
            hint={
              plan.cbmFromSize !== null
                ? t("sheet.cbmFromSize", { cbm: String(plan.cbmFromSize) })
                : undefined
            }
          >
            <Num
              name="cbmPerCarton"
              value={numValue(sheet.cbmPerCarton)}
              disabled={sup}
            />
          </F>
          <F t={t} k="packageType" size="md" req>
            <input
              name="packageType"
              maxLength={120}
              placeholder="COLOR BOX"
              defaultValue={sheet.packageType ?? ""}
              disabled={sup}
              className={inputDenseClass}
            />
          </F>
          {/* Altura × Largura × Comprimento numa linha só. */}
          <FieldRow
            label={t("sheet.field.size")}
            required
            requiredTitle={required}
            size="full"
          >
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["heightCm", sheet.heightCm],
                  ["widthCm", sheet.widthCm],
                  ["lengthCm", sheet.lengthCm],
                ] as const
              ).map(([name, value], i) => (
                <label key={name} className="flex items-center gap-1.5">
                  {i > 0 ? (
                    <span aria-hidden className="text-xs text-zinc-400">
                      ×
                    </span>
                  ) : null}
                  <span className="text-xs text-zinc-600">
                    {t(`sheet.field.${name}` as DictionaryKey)}
                  </span>
                  <Num
                    name={name}
                    value={numValue(value)}
                    disabled={sup}
                    className="w-20"
                  />
                </label>
              ))}
            </div>
          </FieldRow>
        </Rows>
      </Card>

      <Card title={t("sheet.section.schedule")} dense>
        <Rows>
          {!master ? (
            <F t={t} k="productionStartAt" size="sm" req>
              <input
                type="date"
                name="productionStartAt"
                defaultValue={dateValue(sheet.productionStartAt)}
                disabled={sup}
                className={inputDenseClass}
              />
            </F>
          ) : null}
          <F t={t} k="containerType" size="sm">
            <select
              name="containerType"
              defaultValue={view.containerType ?? ""}
              disabled={sup}
              className={inputDenseClass}
            >
              {view.containerTypes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.capacityCbm} m³
                </option>
              ))}
            </select>
          </F>
        </Rows>
        {master ? (
          <p className="mt-3 text-xs text-zinc-500">
            {t("productSheet.scheduleHint")}
          </p>
        ) : (
          <>
            <p className="mt-3 text-xs text-zinc-500">
              {t("sheet.lot.intervalHint")}
            </p>
            {/* Lotes, totais e sugestão para fechar o container: ao vivo, com a mesma conta do servidor. */}
            <SheetSchedule
              initialLots={lots.map((l) => ({
                departureIntervalDays: l.departureIntervalDays,
                masterCartons: l.masterCartons,
              }))}
              initial={{
                masterCartonQty: sheet.masterCartonQty ?? null,
                cbmPerCarton: sheet.cbmPerCarton ?? null,
                heightCm: sheet.heightCm ?? null,
                widthCm: sheet.widthCm ?? null,
                lengthCm: sheet.lengthCm ?? null,
                productionStartAt: dateValue(sheet.productionStartAt) || null,
                containerType: view.containerType ?? null,
              }}
              containerTypes={view.containerTypes}
              disabled={sup}
              lotRequired={lotRequired}
              requested={requestSchedule?.items ?? []}
              unit={requestUnit}
              labels={{
                lotColumn: t("sheet.lot.column"),
                interval: t("sheet.lot.interval"),
                cartons: t("sheet.lot.cartons"),
                pieces: t("sheet.lot.pieces"),
                cbm: t("sheet.lot.cbm"),
                departure: t("sheet.lot.departure"),
                lotTitle: t("sheet.lot.title", { n: "{n}" }),
                required,
                totalPieces: t("sheet.total.pieces"),
                totalCbm: t("sheet.total.cbm"),
                totalContainers: t("sheet.total.containers", {
                  type: "{type}",
                  capacity: "{capacity}",
                }),
                live: t("sheet.fill.live"),
                fillTitle: t("sheet.fill.title"),
                partial: t("sheet.fill.partial"),
                add: t("sheet.fill.add"),
                addNoPieces: t("sheet.fill.addNoPieces"),
                apply: t("sheet.fill.apply"),
                remove: t("sheet.fill.remove"),
                removeNoPieces: t("sheet.fill.removeNoPieces"),
                applyRemove: t("sheet.fill.applyRemove"),
                exact: t("sheet.fill.exact"),
                full: t("sheet.fill.full"),
                need: t("sheet.fill.need"),
                applied: t("sheet.fill.applied"),
                addLot: t("sheet.lot.add"),
                removeLot: t("sheet.lot.remove", { n: "{n}" }),
                requested: t("sheet.lot.requested", {
                  quantity: "{quantity}",
                  unit: "{unit}",
                  date: "{date}",
                }),
              }}
            />
            <p className="mt-2 text-xs text-zinc-500">
              {t("sheet.total.hint")}
            </p>
          </>
        )}
      </Card>

      <Card title={t("sheet.section.customs")} dense>
        <Rows>
          <F t={t} k="ncm" size="sm">
            <input
              name="ncm"
              inputMode="decimal"
              maxLength={12}
              placeholder="0000.00.00"
              defaultValue={sheet.ncm ?? ""}
              disabled={!access.editCustoms}
              className={inputDenseClass}
            />
          </F>
          <F t={t} k="importTaxPercent" size="xs">
            <Num
              name="importTaxPercent"
              value={numValue(sheet.importTaxPercent)}
              disabled={!access.editCustoms}
            />
          </F>
          <F t={t} k="ipiPercent" size="xs">
            <Num
              name="ipiPercent"
              value={numValue(sheet.ipiPercent)}
              disabled={!access.editCustoms}
            />
          </F>
        </Rows>
      </Card>

      <Card title={t("sheet.section.ecommerce")} dense>
        <Rows>
          <F t={t} k="ecommerceDescription" size="full">
            <textarea
              name="ecommerceDescription"
              rows={3}
              maxLength={4000}
              defaultValue={sheet.ecommerceDescription ?? ""}
              disabled={sup}
              className={cx(inputDenseClass, "min-h-16")}
            />
          </F>
          <F t={t} k="notes" size="full">
            <textarea
              name="notes"
              rows={2}
              maxLength={2000}
              defaultValue={sheet.notes ?? ""}
              disabled={sup}
              className={cx(inputDenseClass, "min-h-12")}
            />
          </F>
        </Rows>
      </Card>
    </>
  );
}

/** Campo da ficha: rótulo traduzido, obrigatório (quando conta para concluir) e largura. */
function SheetField({
  t,
  k,
  size,
  req,
  hint,
  children,
}: {
  t: Translate;
  k: string;
  size?: keyof typeof fieldRowWidth;
  req?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <FieldRow
      label={t(`sheet.field.${k}` as DictionaryKey)}
      size={size}
      required={req}
      requiredTitle={t("sheet.required")}
      hint={hint}
    >
      {children}
    </FieldRow>
  );
}

/** Lista de campos, um abaixo do outro. */
function Rows({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

function Num({
  name,
  value,
  disabled,
  int,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  name: string;
  value: string;
  disabled?: boolean;
  int?: boolean;
  className?: string;
  /** Vem do FieldRow (rótulo ligado pelo htmlFor). */
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={int ? "numeric" : "decimal"}
      pattern={int ? "[0-9]*" : "[0-9]*[.,]?[0-9]*"}
      defaultValue={value}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cx(inputDenseClass, "tabular-nums", className)}
    />
  );
}
