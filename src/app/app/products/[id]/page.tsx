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
import {
  catalogPhotoKinds,
  getProductSheet,
  productSheetDraft,
  productSheetMissing,
} from "@/lib/services/product-sheet";
import { planSheet } from "@/lib/services/purchase-sheet-calc";
import { PurchaseSheetFields } from "@/components/purchase-sheet-fields";
import { PantonePicker } from "@/components/pantone-picker";
import { MAX_PANTONE_PER_SHEET } from "@/lib/pantone";
import {
  ncmChipsView,
  ncmSuggestionsFor,
} from "@/lib/services/ncm-suggestions";
import { saveProductSheetAction } from "../../actions/purchase-sheet";
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
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  FieldRow,
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
import { CurrencySelect } from "@/components/currency-select";
import { PhotoInput } from "@/components/photo-input";
import { SubmitButton, SubmitTextButton } from "@/components/submit-button";
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
import { SuppliersCard } from "../_components/suppliers-card";
import { SheetPhotoChecklist } from "../_components/sheet-photo-checklist";
import { MissingFields } from "@/components/missing-fields";
import { missingFieldsView } from "@/components/missing-fields-view";
import { productSuppliersView } from "@/lib/services/product-suppliers";
import type { SupplierOption } from "@/components/supplier-picker";
import { MoneyInput } from "@/components/money-input";

/* Campos maiores para uso no celular (fábrica/feira): py-2.5 em vez de py-2. */
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
      className={className}
      dense
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
  const {
    error,
    saved,
    qty,
    sheet: sheetSaved,
    suppliers: suppliersDone,
    at: saveToken,
  } = await searchParams;
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
  // Ficha mestre (ou rascunho a partir das colunas do produto) e o que falta nela.
  const [masterSheet, masterSupplier] = await Promise.all([
    getProductSheet(product.id),
    product.supplierId ? getStore().get("parties", product.supplierId) : null,
  ]);
  const masterDraft = productSheetDraft(product, masterSupplier);
  // Fornecedores deste produto (principal primeiro) e o seletor da ficha mestre.
  const supplierRows = await productSuppliersView(product);
  const supplierOptions: SupplierOption[] = suppliers
    .filter((s) => s.active || s.id === product.supplierId)
    .map((s) => {
      const row = supplierRows.find((r) => r.supplier.id === s.id);
      return {
        id: s.id,
        name: s.name,
        city: s.city ?? null,
        storeNumber: s.storeNumber ?? null,
        phone: s.phone ?? null,
        code: row?.supplierSku ?? null,
        linked: !!row,
      };
    });
  const masterMissing = await productSheetMissing(
    product.id,
    masterSheet ?? masterDraft,
  );
  const masterPhotoKinds = await catalogPhotoKinds(product.id);
  const masterContainer =
    settings.containerTypes.find(
      (c) => c.code === (masterSheet?.containerType ?? "40HC"),
    ) ??
    [...settings.containerTypes].sort(
      (a, b) => b.capacityCbm - a.capacityCbm,
    )[0];
  const masterPlan = planSheet(
    {
      lots: masterSheet?.lots ?? null,
      masterCartonQty: (masterSheet ?? masterDraft).masterCartonQty ?? null,
      cbmPerCarton: (masterSheet ?? masterDraft).cbmPerCarton ?? null,
      productionStartAt: masterSheet?.productionStartAt ?? null,
      heightCm: (masterSheet ?? masterDraft).heightCm ?? null,
      widthCm: (masterSheet ?? masterDraft).widthCm ?? null,
      lengthCm: (masterSheet ?? masterDraft).lengthCm ?? null,
    },
    masterContainer?.capacityCbm ?? null,
  );
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
  const money = (n: number) => formatMoney(n, currency, t);
  // Erros da ficha mestre (schema_outdated, pantone_too_many, not_found…) têm texto próprio.
  const sheetErrorText = (() => {
    if (typeof error !== "string" || !error) return null;
    for (const key of [`sheet.error.${error}`, `productSheet.error.${error}`]) {
      const text = t(key as Parameters<typeof t>[0]);
      if (text !== key) return text;
    }
    return null;
  })();
  const errorText =
    visionError(t, error) ?? sheetErrorText ?? catalogError(t, error);

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
      <form action={updateProductSheetAction} className="mt-4 space-y-4">
        <input type="hidden" name="id" value={product.id} />
        {/* Cadastro denso, no padrão da ficha de compra: rótulo à esquerda,
            caixa do tamanho do que se digita, um campo abaixo do outro. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={t("catalog.section.identification")} dense>
            <div className="space-y-2">
              <FieldRow label={t("common.name")} size="full" required>
                <Input
                  name="name"
                  required
                  minLength={2}
                  defaultValue={product.name}
                  dense
                />
              </FieldRow>
              <FieldRow label="SKU" size="sm">
                <Input name="sku" defaultValue={product.sku ?? ""} dense />
              </FieldRow>
              <FieldRow label={t("catalog.line")} size="md" required>
                <Select
                  name="lineId"
                  required
                  defaultValue={product.lineId}
                  dense
                >
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
                  defaultValue={product.category ?? ""}
                  dense
                />
              </FieldRow>
              <FieldRow label={t("common.status")} size="full">
                <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-[13px] font-medium text-zinc-800">
                  <input type="hidden" name="active" value="off" />
                  <input
                    type="checkbox"
                    name="active"
                    value="on"
                    defaultChecked={product.active}
                    className="h-4 w-4 cursor-pointer accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  />
                  {t("catalog.active")}
                </label>
              </FieldRow>
              <FieldRow label={t("requests.specification")} size="full">
                <Textarea
                  name="specification"
                  rows={3}
                  defaultValue={product.specification ?? ""}
                  dense
                />
              </FieldRow>
            </div>
          </Card>

          <Card title={t("catalog.section.supplier")} dense>
            <div className="space-y-2">
              <FieldRow
                label={t("common.supplier")}
                size="lg"
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
                  dense
                >
                  <option value="">{t("catalog.noSupplier")}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FieldRow>
              <FieldRow label={t("catalog.supplierSku")} size="md">
                <Input
                  name="supplierSku"
                  defaultValue={product.supplierSku ?? ""}
                  dense
                />
              </FieldRow>
              <FieldRow label={t("catalog.moq")} size="sm">
                <NumberInput
                  name="moq"
                  integer
                  defaultValue={product.moq ?? ""}
                />
              </FieldRow>
              <FieldRow label={t("common.price")} size="md">
                <MoneyInput
                  locale={t.intl}
                  name="price"
                  watchField="currency"
                  defaultAmount={product.price ?? null}
                  decimals={4}
                  size="sm"
                />
              </FieldRow>
              <FieldRow label={t("common.currency")} size="sm">
                <CurrencySelect
                  name="currency"
                  value={product.currency}
                  t={t}
                  allowEmpty
                  dense
                />
              </FieldRow>
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
                  <TextLink
                    href={`/app/sourcing/items/${product.sourcingItemId}`}
                  >
                    {sourcing?.name ?? t("catalog.openSourcing")}
                  </TextLink>
                  {sourcing?.foundAt
                    ? ` · ${formatDate(sourcing.foundAt, t)}`
                    : ""}
                </p>
              ) : null}
            </div>
          </Card>

          <Card title={t("catalog.section.product")} dense>
            <div className="space-y-2">
              <FieldRow label={t("catalog.material")} size="md">
                <Input
                  name="material"
                  defaultValue={product.material ?? ""}
                  dense
                />
              </FieldRow>
              <FieldRow label={t("catalog.color")} size="md">
                <Input name="color" defaultValue={product.color ?? ""} dense />
              </FieldRow>
              <FieldRow
                label={t("catalog.pantone")}
                size="full"
                hint={t("pantone.productHint")}
              >
                <PantonePicker
                  name="colorPantones"
                  initial={
                    product.colorPantones ?? masterSheet?.colorPantones ?? []
                  }
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
              <FieldRow label={t("catalog.netWeight")} size="xs">
                <NumberInput
                  name="netWeightKg"
                  defaultValue={product.netWeightKg ?? ""}
                />
              </FieldRow>
              <FieldRow label={t("catalog.grossWeight")} size="xs">
                <NumberInput
                  name="grossWeightKg"
                  defaultValue={product.grossWeightKg ?? ""}
                />
              </FieldRow>
            </div>
          </Card>

          <Card title={t("catalog.section.packaging")} dense>
            <div className="space-y-2">
              <FieldRow label={t("catalog.masterBoxQty")} size="xs">
                <NumberInput
                  name="masterBoxQty"
                  integer
                  defaultValue={product.masterBoxQty ?? ""}
                />
              </FieldRow>
              <FieldRow label={t("catalog.innerBoxQty")} size="xs">
                <NumberInput
                  name="innerBoxQty"
                  integer
                  defaultValue={product.innerBoxQty ?? ""}
                />
              </FieldRow>
              <FieldRow label={t("catalog.boxDimensions")} size="full">
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
          </Card>
        </div>

        <Card title={t("catalog.section.notes")} dense>
          <Textarea
            name="notes"
            rows={3}
            defaultValue={product.notes ?? ""}
            dense
          />
        </Card>

        {/* Botão principal no fim, fixo ao alcance do polegar no celular. */}
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
          <SubmitButton className="w-full py-3 sm:w-auto sm:py-2">
            {t("catalog.saveSheet")}
          </SubmitButton>
        </div>
      </form>

      {/* ---- Fornecedores deste produto (vários; quem cota entra sozinho) ---- */}
      <section className="mt-6">
        <SuppliersCard
          t={t}
          productId={product.id}
          rows={supplierRows}
          suppliers={suppliers}
          done={typeof suppliersDone === "string" ? suppliersDone : null}
        />
      </section>

      {/* ---- Ficha de compra mestre: a mesma ficha do pedido; pedidos e cotações deste produto nascem dela ---- */}
      <section id="product-sheet" className="mt-6 scroll-mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900">
            {t("productSheet.title")}
          </h2>
          {masterMissing.length === 0 ? (
            <Badge tone="success">{t("productSheet.complete")}</Badge>
          ) : masterSheet ? (
            <Badge tone="warning">
              {t("productSheet.partial", { n: masterMissing.length })}
            </Badge>
          ) : (
            <Badge tone="neutral">{t("productSheet.none")}</Badge>
          )}
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-zinc-600">
          {t("productSheet.hint")}
        </p>
        {sheetSaved === "complete" ? (
          <Alert tone="success">{t("productSheet.saved")}</Alert>
        ) : masterMissing.length ? (
          // Cada campo que falta é clicável e leva até ele; logo depois de
          // salvar, a tela já vai para o primeiro.
          <MissingFields
            // Cada salvamento com pendência remonta o aviso e leva de novo ao campo.
            key={typeof saveToken === "string" ? saveToken : "idle"}
            {...missingFieldsView(
              t,
              sheetSaved === "partial"
                ? "productSheet.savedPartial"
                : "productSheet.missing",
              masterMissing,
            )}
            tone={sheetSaved === "partial" ? "warning" : "neutral"}
            autoFocus={sheetSaved === "partial"}
          />
        ) : null}
        <p className="text-xs text-zinc-500" data-master-photos>
          {t("productSheet.photos", { n: masterPhotoKinds.length })}
          {masterPhotoKinds.length < 5 ? (
            <>
              {" "}
              <TextLink href="#sheet-photos" className="font-medium">
                {t("productSheet.photosLink")}
              </TextLink>
            </>
          ) : null}
        </p>
        <form
          id="product-sheet-form"
          action={saveProductSheetAction}
          className="space-y-4"
        >
          <input type="hidden" name="productId" value={product.id} />
          <PurchaseSheetFields
            t={t}
            sheet={masterSheet ?? masterDraft}
            plan={masterPlan}
            containerType={masterContainer.code}
            containerTypes={settings.containerTypes}
            editSupplier
            editCustoms
            lotRequired={false}
            master
            missing={masterMissing}
            supplierOptions={supplierOptions}
            supplierId={product.supplierId}
            ncmSuggestions={ncmChipsView(
              t,
              await ncmSuggestionsFor(product.id),
            )}
          />
          <p className="text-xs text-zinc-500">
            {t("productSheet.photosHint")}
          </p>
          <SubmitButton>{t("productSheet.save")}</SubmitButton>
        </form>
      </section>

      {/* ---- Fotos e medições ---- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={t("catalog.photos")} className="scroll-mt-4">
          <div id="photos" />
          {/* As 5 fotos que a ficha mestre exige: o que falta, com envio direto. */}
          <SheetPhotoChecklist
            t={t}
            productId={product.id}
            photos={photos}
            canEdit
          />
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
                            <SubmitTextButton className="text-xs">
                              {t("catalog.photos.setPrimary")}
                            </SubmitTextButton>
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
                <Select name="kind" defaultValue="original" dense>
                  {PHOTO_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t(`catalog.photoKind.${k}` as DictionaryKey)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("catalog.photos.caption")}>
                <Input name="caption" maxLength={200} dense />
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
                      {formatDate(m.measuredAt, t)}
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
                <Select name="kind" defaultValue="weight_net" dense>
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
                  placeholder={t("ph.measure.unit")}
                  dense
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
                  <Input name="note" maxLength={500} dense />
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
                      s.scheduledFor ? formatDate(s.scheduledFor, t) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </Td>
                  <Td>{partyName(s.supplierId)}</Td>
                  <Td>{partyName(s.customerId)}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {s.price !== null
                      ? formatMoney(s.price, s.currency, t)
                      : "—"}
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
              <Input name="unit" defaultValue="un" dense />
            </Field>
            <Field label={t("catalog.schedules.scheduledFor")}>
              <Input name="scheduledFor" type="date" dense />
            </Field>
            <Field label={t("catalog.schedules.periodLabel")}>
              <Input name="periodLabel" maxLength={60} dense />
            </Field>
            <Field label={t("common.supplier")}>
              <Select
                name="supplierId"
                defaultValue={product.supplierId ?? ""}
                dense
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
              <Select name="customerId" defaultValue="" dense>
                <option value="">—</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.status")}>
              <Select name="status" defaultValue="planned" dense>
                {SCHEDULE_STATUSES.filter((s) => s !== "ordered").map((st) => (
                  <option key={st} value={st}>
                    {t(`catalog.scheduleStatus.${st}` as DictionaryKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("common.price")}>
              <MoneyInput
                locale={t.intl}
                size="sm"
                name="price"
                watchField="currency"
                defaultAmount={product.price ?? null}
                decimals={4}
              />
            </Field>
            <Field label={t("common.currency")}>
              <CurrencySelect
                name="currency"
                value={product.currency}
                t={t}
                allowEmpty
                dense
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("common.note")}>
                <Input name="notes" dense />
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
                  dense
                  className={"min-h-0 font-mono"}
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
                    dense
                  />
                </Field>
              </div>
              <SubmitButton
                type="submit"
                variant="secondary"
                className={cx("py-2.5", analysis ? "mb-5" : undefined)}
              >
                {t("catalog.opp.analyze")}
              </SubmitButton>
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
                      `${money(opportunity.unitSaving)} (${opportunity.unitSavingPercent.toLocaleString(t.intl, { maximumFractionDigits: 1 })}%)`,
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
                      cbm: c.remainingCbm.toLocaleString(t.intl, {
                        maximumFractionDigits: 2,
                      }),
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
