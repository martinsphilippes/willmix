import { notFound } from "next/navigation";
import type { Translate } from "@/i18n";
import { productNameText } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { errorTextsFor } from "@/i18n/error-text";
import { getStore } from "@/lib/db";
import type { PurchaseQuote, User } from "@/lib/db/schema";
import { can, canSeePurchasePrice } from "@/lib/auth/function-access";
import { lastPurchases } from "@/lib/services/purchase-strategy";
import { responseState, sweepQuotes } from "@/lib/services/purchase-quote";
import {
  quoteProductTerms,
  canCounterQuote,
  canMessageQuote,
  pendingQuoteProposals,
  quoteProductHistory,
  quoteProductMessages,
} from "@/lib/quote-negotiation";
import { quoteInnerState } from "@/lib/quote-inner";
import { itemLogistics } from "@/lib/services/item-logistics";
import { productPhotoList } from "@/lib/services/product-list";
import { bookPhotoList } from "@/lib/purchase-demand";
import {
  Alert,
  Badge,
  Card,
  LinkButton,
  PageHeader,
  formatDate,
} from "@/components/ui";
import { QuoteBoard } from "../../purchase-quotes/_components/quote-board";
import { QuoteDeadline } from "../../purchase-quotes/_time";
import {
  BoardCounterForm,
  QuotationBoard,
  QuoteHistoryList,
  type BoardReference,
  type BoardRow,
} from "./quotation-board";
import { QuoteChat } from "./board-chat";
import { InfoCell, InfoGrid } from "./negotiation-sections";
import { ItemImagesCard } from "./item-images";
import { quoteNeedsSampling, quoteSamplingOf } from "@/lib/quote-sampling";
import { soldBeforeProducts } from "@/lib/services/supplier-sheets";
import { reviewQuoteSamplingAction } from "../../actions/quotation";

/*
 * A cotação de compra dentro da Cotação unificada (dono, 22/11/2026;
 * docs/QUOTATION.md), no mesmo endereço das solicitações ao fornecedor:
 * - /app/supplier-requests/<cotação>: o nível da cotação (os produtos, o
 *   quadro de todas as respostas, a escolha da vencedora e a aprovação);
 * - ?view=item&product=<produto>: o produto da cotação com o quadro
 *   comparativo dos fornecedores, a conversa e o histórico de cada um num
 *   modal e a contraproposta em massa à direita.
 * Só a Wellmix (o fornecedor responde em /app/purchase-quotes/<cotação>).
 */
export async function QuotationQuotePage({
  user,
  quote,
  query,
  t,
}: {
  user: User;
  quote: PurchaseQuote;
  query: Record<string, string | string[] | undefined>;
  t: Translate;
}) {
  const now = new Date();
  await sweepQuotes(now).catch(() => null);
  const productId =
    query.view === "item" && typeof query.product === "string"
      ? query.product
      : null;
  if (!productId)
    return (
      <QuoteBoard
        user={user}
        quote={quote}
        sp={query}
        t={t}
        now={now}
        home="quotation"
      />
    );
  const item = quote.items.find((i) => i.productId === productId);
  if (!item) notFound();

  const store = getStore();
  const seesPrice = canSeePurchasePrice(user);
  const canNegotiate = can(user, "purchaseQuote.choose");
  const [responses, product, photos, refs] = await Promise.all([
    store.list("purchase_quote_responses", { filter: { quoteId: quote.id } }),
    store.get("products", productId).catch(() => null),
    store
      .list("product_photos", { filter: { productId: [productId] } })
      .catch(() => []),
    lastPurchases([productId]).catch(() => null),
  ]);
  const authorIds = [
    ...new Set(
      responses.flatMap((r) => (r.negotiation ?? []).map((e) => e.byUserId)),
    ),
  ];
  const [suppliers, authors] = await Promise.all([
    responses.length
      ? store.list("parties", {
          filter: { id: [...new Set(responses.map((r) => r.supplierId))] },
        })
      : Promise.resolve([]),
    authorIds.length
      ? store.list("users", { filter: { id: authorIds } }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const names = Object.fromEntries(authors.map((u) => [u.id, u.name]));
  // Fornecedor conhecido do produto (já vendeu à Wellmix): sem amostragem.
  const knownSuppliers = new Set(
    (
      await Promise.all(
        responses.map(async (r) =>
          (
            await soldBeforeProducts(r.supplierId, [productId]).catch(
              () => new Set<string>(),
            )
          ).has(productId)
            ? r.supplierId
            : null,
        ),
      )
    ).filter((x): x is string => !!x),
  );
  const canValidate = can(user, "sampling.validate");
  const samplingNotice =
    typeof query.sampling === "string" &&
    ["approved", "rejected"].includes(query.sampling)
      ? (query.sampling as "approved" | "rejected")
      : null;
  const errors = errorTextsFor(t, [
    "quotation.error",
    "quote.error",
    "supplierRequests.error",
    "common",
  ]);
  const fallbackError = `${t("common.error")} ({code})`;
  const chatOpen = typeof query.chat === "string" ? query.chat : "";
  const name = productNameText(t, item.name);

  // Referência da Wellmix: as fotos do cadastro do produto (as mesmas que o
  // fornecedor vê na cotação dele).
  const referencePhotos = (
    product ? productPhotoList(product, photos) : bookPhotoList(item.book)
  )
    .slice(0, 6)
    .map((x) => x.documentId);
  const rows: BoardRow[] = responses.map((r) => {
    const state = responseState(r, now);
    const supplierName =
      suppliers.find((p) => p.id === r.supplierId)?.name ?? r.supplierId;
    const key = `response:${r.id}`;
    const messages = quoteProductMessages(r, productId);
    return {
      key,
      target: canNegotiate && canCounterQuote(quote.status, r) ? key : null,
      supplierName,
      winner: quote.winnerResponseId === r.id,
      state: (
        <>
          <Badge tone={state === "answered" ? "success" : "neutral"}>
            {t(`quote.response.${state}` as DictionaryKey)}
          </Badge>
          {state === "open" ? (
            <QuoteDeadline t={t} dueAt={r.dueAt} now={now} />
          ) : null}
        </>
      ),
      price: seesPrice
        ? (r.prices?.find((p) => p.productId === productId)?.unitPrice ?? null)
        : null,
      currency: r.currency,
      incoterm: r.incoterm,
      // Prazo e mínimo do produto (dono, 23/11/2026).
      ...quoteProductTerms(r, productId),
      conditions: [r.port, r.note].filter(Boolean).join(" · ") || null,
      pending: pendingQuoteProposals(r).some((e) => e.productId === productId),
      chat: (
        <>
          <QuoteChat
            quoteId={quote.id}
            responseId={r.id}
            productId={productId}
            messages={messages}
            mySide="wellmix"
            names={names}
            canPost={canMessageQuote(quote.status, r)}
            errors={errors}
            fallbackError={fallbackError}
            t={t}
          />
        </>
      ),
      messages: messages.length,
      history: (
        <QuoteHistoryList
          entries={quoteProductHistory(r, productId)}
          showPrice={seesPrice}
          t={t}
        />
      ),
      chatOpen: chatOpen === key,
    };
  });
  const last = refs?.get(productId) ?? null;
  const reference: BoardReference | null = last
    ? {
        label: t("quote.lastPurchase"),
        price: last.unitPrice,
        currency: last.currency,
        incoterm: last.incoterm,
        moq: last.moq,
        leadTimeDays: last.leadTimeDays,
        note: last.supplierName,
      }
    : null;
  const targets = rows.map((r) => r.target).filter((x): x is string => !!x);
  const firstAnswer = responses.find((r) => r.status === "answered");
  const logistics = itemLogistics({ quantity: item.quantity, product });
  const inner = quoteInnerState(item.inner);
  const schedule = item.schedule?.items ?? [];
  const n = (v: number) => v.toLocaleString(t.intl);
  const countered = Number(
    typeof query.countered === "string" ? query.countered : "",
  );
  return (
    <div data-quotation-quote-item={productId}>
      <PageHeader
        t={t}
        title={t("quote.one", { n: quote.number })}
        subtitle={name}
        actions={
          <LinkButton
            href={`/app/supplier-requests/${quote.id}`}
            data-supplier-table-back
          >
            {t("supplierRequests.table.back")}
          </LinkButton>
        }
      />
      {Number.isInteger(countered) && countered > 0 ? (
        <div className="mb-3" role="status" data-quotation-countered>
          <Alert tone="success">
            {t("quotation.counter.sent", { n: countered })}
          </Alert>
        </div>
      ) : null}
      {samplingNotice ? (
        <div className="mb-3" role="status" data-quote-sampling-notice>
          <Alert tone="success">
            {t(`quoteSampling.notice.${samplingNotice}`)}
          </Alert>
        </div>
      ) : null}
      <div
        className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(17rem,1fr)] xl:items-start"
        data-quotation-item
      >
        <div className="min-w-0 space-y-4">
          <Card title={t("quotation.item.product")} dense>
            <div className="flex gap-3" data-quotation-product>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="break-words text-sm font-semibold text-zinc-900">
                  {name}
                </p>
                <InfoGrid>
                  <InfoCell label={t("common.quantity")} mark="quantity" wide>
                    <strong>
                      {n(item.quantity)} {item.unit}
                    </strong>
                  </InfoCell>
                  <InfoCell label={t("quote.unitsPerBox")} mark="unitsPerBox">
                    {logistics.unitsPerBox !== null
                      ? n(logistics.unitsPerBox)
                      : "—"}
                  </InfoCell>
                  <InfoCell label={t("quote.boxes")} mark="boxes">
                    {logistics.unitsPerBox !== null ? n(logistics.boxes) : "—"}
                  </InfoCell>
                  <InfoCell label={t("quote.inner.col")} mark="inner">
                    {inner.kind === "required"
                      ? t("quote.inner.required", { n: n(inner.qty) })
                      : inner.kind === "pending"
                        ? t("quote.inner.pendingTitle")
                        : t("quote.inner.none")}
                  </InfoCell>
                </InfoGrid>
                {item.specification ? (
                  <p className="whitespace-pre-wrap text-[13px] text-zinc-700">
                    {item.specification}
                  </p>
                ) : null}
                {schedule.length ? (
                  <p className="text-xs text-zinc-600">
                    {schedule
                      .map((i) =>
                        t("strategy.line.scheduleItem", {
                          index: i.index,
                          quantity: n(i.quantity),
                          date: formatDate(i.expectedAt, t),
                        }),
                      )
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
          <QuotationBoard
            rows={rows}
            reference={reference}
            showPrice={seesPrice}
            t={t}
          />
        </div>
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-[calc(var(--wm-header)+1rem)] xl:max-h-[calc(100vh-var(--wm-header)-2rem)] xl:overflow-y-auto xl:px-1 xl:pb-1">
          <ItemImagesCard
            reference={referencePhotos}
            referenceFrom="product"
            samples={responses
              .filter((r) => r.status !== "declined")
              .map((r) => {
                // Só com "Necessita amostragem" (dono, 27/11/2026).
                const needs = quoteNeedsSampling(quote, r);
                const known = needs && knownSuppliers.has(r.supplierId);
                return {
                  key: `response:${r.id}`,
                  supplierName:
                    suppliers.find((p) => p.id === r.supplierId)?.name ??
                    r.supplierId,
                  sampling: needs ? quoteSamplingOf(r, productId, known) : null,
                  skipped: known,
                  review: canValidate
                    ? {
                        action: reviewQuoteSamplingAction,
                        fields: (
                          <>
                            <input
                              type="hidden"
                              name="quoteId"
                              value={quote.id}
                            />
                            <input
                              type="hidden"
                              name="product"
                              value={productId}
                            />
                            <input
                              type="hidden"
                              name="responseId"
                              value={r.id}
                            />
                          </>
                        ),
                      }
                    : null,
                };
              })}
            t={t}
          />
          <BoardCounterForm
            kind="quote"
            boardId={quote.id}
            productId={productId}
            targets={targets}
            values={{
              price: null,
              currency: firstAnswer?.currency ?? "USD",
              moq: null,
              leadTimeDays: null,
              incoterm: firstAnswer?.incoterm ?? "FOB",
            }}
            showPrice={seesPrice}
            errors={errors}
            fallbackError={fallbackError}
            formKey={`counter-${responses
              .map((r) => (r.negotiation ?? []).length)
              .join("-")}`}
            t={t}
          />
        </aside>
      </div>
    </div>
  );
}
