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
  Field,
  Input,
  Select,
  Textarea,
  cx,
  formatDate,
} from "@/components/ui";
import { MoneyInput } from "./money-input";

/*
 * Campos da ficha de compra (planilha COMPRAS), usados dentro de um <form>:
 * na Preparação do pedido e na resposta da RFQ pelo fornecedor. Peças, CBM,
 * containers e datas vêm calculados do servidor (`plan`).
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
  return (
    <>
      <Card title={t("sheet.section.supplier")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <F t={t} k="sheetDate">
            <Input
              type="date"
              name="sheetDate"
              defaultValue={dateValue(sheet.sheetDate)}
              disabled={sup}
            />
          </F>
          <F t={t} k="location">
            <Input
              name="location"
              maxLength={80}
              placeholder="YIWU"
              defaultValue={sheet.location ?? ""}
              disabled={sup}
            />
          </F>
          <F t={t} k="supplierName" required>
            <Input
              name="supplierName"
              maxLength={160}
              defaultValue={sheet.supplierName ?? ""}
              disabled={sup}
            />
          </F>
          <F t={t} k="supplierStore">
            <Input
              name="supplierStore"
              maxLength={60}
              placeholder="A 154678"
              defaultValue={sheet.supplierStore ?? ""}
              disabled={sup}
            />
          </F>
          <F t={t} k="supplierPhone">
            <Input
              name="supplierPhone"
              type="tel"
              maxLength={40}
              defaultValue={sheet.supplierPhone ?? ""}
              disabled={sup}
            />
          </F>
          <F t={t} k="factoryItemCode">
            <Input
              name="factoryItemCode"
              maxLength={60}
              defaultValue={sheet.factoryItemCode ?? ""}
              disabled={sup}
            />
          </F>
        </div>
      </Card>

      <Card title={t("sheet.section.price")}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <F t={t} k="incoterm" required>
            <Select
              name="incoterm"
              defaultValue={sheet.incoterm ?? ""}
              disabled={sup}
            >
              <option value="">—</option>
              {SHEET_INCOTERMS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </F>
          <F t={t} k="currency" required>
            <Select
              name="currency"
              defaultValue={sheet.currency ?? ""}
              disabled={sup}
            >
              <option value="">—</option>
              {SHEET_CURRENCIES.map((v) => (
                <option key={v} value={v}>
                  {v === "RMB"
                    ? "Yuan (RMB)"
                    : t(`currency.name.${v}` as DictionaryKey)}
                </option>
              ))}
            </Select>
          </F>
          <F t={t} k="price" required>
            <MoneyInput
              name="price"
              watchField="currency"
              defaultAmount={numValue(sheet.price) || null}
              disabled={sup}
              decimals={4}
            />
          </F>
          <F t={t} k="moq" required>
            <Num name="moq" value={numValue(sheet.moq)} disabled={sup} int />
          </F>
        </div>
      </Card>

      <Card title={t("sheet.section.carton")}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <F t={t} k="masterCartonQty" required>
            <Num
              name="masterCartonQty"
              value={numValue(sheet.masterCartonQty)}
              disabled={sup}
              int
            />
          </F>
          <F t={t} k="innerQty">
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
            required
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
          <F t={t} k="packageType" required>
            <Input
              name="packageType"
              maxLength={120}
              placeholder="COLOR BOX"
              defaultValue={sheet.packageType ?? ""}
              disabled={sup}
            />
          </F>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-zinc-800">
            {t("sheet.field.size")}{" "}
            <span
              className="ml-0.5 font-semibold text-brand-600"
              title={t("sheet.required")}
            >
              <span aria-hidden>*</span>
              <span className="sr-only">({t("sheet.required")})</span>
            </span>
          </legend>
          <div className="mt-1 grid grid-cols-3 gap-4">
            <Field
              label={
                <span className="text-xs text-zinc-600">
                  {t("sheet.field.heightCm")}
                </span>
              }
            >
              <Num
                name="heightCm"
                value={numValue(sheet.heightCm)}
                disabled={sup}
              />
            </Field>
            <Field
              label={
                <span className="text-xs text-zinc-600">
                  {t("sheet.field.widthCm")}
                </span>
              }
            >
              <Num
                name="widthCm"
                value={numValue(sheet.widthCm)}
                disabled={sup}
              />
            </Field>
            <Field
              label={
                <span className="text-xs text-zinc-600">
                  {t("sheet.field.lengthCm")}
                </span>
              }
            >
              <Num
                name="lengthCm"
                value={numValue(sheet.lengthCm)}
                disabled={sup}
              />
            </Field>
          </div>
        </fieldset>
      </Card>

      <Card title={t("sheet.section.product")}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <F t={t} k="netWeightPcKg" required>
            <Num
              name="netWeightPcKg"
              value={numValue(sheet.netWeightPcKg)}
              disabled={sup}
            />
          </F>
          <F t={t} k="grossWeightPcKg" required>
            <Num
              name="grossWeightPcKg"
              value={numValue(sheet.grossWeightPcKg)}
              disabled={sup}
            />
          </F>
          <F t={t} k="capacityMl">
            <Num
              name="capacityMl"
              value={numValue(sheet.capacityMl)}
              disabled={sup}
            />
          </F>
          <F t={t} k="colorAssortment" required>
            <Input
              name="colorAssortment"
              maxLength={200}
              placeholder="WHITE / BLACK / RED"
              defaultValue={sheet.colorAssortment ?? ""}
              disabled={sup}
            />
          </F>
          <F t={t} k="material" required>
            <Input
              name="material"
              maxLength={200}
              placeholder="PLASTIC / IRON"
              defaultValue={sheet.material ?? ""}
              disabled={sup}
            />
          </F>
          <F t={t} k="powerSource">
            <Select
              name="powerSource"
              defaultValue={sheet.powerSource ?? ""}
              disabled={sup}
            >
              <option value="">—</option>
              {SHEET_POWER_SOURCES.map((v) => (
                <option key={v} value={v}>
                  {t(`sheet.power.${v}` as DictionaryKey)}
                </option>
              ))}
            </Select>
          </F>
          <div className="sm:col-span-2 lg:col-span-3">
            <F t={t} k="powerDetail">
              <Input
                name="powerDetail"
                maxLength={60}
                placeholder="12V"
                defaultValue={sheet.powerDetail ?? ""}
                disabled={sup}
              />
            </F>
          </div>
        </div>
      </Card>

      <Card title={t("sheet.section.schedule")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <F t={t} k="productionStartAt" required>
            <Input
              type="date"
              name="productionStartAt"
              defaultValue={dateValue(sheet.productionStartAt)}
              disabled={sup}
            />
          </F>
          <F t={t} k="containerType">
            <Select
              name="containerType"
              defaultValue={view.containerType ?? ""}
              disabled={sup}
            >
              {view.containerTypes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.capacityCbm} m³
                </option>
              ))}
            </Select>
          </F>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {t("sheet.lot.intervalHint")}
        </p>
        <ul className="mt-3 space-y-3">
          {lots.map((lot) => (
            <li
              key={lot.index}
              className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
            >
              <p className="mb-2 text-sm font-semibold text-zinc-900">
                {t("sheet.lot.title", { n: String(lot.index) })}
                {lot.index === 1 && lotRequired ? (
                  <span
                    className="ml-0.5 font-semibold text-brand-600"
                    title={t("sheet.required")}
                  >
                    <span aria-hidden>*</span>
                    <span className="sr-only">({t("sheet.required")})</span>
                  </span>
                ) : null}
              </p>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <Field
                  label={
                    <span className="text-xs text-zinc-600">
                      {t("sheet.lot.interval")}
                    </span>
                  }
                >
                  <Num
                    name={`lot${lot.index}Interval`}
                    value={numValue(lot.departureIntervalDays)}
                    disabled={sup}
                    int
                  />
                </Field>
                <Field
                  label={
                    <span className="text-xs text-zinc-600">
                      {t("sheet.lot.cartons")}
                    </span>
                  }
                >
                  <Num
                    name={`lot${lot.index}Cartons`}
                    value={numValue(lot.masterCartons)}
                    disabled={sup}
                    int
                  />
                </Field>
                <Calc
                  label={t("sheet.lot.pieces")}
                  value={lot.pieces?.toLocaleString("pt-BR")}
                />
                <Calc
                  label={t("sheet.lot.cbm")}
                  value={lot.cbm !== null ? `${lot.cbm} m³` : null}
                />
                <Calc
                  label={t("sheet.lot.departure")}
                  value={lot.departureAt ? formatDate(lot.departureAt) : null}
                />
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-brand-50/60 p-3 text-sm ring-1 ring-inset ring-brand-100 sm:grid-cols-3">
          <Calc
            label={t("sheet.total.pieces")}
            value={plan.totalPieces?.toLocaleString("pt-BR")}
            strong
          />
          <Calc
            label={t("sheet.total.cbm")}
            value={plan.totalCbm !== null ? `${plan.totalCbm} m³` : null}
            strong
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
            strong
          />
        </dl>
        <p className="mt-2 text-xs text-zinc-500">{t("sheet.total.hint")}</p>
      </Card>

      <Card title={t("sheet.section.customs")}>
        <div className="grid grid-cols-3 gap-4">
          <F t={t} k="ncm">
            <Input
              name="ncm"
              inputMode="decimal"
              maxLength={12}
              placeholder="0000.00.00"
              defaultValue={sheet.ncm ?? ""}
              disabled={!access.editCustoms}
            />
          </F>
          <F t={t} k="importTaxPercent">
            <Num
              name="importTaxPercent"
              value={numValue(sheet.importTaxPercent)}
              disabled={!access.editCustoms}
            />
          </F>
          <F t={t} k="ipiPercent">
            <Num
              name="ipiPercent"
              value={numValue(sheet.ipiPercent)}
              disabled={!access.editCustoms}
            />
          </F>
        </div>
      </Card>

      <Card title={t("sheet.section.ecommerce")}>
        <div className="space-y-4">
          <Textarea
            name="ecommerceDescription"
            rows={4}
            maxLength={4000}
            aria-label={t("sheet.field.ecommerceDescription")}
            defaultValue={sheet.ecommerceDescription ?? ""}
            disabled={sup}
          />
          <F t={t} k="notes">
            <Textarea
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={sheet.notes ?? ""}
              disabled={sup}
            />
          </F>
        </div>
      </Card>
    </>
  );
}

/** Rótulo do campo da ficha (com "obrigatório" quando conta para concluir). */
function F({
  t,
  k,
  required,
  hint,
  children,
}: {
  t: Translate;
  k: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Field
      label={
        <>
          {t(`sheet.field.${k}` as DictionaryKey)}
          {required ? (
            <span
              className="ml-0.5 font-semibold text-brand-600"
              title={t("sheet.required")}
            >
              <span aria-hidden>*</span>
              <span className="sr-only">({t("sheet.required")})</span>
            </span>
          ) : null}
        </>
      }
      hint={hint}
    >
      {children}
    </Field>
  );
}

function Num({
  name,
  value,
  disabled,
  int,
}: {
  name: string;
  value: string;
  disabled?: boolean;
  int?: boolean;
}) {
  return (
    <Input
      name={name}
      type="text"
      inputMode={int ? "numeric" : "decimal"}
      pattern={int ? "[0-9]*" : "[0-9]*[.,]?[0-9]*"}
      defaultValue={value}
      disabled={disabled}
      className="tabular-nums"
    />
  );
}

function Calc({
  label,
  value,
  strong,
}: {
  label: string;
  value: string | null | undefined;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={cx(
          "mt-1 tabular-nums",
          strong
            ? "text-base font-semibold text-zinc-900"
            : "text-sm text-zinc-800",
        )}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}
