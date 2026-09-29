import { notFound, redirect } from "next/navigation";
import type { ComponentProps } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { assertWellmix } from "@/lib/auth/permissions";
import {
  getStore,
  MEASUREMENT_KINDS,
  PHOTO_KINDS,
  SCHEDULE_STATUSES,
  type ProductPhoto,
} from "@/lib/db";
import { cbmFromDimensions } from "@/lib/logistics/cbm";
import { loadProductSheet } from "@/lib/services/sourcing";
import { listTaxClassifications } from "@/lib/services/taxes";
import {
  checkProductCompliance,
  listCertifications,
} from "@/lib/services/compliance";
import {
  boxesForQuantity,
  containerFillOpportunities,
  formatPriceTiers,
  sortTiers,
  tierOpportunity,
} from "@/lib/services/opportunities";
import { getSettings } from "@/lib/settings";
import { checkRequiredAttributes } from "@/lib/ai/prompts";
import { getAiAdapter } from "@/lib/integrations/ai";
import { listSuggestions } from "@/lib/services/ai-suggestions";
import { loadProductCycle } from "@/lib/services/product-cycle";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Button,
  Card,
  DescriptionList,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  Td,
  TextLink,
  Textarea,
  Th,
  cx,
  formatDate,
  formatMoney,
  linkClass,
  rowClass,
  type Tone,
} from "@/components/ui";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton } from "@/components/submit-button";
import {
  addProductMeasurementAction,
  addProductPhotosAction,
  savePurchaseScheduleAction,
  saveProductPriceTiersAction,
  setPrimaryPhotoAction,
  setScheduleStatusAction,
  updateProductSheetAction,
} from "../../actions/catalog";
import { CertificationsSection } from "../_components/certifications-section";
import { TaxSection } from "../_components/tax-section";
import { catalogError } from "../_components/shared";
import {
  AiSection,
  collectAiPhotos,
  visionError,
} from "../_components/ai-section";
import { CycleCard } from "../_components/cycle-card";

/* Campos maiores para uso no celular (fábrica/feira): py-2.5 em vez de py-2. */
const big = "py-2.5";
const sourceTone = {
  manual: "neutral",
  sourcing: "brand",
  import: "info",
} as const;
const scheduleTone: Record<string, Tone> = {
  planned: "neutral",
  confirmed: "info",
  ordered: "success",
  cancelled: "danger",
};
const CURRENCIES = ["USD", "CNY", "BRL", "EUR"];

function CurrencySelect({
  name,
  value,
  t,
}: {
  name: string;
  value: string | null;
  t: Translate;
}) {
  const options =
    value && !CURRENCIES.includes(value) ? [value, ...CURRENCIES] : CURRENCIES;
  return (
    <Select name={name} defaultValue={value ?? ""} className={big}>
      <option value="">{t("common.select")}</option>
      {options.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Select>
  );
}

function NumberInput({
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
      className={cx(big, className)}
      {...props}
    />
  );
}

/** Miniatura de foto do produto (download controlado por /api/files). */
function Thumb({ photo, alt }: { photo: ProductPhoto; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arquivo servido pela API com controle de acesso
    <img
      src={`/api/files/${photo.documentId}`}
      alt={alt}
      loading="lazy"
      className="aspect-square w-full rounded-lg border border-zinc-200 bg-zinc-50 object-cover"
    />
  );
}

export default async function ProductSheetPage({
  params,
  searchParams,
}: PageProps<"/app/products/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  assertWellmix(user);
  const { id } = await params;
  const { error, saved, qty } = await searchParams;
  const sheet = await loadProductSheet(id);
  if (!sheet) notFound();
  const {
    product,
    photos,
    measurements,
    schedules,
    supplier,
    line,
    sourcing,
    documents,
  } = sheet;
  const t = await getT();
  const store = getStore();
  const [lines, suppliers, customers, users] = await Promise.all([
    store.list("product_lines", { orderBy: "name" }),
    store.list("parties", { filter: { type: "supplier" }, orderBy: "name" }),
    store.list("parties", { filter: { type: "customer" }, orderBy: "name" }),
    store.list("users"),
  ]);
  const userName = (uid: string | null) =>
    uid ? (users.find((u) => u.id === uid)?.name ?? "—") : "—";
  const partyName = (pid: string | null) =>
    pid
      ? ([...suppliers, ...customers].find((p) => p.id === pid)?.name ?? "—")
      : "—";
  const cbmComputed = cbmFromDimensions(
    product.boxLengthCm,
    product.boxWidthCm,
    product.boxHeightCm,
  );
  const cbmShown = cbmComputed ?? product.cbm;
  const photosByKind = PHOTO_KINDS.map((kind) => ({
    kind,
    items: photos
      .filter((p) => p.kind === kind)
      .sort((a, b) => (a.takenAt ?? "").localeCompare(b.takenAt ?? "")),
  })).filter((g) => g.items.length > 0);
  const nextSequence =
    schedules.reduce((max, s) => Math.max(max, s.sequence), 0) + 1;

  /* Segunda Onda: NCM, certificações/compliance e oportunidade de compra. */
  const [
    taxRows,
    certs,
    compliance,
    settings,
    fillOpportunities,
    suggestions,
    cycle,
  ] = await Promise.all([
    listTaxClassifications(id),
    listCertifications("product", id),
    checkProductCompliance(id),
    getSettings(),
    containerFillOpportunities(user),
    // Visão de Produto: sugestões por foto (IA) e ciclo contínuo do produto.
    listSuggestions("product", id),
    loadProductCycle(id),
  ]);
  const aiAdapter = getAiAdapter(settings);
  const attributeCheck = checkRequiredAttributes(product, line);
  const aiPhotos = collectAiPhotos(
    photos,
    documents,
    product.primaryPhotoDocumentId,
    (kind) => t(`catalog.photoKind.${kind}` as DictionaryKey),
  );
  const containerFits = fillOpportunities.flatMap((c) => {
    const fit = c.suggestions.find((s) => s.productId === product.id);
    return fit ? [{ ...c, fit }] : [];
  });
  const tiers = sortTiers(product.priceTiers);
  // Quantidade analisada: ?qty= informado; senão a última programação; senão o MOQ.
  const lastSchedule = [...schedules]
    .filter((s) => s.status !== "cancelled")
    .sort((a, b) => b.sequence - a.sequence)[0];
  const qtyParam = typeof qty === "string" ? Number(qty) : NaN;
  const analysis =
    Number.isFinite(qtyParam) && qtyParam > 0
      ? { quantity: qtyParam, source: "param" as const }
      : lastSchedule
        ? { quantity: lastSchedule.quantity, source: "schedule" as const }
        : product.moq
          ? { quantity: product.moq, source: "moq" as const }
          : null;
  const opportunity = analysis
    ? tierOpportunity(tiers, analysis.quantity, product.price)
    : null;
  const currency = product.currency ?? "USD";
  const money = (n: number) => formatMoney(n, currency);
  const errorText = visionError(t, error) ?? catalogError(t, error);

  return (
    <>
      <PageHeader
        help={{
          body: "help.catalog.product.body",
          steps: "help.catalog.product.steps",
        }}
        t={t}
        title={product.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {product.sku ? (
              <span className="font-mono text-xs text-zinc-700">
                {product.sku}
              </span>
            ) : null}
            {line ? <Badge>{line.name}</Badge> : null}
            {product.source ? (
              <Badge tone={sourceTone[product.source]}>
                {t("catalog.source")}:{" "}
                {t(`catalog.source.${product.source}` as DictionaryKey)}
              </Badge>
            ) : null}
            {!product.active ? (
              <Badge tone="warning">{t("common.no")}</Badge>
            ) : null}
          </span>
        }
        actions={
          <>
            <LinkButton href="/app/products">{t("common.back")}</LinkButton>
            <LinkButton
              href={`/app/requests/new?productId=${product.id}`}
              variant="primary"
            >
              + {t("requests.new")}
            </LinkButton>
          </>
        }
      />
      {saved ? <Alert tone="success">{t("catalog.saved")}</Alert> : null}
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}

      {/* ---- Ficha (um formulário, seções em cards) ---- */}
      <div id="sheet" className="scroll-mt-4" />
      <form action={updateProductSheetAction} className="mt-4 space-y-6">
        <input type="hidden" name="id" value={product.id} />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("catalog.section.identification")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t("common.name")}>
                  <Input
                    name="name"
                    required
                    minLength={2}
                    defaultValue={product.name}
                    className={big}
                  />
                </Field>
              </div>
              <Field label="SKU">
                <Input
                  name="sku"
                  defaultValue={product.sku ?? ""}
                  className={big}
                />
              </Field>
              <Field label={t("catalog.line")}>
                <Select
                  name="lineId"
                  required
                  defaultValue={product.lineId}
                  className={big}
                >
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("catalog.category")}>
                <Input
                  name="category"
                  defaultValue={product.category ?? ""}
                  className={big}
                />
              </Field>
              <label className="flex cursor-pointer items-center gap-2 self-end pb-2.5 text-sm font-medium text-zinc-800">
                <input type="hidden" name="active" value="off" />
                <input
                  type="checkbox"
                  name="active"
                  value="on"
                  defaultChecked={product.active}
                  className="h-5 w-5 cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                />
                {t("catalog.active")}
              </label>
              <div className="sm:col-span-2">
                <Field label={t("requests.specification")}>
                  <Textarea
                    name="specification"
                    defaultValue={product.specification ?? ""}
                    className={big}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card title={t("catalog.section.supplier")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label={t("common.supplier")}
                  hint={
                    supplier ? (
                      <TextLink href={`/app/parties/${supplier.id}`}>
                        {t("catalog.openSupplier")}
                      </TextLink>
                    ) : undefined
                  }
                >
                  <Select
                    name="supplierId"
                    defaultValue={product.supplierId ?? ""}
                    className={big}
                  >
                    <option value="">{t("catalog.noSupplier")}</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label={t("catalog.supplierSku")}>
                <Input
                  name="supplierSku"
                  defaultValue={product.supplierSku ?? ""}
                  className={big}
                />
              </Field>
              <Field label={t("catalog.moq")}>
                <NumberInput
                  name="moq"
                  integer
                  defaultValue={product.moq ?? ""}
                />
              </Field>
              <Field label={t("common.price")}>
                <NumberInput name="price" defaultValue={product.price ?? ""} />
              </Field>
              <Field label={t("common.currency")}>
                <CurrencySelect
                  name="currency"
                  value={product.currency}
                  t={t}
                />
              </Field>
              <Field label={t("catalog.negotiatedAt")}>
                <Input
                  name="negotiatedAt"
                  type="date"
                  defaultValue={product.negotiatedAt?.slice(0, 10) ?? ""}
                  className={big}
                />
              </Field>
              <Field
                label={`${t("catalog.source")} (${t("catalog.readOnly")})`}
              >
                <Input
                  readOnly
                  value={
                    product.source
                      ? t(`catalog.source.${product.source}` as DictionaryKey)
                      : "—"
                  }
                  className={cx(big, "bg-zinc-50 text-zinc-600")}
                />
              </Field>
              {product.sourcingItemId ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t("catalog.sourcingOrigin")}
                  </p>
                  <p className="mt-0.5 text-sm">
                    <TextLink
                      href={`/app/sourcing/items/${product.sourcingItemId}`}
                    >
                      {sourcing?.name ?? t("catalog.openSourcing")}
                    </TextLink>
                    {sourcing?.foundAt
                      ? ` · ${formatDate(sourcing.foundAt)}`
                      : ""}
                  </p>
                </div>
              ) : null}
            </div>
          </Card>

          <Card title={t("catalog.section.product")}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("catalog.material")}>
                <Input
                  name="material"
                  defaultValue={product.material ?? ""}
                  className={big}
                />
              </Field>
              <Field label={t("catalog.color")}>
                <Input
                  name="color"
                  defaultValue={product.color ?? ""}
                  className={big}
                />
              </Field>
              <Field label={t("catalog.pantone")}>
                <Input
                  name="pantone"
                  defaultValue={product.pantone ?? ""}
                  className={big}
                />
              </Field>
              <div className="sm:col-span-3">
                <p className="mb-1 text-sm font-medium text-zinc-800">
                  {t("catalog.dimensions")}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label={t("catalog.length")}>
                    <NumberInput
                      name="lengthCm"
                      defaultValue={product.lengthCm ?? ""}
                    />
                  </Field>
                  <Field label={t("catalog.width")}>
                    <NumberInput
                      name="widthCm"
                      defaultValue={product.widthCm ?? ""}
                    />
                  </Field>
                  <Field label={t("catalog.height")}>
                    <NumberInput
                      name="heightCm"
                      defaultValue={product.heightCm ?? ""}
                    />
                  </Field>
                </div>
              </div>
              <Field label={t("catalog.netWeight")}>
                <NumberInput
                  name="netWeightKg"
                  defaultValue={product.netWeightKg ?? ""}
                />
              </Field>
              <Field label={t("catalog.grossWeight")}>
                <NumberInput
                  name="grossWeightKg"
                  defaultValue={product.grossWeightKg ?? ""}
                />
              </Field>
            </div>
          </Card>

          <Card title={t("catalog.section.packaging")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("catalog.masterBoxQty")}>
                <NumberInput
                  name="masterBoxQty"
                  integer
                  defaultValue={product.masterBoxQty ?? ""}
                />
              </Field>
              <Field label={t("catalog.innerBoxQty")}>
                <NumberInput
                  name="innerBoxQty"
                  integer
                  defaultValue={product.innerBoxQty ?? ""}
                />
              </Field>
              <div className="sm:col-span-2">
                <p className="mb-1 text-sm font-medium text-zinc-800">
                  {t("catalog.boxDimensions")}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label={t("catalog.length")}>
                    <NumberInput
                      name="boxLengthCm"
                      defaultValue={product.boxLengthCm ?? ""}
                    />
                  </Field>
                  <Field label={t("catalog.width")}>
                    <NumberInput
                      name="boxWidthCm"
                      defaultValue={product.boxWidthCm ?? ""}
                    />
                  </Field>
                  <Field label={t("catalog.height")}>
                    <NumberInput
                      name="boxHeightCm"
                      defaultValue={product.boxHeightCm ?? ""}
                    />
                  </Field>
                </div>
              </div>
              <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  {t("catalog.cbmPerBox")}
                </div>
                <div className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
                  {cbmShown !== null ? `${cbmShown.toFixed(4)} m³` : "—"}
                </div>
                {cbmComputed !== null ? (
                  <div className="text-xs text-brand-800/80">
                    {t("catalog.cbmComputed")}
                  </div>
                ) : null}
              </div>
              <Field label={t("catalog.cbmPerBox")} hint={t("catalog.cbmHint")}>
                <NumberInput
                  name="cbm"
                  defaultValue={product.cbm ?? ""}
                  disabled={cbmComputed !== null}
                  className={cbmComputed !== null ? "bg-zinc-50" : undefined}
                />
              </Field>
            </div>
          </Card>
        </div>

        <Card title={t("catalog.section.notes")}>
          <Textarea
            name="notes"
            defaultValue={product.notes ?? ""}
            className={big}
          />
        </Card>

        {/* Botão principal no fim, fixo ao alcance do polegar no celular. */}
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <SubmitButton className="w-full py-3 sm:w-auto sm:py-2">
            {t("catalog.saveSheet")}
          </SubmitButton>
        </div>
      </form>

      {/* ---- Fotos e medições ---- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={t("catalog.photos")} className="scroll-mt-4">
          <div id="photos" />
          {photosByKind.length === 0 ? (
            <Empty>{t("catalog.photos.empty")}</Empty>
          ) : (
            <div className="space-y-4">
              {photosByKind.map((group) => (
                <div key={group.kind}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {t(`catalog.photoKind.${group.kind}` as DictionaryKey)}
                  </h3>
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {group.items.map((photo) => (
                      <li key={photo.id} className="min-w-0 space-y-1">
                        <a
                          href={`/api/files/${photo.documentId}`}
                          target="_blank"
                          className="block"
                        >
                          <Thumb
                            photo={photo}
                            alt={photo.caption ?? product.name}
                          />
                        </a>
                        {photo.caption ? (
                          <p className="truncate text-xs text-zinc-600">
                            {photo.caption}
                          </p>
                        ) : null}
                        {photo.isPrimary ? (
                          <Badge tone="brand">
                            {t("catalog.photos.primary")}
                          </Badge>
                        ) : (
                          <form action={setPrimaryPhotoAction}>
                            <input
                              type="hidden"
                              name="productId"
                              value={product.id}
                            />
                            <input
                              type="hidden"
                              name="photoId"
                              value={photo.id}
                            />
                            <button
                              type="submit"
                              className={cx(linkClass, "text-xs")}
                            >
                              {t("catalog.photos.setPrimary")}
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <form
            action={addProductPhotosAction}
            className="mt-4 space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4"
          >
            <input type="hidden" name="productId" value={product.id} />
            <PhotoInput
              name="photos"
              label={t("catalog.photos.add")}
              hint={t("catalog.photos.hint")}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("catalog.photos.kind")}>
                <Select name="kind" defaultValue="original" className={big}>
                  {PHOTO_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`catalog.photoKind.${k}` as DictionaryKey)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("catalog.photos.caption")}>
                <Input name="caption" maxLength={200} className={big} />
              </Field>
            </div>
            <SubmitButton variant="secondary" className="w-full sm:w-auto">
              {t("catalog.photos.add")}
            </SubmitButton>
          </form>
        </Card>

        <Card title={t("catalog.measurements")}>
          <div id="measurements" />
          {measurements.length === 0 ? (
            <Empty>{t("catalog.measurements.empty")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("catalog.measurements.kind")}</Th>
                  <Th className="text-right">
                    {t("catalog.measurements.declared")}
                  </Th>
                  <Th className="text-right">
                    {t("catalog.measurements.measured")}
                  </Th>
                  <Th>{t("common.date")}</Th>
                  <Th>{t("catalog.measurements.by")}</Th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => (
                  <tr key={m.id} className={rowClass}>
                    <Td>
                      {t(`catalog.measureKind.${m.kind}` as DictionaryKey)}
                      {m.note ? (
                        <span className="block text-xs text-zinc-500">
                          {m.note}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {m.declaredValue !== null
                        ? `${m.declaredValue} ${m.unit}`
                        : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium tabular-nums">
                      {m.measuredValue} {m.unit}
                      {m.photoDocumentId ? (
                        <a
                          href={`/api/files/${m.photoDocumentId}`}
                          target="_blank"
                          className={cx(linkClass, "ml-2 text-xs")}
                        >
                          📷
                        </a>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(m.measuredAt)}
                    </Td>
                    <Td>{userName(m.measuredByUserId)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <form
            action={addProductMeasurementAction}
            className="mt-4 space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4"
          >
            <input type="hidden" name="productId" value={product.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("catalog.measurements.kind")}>
                <Select name="kind" defaultValue="weight_net" className={big}>
                  {MEASUREMENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`catalog.measureKind.${k}` as DictionaryKey)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("catalog.measurements.unit")}>
                <Input
                  name="unit"
                  required
                  defaultValue="kg"
                  placeholder="kg, cm, m³, un"
                  className={big}
                />
              </Field>
              <Field label={t("catalog.measurements.declared")}>
                <NumberInput name="declaredValue" />
              </Field>
              <Field label={t("catalog.measurements.measured")}>
                <NumberInput name="measuredValue" required />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("common.note")}>
                  <Input name="note" maxLength={500} className={big} />
                </Field>
              </div>
            </div>
            <PhotoInput
              name="photo"
              multiple={false}
              label={t("catalog.measurements.photo")}
            />
            <SubmitButton variant="secondary" className="w-full sm:w-auto">
              {t("catalog.measurements.add")}
            </SubmitButton>
          </form>
        </Card>
      </div>

      {/* ---- Programação de compra ---- */}
      <Card title={t("catalog.schedules")} className="mt-6">
        <div id="schedules" />
        {schedules.length === 0 ? (
          <Empty>{t("catalog.schedules.empty")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("catalog.schedules.sequence")}</Th>
                <Th className="text-right">{t("common.quantity")}</Th>
                <Th>{t("catalog.schedules.period")}</Th>
                <Th>{t("common.supplier")}</Th>
                <Th>{t("common.customer")}</Th>
                <Th className="text-right">{t("common.price")}</Th>
                <Th>{t("common.status")}</Th>
                <Th>{t("common.note")}</Th>
                <Th>{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className={rowClass}>
                  <Td className="font-medium tabular-nums">#{s.sequence}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {s.quantity} {s.unit}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {[
                      s.periodLabel,
                      s.scheduledFor ? formatDate(s.scheduledFor) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </Td>
                  <Td>{partyName(s.supplierId)}</Td>
                  <Td>{partyName(s.customerId)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {s.price !== null ? formatMoney(s.price, s.currency) : "—"}
                  </Td>
                  <Td>
                    <Badge tone={scheduleTone[s.status] ?? "neutral"}>
                      {t(`catalog.scheduleStatus.${s.status}` as DictionaryKey)}
                    </Badge>
                  </Td>
                  <Td className="max-w-[14rem] text-xs text-zinc-600">
                    {s.notes ?? "—"}
                  </Td>
                  <Td>
                    <div className="flex min-w-[14rem] flex-col gap-2">
                      {s.orderId ? (
                        <TextLink href={`/app/orders/${s.orderId}`}>
                          {t("catalog.schedules.order")}
                        </TextLink>
                      ) : s.requestId ? (
                        <TextLink href={`/app/requests/${s.requestId}`}>
                          {t("catalog.schedules.request")}
                        </TextLink>
                      ) : s.status !== "cancelled" ? (
                        <LinkButton
                          href={`/app/requests/new?productId=${product.id}&quantity=${s.quantity}&scheduleId=${s.id}${s.customerId ? `&customerId=${s.customerId}` : ""}`}
                          variant="primary"
                          className="w-fit px-3 py-1.5 text-xs"
                        >
                          {t("catalog.schedules.createRequest")}
                        </LinkButton>
                      ) : null}
                      {!s.orderId ? (
                        <form
                          action={setScheduleStatusAction}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            type="hidden"
                            name="productId"
                            value={product.id}
                          />
                          <input type="hidden" name="scheduleId" value={s.id} />
                          <Select
                            name="status"
                            defaultValue={s.status}
                            aria-label={t("catalog.schedules.changeStatus")}
                            className="py-1.5 text-xs"
                          >
                            {SCHEDULE_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {t(
                                  `catalog.scheduleStatus.${st}` as DictionaryKey,
                                )}
                              </option>
                            ))}
                          </Select>
                          <SubmitButton
                            variant="secondary"
                            className="shrink-0 px-2.5 py-1.5 text-xs"
                          >
                            {t("common.save")}
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <form
          action={savePurchaseScheduleAction}
          className="mt-4 space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4"
        >
          <input type="hidden" name="productId" value={product.id} />
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("catalog.schedules.new")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("catalog.schedules.sequence")}>
              <NumberInput
                name="sequence"
                integer
                defaultValue={nextSequence}
              />
            </Field>
            <Field label={t("common.quantity")}>
              <NumberInput name="quantity" required min={0.01} />
            </Field>
            <Field label={t("requests.unit")}>
              <Input name="unit" defaultValue="un" className={big} />
            </Field>
            <Field label={t("catalog.schedules.scheduledFor")}>
              <Input name="scheduledFor" type="date" className={big} />
            </Field>
            <Field label={t("catalog.schedules.periodLabel")}>
              <Input name="periodLabel" maxLength={60} className={big} />
            </Field>
            <Field label={t("common.supplier")}>
              <Select
                name="supplierId"
                defaultValue={product.supplierId ?? ""}
                className={big}
              >
                <option value="">{t("catalog.noSupplier")}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("common.customer")}
              hint={t("catalog.schedules.customerHint")}
            >
              <Select name="customerId" defaultValue="" className={big}>
                <option value="">—</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.status")}>
              <Select name="status" defaultValue="planned" className={big}>
                {SCHEDULE_STATUSES.filter((s) => s !== "ordered").map((st) => (
                  <option key={st} value={st}>
                    {t(`catalog.scheduleStatus.${st}` as DictionaryKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.price")}>
              <NumberInput name="price" defaultValue={product.price ?? ""} />
            </Field>
            <Field label={t("common.currency")}>
              <CurrencySelect name="currency" value={product.currency} t={t} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("common.note")}>
                <Input name="notes" className={big} />
              </Field>
            </div>
          </div>
          <SubmitButton variant="secondary" className="w-full sm:w-auto">
            + {t("catalog.schedules.new")}
          </SubmitButton>
        </form>
      </Card>

      {/* ---- Segunda Onda: classificação fiscal (NCM) ---- */}
      <Card title={t("catalog.tax.title")} className="mt-6">
        <TaxSection
          product={product}
          rows={taxRows}
          users={users}
          user={user}
          t={t}
          back="sheet"
        />
      </Card>

      {/* ---- Certificações e compliance ---- */}
      <Card title={t("catalog.cert.title")} className="mt-6">
        <CertificationsSection
          entity="product"
          entityId={product.id}
          certs={certs}
          check={compliance}
          suggestedKinds={compliance.required}
          users={users}
          user={user}
          t={t}
          warningDays={settings.certificationExpiryWarningDays}
        />
      </Card>

      {/* ---- Oportunidade de compra (faixas + container); preço FOB é interno ---- */}
      <Card title={t("catalog.opp.title")} className="mt-6">
        <div id="opportunity" className="scroll-mt-4" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("catalog.opp.tiers")}
            </h3>
            {tiers.length === 0 ? (
              <Empty>{t("catalog.opp.tiers.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 text-sm">
                {tiers.map((tier) => (
                  <li
                    key={tier.minQty}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="text-zinc-700">
                      {t("catalog.opp.from")}{" "}
                      <span className="font-semibold tabular-nums text-zinc-900">
                        {tier.minQty}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-zinc-900">
                      {money(tier.price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form
              action={saveProductPriceTiersAction}
              className="space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4"
            >
              <input type="hidden" name="productId" value={product.id} />
              {analysis?.source === "param" ? (
                <input type="hidden" name="qty" value={analysis.quantity} />
              ) : null}
              <Field
                label={t("catalog.opp.tiers")}
                hint={t("catalog.opp.tiersHint")}
              >
                <Textarea
                  name="tiers"
                  rows={4}
                  placeholder={"500;9.50\n1000;8.90"}
                  defaultValue={formatPriceTiers(tiers)}
                  className={cx(big, "min-h-0 font-mono")}
                />
              </Field>
              <SubmitButton
                variant="secondary"
                className="w-full sm:w-auto"
                pendingText="…"
              >
                {t("catalog.opp.saveTiers")}
              </SubmitButton>
            </form>
          </div>

          <div className="space-y-3">
            <form
              method="get"
              action={`/app/products/${product.id}#opportunity`}
              className="flex items-end gap-2"
            >
              <div className="flex-1">
                <Field
                  label={t("catalog.opp.quantity")}
                  hint={
                    analysis
                      ? t(
                          `catalog.opp.quantitySource.${analysis.source}` as DictionaryKey,
                        )
                      : undefined
                  }
                >
                  <Input
                    name="qty"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    defaultValue={analysis?.quantity ?? ""}
                    className={big}
                  />
                </Field>
              </div>
              <Button
                type="submit"
                variant="secondary"
                className={cx(big, analysis ? "mb-5" : undefined)}
              >
                {t("catalog.opp.analyze")}
              </Button>
            </form>
            {tiers.length === 0 ? (
              <p className="text-sm text-zinc-600">
                {t("catalog.opp.tiers.empty")}
              </p>
            ) : !analysis ? (
              <p className="text-sm text-zinc-600">
                {t("catalog.opp.noQuantity")}
              </p>
            ) : opportunity ? (
              <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                <DescriptionList
                  items={[
                    [
                      t("catalog.opp.today"),
                      `${opportunity.quantity} × ${money(opportunity.currentUnitPrice)} = ${money(opportunity.currentTotal)}`,
                    ],
                    [
                      t("catalog.opp.nextTier"),
                      `${opportunity.nextTier.minQty} × ${money(opportunity.nextTier.price)} = ${money(opportunity.nextTotal)}`,
                    ],
                    [
                      t("catalog.opp.extraUnits"),
                      `${opportunity.extraQuantity}${
                        boxesForQuantity(product, opportunity.extraQuantity)
                          ? ` (${boxesForQuantity(product, opportunity.extraQuantity)} ${t("catalog.opp.boxes")})`
                          : ""
                      }`,
                    ],
                    [
                      t("catalog.opp.unitSaving"),
                      `${money(opportunity.unitSaving)} (${opportunity.unitSavingPercent}%)`,
                    ],
                    [
                      t("catalog.opp.totalDifference"),
                      `${opportunity.totalDifference > 0 ? "+" : ""}${money(opportunity.totalDifference)}`,
                    ],
                    [
                      t("catalog.opp.marginal"),
                      money(opportunity.marginalUnitCost),
                    ],
                  ]}
                />
                <p className="break-words border-t border-brand-200/70 pt-3 font-mono text-xs text-zinc-700">
                  {t("catalog.opp.formula")}: {opportunity.formula}
                </p>
                <p className="text-xs text-brand-800/80">
                  {t("catalog.opp.deterministic")}
                </p>
              </div>
            ) : (
              <Alert tone="neutral">{t("catalog.opp.none")}</Alert>
            )}
            <p className="text-xs text-zinc-500">{t("catalog.opp.internal")}</p>
          </div>
        </div>

        {containerFits.length > 0 ? (
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {t("catalog.opp.container.title")}
            </h3>
            <ul className="space-y-1.5 text-sm">
              {containerFits.map((c) => (
                <li
                  key={c.containerId}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1"
                >
                  <span className="font-mono font-semibold text-zinc-900">
                    {c.containerCode}
                  </span>
                  {c.customer ? (
                    <span className="text-zinc-500">· {c.customer}</span>
                  ) : null}
                  <span className="text-zinc-800">
                    {t("catalog.opp.container.line", {
                      boxes: c.fit.boxes,
                      units: c.fit.units ?? "—",
                      cbm: c.remainingCbm.toFixed(2),
                    })}
                  </span>
                  <TextLink
                    href={`/app/containers/${c.containerId}`}
                    className="text-xs"
                  >
                    {t("catalog.opp.container.open")}
                  </TextLink>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-500">
              {t("catalog.opp.container.formula")} ·{" "}
              {t("catalog.opp.deterministic")}
            </p>
          </div>
        ) : null}
      </Card>

      {/* ---- Visão de Produto: atributos exigidos pela linha (determinístico) ---- */}
      <Card title={t("vision.attrs.title")} className="mt-6">
        <div id="attributes" className="scroll-mt-4" />
        <p className="mb-3 text-sm text-zinc-600">{t("vision.attrs.hint")}</p>
        {attributeCheck.required.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("vision.attrs.none")}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {t("vision.attrs.present")} ({attributeCheck.present.length})
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {attributeCheck.present.map((a) => (
                  <li key={a}>
                    <Badge tone="success">✓ {a}</Badge>
                  </li>
                ))}
                {attributeCheck.present.length === 0 ? (
                  <li className="text-xs text-zinc-500">—</li>
                ) : null}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                {t("vision.attrs.missing")} ({attributeCheck.missing.length})
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {attributeCheck.missing.map((a) => (
                  <li key={a}>
                    <Badge tone="danger">✗ {a}</Badge>
                  </li>
                ))}
                {attributeCheck.missing.length === 0 ? (
                  <li className="text-xs text-zinc-500">—</li>
                ) : null}
              </ul>
              {attributeCheck.missing.length > 0 ? (
                <a
                  href="#sheet"
                  className={cx(linkClass, "mt-2 inline-block text-xs")}
                >
                  {t("vision.attrs.fill")}
                </a>
              ) : null}
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                {t("vision.attrs.manual")} ({attributeCheck.manual.length})
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {attributeCheck.manual.map((a) => (
                  <li key={a}>
                    <Badge tone="warning">? {a}</Badge>
                  </li>
                ))}
                {attributeCheck.manual.length === 0 ? (
                  <li className="text-xs text-zinc-500">—</li>
                ) : null}
              </ul>
              {attributeCheck.manual.length > 0 ? (
                <p className="mt-2 text-xs text-zinc-500">
                  {t("vision.attrs.manualHint")}
                </p>
              ) : null}
            </div>
          </div>
        )}
        {attributeCheck.required.length > 0 &&
        attributeCheck.missing.length === 0 &&
        attributeCheck.manual.length === 0 ? (
          <p className="mt-3 text-xs text-emerald-700">
            {t("vision.attrs.allPresent")}
          </p>
        ) : null}
      </Card>

      {/* ---- Sugestão por foto (IA): humano confirma campo a campo ---- */}
      <Card title={t("vision.ai.title")} className="mt-6">
        <AiSection
          entity="product"
          entityId={product.id}
          photos={aiPhotos}
          suggestions={suggestions}
          mode={aiAdapter.mode}
          model={aiAdapter.model}
          user={user}
          users={users}
          current={{
            category: product.category,
            description: product.specification,
            material: product.material,
            color: product.color,
          }}
          t={t}
          back={`/app/products/${product.id}`}
        />
      </Card>

      {/* ---- Ciclo contínuo do produto ---- */}
      {cycle ? (
        <Card title={t("vision.cycle.title")} className="mt-6">
          <CycleCard cycle={cycle} productId={product.id} t={t} />
        </Card>
      ) : null}
    </>
  );
}
