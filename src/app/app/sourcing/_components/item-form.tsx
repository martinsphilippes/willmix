import type { Translate } from "@/i18n";
import {
  SOURCING_STATUSES,
  type Party,
  type ProductLine,
  type SourcingItem,
} from "@/lib/db";
import {
  Badge,
  Field,
  Input,
  LinkButton,
  Select,
  Textarea,
} from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton } from "@/components/submit-button";
import { saveSourcingItemAction } from "../../actions/sourcing";
import {
  SaveBar,
  Section,
  bigField,
  dateValue,
  formatNumber,
  sourcingTone,
  todayValue,
} from "./shared";

const CURRENCIES = ["USD", "CNY", "BRL", "EUR"] as const;

/** Valores herdados da visita quando o item nasce a partir dela. */
export interface ItemPreset {
  visitId?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  city?: string | null;
  location?: string | null;
  foundAt?: string | null;
}

/**
 * Formulário do produto encontrado: abrir → fotografar → preencher → salvar.
 * Fotos no topo (só no cadastro; na ficha a galeria cuida disso), seções
 * recolhíveis, botão principal ao alcance do polegar. Sem autosave: salve
 * como rascunho e complete depois.
 */
export function ItemForm({
  t,
  item,
  suppliers,
  lines,
  preset,
}: {
  t: Translate;
  item?: SourcingItem | null;
  suppliers: Party[];
  lines: ProductLine[];
  preset?: ItemPreset;
}) {
  const isNew = !item;
  const supplierId = item?.supplierId ?? preset?.supplierId ?? "";
  const registered = supplierId
    ? suppliers.find((s) => s.id === supplierId)
    : null;
  const supplierName = item?.supplierName ?? preset?.supplierName ?? "";
  const otherName =
    supplierName && supplierName !== registered?.name ? supplierName : "";
  // Na edição, as seções com dados abrem; no cadastro, só a primeira.
  const has = (...values: Array<string | number | null | undefined>) =>
    !isNew && values.some((v) => v !== null && v !== undefined && v !== "");
  const promoted = item?.status === "promoted";

  return (
    <form action={saveSourcingItemAction} className="space-y-3">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {!item && preset?.visitId ? (
        <input type="hidden" name="visitId" value={preset.visitId} />
      ) : null}
      {isNew ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.03]">
          <PhotoInput
            name="photos"
            label={t("sourcing.item.photos")}
            hint={t("sourcing.item.photoHint")}
          />
        </div>
      ) : null}

      <Section title={t("sourcing.item.section.identity")} open>
        <div className="sm:col-span-2">
          <Field label={t("common.name")}>
            <Input
              name="name"
              required
              maxLength={160}
              defaultValue={item?.name ?? ""}
              className={bigField}
              autoFocus={isNew}
            />
          </Field>
        </div>
        <Field
          label={t("sourcing.item.supplier")}
          hint={t("sourcing.visit.supplierHint")}
        >
          <Select
            name="supplierId"
            defaultValue={supplierId}
            className={bigField}
          >
            <option value="">{t("common.select")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.city ? ` · ${s.city}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("sourcing.item.otherSupplier")}>
          <Input
            name="supplierName"
            defaultValue={otherName}
            className={bigField}
          />
        </Field>
        <Field label={t("sourcing.item.supplierSku")}>
          <Input
            name="supplierSku"
            defaultValue={item?.supplierSku ?? ""}
            className={bigField}
          />
        </Field>
        <Field label={t("sourcing.item.category")}>
          <Input
            name="category"
            defaultValue={item?.category ?? ""}
            className={bigField}
          />
        </Field>
        <Field label={t("sourcing.item.line")}>
          <Select
            name="lineId"
            defaultValue={item?.lineId ?? ""}
            className={bigField}
          >
            <option value="">{t("common.select")}</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("sourcing.item.description")}>
            <Textarea
              name="description"
              rows={2}
              defaultValue={item?.description ?? ""}
              className={bigField}
            />
          </Field>
        </div>
      </Section>

      <Section
        title={t("sourcing.item.section.negotiation")}
        open={has(item?.price, item?.moq, item?.conditions)}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("common.price")}>
            <Input
              name="price"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              defaultValue={item?.price ?? ""}
              className={bigField}
            />
          </Field>
          <Field label={t("common.currency")}>
            <Select
              name="currency"
              defaultValue={item?.currency ?? "USD"}
              className={bigField}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("sourcing.moq")}>
          <Input
            name="moq"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            defaultValue={item?.moq ?? ""}
            className={bigField}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("sourcing.item.conditions")}>
            <Textarea
              name="conditions"
              rows={2}
              defaultValue={item?.conditions ?? ""}
              className={bigField}
              placeholder="Ex.: FOB Ningbo, 30% sinal, saldo contra BL"
            />
          </Field>
        </div>
      </Section>

      <Section
        title={t("sourcing.item.section.packaging")}
        open={has(item?.masterBoxQty, item?.innerBoxQty, item?.boxLengthCm)}
      >
        <Field label={t("sourcing.item.masterBoxQty")}>
          <Input
            name="masterBoxQty"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            defaultValue={item?.masterBoxQty ?? ""}
            className={bigField}
          />
        </Field>
        <Field label={t("sourcing.item.innerBoxQty")}>
          <Input
            name="innerBoxQty"
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            defaultValue={item?.innerBoxQty ?? ""}
            className={bigField}
          />
        </Field>
        <div className="sm:col-span-2">
          <span className="text-sm font-medium text-zinc-800">
            {t("sourcing.item.boxDims")}
          </span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <Field label={t("sourcing.dim.length")}>
              <Input
                name="boxLengthCm"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                defaultValue={item?.boxLengthCm ?? ""}
                className={bigField}
              />
            </Field>
            <Field label={t("sourcing.dim.width")}>
              <Input
                name="boxWidthCm"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                defaultValue={item?.boxWidthCm ?? ""}
                className={bigField}
              />
            </Field>
            <Field label={t("sourcing.dim.height")}>
              <Input
                name="boxHeightCm"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                defaultValue={item?.boxHeightCm ?? ""}
                className={bigField}
              />
            </Field>
          </div>
        </div>
        <div className="sm:col-span-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          <span className="font-medium">{t("sourcing.item.cbm")}:</span>{" "}
          {item?.cbm ? `${formatNumber(item.cbm)} m³` : "—"}
          <span className="block text-xs text-zinc-500">
            {t("sourcing.item.cbmHint")}
          </span>
        </div>
      </Section>

      <Section
        title={t("sourcing.item.section.product")}
        open={has(
          item?.material,
          item?.color,
          item?.pantone,
          item?.netWeightKg,
          item?.lengthCm,
        )}
      >
        <Field label={t("sourcing.item.material")}>
          <Input
            name="material"
            defaultValue={item?.material ?? ""}
            className={bigField}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("sourcing.item.color")}>
            <Input
              name="color"
              defaultValue={item?.color ?? ""}
              className={bigField}
            />
          </Field>
          <Field label={t("sourcing.item.pantone")}>
            <Input
              name="pantone"
              defaultValue={item?.pantone ?? ""}
              className={bigField}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <span className="text-sm font-medium text-zinc-800">
            {t("sourcing.item.productDims")}
          </span>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <Field label={t("sourcing.dim.length")}>
              <Input
                name="lengthCm"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                defaultValue={item?.lengthCm ?? ""}
                className={bigField}
              />
            </Field>
            <Field label={t("sourcing.dim.width")}>
              <Input
                name="widthCm"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                defaultValue={item?.widthCm ?? ""}
                className={bigField}
              />
            </Field>
            <Field label={t("sourcing.dim.height")}>
              <Input
                name="heightCm"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                defaultValue={item?.heightCm ?? ""}
                className={bigField}
              />
            </Field>
          </div>
        </div>
        <Field label={t("sourcing.item.netWeight")}>
          <Input
            name="netWeightKg"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            defaultValue={item?.netWeightKg ?? ""}
            className={bigField}
          />
        </Field>
        <Field label={t("sourcing.item.grossWeight")}>
          <Input
            name="grossWeightKg"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            defaultValue={item?.grossWeightKg ?? ""}
            className={bigField}
          />
        </Field>
      </Section>

      <Section
        title={t("sourcing.item.section.place")}
        open={has(item?.city, item?.location)}
      >
        <Field label={t("sourcing.visit.city")}>
          <Input
            name="city"
            defaultValue={item?.city ?? preset?.city ?? ""}
            className={bigField}
          />
        </Field>
        <Field label={t("sourcing.visit.location")}>
          <Input
            name="location"
            defaultValue={item?.location ?? preset?.location ?? ""}
            className={bigField}
          />
        </Field>
        <Field label={t("sourcing.foundAt")}>
          <Input
            name="foundAt"
            type="date"
            defaultValue={
              dateValue(item?.foundAt ?? preset?.foundAt) || todayValue()
            }
            className={bigField}
          />
        </Field>
      </Section>

      <Section
        title={t("sourcing.item.section.notes")}
        open={has(item?.notes) || (!isNew && item?.status !== "draft")}
      >
        <div className="sm:col-span-2">
          <Field label={t("common.note")}>
            <Textarea
              name="notes"
              rows={3}
              defaultValue={item?.notes ?? ""}
              className={bigField}
            />
          </Field>
        </div>
        <Field label={t("common.status")}>
          {promoted ? (
            <span className="block py-2">
              <Badge tone={sourcingTone("promoted")}>
                {t("sourcing.status.promoted")}
              </Badge>
            </span>
          ) : (
            <Select
              name="status"
              defaultValue={item?.status ?? "draft"}
              className={bigField}
            >
              {SOURCING_STATUSES.filter((s) => s !== "promoted").map((s) => (
                <option key={s} value={s}>
                  {t(`sourcing.status.${s}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Section>

      <SaveBar hint={isNew ? t("sourcing.item.saveHint") : undefined}>
        <SubmitButton
          pendingText="…"
          className="w-full py-3 text-base sm:w-auto sm:py-2 sm:text-sm"
        >
          {t("common.save")}
        </SubmitButton>
        <LinkButton
          href={
            preset?.visitId && isNew
              ? `/app/sourcing/visits/${preset.visitId}`
              : "/app/sourcing"
          }
          variant="ghost"
          className="w-full sm:w-auto"
        >
          {t("common.back")}
        </LinkButton>
      </SaveBar>
    </form>
  );
}
