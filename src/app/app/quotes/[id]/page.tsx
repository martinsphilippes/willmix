import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewQuote, isWellmix } from "@/lib/auth/permissions";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  FieldRow,
  PageHeader,
  cx,
  formatDate,
  inputDenseClass,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  addQuoteSheetPhotosAction,
  adoptSheetIntoProductAction,
  answerQuoteWithSheetAction,
  removeQuoteSheetPhotoAction,
  saveQuoteSheetDraftAction,
  sendQuoteWithSheetAction,
} from "../../actions/purchase-sheet";
import { SheetPhotosCard } from "@/components/sheet-photos";
import { getQuoteSheetForUser } from "@/lib/services/quote-sheet";
import { PurchaseSheetFields } from "@/components/purchase-sheet-fields";
import { RequestScheduleTable } from "@/components/request-schedule-table";
import type { DictionaryKey } from "@/i18n/dictionaries";

/** Fornecedor vê a RFQ e responde. Não vê outros fornecedores nem o cliente final. */
export default async function QuotePage({
  params,
  searchParams,
}: PageProps<"/app/quotes/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const {
    error,
    saved,
    photos: photoSent,
    photoRemoved,
    adopted,
  } = await searchParams;
  const store = getStore();
  const quote = await store.get("quotes", id);
  if (!quote || !canViewQuote(user, quote)) notFound();
  const request = await store.get("requests", quote.requestId);
  if (!request) notFound();
  const t = await getT();
  const documents = await store.list("documents", {
    filter: { requestId: request.id },
  });
  const canAnswer = quote.status === "invited" || quote.status === "answered";
  // Resposta pela ficha de compra (fotos opcionais nesta fase).
  const sheetView = await getQuoteSheetForUser(user, quote.id);
  const missingText = (sheetView?.missing ?? [])
    .map((k) => t(`sheet.field.${k}` as DictionaryKey))
    .join(", ");
  const errorCode = typeof error === "string" ? error : "";
  const errorKeys = [
    `quoteSheet.error.${errorCode}`,
    `sheet.error.${errorCode}`,
  ];
  const errorText = !errorCode
    ? null
    : (errorKeys
        .map((k) => [k, t(k as DictionaryKey)] as const)
        .find(([k, v]) => v !== k)?.[1] ?? t("common.error"));

  return (
    <>
      <PageHeader
        help={{ body: "help.quote.body", steps: "help.quote.steps" }}
        t={t}
        title={`${t("quotes.title")}: ${request.productName}`}
        subtitle={
          <Badge
            tone={
              quote.status === "selected"
                ? "success"
                : quote.status === "rejected"
                  ? "neutral"
                  : quote.status === "invited"
                    ? "neutral"
                    : "info"
            }
          >
            {t(`quoteStatus.${quote.status}`)}
          </Badge>
        }
      />
      <div className="space-y-3">
        {errorText ? <Alert tone="danger">{errorText}</Alert> : null}
        {typeof adopted === "string" && adopted ? (
          <Alert tone="success">{t("productSheet.adopted")}</Alert>
        ) : null}
        {saved === "sent" ? (
          <Alert tone="success">{t("quoteSheet.saved.sent")}</Alert>
        ) : saved === "complete" ? (
          <Alert tone="success">{t("quoteSheet.saved.complete")}</Alert>
        ) : photoSent ? (
          <Alert tone="success">{t("sheet.photos.sent")}</Alert>
        ) : photoRemoved ? (
          <Alert tone="success">{t("sheet.photos.removed")}</Alert>
        ) : saved === "partial" ? (
          <Alert tone="warning">
            {t("quoteSheet.saved.partial", { fields: missingText })}
          </Alert>
        ) : null}
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card title={t("requests.title")}>
          <DescriptionList
            items={[
              [t("common.quantity"), `${request.quantity} ${request.unit}`],
              [t("requests.deadline"), formatDate(request.deadline)],
              [t("quotes.validUntil"), formatDate(quote.validUntil)],
              [t("requests.description"), request.description],
              [t("requests.specification"), request.specification],
            ]}
          />
          <RequestScheduleTable
            schedule={request.schedule}
            unit={request.unit}
            t={t}
          />
          {documents.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 text-sm">
              {documents
                .filter(
                  (d) =>
                    d.visibility !== "internal" && d.visibility !== "customer",
                )
                .map((d) => (
                  <li key={d.id}>
                    <a
                      href={`/api/files/${d.id}`}
                      className={linkClass}
                      target="_blank"
                    >
                      {d.name}
                    </a>
                  </li>
                ))}
            </ul>
          ) : null}
        </Card>
        <Card
          title={t("quotes.answer")}
          className={cx(
            quote.status === "invited" &&
              "border-brand-300! ring-4 ring-brand-50",
          )}
        >
          <div className="space-y-4">
            {quote.status === "selected" ? (
              <Alert tone="success">{t("quotes.selected")}</Alert>
            ) : null}
            {quote.status === "rejected" ? (
              <Alert tone="neutral">{t("quotes.rejected")}</Alert>
            ) : null}
            {quote.status === "answered" ? (
              <Alert tone="info">{t("quotes.answered")}</Alert>
            ) : null}
            {canAnswer && sheetView?.access.editSupplier ? (
              <p className="text-sm leading-relaxed text-zinc-600">
                {t("quoteSheet.intro")}
              </p>
            ) : (
              <DescriptionList
                items={[
                  [
                    t("common.price"),
                    quote.price !== null
                      ? `${quote.currency} ${quote.price}`
                      : "—",
                  ],
                  [t("common.leadTime"), quote.leadTimeDays],
                  [t("common.conditions"), quote.conditions],
                ]}
              />
            )}
          </div>
        </Card>
      </div>
      {/* Ordem da ficha: campos, fotos e, por último, a resposta com os botões.
          O card de fotos tem formulários próprios (cada foto sobe na hora, no
          lugar), por isso prazo, condições e botões ficam fora do <form> e
          apontam para ele pelo atributo `form`. */}
      {/* Grade de 2 colunas: Fornecedor | Produto, Caixa | Preço, Programação | Fotos;
          o <form> é display: contents para os cards entrarem na grade. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {sheetView ? (
          <form
            id="quote-sheet"
            action={answerQuoteWithSheetAction}
            className="contents"
          >
            <input type="hidden" name="quoteId" value={quote.id} />
            <div className="space-y-3 lg:col-span-2">
              <h2 className="text-lg font-semibold text-zinc-900">
                {t("quoteSheet.title")}
              </h2>
              {!sheetView.access.editSupplier ? (
                <Alert tone="neutral">{t("quoteSheet.readOnly")}</Alert>
              ) : sheetView.missing.length ? (
                <Alert tone="info">
                  {t("quoteSheet.missing", { fields: missingText })}
                </Alert>
              ) : null}
              {sheetView.access.editCustoms ? (
                <p className="text-xs text-zinc-500">
                  {t("quoteSheet.wellmixHint")}
                </p>
              ) : null}
            </div>
            <PurchaseSheetFields
              t={t}
              sheet={sheetView.sheet}
              plan={sheetView.plan}
              containerType={sheetView.containerType}
              containerTypes={sheetView.containerTypes}
              editSupplier={sheetView.access.editSupplier}
              editCustoms={sheetView.access.editCustoms}
              requestSchedule={request.schedule ?? null}
              requestUnit={request.unit}
              records={sheetView.records}
            />
          </form>
        ) : null}
        {sheetView ? (
          <SheetPhotosCard
            t={t}
            photos={sheetView.photos}
            canEdit={sheetView.access.addPhotos}
            ownerField="quoteId"
            ownerId={quote.id}
            addAction={addQuoteSheetPhotosAction}
            removeAction={removeQuoteSheetPhotoAction}
            coveredKinds={sheetView.catalogPhotoKinds}
            hint={t("quoteSheet.photosHint")}
            className="lg:order-4"
          />
        ) : null}
        {sheetView &&
        sheetView.saved &&
        isWellmix(user) &&
        sheetView.sheet.productId ? (
          <form
            action={adoptSheetIntoProductAction}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-sm lg:order-7 lg:col-span-2"
            data-adopt-sheet
          >
            <input type="hidden" name="ownerId" value={quote.id} />
            <input
              type="hidden"
              name="back"
              value={`/app/quotes/${quote.id}`}
            />
            <span className="min-w-0 flex-1 text-xs text-zinc-600">
              {t("productSheet.adoptHint")}
            </span>
            <SubmitButton variant="secondary">
              {t("productSheet.adopt")}
            </SubmitButton>
          </form>
        ) : null}
        {sheetView && canAnswer && sheetView.access.editSupplier ? (
          <Card
            title={t("quotes.answer")}
            className="lg:order-8 lg:col-span-2"
            dense
          >
            <div className="space-y-2">
              <FieldRow label={t("quoteSheet.leadTime")} size="xs">
                <input
                  form="quote-sheet"
                  name="leadTimeDays"
                  type="number"
                  min="1"
                  defaultValue={quote.leadTimeDays ?? ""}
                  className={inputDenseClass}
                />
              </FieldRow>
              <FieldRow label={t("quoteSheet.conditions")} size="full">
                <textarea
                  form="quote-sheet"
                  name="conditions"
                  rows={2}
                  maxLength={2000}
                  defaultValue={quote.conditions ?? ""}
                  placeholder={t("ph.quote.conditions")}
                  className={cx(inputDenseClass, "min-h-12")}
                />
              </FieldRow>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <SubmitButton
                form="quote-sheet"
                formAction={sendQuoteWithSheetAction}
              >
                {t("quoteSheet.send")}
              </SubmitButton>
              <SubmitButton
                form="quote-sheet"
                formAction={saveQuoteSheetDraftAction}
                variant="secondary"
              >
                {t("quoteSheet.saveDraft")}
              </SubmitButton>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
