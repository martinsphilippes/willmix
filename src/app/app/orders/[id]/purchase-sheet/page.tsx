import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getStore,
  SHEET_CURRENCIES,
  SHEET_INCOTERMS,
  SHEET_POWER_SOURCES,
} from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Translate } from "@/i18n";
import {
  Alert,
  Badge,
  Card,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Textarea,
  cx,
  formatDate,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PhotoInput } from "@/components/photo-input";
import {
  getSheetForUser,
  SHEET_PHOTO_KINDS,
  type SheetView,
} from "@/lib/services/purchase-sheet";
import {
  addPurchaseSheetPhotosAction,
  savePurchaseSheetAction,
} from "../../../actions/purchase-sheet";

/*
 * Ficha de compra (planilha COMPRAS) da Preparação. Pensada para o celular do
 * comprador/fornecedor em Yiwu: campos grandes, teclado numérico, salvar a
 * qualquer momento. Peças, CBM, containers e datas são calculados no servidor.
 */
export default async function PurchaseSheetPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]/purchase-sheet">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { saved, error, photos: photosSent } = await searchParams;
  const view = await getSheetForUser(user, id);
  if (!view) notFound();
  const t = await getT();
  const [item] = await getStore().list("order_items", {
    filter: { orderId: id },
    limit: 1,
  });
  const { sheet, access, plan, missing } = view;
  const missingText = missing
    .map((k) => t(`sheet.field.${k}` as DictionaryKey))
    .join(", ");
  const errorKey = `sheet.error.${typeof error === "string" ? error : ""}`;
  const errorText =
    typeof error === "string"
      ? t(errorKey as DictionaryKey) !== errorKey
        ? t(errorKey as DictionaryKey)
        : `${t("common.error")} (${error})`
      : null;
  const dateValue = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");
  const numValue = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : String(v);
  const sup = !access.editSupplier;
  const lots = plan.lots;

  return (
    <>
      <PageHeader
        t={t}
        title={t("sheet.title")}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {t("sheet.subtitle", {
              number: String(view.order.number),
              product: item?.name ?? "—",
            })}
            {missing.length === 0 ? (
              <Badge tone="success">{t("sheet.complete")}</Badge>
            ) : null}
          </span>
        }
        actions={
          <LinkButton href={`/app/orders/${id}`}>{t("sheet.back")}</LinkButton>
        }
      />
      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-600">
        {t("sheet.intro")}
      </p>
      <div className="mb-4 space-y-3">
        {saved === "complete" ? (
          <Alert tone="success">{t("sheet.saved.complete")}</Alert>
        ) : saved === "partial" ? (
          <Alert tone="warning">
            {t("sheet.saved.partial", { fields: missingText })}
          </Alert>
        ) : missing.length ? (
          <Alert tone="info">
            {t("sheet.missing", { fields: missingText })}
          </Alert>
        ) : null}
        {typeof photosSent === "string" ? (
          <Alert tone="success">{t("sheet.photos.sent")}</Alert>
        ) : null}
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {!view.saved && access.editSupplier ? (
          <Alert tone="neutral">{t("sheet.prefilled")}</Alert>
        ) : null}
        {!access.editSupplier && !access.editCustoms ? (
          <Alert tone="neutral">{t("sheet.readOnly")}</Alert>
        ) : null}
      </div>

      <form action={savePurchaseSheetAction} className="space-y-6">
        <input type="hidden" name="orderId" value={id} />

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
                    {v === "USD" ? "U$ (USD)" : "RMB"}
                  </option>
                ))}
              </Select>
            </F>
            <F t={t} k="price" required>
              <Num name="price" value={numValue(sheet.price)} disabled={sup} />
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
                  {lot.index === 1 ? (
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

        {access.editSupplier || access.editCustoms ? (
          <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <SubmitButton className="w-full py-3 text-base sm:w-auto">
              {t("sheet.save")}
            </SubmitButton>
          </div>
        ) : null}
      </form>

      <Photos view={view} t={t} orderId={id} />
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

function Photos({
  view,
  t,
  orderId,
}: {
  view: SheetView;
  t: Translate;
  orderId: string;
}) {
  return (
    <Card title={t("sheet.section.photos")} className="mt-6">
      <span id="photos" className="block scroll-mt-24" />
      <p className="mb-4 text-sm leading-relaxed text-zinc-600">
        {t("sheet.photos.hint")}
      </p>
      <ul className="space-y-5">
        {SHEET_PHOTO_KINDS.map((kind) => {
          const photos = view.photos.filter((p) => p.kind === kind);
          const required = kind === "weight_scale";
          return (
            <li
              key={kind}
              className="border-t border-zinc-100 pt-4 first:border-0 first:pt-0"
            >
              <p className="text-sm font-semibold text-zinc-900">
                {t(`catalog.photoKind.${kind}` as DictionaryKey)}
                {required ? (
                  <span
                    className="ml-0.5 font-semibold text-brand-600"
                    title={t("sheet.required")}
                  >
                    <span aria-hidden>*</span>
                    <span className="sr-only">({t("sheet.required")})</span>
                  </span>
                ) : null}
              </p>
              {photos.length ? (
                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {photos.map((p) => (
                    <li key={p.id}>
                      <a
                        href={`/api/files/${p.documentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                        <img
                          src={`/api/files/${p.documentId}`}
                          alt={t(`catalog.photoKind.${kind}` as DictionaryKey)}
                          loading="lazy"
                          className="aspect-square w-full object-cover"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-zinc-500">
                  {t("sheet.photos.none")}
                </p>
              )}
              {view.access.addPhotos ? (
                <form
                  action={addPurchaseSheetPhotosAction}
                  className="mt-3 space-y-2"
                >
                  <input type="hidden" name="orderId" value={orderId} />
                  <input type="hidden" name="kind" value={kind} />
                  <PhotoInput
                    name="photos"
                    label={t("sheet.photos.add")}
                    required
                  />
                  <SubmitButton
                    variant="secondary"
                    className="w-full sm:w-auto"
                  >
                    {t("common.send")}
                  </SubmitButton>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
