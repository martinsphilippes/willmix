import { supplierPortOptions } from "@/lib/services/ports";
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
import {
  Alert,
  Badge,
  Card,
  OpenLink,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
} from "@/components/ui";
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
import {
  baselineFromProduct,
  boxesForSheet,
  draftFromBaseline,
  draftFromData,
} from "@/lib/supplier-sheet";
import { isPieceUnit } from "@/lib/moq";
import { listMaterials } from "@/lib/services/materials";
import { materialName } from "@/lib/materials";
import { QuoteBoard } from "../_components/quote-board";
import { QuoteChat } from "../../supplier-requests/_components/board-chat";
import {
  quoteProductTerms,
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
import { bookPhotoList } from "@/lib/purchase-demand";

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
    const supplierParty = await getStore()
      .get("parties", response.supplierId)
      .catch(() => null);
    const portOptions = await supplierPortOptions(supplierParty?.country);
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
    const num = (value: number, digits = 3) =>
      value.toLocaleString(t.intl, { maximumFractionDigits: digits });
    const catalogOf = (productId: string): Array<[string, string]> => {
      const product = sampleProducts.find((p) => p.id === productId);
      // Item de book sem produto (dono, 26/11/2026): o que o book traz do
      // SKU (a caixa, o inner, o CBM, os pesos por embalagem e o material).
      const book = quote.items.find((i) => i.productId === productId)?.book;
      if (!product && book) {
        const it = book.snapshot;
        const labels = answerLabels(t).f;
        const rows: Array<[string, string | null]> = [
          [
            labels.master,
            it.masterCartonQty !== null ? num(it.masterCartonQty, 0) : null,
          ],
          [
            labels.net,
            it.netWeightPcKg !== null ? num(it.netWeightPcKg) : null,
          ],
          [
            t("quote.catalog.grossPerPiece"),
            it.grossWeightPcKg !== null ? num(it.grossWeightPcKg) : null,
          ],
          [
            labels.cbm,
            it.cbmPerCarton !== null ? num(it.cbmPerCarton, 4) : null,
          ],
          [labels.material, it.material?.trim() || null],
        ];
        return rows.filter((r): r is [string, string] => !!r[1]);
      }
      if (!product) return [];
      const b = baselineFromProduct(product);
      const labels = answerLabels(t).f;
      const rows: Array<[string, string | null]> = [
        [
          labels.master,
          b.masterBoxQty !== null ? num(b.masterBoxQty, 0) : null,
        ],
        [labels.net, b.netWeightKg !== null ? num(b.netWeightKg) : null],
        [
          labels.gross,
          b.grossWeightBoxKg !== null ? num(b.grossWeightBoxKg) : null,
        ],
        // Peso bruto por peça (dono, 24/11/2026): o da caixa pelas peças dela.
        [
          t("quote.catalog.grossPerPiece"),
          b.grossWeightBoxKg !== null && b.masterBoxQty
            ? num(b.grossWeightBoxKg / b.masterBoxQty)
            : null,
        ],
        [
          t("quote.catalog.dims"),
          b.boxLengthCm !== null &&
          b.boxWidthCm !== null &&
          b.boxHeightCm !== null
            ? `${num(b.boxLengthCm, 2)} × ${num(b.boxWidthCm, 2)} × ${num(b.boxHeightCm, 2)}`
            : null,
        ],
        [labels.cbm, b.cbm !== null ? num(b.cbm, 4) : null],
        [labels.material, b.material?.trim() || null],
      ];
      return rows.filter((r): r is [string, string] => !!r[1]);
    };
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
        // Prazo e mínimo do produto (dono, 23/11/2026); na resposta antiga,
        // os da cotação.
        leadTimeDays:
          quoteProductTerms(
            response,
            item.productId,
          ).leadTimeDays?.toString() ?? "",
        moq: quoteProductTerms(response, item.productId).moq?.toString() ?? "",
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
        // O que o cadastro da Wellmix tem do produto (dono, 23/11/2026): as
        // mesmas informações da ficha técnica. O código na fábrica fica de
        // fora: é de outro fornecedor.
        catalog: catalogOf(item.productId),
        legacyMaterial:
          line.ownDraft && !line.ownDraft.materialIds?.length
            ? line.ownDraft.material || null
            : null,
      };
    });
    /* Um produto por tela (dono, 23/11/2026): a cotação abre na lista dos
       produtos (tabela padrão de itens, docs/ORDER_TABLES.md) e cada um abre
       a tela só dele (`?item=<produto>`), com o preço, os termos comerciais,
       a ficha técnica, a amostra e a conversa daquele produto. */
    const focus =
      typeof sp.item === "string" &&
      quote.items.some((i) => i.productId === sp.item)
        ? sp.item
        : null;
    const listHref = `/app/purchase-quotes/${quote.id}`;
    const itemHref = (productId: string) =>
      `${listHref}?item=${encodeURIComponent(productId)}`;
    const chatErrors = errorTextsFor(t, [
      "quotation.error",
      "quote.error",
      "supplierRequests.error",
      "common",
    ]);
    const counterCard = (e: (typeof counters)[number]) => (
      <div
        key={e.id}
        className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
        data-quote-counter={e.productId ?? ""}
      >
        <p className="font-semibold">
          {t("quotation.supplier.counter", {
            product: productNameText(
              t,
              quote.items.find((i) => i.productId === e.productId)?.name ?? "",
            ),
          })}
        </p>
        <p className="mt-1 flex flex-wrap gap-1">
          {[
            e.price != null
              ? `${e.price.toLocaleString(t.intl, { maximumFractionDigits: 4 })} ${e.currency ?? ""}`.trim()
              : null,
            e.incoterm ?? null,
            e.moq != null ? `MOQ ${e.moq.toLocaleString(t.intl)}` : null,
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
        {e.text ? <p className="mt-1 whitespace-pre-wrap">{e.text}</p> : null}
        <p className="mt-1 text-xs">
          {t(
            editable
              ? "quotation.supplier.counterHint"
              : "quotation.supplier.counterClosed",
            times,
          )}
        </p>
      </div>
    );
    /** A conversa deste produto na cotação, numa janela (botão na tela). */
    const productChat = (productId: string) => {
      const name = productNameText(
        t,
        quote.items.find((i) => i.productId === productId)?.name ?? "",
      );
      const messages = quoteProductMessages(response, productId);
      // A conversa já aberta, na coluna fixa da direita (dono, 23/11/2026).
      return (
        <Card title={t("quote.products.chatTitle", { product: name })}>
          <div data-quote-product-chat={productId}>
            <QuoteChat
              quoteId={quote.id}
              responseId={null}
              productId={productId}
              messages={messages}
              mySide="supplier"
              names={{}}
              canPost={canMessageQuote(quote.status, response)}
              errors={chatErrors}
              fallbackError={`${t("common.error")} ({code})`}
              t={t}
            />
          </div>
        </Card>
      );
    };
    const samplingBlock = (item: (typeof quote.items)[number]) => {
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
                    : bookPhotoList(item.book),
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
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <input type="hidden" name="product" value={item.productId} />
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
    };
    const stateBar = (
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Badge tone={state === "open" ? "warning" : "neutral"}>
          {t(`quote.response.${state}` as DictionaryKey)}
        </Badge>
        <QuoteDeadline t={t} dueAt={response.dueAt} now={now} />
      </div>
    );
    const answerForm = editable ? (
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
          incotermValue: response.incotermValue?.toString() ?? "",
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
        focusProductId={focus}
        listHref={listHref}
        portOptions={portOptions}
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
    );
    const notices = (
      <>
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
      </>
    );

    if (focus) {
      const item = quote.items.find((i) => i.productId === focus)!;
      const index = quote.items.indexOf(item);
      const mine = counters.filter((e) => e.productId === focus);
      return (
        <div data-quote-supplier={quote.id} data-quote-supplier-item={focus}>
          <PageHeader
            t={t}
            title={productNameText(t, item.name)}
            subtitle={`${t("quote.one", { n: quote.number })} · ${t(
              "quote.products.of",
              { n: index + 1, total: quote.items.length },
            )}`}
            actions={
              <TextLink href={listHref} data-quote-products-back>
                ← {t("quote.products.back")}
              </TextLink>
            }
          />
          {notices}
          {/* Duas colunas (dono, 23/11/2026): à esquerda, o formulário e a
              amostra; à direita, fixa na rolagem, a conversa deste produto
              já aberta (em tela estreita, ela vai para baixo). */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
            <div className="min-w-0">
              {mine.length ? (
                <div className="mb-4 space-y-3">{mine.map(counterCard)}</div>
              ) : null}
              <div className="mb-4">
                <Card>
                  {stateBar}
                  {answerForm}
                </Card>
              </div>
              {response.status !== "declined" ? (
                <div id="amostragem" className="scroll-mt-20">
                  <Card title={t("quoteSampling.productsTitle")}>
                    <div className="space-y-4" data-quote-sampling>
                      {samplingNotice ? (
                        <div role="status" data-quote-sampling-notice>
                          <Alert tone="success">
                            {t(`quoteSampling.notice.${samplingNotice}`)}
                          </Alert>
                        </div>
                      ) : null}
                      {samplingBlock(item)}
                    </div>
                  </Card>
                </div>
              ) : null}
            </div>
            <aside
              id="negociacao"
              className="min-w-0 scroll-mt-20 lg:sticky lg:top-20 lg:z-10 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
              data-quote-product-side
            >
              {productChat(focus)}
            </aside>
          </div>
        </div>
      );
    }

    // Lista: a tabela padrão de itens, com o que o fornecedor já preencheu.
    const draftValue = (key: string) =>
      typeof draft?.values[key] === "string" ? draft.values[key] : "";
    const tableRows = quote.items.map((item, index) => {
      const p = answerProducts.find((x) => x.productId === item.productId)!;
      const product =
        sampleProducts.find((x) => x.id === item.productId) ?? null;
      const sent = response.prices?.find((x) => x.productId === item.productId);
      const typed = draftValue(`price.${item.productId}`);
      const perBox =
        Number(draftValue(`sheet.${item.productId}.masterBoxQty`)) ||
        p.draft.masterBoxQty ||
        null;
      const cbmBox = p.draft.cbm ?? null;
      const box =
        perBox && cbmBox
          ? boxesForSheet(p.rounds, { masterBoxQty: perBox, cbm: cbmBox })
          : null;
      const boxes =
        box?.boxes ??
        (perBox && p.rounds.length
          ? p.rounds.reduce((sum, q) => sum + Math.ceil(q / perBox), 0)
          : null);
      return {
        item,
        index,
        product,
        name: p.name,
        price: sent
          ? `${response.currency ?? ""} ${sent.unitPrice.toLocaleString(t.intl, { maximumFractionDigits: 4 })}`.trim()
          : null,
        filled: !!sent || !!typed.trim(),
        counter: counters.some((e) => e.productId === item.productId),
        perBox,
        inner: p.inner.kind === "required" ? p.inner.qty : null,
        boxes,
        cbm: box?.cbm ?? null,
      };
    });
    const n = (value: number | null, digits = 0) =>
      value === null
        ? "—"
        : value.toLocaleString(t.intl, { maximumFractionDigits: digits });
    const itemHead = (key: string) =>
      t(`orderItems.head.${key}` as DictionaryKey);
    return (
      <div data-quote-supplier={quote.id}>
        <PageHeader
          t={t}
          title={t("quote.one", { n: quote.number })}
          subtitle={t("quote.supplier.hint", { hours: quote.hours })}
        />
        {notices}
        {/* Negociação dentro da cotação (dono, 22/11/2026;
            docs/QUOTATION.md): a contraproposta da Wellmix por produto e a
            conversa geral com ela. A de cada produto fica na tela dele. */}
        {counters.length || chat.length || sampleStarted ? (
          <div id="negociacao" className="mb-4 scroll-mt-20">
            <Card title={t("quotation.supplier.title")}>
              <div className="space-y-3" data-quote-negotiation>
                {counters.map(counterCard)}
                <QuoteChat
                  quoteId={quote.id}
                  responseId={null}
                  productId={null}
                  messages={chat}
                  mySide="supplier"
                  names={{}}
                  canPost={canMessageQuote(quote.status, response)}
                  errors={chatErrors}
                  fallbackError={`${t("common.error")} ({code})`}
                  t={t}
                />
              </div>
            </Card>
          </div>
        ) : null}
        <div className="mb-4">
          <Card title={t("quote.products.title")}>
            {editable ? (
              <p className="mb-2 text-sm text-zinc-600">
                {t("quote.products.hint")}
              </p>
            ) : null}
            <Table tools={false}>
              <thead>
                <tr data-order-items-standard>
                  <Th className="w-10 text-right">{itemHead("sequence")}</Th>
                  <Th className="w-14">{itemHead("photo")}</Th>
                  <Th>{itemHead("step")}</Th>
                  <Th>{itemHead("status")}</Th>
                  <Th>{itemHead("sla")}</Th>
                  <Th>{itemHead("code")}</Th>
                  <Th>{itemHead("description")}</Th>
                  <Th className="text-right">{itemHead("priceNoIpi")}</Th>
                  <Th className="text-right">{itemHead("priceIpi")}</Th>
                  <Th className="text-right">{itemHead("priceIpiFreight")}</Th>
                  <Th className="text-right">{itemHead("perBox")}</Th>
                  <Th className="text-right">{itemHead("perInner")}</Th>
                  <Th className="text-right">{itemHead("boxes")}</Th>
                  <Th className="text-right">{itemHead("pieces")}</Th>
                  <Th className="text-right">{itemHead("cbm")}</Th>
                  <Th className="text-right">
                    {t("quote.products.yourPrice")}
                  </Th>
                  <Th>{t("quote.products.answer")}</Th>
                  <Th>
                    <span className="sr-only">{t("quote.products.open")}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr
                    key={row.item.productId}
                    className={rowClass}
                    data-quote-product-row={row.item.productId}
                  >
                    <Td className="text-right tabular-nums">{row.index + 1}</Td>
                    <Td className="w-14">
                      <PhotoGallery
                        name={row.name}
                        {...galleryProps(
                          t,
                          row.product
                            ? productPhotoList(row.product, samplePhotos)
                            : bookPhotoList(row.item.book),
                        )}
                      />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {t(`quote.response.${state}` as DictionaryKey)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {editable &&
                      (!row.filled || row.counter || state === "open") ? (
                        <Badge tone="warning">
                          {t("quote.products.waitingYou")}
                        </Badge>
                      ) : state === "answered" ? (
                        <Badge tone="info">
                          {t("quote.products.waitingWellmix")}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {editable ? (
                        <QuoteDeadline t={t} dueAt={response.dueAt} now={now} />
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-xs text-zinc-700">
                      {row.product?.sku ?? "—"}
                    </Td>
                    <Td className="min-w-44 font-medium">
                      <TextLink
                        href={itemHref(row.item.productId)}
                        className="text-zinc-900 no-underline hover:underline"
                        data-quote-product-open={row.item.productId}
                      >
                        {row.name}
                      </TextLink>
                    </Td>
                    {/* Preços de venda (sem IPI, com IPI e com frete) são da
                        Wellmix com o cliente dela: não saem para o fornecedor. */}
                    <Td className="text-right">—</Td>
                    <Td className="text-right">—</Td>
                    <Td className="text-right">—</Td>
                    <Td className="text-right tabular-nums">{n(row.perBox)}</Td>
                    <Td className="text-right tabular-nums">{n(row.inner)}</Td>
                    <Td className="text-right tabular-nums">{n(row.boxes)}</Td>
                    <Td className="whitespace-nowrap text-right font-semibold tabular-nums">
                      {row.item.quantity.toLocaleString(t.intl)} {row.item.unit}
                    </Td>
                    <Td className="text-right tabular-nums">{n(row.cbm, 3)}</Td>
                    <Td
                      className="whitespace-nowrap text-right tabular-nums"
                      data-quote-product-price
                    >
                      {row.price ?? "—"}
                    </Td>
                    <Td
                      className="whitespace-nowrap"
                      data-quote-product-filled={row.filled ? "1" : "0"}
                    >
                      <Badge tone={row.filled ? "success" : "warning"}>
                        {t(
                          row.filled
                            ? "quote.products.filled"
                            : "quote.products.pending",
                        )}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <OpenLink
                        href={itemHref(row.item.productId)}
                        label={`${t("quote.products.open")}: ${row.name}`}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
        <Card>
          {stateBar}
          {answerForm}
        </Card>
      </div>
    );
  }

  const quote = await getStore().get("purchase_quotes", id);
  if (!quote) notFound();
  return <QuoteBoard user={user} quote={quote} sp={sp} t={t} now={now} />;
}
