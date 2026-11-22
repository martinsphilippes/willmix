import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText } from "@/i18n";
import { getStore } from "@/lib/db";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import {
  quoteEditable,
  responseState,
  supplierQuoteView,
  sweepQuotes,
} from "@/lib/services/purchase-quote";
import { Alert, Badge, Card, PageHeader, formatDate } from "@/components/ui";
import { ActionError } from "@/components/action-error";
import {
  addQuoteScalePhotoAction,
  answerQuoteAction,
  saveQuoteDraftAction,
} from "../../actions/purchase-demand";
import { loadQuoteDraft } from "@/lib/services/quote-draft";
import { QuoteDeadline, dueTimes } from "../_time";
import { QuoteAnswerSummary } from "../_components/quote-answer-summary";
import {
  QuoteAnswerForm,
  type QuoteSheetProduct,
} from "../_components/quote-answer-form";
import { answerLabels } from "../_components/quote-answer-labels";
import {
  quoteSheetLines,
  sheetTolerances,
} from "@/lib/services/supplier-sheets";
import { draftFromBaseline, draftFromData } from "@/lib/supplier-sheet";
import { isPieceUnit } from "@/lib/moq";
import { listMaterials } from "@/lib/services/materials";
import { materialName } from "@/lib/materials";
import { QuoteBoard } from "../_components/quote-board";
import { QuoteChat } from "../../supplier-requests/_components/board-chat";
import {
  canMessageQuote,
  pendingQuoteProposals,
  quoteProductMessages,
} from "@/lib/quote-negotiation";
import { errorTextsFor } from "@/i18n/error-text";
import { quoteSamplingOf } from "@/lib/quote-sampling";
import { soldBeforeProducts } from "@/lib/services/supplier-sheets";
import { SamplingPanel } from "../../supplier-requests/_components/sampling";
import {
  addQuoteSamplingFileAction,
  removeQuoteSamplingFileAction,
  reviewQuoteSamplingAction,
  submitQuoteSamplingAction,
} from "../../actions/quotation";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import { productPhotoList } from "@/lib/services/product-list";

/*
 * Uma cotação de compra (mapa B13; docs/PURCHASE_DEMAND.md).
 * - Fornecedor: só a própria resposta (itens, prazo, preço por item e
 *   condição de envio, ou recusa). Nada de outros convidados, outras
 *   respostas, demandas nem cliente.
 * - Wellmix: o quadro comparativo com a última compra como referência, a
 *   escolha da vencedora, a aprovação e o que fazer sem resposta.
 */
export default async function PurchaseQuotePage({
  params,
  searchParams,
}: PageProps<"/app/purchase-quotes/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "quotes");
  const { id } = await params;
  const sp = await searchParams;
  const t = await getT();
  const now = new Date();
  await sweepQuotes(now).catch(() => null);
  const errorCode = typeof sp.error === "string" ? sp.error : "";
  const errorKey = `quote.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;

  if (!isWellmix(user)) {
    const view = await supplierQuoteView(user, id);
    if (!view) notFound();
    const { quote, response } = view;
    // Para quem nunca vendeu, a cotação não mostra a nossa caixa: as caixas
    // saem da caixa que ele informar (dono, 20/11/2026).
    const state = responseState(response, now);
    // Enviada ou não, dá para responder e corrigir até o prazo dele, enquanto
    // a Wellmix não escolhe a vencedora (dono, 21/11/2026, opção 1).
    const editable = quoteEditable(quote, response, now);
    const times = dueTimes(t, response.dueAt);
    // Fotos do produto e amostragem (dono, 22/11/2026;
    // docs/SUPPLIER_SAMPLING.md): desde o convite, ele vê as fotos do nosso
    // cadastro e envia a amostra de cada produto; o fornecedor conhecido do
    // produto (já vendeu à Wellmix) não envia.
    const quoteProductIds = quote.items.map((i) => i.productId);
    const [known, sampleProducts, samplePhotos] = await Promise.all([
      soldBeforeProducts(response.supplierId, quoteProductIds).catch(
        () => new Set<string>(),
      ),
      getStore()
        .list("products", { filter: { id: quoteProductIds } })
        .catch(() => []),
      getStore()
        .list("product_photos", { filter: { productId: quoteProductIds } })
        .catch(() => []),
    ]);
    const samplingOpen = quote.status === "open" || quote.status === "chosen";
    const samplingNotice =
      typeof sp.sampling === "string" &&
      ["file", "removed", "submitted"].includes(sp.sampling)
        ? (sp.sampling as "file" | "removed" | "submitted")
        : null;
    // Com a amostra enviada, a conversa já abre: os dois falam do que veem.
    const sampleStarted = Object.values(response.sampling ?? {}).some(
      (x) => x.files.length > 0,
    );
    const counters = pendingQuoteProposals(response);
    const chat = quoteProductMessages(response, null);
    // Ficha técnica de cada produto (dono, 20/11/2026): pedida na primeira
    // vez do par; quem já vendeu confere o que temos (o aviso de revalidação).
    // Rascunho automático deste login (dono, 20/11/2026): o que estava
    // digitado volta para a tela.
    const [lines, tolerances, draft, catalog] = await Promise.all([
      quoteSheetLines(quote, response),
      sheetTolerances(),
      editable ? loadQuoteDraft(user, quote.id) : Promise.resolve(null),
      // Catálogo de materiais (dono, 21/11/2026): o fornecedor escolhe daqui.
      listMaterials({ includeInactive: true }),
    ]);
    const materialOptions = catalog
      .filter((m) => m.active)
      .map((m) => ({
        id: m.id,
        label: materialName(m, t.intl),
        search: `${m.namePt} ${m.nameEn} ${m.nameZh}`,
        namePt: m.namePt,
      }));
    const answerProducts: QuoteSheetProduct[] = quote.items.map((item) => {
      const line = lines.find((l) => l.productId === item.productId)!;
      const scheduleItems = item.schedule?.items ?? [];
      return {
        productId: item.productId,
        name: productNameText(t, item.name),
        quantityText: `${item.quantity.toLocaleString(t.intl)} ${item.unit}`,
        specification: item.specification ?? null,
        scheduleText: scheduleItems.length
          ? scheduleItems
              .map((i) =>
                t("strategy.line.scheduleItem", {
                  index: i.index,
                  quantity: i.quantity.toLocaleString(t.intl),
                  date: formatDate(i.expectedAt, t),
                }),
              )
              .join(" · ")
          : null,
        desiredText: item.desiredAt ? formatDate(item.desiredAt, t) : null,
        price:
          response.prices
            ?.find((p) => p.productId === item.productId)
            ?.unitPrice.toString() ?? "",
        // Caixas pela caixa dele: em peças, uma conta por programação.
        rounds: isPieceUnit(item.unit)
          ? scheduleItems.length
            ? scheduleItems.map((i) => i.quantity)
            : [item.quantity]
          : [],
        soldBefore: line.soldBefore,
        ask: line.ask,
        own: !!line.ownDraft,
        settledText: line.settled
          ? t("supplierSheet.settled", {
              date: formatDate(line.settled.confirmedAt, t),
            })
          : null,
        rejectedNote: line.rejectedNote,
        draft: line.ownDraft
          ? draftFromData(line.ownDraft)
          : draftFromBaseline(
              line.soldBefore ? line.baseline : null,
              line.baselineMaterialIds,
            ),
        baseline: line.baseline,
        askPhoto: line.askPhoto,
        photoUrl: line.photoDocumentId
          ? `/api/files/${line.photoDocumentId}`
          : null,
        inner: line.inner,
        // Ficha de antes do catálogo (texto livre): ele escolhe de novo.
        legacyMaterial:
          line.ownDraft && !line.ownDraft.materialIds?.length
            ? line.ownDraft.material || null
            : null,
      };
    });
    return (
      <div data-quote-supplier={quote.id}>
        <PageHeader
          t={t}
          title={t("quote.one", { n: quote.number })}
          subtitle={t("quote.supplier.hint", { hours: quote.hours })}
        />
        <ActionError t={t} code={errorCode} text={errorText} fields={null} />
        {typeof sp.answered === "string" && editable ? (
          <div className="mb-3" role="status" data-quote-answered>
            <Alert tone="success">
              {t(
                sp.answered === "declined"
                  ? "quote.supplier.declinedDone"
                  : "quote.supplier.answeredDone",
                times,
              )}
            </Alert>
          </div>
        ) : null}
        {/* Negociação dentro da cotação (dono, 22/11/2026;
            docs/QUOTATION.md): a contraproposta da Wellmix por produto (ele
            corrige a resposta abaixo e reenvia) e a conversa com ela. */}
        {counters.length || chat.length || sampleStarted ? (
          <div id="negociacao" className="mb-4 scroll-mt-20">
            <Card title={t("quotation.supplier.title")}>
              <div className="space-y-3" data-quote-negotiation>
                {counters.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                    data-quote-counter={e.productId ?? ""}
                  >
                    <p className="font-semibold">
                      {t("quotation.supplier.counter", {
                        product: productNameText(
                          t,
                          quote.items.find((i) => i.productId === e.productId)
                            ?.name ?? "",
                        ),
                      })}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {[
                        e.price != null
                          ? `${e.price.toLocaleString(t.intl, { maximumFractionDigits: 4 })} ${e.currency ?? ""}`.trim()
                          : null,
                        e.incoterm ?? null,
                        e.moq != null
                          ? `MOQ ${e.moq.toLocaleString(t.intl)}`
                          : null,
                        e.leadTimeDays != null
                          ? t("strategy.days", { n: e.leadTimeDays })
                          : null,
                      ]
                        .filter((v): v is string => !!v)
                        .map((chip) => (
                          <span
                            key={chip}
                            className="rounded-md border border-amber-300 bg-white px-1.5 py-0.5 text-xs tabular-nums"
                          >
                            {chip}
                          </span>
                        ))}
                    </p>
                    {e.text ? (
                      <p className="mt-1 whitespace-pre-wrap">{e.text}</p>
                    ) : null}
                    <p className="mt-1 text-xs">
                      {t(
                        editable
                          ? "quotation.supplier.counterHint"
                          : "quotation.supplier.counterClosed",
                        times,
                      )}
                    </p>
                  </div>
                ))}
                <QuoteChat
                  quoteId={quote.id}
                  responseId={null}
                  productId={null}
                  messages={chat}
                  mySide="supplier"
                  names={{}}
                  canPost={canMessageQuote(quote.status, response)}
                  errors={errorTextsFor(t, [
                    "quotation.error",
                    "quote.error",
                    "supplierRequests.error",
                    "common",
                  ])}
                  fallbackError={`${t("common.error")} ({code})`}
                  t={t}
                />
              </div>
            </Card>
          </div>
        ) : null}
        {response.status !== "declined" ? (
          <div id="amostragem" className="mb-4 scroll-mt-20">
            <Card title={t("quoteSampling.productsTitle")}>
              <div className="space-y-4" data-quote-sampling>
                {samplingNotice ? (
                  <div role="status" data-quote-sampling-notice>
                    <Alert tone="success">
                      {t(`quoteSampling.notice.${samplingNotice}`)}
                    </Alert>
                  </div>
                ) : null}
                {quote.items.map((item) => {
                  const product =
                    sampleProducts.find((p) => p.id === item.productId) ?? null;
                  const name = productNameText(t, item.name);
                  const sampling = quoteSamplingOf(
                    response,
                    item.productId,
                    known.has(item.productId),
                  );
                  return (
                    <div
                      key={item.productId}
                      className="space-y-2"
                      data-quote-sampling-product={item.productId}
                    >
                      <div className="flex items-center gap-3">
                        <span data-quote-product-photos={item.productId}>
                          <PhotoGallery
                            name={name}
                            {...galleryProps(
                              t,
                              product
                                ? productPhotoList(product, samplePhotos)
                                : [],
                            )}
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-zinc-900">
                            {name}
                          </span>
                          <span className="block text-xs text-zinc-500">
                            {t("quoteSampling.reference")}
                          </span>
                        </span>
                      </div>
                      {sampling && samplingOpen ? (
                        <SamplingPanel
                          title={t("quoteSampling.yourSample")}
                          sampling={sampling}
                          wellmix={false}
                          canValidate={false}
                          slaDays={null}
                          early
                          anchor={null}
                          actions={{
                            add: addQuoteSamplingFileAction,
                            remove: removeQuoteSamplingFileAction,
                            submit: submitQuoteSamplingAction,
                            review: reviewQuoteSamplingAction,
                          }}
                          fields={
                            <>
                              <input
                                type="hidden"
                                name="quoteId"
                                value={quote.id}
                              />
                              <input
                                type="hidden"
                                name="product"
                                value={item.productId}
                              />
                            </>
                          }
                          t={t}
                        />
                      ) : sampling ? null : (
                        <p
                          className="rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                          data-quote-sampling-skipped={item.productId}
                        >
                          {t("quoteSampling.supplierSkipped")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ) : null}
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge tone={state === "open" ? "warning" : "neutral"}>
              {t(`quote.response.${state}` as DictionaryKey)}
            </Badge>
            <QuoteDeadline t={t} dueAt={response.dueAt} now={now} />
          </div>
          {editable ? (
            <QuoteAnswerForm
              quoteId={quote.id}
              action={answerQuoteAction}
              photoAction={addQuoteScalePhotoAction}
              products={answerProducts}
              materials={materialOptions}
              commercial={{
                // Sem resposta ainda: RMB (dono, 20/11/2026); o fornecedor
                // troca ao lado do preço.
                currency: response.currency ?? "RMB",
                incoterm: response.incoterm ?? "FOB",
                leadTimeDays: response.leadTimeDays?.toString() ?? "",
                port: response.port ?? "",
                moq: response.moq?.toString() ?? "",
                note: response.note ?? "",
              }}
              currencies={SHEET_CURRENCIES}
              incoterms={SHEET_INCOTERMS}
              labels={answerLabels(t)}
              intl={t.intl}
              cbmTolerancePercent={tolerances.cbmPercent}
              draft={draft}
              draftAction={saveQuoteDraftAction}
            />
          ) : (
            <QuoteAnswerSummary
              t={t}
              items={quote.items}
              response={response}
              reason={quote.status === "open" ? "deadline" : "closed"}
              times={times}
              materials={catalog}
            />
          )}
        </Card>
      </div>
    );
  }

  const quote = await getStore().get("purchase_quotes", id);
  if (!quote) notFound();
  return <QuoteBoard user={user} quote={quote} sp={sp} t={t} now={now} />;
}
