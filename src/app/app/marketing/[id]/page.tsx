import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore, type AiSuggestion, type Document } from "@/lib/db";
import { loadKit } from "@/lib/services/marketing";
import { listSuggestions } from "@/lib/services/ai-suggestions";
import { loadProductSheet } from "@/lib/services/sourcing";
import { canAccessDocument } from "@/lib/services/documents";
import { getAiAdapter } from "@/lib/integrations/ai";
import { getSettings } from "@/lib/settings";
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
  TextLink,
  Textarea,
  formatDate,
  formatMoney,
} from "@/components/ui";
import { CurrencySelect } from "@/components/currency-select";
import { SubmitButton } from "@/components/submit-button";
import {
  addKitFileAction,
  cancelKitAction,
  confirmKitPaymentAction,
  offerKitAction,
  purchaseKitAction,
  releaseKitAction,
  requestMarketingSuggestionAction,
  updateKitAction,
} from "../../actions/vision";
import {
  FileThumb,
  KitDocList,
  KitStatusBadge,
  KitTimeline,
  marketingError,
} from "../_components/shared";

/* Campos de texto e valor sugerido: só strings/listas de strings entram na tela. */
function suggestedText(s: AiSuggestion, key: string) {
  const v = s.fields[key];
  return typeof v === "string" ? v : "";
}
function suggestedList(s: AiSuggestion, key: string): string[] {
  const v = s.fields[key];
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

/** Selo de origem da sugestão: mock sempre rotulado; API com o modelo. */
function SourceBadge({ t, s }: { t: Translate; s: AiSuggestion }) {
  return s.source === "mock" ? (
    <Badge tone="warning">{t("marketing.ai.mock")}</Badge>
  ) : (
    <Badge tone="info">
      {t("marketing.ai.api")}
      {s.model ? ` · ${s.model}` : ""}
    </Badge>
  );
}

/**
 * /app/marketing/[id]: o studio do kit.
 * Wellmix vê e edita tudo; o cliente dono vê a versão de leitura a partir da
 * oferta (loadKit devolve null para quem não pode → notFound). O cliente nunca
 * vê fornecedor, preço FOB nem MOQ do produto. IA só sugere: nada entra no kit
 * sem o botão "Usar estes textos (revisados)".
 */
export default async function MarketingKitPage({
  params,
  searchParams,
}: PageProps<"/app/marketing/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const sp = await searchParams;
  const view = await loadKit(user, id);
  if (!view) notFound();
  const { kit, product, customerName, previewDocs, releasedDocs, payment } =
    view;
  const wellmix = isWellmix(user);
  const t = await getT();
  const store = getStore();
  const [settings, sheet, customers, suggestions] = await Promise.all([
    getSettings(),
    loadProductSheet(kit.productId),
    wellmix
      ? store.list("parties", { filter: { type: "customer" }, orderBy: "name" })
      : Promise.resolve([]),
    wellmix
      ? listSuggestions("marketing_kit", kit.id)
      : Promise.resolve([] as AiSuggestion[]),
  ]);
  const aiMode = getAiAdapter(settings).mode;

  /* Imagens do produto: principal + comerciais, só as que este papel pode abrir. */
  const photos = sheet?.photos ?? [];
  const primaryId =
    product?.primaryPhotoDocumentId ??
    photos.find((p) => p.isPrimary)?.documentId ??
    null;
  const commercial = photos.filter(
    (p) => p.kind === "commercial" && p.documentId !== primaryId,
  );
  const photoIds = [
    ...new Set(
      [primaryId, ...commercial.map((p) => p.documentId)].filter(
        (x): x is string => !!x,
      ),
    ),
  ];
  const photoDocs: Document[] = photoIds.length
    ? await store.list("documents", { filter: { id: photoIds } })
    : [];
  const visiblePhotoIds = new Set(
    (
      await Promise.all(
        photoDocs.map(async (d) =>
          (await canAccessDocument(user, d)) ? d.id : null,
        ),
      )
    ).filter((x): x is string => !!x),
  );
  const primaryVisible = primaryId ? visiblePhotoIds.has(primaryId) : false;
  const commercialVisible = commercial.filter((p) =>
    visiblePhotoIds.has(p.documentId),
  );

  const cancelled = kit.status === "cancelled";
  const customerLocked = !["draft", "preview"].includes(kit.status);
  const priceLocked = ["purchased", "paid", "released"].includes(kit.status);
  const editable = wellmix && !cancelled;
  const latest = suggestions.find((s) => s.status === "suggested") ?? null;
  const history = suggestions.filter((s) => s !== latest);
  const errorText = marketingError(t, sp.error);
  const price = formatMoney(kit.price, kit.currency);
  const textItems: Array<[string, string | null]> = [
    [t("marketing.field.concept"), kit.concept],
    [t("marketing.field.slogan"), kit.slogan],
    [t("marketing.field.description"), kit.description],
    [t("marketing.field.campaign"), kit.campaign],
    [t("marketing.field.colors"), kit.colors?.join(", ") || null],
    [t("marketing.field.pantone"), kit.pantone],
  ];
  const dateItems: Array<[string, string | null]> = [
    [t("marketing.dates.created"), kit.createdAt],
    [t("marketing.dates.offered"), kit.offeredAt],
    [t("marketing.dates.purchased"), kit.purchasedAt],
    [t("marketing.dates.paid"), kit.paidAt],
    [t("marketing.dates.released"), kit.releasedAt],
  ];

  /* Formulário de cancelamento (Wellmix; até a compra). */
  const cancelForm = (
    <form
      action={cancelKitAction}
      className="space-y-2 border-t border-zinc-100 pt-3"
    >
      <input type="hidden" name="id" value={kit.id} />
      <Field label={t("marketing.action.cancelNote")}>
        <Input name="note" maxLength={2000} />
      </Field>
      <SubmitButton variant="danger" className="w-full sm:w-auto">
        {t("marketing.action.cancel")}
      </SubmitButton>
    </form>
  );

  return (
    <>
      <PageHeader
        help={
          wellmix
            ? {
                body: "marketing.kit.help.body",
                steps: "marketing.kit.help.steps",
              }
            : {
                body: "marketing.kit.help.customer.body",
                steps: "marketing.kit.help.customer.steps",
              }
        }
        t={t}
        title={kit.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <KitStatusBadge t={t} status={kit.status} />
            <span>
              {t("common.customer")}:{" "}
              {customerName ?? t("marketing.noCustomer")}
            </span>
            <span className="font-semibold text-zinc-900">{price}</span>
            {product ? (
              <span>
                {t("common.product")}: {product.name}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <LinkButton href="/app/marketing">{t("common.back")}</LinkButton>
            {wellmix && product ? (
              <LinkButton href={`/app/products/${product.id}`}>
                {t("marketing.product.openSheet")}
              </LinkButton>
            ) : null}
          </>
        }
      />
      {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
      {sp.ok ? <Alert tone="success">{t("marketing.ok")}</Alert> : null}
      {cancelled ? (
        <div className="mt-2">
          <Alert tone="neutral">
            <strong>{t("marketing.kit.cancelled")}</strong>
            {kit.notes
              ? ` · ${t("marketing.kit.cancelledNote")}: ${kit.notes}`
              : ""}
          </Alert>
        </div>
      ) : null}

      <Card title={t("marketing.kit.timeline")} className="mt-4">
        <KitTimeline t={t} kit={kit} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* ---- Situação e ações (primeiro no celular, à direita na mesa) ---- */}
        <div className="min-w-0 space-y-6 lg:order-2">
          <Card title={t("marketing.status.title")}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <KitStatusBadge t={t} status={kit.status} />
              <span className="text-sm font-semibold text-zinc-900">
                {price}
              </span>
            </div>

            {wellmix ? (
              <div className="space-y-4">
                {kit.status === "draft" || kit.status === "preview" ? (
                  <>
                    <form action={offerKitAction} className="space-y-2">
                      <input type="hidden" name="id" value={kit.id} />
                      {kit.customerId ? (
                        <SubmitButton className="w-full">
                          {t("marketing.action.offer")}
                        </SubmitButton>
                      ) : (
                        <Button type="button" disabled className="w-full">
                          {t("marketing.action.offer")}
                        </Button>
                      )}
                      <p className="text-xs text-zinc-500">
                        {kit.customerId
                          ? t("marketing.action.offerReady")
                          : t("marketing.action.offerHint")}
                      </p>
                    </form>
                    {cancelForm}
                  </>
                ) : null}

                {kit.status === "offered" ? (
                  <>
                    <Alert tone="brand">
                      {t("marketing.action.awaitingCustomer")}
                    </Alert>
                    <form action={purchaseKitAction} className="space-y-2">
                      <input type="hidden" name="id" value={kit.id} />
                      <SubmitButton variant="secondary" className="w-full">
                        {t("marketing.action.purchaseByCustomer")}
                      </SubmitButton>
                      <p className="text-xs text-zinc-500">
                        {t("marketing.action.purchaseByCustomerHint")}
                      </p>
                    </form>
                    {cancelForm}
                  </>
                ) : null}

                {kit.status === "purchased" ? (
                  <>
                    <Alert tone="warning">
                      <strong>{t("marketing.payment.pending")}</strong>
                    </Alert>
                    <DescriptionList
                      items={[
                        [t("marketing.payment.amount"), price],
                        [
                          t("marketing.dates.purchased"),
                          formatDate(kit.purchasedAt),
                        ],
                        [
                          t("common.status"),
                          payment
                            ? t(
                                `paymentStatus.${payment.status}` as DictionaryKey,
                              )
                            : "—",
                        ],
                        [t("finance.method"), payment?.method ?? "—"],
                      ]}
                    />
                    <p className="text-xs text-zinc-500">
                      {t("marketing.payment.manual")}
                    </p>
                    <form
                      action={confirmKitPaymentAction}
                      className="space-y-3 border-t border-zinc-100 pt-3"
                    >
                      <input type="hidden" name="id" value={kit.id} />
                      <Field label={t("marketing.payment.proof")}>
                        <Input
                          name="proof"
                          type="file"
                          accept="image/*,application/pdf"
                        />
                      </Field>
                      <SubmitButton pendingText="..." className="w-full">
                        {t("marketing.payment.confirm")}
                      </SubmitButton>
                    </form>
                  </>
                ) : null}

                {kit.status === "paid" ? (
                  <>
                    <Alert tone="success">
                      <strong>{t("marketing.payment.confirmed")}</strong>
                      {kit.paidAt ? ` · ${formatDate(kit.paidAt)}` : ""}
                    </Alert>
                    <form action={releaseKitAction} className="space-y-2">
                      <input type="hidden" name="id" value={kit.id} />
                      {kit.releasedDocumentIds.length > 0 ? (
                        <SubmitButton className="w-full">
                          {t("marketing.action.release")}
                        </SubmitButton>
                      ) : (
                        <Button type="button" disabled className="w-full">
                          {t("marketing.action.release")}
                        </Button>
                      )}
                      <p className="text-xs text-zinc-500">
                        {kit.releasedDocumentIds.length > 0
                          ? t("marketing.action.releaseReady", {
                              count: kit.releasedDocumentIds.length,
                            })
                          : t("marketing.action.releaseHint")}
                      </p>
                    </form>
                  </>
                ) : null}

                {kit.status === "released" ? (
                  <Alert tone="success">
                    {t("marketing.released.summary")}
                  </Alert>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                {kit.status === "offered" ? (
                  <>
                    <Alert tone="brand">
                      <strong>{t("marketing.customer.offer")}</strong>
                    </Alert>
                    <p className="text-2xl font-bold tracking-tight text-zinc-900">
                      {price}
                    </p>
                    <form action={purchaseKitAction} className="space-y-2">
                      <input type="hidden" name="id" value={kit.id} />
                      <SubmitButton pendingText="..." className="w-full py-3">
                        {t("marketing.customer.buy")}
                      </SubmitButton>
                      <p className="text-xs text-zinc-500">
                        {t("marketing.customer.buyHint")}
                      </p>
                    </form>
                  </>
                ) : null}
                {kit.status === "purchased" ? (
                  <Alert tone="warning">
                    {t("marketing.customer.awaitingPayment")}
                  </Alert>
                ) : null}
                {kit.status === "paid" ? (
                  <Alert tone="success">
                    {t("marketing.customer.awaitingRelease")}
                  </Alert>
                ) : null}
                {kit.status === "released" ? (
                  <Alert tone="success">
                    {t("marketing.customer.released")}{" "}
                    <TextLink href="#files">
                      {t("marketing.files.title")}
                    </TextLink>
                  </Alert>
                ) : null}
              </div>
            )}

            <div className="mt-4 border-t border-zinc-100 pt-3">
              <DescriptionList
                items={dateItems
                  .filter(([, v]) => !!v)
                  .map(([k, v]) => [k, formatDate(v)])}
              />
            </div>
          </Card>
        </div>

        {/* ---- Conteúdo principal ---- */}
        <div className="min-w-0 space-y-6 lg:order-1 lg:col-span-2">
          {/* Produto (ficha, somente leitura) */}
          <Card title={t("marketing.product.title")}>
            <p className="mb-3 text-xs text-zinc-500">
              {t("marketing.product.fromSheet")}
            </p>
            {product ? (
              <div className="space-y-4">
                {primaryVisible || commercialVisible.length > 0 ? (
                  <div className="space-y-3">
                    {primaryVisible && primaryId ? (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          {t("marketing.product.primaryPhoto")}
                        </h3>
                        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                          <li>
                            <a
                              href={`/api/files/${primaryId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <FileThumb
                                documentId={primaryId}
                                alt={product.name}
                              />
                            </a>
                          </li>
                        </ul>
                      </div>
                    ) : null}
                    {commercialVisible.length > 0 ? (
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          {t("marketing.product.commercialPhotos")}
                        </h3>
                        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                          {commercialVisible.map((photo) => (
                            <li key={photo.id} className="min-w-0 space-y-1">
                              <a
                                href={`/api/files/${photo.documentId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <FileThumb
                                  documentId={photo.documentId}
                                  alt={photo.caption ?? product.name}
                                />
                              </a>
                              {photo.caption ? (
                                <p className="truncate text-xs text-zinc-600">
                                  {photo.caption}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Empty>{t("marketing.product.noPhotos")}</Empty>
                )}
                <DescriptionList
                  items={[
                    [t("common.name"), product.name],
                    ...(wellmix
                      ? ([
                          [t("marketing.field.sku"), product.sku ?? "—"],
                          [t("marketing.field.line"), sheet?.line?.name ?? "—"],
                        ] as Array<[string, string]>)
                      : []),
                    [t("marketing.field.category"), product.category ?? "—"],
                    [t("marketing.field.material"), product.material ?? "—"],
                    [t("marketing.field.color"), product.color ?? "—"],
                    [t("marketing.field.pantone"), product.pantone ?? "—"],
                    [
                      t("marketing.field.specification"),
                      product.specification ? (
                        <span className="whitespace-pre-wrap">
                          {product.specification}
                        </span>
                      ) : (
                        "—"
                      ),
                    ],
                  ]}
                />
              </div>
            ) : (
              <Empty>{t("marketing.product.missing")}</Empty>
            )}
          </Card>

          {/* Textos do kit */}
          <Card title={t("marketing.texts.title")}>
            {editable ? (
              <form action={updateKitAction} className="space-y-4">
                <input type="hidden" name="id" value={kit.id} />
                <Field label={t("marketing.field.name")}>
                  <Input
                    name="name"
                    required
                    maxLength={160}
                    defaultValue={kit.name}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t("marketing.field.customer")}
                    hint={
                      customerLocked
                        ? t("marketing.texts.customerLocked")
                        : undefined
                    }
                  >
                    {customerLocked ? (
                      <input
                        type="hidden"
                        name="customerId"
                        value={kit.customerId ?? ""}
                      />
                    ) : null}
                    <Select
                      name={customerLocked ? undefined : "customerId"}
                      disabled={customerLocked}
                      defaultValue={kit.customerId ?? ""}
                    >
                      <option value="">{t("marketing.noCustomer")}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <Field
                        label={t("marketing.field.price")}
                        hint={
                          priceLocked
                            ? t("marketing.texts.priceLocked")
                            : t("marketing.texts.priceEditable")
                        }
                      >
                        {priceLocked ? (
                          <input type="hidden" name="price" value={kit.price} />
                        ) : null}
                        <Input
                          name={priceLocked ? undefined : "price"}
                          type="number"
                          min="0"
                          step="0.01"
                          required={!priceLocked}
                          disabled={priceLocked}
                          defaultValue={kit.price}
                        />
                      </Field>
                    </div>
                    <Field label={t("marketing.field.currency")}>
                      {priceLocked ? (
                        <input
                          type="hidden"
                          name="currency"
                          value={kit.currency}
                        />
                      ) : null}
                      <CurrencySelect
                        name={priceLocked ? undefined : "currency"}
                        value={kit.currency}
                        t={t}
                        required={!priceLocked}
                        disabled={priceLocked}
                      />
                    </Field>
                  </div>
                </div>
                <Field label={t("marketing.field.concept")}>
                  <Textarea
                    name="concept"
                    maxLength={2000}
                    defaultValue={kit.concept ?? ""}
                  />
                </Field>
                <Field label={t("marketing.field.slogan")}>
                  <Input
                    name="slogan"
                    maxLength={255}
                    defaultValue={kit.slogan ?? ""}
                  />
                </Field>
                <Field label={t("marketing.field.description")}>
                  <Textarea
                    name="description"
                    maxLength={4000}
                    defaultValue={kit.description ?? ""}
                  />
                </Field>
                <Field label={t("marketing.field.campaign")}>
                  <Textarea
                    name="campaign"
                    maxLength={4000}
                    defaultValue={kit.campaign ?? ""}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t("marketing.field.colors")}
                    hint={t("marketing.field.colorsHint")}
                  >
                    <Textarea
                      name="colors"
                      defaultValue={kit.colors?.join("\n") ?? ""}
                    />
                  </Field>
                  <Field label={t("marketing.field.pantone")}>
                    <Input
                      name="pantone"
                      maxLength={120}
                      defaultValue={kit.pantone ?? ""}
                    />
                  </Field>
                </div>
                <Field label={t("marketing.field.notes")}>
                  <Textarea
                    name="notes"
                    maxLength={4000}
                    defaultValue={kit.notes ?? ""}
                  />
                </Field>
                <div className="border-t border-zinc-100 pt-4">
                  <SubmitButton
                    pendingText="..."
                    className="w-full py-2.5 sm:w-auto sm:py-2"
                  >
                    {t("marketing.texts.save")}
                  </SubmitButton>
                </div>
              </form>
            ) : textItems.some(([, v]) => !!v) ? (
              <DescriptionList
                items={textItems.map(([k, v]) => [
                  k,
                  v ? <span className="whitespace-pre-wrap">{v}</span> : "—",
                ])}
              />
            ) : (
              <Empty>{t("marketing.texts.empty")}</Empty>
            )}
          </Card>

          {/* Sugestão de textos (IA): só a Wellmix; humano confirma */}
          {wellmix ? (
            <Card title={t("marketing.ai.title")} className="scroll-mt-4">
              <div id="ai" className="scroll-mt-4" />
              <div className="space-y-4">
                <Alert tone="info">{t("marketing.ai.principle")}</Alert>
                {aiMode === "manual" ? (
                  <Alert tone="warning">
                    {t("marketing.ai.manual")}
                    {user.role === "admin" ? (
                      <>
                        {" "}
                        <TextLink href="/app/settings">
                          {t("marketing.ai.manualAdmin")}
                        </TextLink>
                      </>
                    ) : null}
                  </Alert>
                ) : editable ? (
                  <form
                    action={requestMarketingSuggestionAction}
                    className="space-y-3"
                  >
                    <input type="hidden" name="id" value={kit.id} />
                    {aiMode === "mock" ? (
                      <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                        <Badge tone="warning">{t("marketing.ai.mock")}</Badge>
                        {t("marketing.ai.mockHint")}
                      </p>
                    ) : null}
                    <Field
                      label={t("marketing.ai.context")}
                      hint={t("marketing.ai.contextHint")}
                    >
                      <Textarea
                        name="context"
                        maxLength={2000}
                        className="min-h-16"
                      />
                    </Field>
                    <SubmitButton
                      variant="secondary"
                      pendingText="..."
                      className="w-full sm:w-auto"
                    >
                      {t("marketing.ai.request")}
                    </SubmitButton>
                  </form>
                ) : null}

                {latest ? (
                  <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900">
                        {t("marketing.ai.latest")}
                      </span>
                      <SourceBadge t={t} s={latest} />
                      <Badge tone="brand">
                        {t("marketing.ai.status.suggested")}
                      </Badge>
                      <span className="text-xs text-zinc-500">
                        {formatDate(latest.createdAt)}
                      </span>
                    </div>
                    {latest.source === "mock" ? (
                      <p className="mt-1 text-xs text-zinc-600">
                        {t("marketing.ai.mockHint")}
                      </p>
                    ) : null}
                    <p className="mt-2 text-sm text-zinc-700">
                      {t("marketing.ai.review")}
                    </p>
                    {editable ? (
                      <form action={updateKitAction} className="mt-3 space-y-3">
                        <input type="hidden" name="id" value={kit.id} />
                        <input
                          type="hidden"
                          name="suggestionId"
                          value={latest.id}
                        />
                        <input type="hidden" name="name" value={kit.name} />
                        <input
                          type="hidden"
                          name="customerId"
                          value={kit.customerId ?? ""}
                        />
                        <input type="hidden" name="price" value={kit.price} />
                        <input
                          type="hidden"
                          name="currency"
                          value={kit.currency}
                        />
                        <input
                          type="hidden"
                          name="pantone"
                          value={kit.pantone ?? ""}
                        />
                        <input
                          type="hidden"
                          name="notes"
                          value={kit.notes ?? ""}
                        />
                        <Field label={t("marketing.field.concept")}>
                          <Textarea
                            name="concept"
                            maxLength={2000}
                            defaultValue={suggestedText(latest, "concept")}
                          />
                        </Field>
                        <Field label={t("marketing.field.slogan")}>
                          <Input
                            name="slogan"
                            maxLength={255}
                            defaultValue={suggestedText(latest, "slogan")}
                          />
                        </Field>
                        <Field label={t("marketing.field.description")}>
                          <Textarea
                            name="description"
                            maxLength={4000}
                            defaultValue={suggestedText(latest, "description")}
                          />
                        </Field>
                        <Field label={t("marketing.field.campaign")}>
                          <Textarea
                            name="campaign"
                            maxLength={4000}
                            defaultValue={suggestedText(latest, "campaign")}
                          />
                        </Field>
                        <Field
                          label={t("marketing.field.colors")}
                          hint={t("marketing.field.colorsHint")}
                        >
                          <Textarea
                            name="colors"
                            className="min-h-16"
                            defaultValue={suggestedList(latest, "colors").join(
                              "\n",
                            )}
                          />
                        </Field>
                        {suggestedText(latest, "imagePrompt") ? (
                          <DescriptionList
                            items={[
                              [
                                t("marketing.ai.imagePrompt"),
                                <span key="ip" className="whitespace-pre-wrap">
                                  {suggestedText(latest, "imagePrompt")}
                                </span>,
                              ],
                            ]}
                          />
                        ) : null}
                        <SubmitButton
                          pendingText="..."
                          className="w-full py-2.5 sm:w-auto sm:py-2"
                        >
                          {t("marketing.ai.use")}
                        </SubmitButton>
                      </form>
                    ) : (
                      <DescriptionList
                        items={[
                          [
                            t("marketing.field.concept"),
                            suggestedText(latest, "concept") || "—",
                          ],
                          [
                            t("marketing.field.slogan"),
                            suggestedText(latest, "slogan") || "—",
                          ],
                          [
                            t("marketing.field.description"),
                            suggestedText(latest, "description") || "—",
                          ],
                          [
                            t("marketing.field.campaign"),
                            suggestedText(latest, "campaign") || "—",
                          ],
                          [
                            t("marketing.field.colors"),
                            suggestedList(latest, "colors").join(", ") || "—",
                          ],
                        ]}
                      />
                    )}
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer font-medium text-zinc-700">
                        {t("marketing.ai.prompt")}
                      </summary>
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                        {latest.prompt}
                      </pre>
                    </details>
                  </div>
                ) : suggestions.length === 0 ? (
                  <Empty>{t("marketing.ai.none")}</Empty>
                ) : null}

                {history.length > 0 ? (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {t("marketing.ai.history")}
                    </h3>
                    <ul className="space-y-2">
                      {history.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-lg border border-zinc-200 bg-white p-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <SourceBadge t={t} s={s} />
                            <Badge
                              tone={
                                s.status === "applied"
                                  ? "success"
                                  : s.status === "discarded"
                                    ? "neutral"
                                    : "brand"
                              }
                            >
                              {t(
                                `marketing.ai.status.${s.status}` as DictionaryKey,
                              )}
                            </Badge>
                            <span className="text-xs text-zinc-500">
                              {formatDate(s.createdAt)}
                            </span>
                            {s.note ? (
                              <span className="text-xs text-zinc-600">
                                · {s.note}
                              </span>
                            ) : null}
                          </div>
                          {suggestedText(s, "slogan") ? (
                            <p className="mt-1 text-zinc-800">
                              {suggestedText(s, "slogan")}
                            </p>
                          ) : null}
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-zinc-600">
                              {t("marketing.ai.prompt")}
                            </summary>
                            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-zinc-700">
                              {s.prompt}
                            </pre>
                          </details>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          {/* Prévias */}
          <Card title={t("marketing.previews.title")}>
            {wellmix ? (
              <p className="mb-3 text-xs text-zinc-500">
                {t("marketing.previews.hint")}
              </p>
            ) : null}
            <KitDocList
              t={t}
              docs={previewDocs}
              empty={t("marketing.previews.none")}
            />
            {editable ? (
              <form
                action={addKitFileAction}
                className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="id" value={kit.id} />
                <input type="hidden" name="stage" value="preview" />
                <div className="min-w-0 flex-1">
                  <Field label={t("marketing.files.select")}>
                    <Input
                      name="files"
                      type="file"
                      multiple
                      required
                      accept="image/*,application/pdf"
                    />
                  </Field>
                </div>
                <SubmitButton
                  variant="secondary"
                  pendingText="..."
                  className="w-full sm:w-auto"
                >
                  {t("marketing.previews.upload")}
                </SubmitButton>
              </form>
            ) : null}
          </Card>

          {/* Arquivos finais */}
          <Card title={t("marketing.files.title")} className="scroll-mt-4">
            <div id="files" className="scroll-mt-4" />
            {wellmix ? (
              <>
                <p className="mb-3 text-xs text-zinc-500">
                  {t("marketing.files.hint")}
                </p>
                <KitDocList
                  t={t}
                  docs={releasedDocs}
                  empty={t("marketing.files.none")}
                />
                {editable ? (
                  <form
                    action={addKitFileAction}
                    className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4 sm:flex-row sm:items-end"
                  >
                    <input type="hidden" name="id" value={kit.id} />
                    <input type="hidden" name="stage" value="final" />
                    <div className="min-w-0 flex-1">
                      <Field label={t("marketing.files.select")}>
                        <Input
                          name="files"
                          type="file"
                          multiple
                          required
                          accept="image/*,application/pdf"
                        />
                      </Field>
                    </div>
                    <SubmitButton
                      variant="secondary"
                      pendingText="..."
                      className="w-full sm:w-auto"
                    >
                      {t("marketing.files.upload")}
                    </SubmitButton>
                  </form>
                ) : null}
              </>
            ) : kit.status === "released" ? (
              <KitDocList
                t={t}
                docs={releasedDocs}
                empty={t("marketing.files.none")}
              />
            ) : (
              <Alert tone="neutral">{t("marketing.files.afterPayment")}</Alert>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
