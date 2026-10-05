import type { PurchaseSheet } from "@/lib/db";
import {
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  SHEET_POWER_SOURCES,
} from "@/lib/db/schema";
import type { SheetPlan } from "@/lib/services/purchase-sheet-calc";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Translate } from "@/i18n";
import {
  Card,
  FieldRow,
  cx,
  fieldRowWidth,
  formatDate,
  inputDenseClass,
} from "@/components/ui";
import { MoneyInput } from "./money-input";

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
      </Card>

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

      <Card title={t("sheet.section.schedule")} dense>
        <Rows>
          <F t={t} k="productionStartAt" size="sm" req>
            <input
              type="date"
              name="productionStartAt"
              defaultValue={dateValue(sheet.productionStartAt)}
              disabled={sup}
              className={inputDenseClass}
            />
          </F>
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
        <p className="mt-3 text-xs text-zinc-500">
          {t("sheet.lot.intervalHint")}
        </p>
        {/* Lotes: tabela compacta, uma linha por lote. */}
        <div className="-mx-3 mt-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <table className="min-w-[34rem] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <th className="w-12 py-1 pr-3 font-medium">
                  {t("sheet.lot.title", { n: "" }).trim()}
                </th>
                <th className="w-28 py-1 pr-3 font-medium">
                  {t("sheet.lot.interval")}
                </th>
                <th className="w-32 py-1 pr-3 font-medium">
                  {t("sheet.lot.cartons")}
                </th>
                <th className="w-24 py-1 pr-3 text-right font-medium">
                  {t("sheet.lot.pieces")}
                </th>
                <th className="w-24 py-1 pr-3 text-right font-medium">
                  {t("sheet.lot.cbm")}
                </th>
                <th className="w-32 py-1 pl-3 font-medium">
                  {t("sheet.lot.departure")}
                </th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.index} className="border-t border-zinc-100">
                  <td className="py-1.5 pr-3 font-semibold text-zinc-800">
                    {lot.index}
                    {lot.index === 1 && lotRequired ? (
                      <span
                        className="ml-0.5 font-semibold text-brand-600"
                        title={required}
                      >
                        <span aria-hidden>*</span>
                        <span className="sr-only">({required})</span>
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3">
                    <Num
                      name={`lot${lot.index}Interval`}
                      value={numValue(lot.departureIntervalDays)}
                      disabled={sup}
                      int
                      className="w-20"
                      aria-label={`${t("sheet.lot.title", { n: String(lot.index) })}: ${t("sheet.lot.interval")}`}
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <Num
                      name={`lot${lot.index}Cartons`}
                      value={numValue(lot.masterCartons)}
                      disabled={sup}
                      int
                      className="w-24"
                      aria-label={`${t("sheet.lot.title", { n: String(lot.index) })}: ${t("sheet.lot.cartons")}`}
                    />
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-800">
                    {lot.pieces?.toLocaleString("pt-BR") ?? "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-800">
                    {lot.cbm !== null ? `${lot.cbm} m³` : "—"}
                  </td>
                  <td className="py-1.5 pl-3 tabular-nums text-zinc-800">
                    {lot.departureAt ? formatDate(lot.departureAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-brand-50/60 px-3 py-2 text-sm ring-1 ring-inset ring-brand-100">
          <Calc
            label={t("sheet.total.pieces")}
            value={plan.totalPieces?.toLocaleString("pt-BR")}
          />
          <Calc
            label={t("sheet.total.cbm")}
            value={plan.totalCbm !== null ? `${plan.totalCbm} m³` : null}
          />
          <Calc
            label={t("sheet.total.containers", {
              type: view.containerType ?? "—",
              capacity: String(plan.containerCapacityCbm ?? "—"),
            })}
            value={
              plan.containers !== null
                ? plan.containers.toLocaleString("pt-BR", {
                    maximumFractionDigits: 2,
                  })
                : null
            }
          />
        </dl>
        <p className="mt-2 text-xs text-zinc-500">{t("sheet.total.hint")}</p>
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
  "aria-label": ariaLabel,
}: {
  name: string;
  value: string;
  disabled?: boolean;
  int?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <input
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

function Calc({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-zinc-900">
        {value ?? "—"}
      </dd>
    </div>
  );
}
