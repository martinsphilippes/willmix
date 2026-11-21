import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { can, canSeePurchasePrice } from "@/lib/auth/function-access";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText } from "@/i18n";
import { getStore } from "@/lib/db";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import { lastPurchases } from "@/lib/services/purchase-strategy";
import {
  quoteClosed,
  quoteEditable,
  quoteEmpty,
  responseState,
  supplierQuoteView,
  sweepQuotes,
} from "@/lib/services/purchase-quote";
import {
  Alert,
  Badge,
  Card,
  Field,
  PageHeader,
  Table,
  Td,
  Textarea,
  Th,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { PartyPicker } from "@/components/party-picker";
import { partyPickerLabels } from "@/components/party-picker-labels";
import {
  addQuoteScalePhotoAction,
  answerQuoteAction,
  chooseQuoteWinnerAction,
  decideQuoteWinnerAction,
  quoteNoAnswerAction,
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
  boardSheetCells,
  quoteSheetLines,
  sheetTolerances,
} from "@/lib/services/supplier-sheets";
import {
  boxesForSheet,
  draftFromBaseline,
  draftFromData,
  type CatalogAlert,
} from "@/lib/supplier-sheet";
import { isPieceUnit } from "@/lib/moq";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import { ChatOpenButton } from "@/components/chat-open-button";
import { productPhotoList } from "@/lib/services/product-list";
import { itemLogistics } from "@/lib/services/item-logistics";
import { canOpen } from "@/lib/auth/screens";
import type { Product, PurchaseQuoteItem } from "@/lib/db/schema";
import type { Translate } from "@/i18n";

/** Peças por caixa e caixas do produto na cotação ("—" sem caixa master). */
function boxCells(
  t: Translate,
  item: PurchaseQuoteItem,
  product: Product | null,
) {
  const l = itemLogistics({ quantity: item.quantity, product });
  const n = (v: number) => v.toLocaleString(t.intl);
  return (
    <>
      <Td className="tabular-nums" data-quote-units-per-box={item.productId}>
        {l.unitsPerBox !== null ? n(l.unitsPerBox) : "—"}
      </Td>
      <Td className="tabular-nums" data-quote-boxes={item.productId}>
        {l.unitsPerBox !== null ? n(l.boxes) : "—"}
      </Td>
    </>
  );
}

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
    // Ficha técnica de cada produto (dono, 20/11/2026): pedida na primeira
    // vez do par; quem já vendeu confere o que temos (o aviso de revalidação).
    // Rascunho automático deste login (dono, 20/11/2026): o que estava
    // digitado volta para a tela.
    const [lines, tolerances, draft] = await Promise.all([
      quoteSheetLines(quote, response),
      sheetTolerances(),
      editable ? loadQuoteDraft(user, quote.id) : Promise.resolve(null),
    ]);
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
          : draftFromBaseline(line.soldBefore ? line.baseline : null),
        baseline: line.baseline,
        askPhoto: line.askPhoto,
        photoUrl: line.photoDocumentId
          ? `/api/files/${line.photoDocumentId}`
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
            />
          )}
        </Card>
      </div>
    );
  }

  const store = getStore();
  const quote = await store.get("purchase_quotes", id);
  if (!quote) notFound();
  const responses = await store.list("purchase_quote_responses", {
    filter: { quoteId: quote.id },
  });
  const productIds = [...new Set(quote.items.map((i) => i.productId))];
  const [suppliers, refs, requests, products, photos, demands] =
    await Promise.all([
      responses.length
        ? store.list("parties", {
            filter: { id: [...new Set(responses.map((r) => r.supplierId))] },
          })
        : Promise.resolve([]),
      lastPurchases(quote.items.map((i) => i.productId)),
      quote.supplierRequestIds?.length
        ? store.list("supplier_requests", {
            filter: { id: quote.supplierRequestIds },
          })
        : Promise.resolve([]),
      // Tabela dos produtos da cotação: só os produtos desta cotação.
      productIds.length
        ? store.list("products", { filter: { id: productIds } })
        : Promise.resolve([]),
      productIds.length
        ? store
            .list("product_photos", { filter: { productId: productIds } })
            .catch(() => [])
        : Promise.resolve([]),
      // A demanda (solicitação) de cada produto: a conversa sobre ele.
      quote.demandIds.length
        ? store
            .list("requests", { filter: { id: quote.demandIds } })
            .catch(() => [])
        : Promise.resolve([]),
    ]);
  const productOf = (pid: string) => products.find((p) => p.id === pid) ?? null;
  const canOpenProducts = canOpen(user, "products");
  const supplierName = (sid: string) =>
    suppliers.find((p) => p.id === sid)?.name ?? sid;
  const closed = quoteClosed(responses, now);
  const empty = quoteEmpty(responses, now);
  const canChoose = can(user, "purchaseQuote.choose");
  const canApprove = can(user, "purchaseQuote.approve");
  // Preços, total e última compra: só com "Ver preço de compra" (dono,
  // 15/11/2026; docs/LINHA_DE_VISAO.md, seção 7). Sem ela, o quadro mostra
  // os fornecedores, a situação e as condições.
  const seesPrice = canSeePurchasePrice(user);
  const total = (r: (typeof responses)[number]) =>
    r.prices
      ? quote.items.reduce(
          (sum, i) =>
            sum +
            (r.prices!.find((p) => p.productId === i.productId)?.unitPrice ??
              0) *
              i.quantity,
          0,
        )
      : null;
  const notice = (
    ["opened", "chosen", "decided", "reopened", "invited"] as const
  ).find((k) => typeof sp[k] === "string");
  // Ficha técnica de cada resposta (dono, 20/11/2026): o que cada fornecedor
  // informou, as caixas e o m³ pela caixa dele e os avisos do cadastro.
  const cells = await boardSheetCells(quote, responses);
  const answered = responses.filter((r) => r.status === "answered");
  const n = (v: number, digits = 3) =>
    v.toLocaleString(t.intl, { maximumFractionDigits: digits });
  const roundsOf = (item: PurchaseQuoteItem) =>
    isPieceUnit(item.unit)
      ? item.schedule?.items?.length
        ? item.schedule.items.map((i) => i.quantity)
        : [item.quantity]
      : [];
  const alertText = (a: CatalogAlert) =>
    a.key === "other_box"
      ? t("supplierSheet.alert.other_box", {
          theirs: n(a.theirs, 0),
          ours: n(a.ours, 0),
        })
      : a.key === "dims"
        ? t("supplierSheet.alert.dims", { percent: n(a.percent, 1) })
        : t(`supplierSheet.alert.${a.key}`, {
            percent: n(a.percent, 1),
            ours: n(a.ours, a.key === "cbm" ? 4 : 3),
          });
  return (
    <div data-quote-board={quote.id} data-quote-status={quote.status}>
      <PageHeader
        t={t}
        title={t("quote.one", { n: quote.number })}
        subtitle={t("quote.subtitle")}
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {notice ? (
        <div className="mb-3" role="status" data-quote-notice={notice}>
          <Alert tone="success">{t(`quote.notice.${notice}`)}</Alert>
        </div>
      ) : null}
      <Card title={t("quote.productsTitle")}>
        <Table tools={false}>
          <thead>
            <tr>
              <Th>
                <span className="sr-only">{t("quote.photo")}</span>
              </Th>
              <Th>{t("common.product")}</Th>
              <Th>{t("common.quantity")}</Th>
              <Th>{t("quote.unitsPerBox")}</Th>
              <Th>{t("quote.boxes")}</Th>
              <Th>
                <span className="sr-only">{t("chat.open")}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => {
              const product = productOf(item.productId);
              const name = productNameText(t, item.name);
              const demand = demands.find(
                (d) => d.productId === item.productId,
              );
              return (
                <tr
                  key={item.productId}
                  className={rowClass}
                  data-quote-product={item.productId}
                >
                  <Td className="w-14">
                    <PhotoGallery
                      name={name}
                      {...galleryProps(
                        t,
                        product ? productPhotoList(product, photos) : [],
                      )}
                    />
                  </Td>
                  <Td>
                    {product && canOpenProducts ? (
                      <Link
                        href={`/app/products/${product.id}`}
                        className={linkClass}
                      >
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                  </Td>
                  <Td className="tabular-nums">
                    {item.quantity.toLocaleString(t.intl)} {item.unit}
                  </Td>
                  {boxCells(t, item, product)}
                  <Td>
                    {demand ? (
                      <ChatOpenButton
                        target={{ requestId: demand.id }}
                        label={t("chat.open")}
                      />
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      <Card title={t("quote.compare")}>
        <Table tools={false}>
          <thead>
            <tr>
              <Th>{t("quote.supplier")}</Th>
              <Th>{t("quote.state")}</Th>
              {seesPrice
                ? quote.items.map((i) => (
                    <Th key={i.productId}>
                      {productNameText(t, i.name)}
                      <span className="block text-xs font-normal text-zinc-500">
                        {i.quantity.toLocaleString(t.intl)} {i.unit}
                      </span>
                    </Th>
                  ))
                : null}
              {seesPrice ? <Th>{t("quote.total")}</Th> : null}
              <Th>{t("quote.conditions")}</Th>
            </tr>
          </thead>
          <tbody>
            {seesPrice ? (
              <tr className={rowClass} data-quote-reference>
                <Td className="font-medium text-zinc-600">
                  {t("quote.lastPurchase")}
                </Td>
                <Td>—</Td>
                {quote.items.map((i) => {
                  const ref = refs.get(i.productId);
                  return (
                    <Td key={i.productId} className="text-xs text-zinc-600">
                      {ref
                        ? `${ref.currency ?? ""} ${ref.unitPrice ?? "—"} · ${ref.supplierName ?? ""}`
                        : t("quote.noLastPurchase")}
                    </Td>
                  );
                })}
                <Td>—</Td>
                <Td>—</Td>
              </tr>
            ) : null}
            {responses.map((r) => {
              const state = responseState(r, now);
              return (
                <tr
                  key={r.id}
                  className={rowClass}
                  data-quote-response={r.supplierId}
                  data-quote-response-state={state}
                >
                  <Td className="font-medium">
                    {supplierName(r.supplierId)}
                    {quote.winnerResponseId === r.id ? (
                      <Badge tone="success">{t("quote.winner")}</Badge>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={state === "answered" ? "success" : "neutral"}>
                      {t(`quote.response.${state}` as DictionaryKey)}
                    </Badge>
                    {state === "open" ? (
                      <QuoteDeadline t={t} dueAt={r.dueAt} now={now} />
                    ) : null}
                  </Td>
                  {seesPrice
                    ? quote.items.map((i) => {
                        const p = r.prices?.find(
                          (x) => x.productId === i.productId,
                        );
                        return (
                          <Td key={i.productId} className="tabular-nums">
                            {p ? `${r.currency ?? ""} ${p.unitPrice}` : "—"}
                          </Td>
                        );
                      })
                    : null}
                  {seesPrice ? (
                    <Td className="tabular-nums">
                      {total(r) !== null
                        ? `${r.currency ?? ""} ${total(r)!.toLocaleString(t.intl, { maximumFractionDigits: 2 })}`
                        : "—"}
                    </Td>
                  ) : null}
                  <Td className="text-xs text-zinc-600">
                    {r.status === "answered"
                      ? [
                          r.incoterm,
                          r.leadTimeDays !== null
                            ? t("strategy.days", { n: r.leadTimeDays })
                            : null,
                          r.port,
                          r.moq !== null ? `MOQ ${r.moq}` : null,
                          r.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {seesPrice ? null : (
          <p className="mt-2 text-xs text-zinc-500" data-quote-price-restricted>
            {t("quote.priceRestricted")}
          </p>
        )}
      </Card>

      {answered.length ? (
        <Card title={t("supplierSheet.board.title")}>
          <p className="mb-2 text-xs text-zinc-600">
            {t("supplierSheet.board.hint")}
          </p>
          <Table tools={false}>
            <thead>
              <tr>
                <Th>{t("quote.supplier")}</Th>
                <Th>{t("common.product")}</Th>
                <Th>{t("supplierSheet.board.col.kind")}</Th>
                <Th>{t("supplierSheet.board.col.masterBoxQty")}</Th>
                <Th>{t("supplierSheet.board.col.innerBoxQty")}</Th>
                <Th>{t("supplierSheet.board.col.dims")}</Th>
                <Th>{t("supplierSheet.board.col.cbm")}</Th>
                <Th>{t("supplierSheet.board.col.netWeight")}</Th>
                <Th>{t("supplierSheet.board.col.grossWeight")}</Th>
                <Th>{t("supplierSheet.board.col.material")}</Th>
                <Th>{t("supplierSheet.board.col.code")}</Th>
                <Th>{t("supplierSheet.board.col.boxes")}</Th>
                <Th>{t("supplierSheet.board.col.totalCbm")}</Th>
                <Th>{t("supplierSheet.board.col.photo")}</Th>
                <Th>{t("supplierSheet.board.col.alerts")}</Th>
              </tr>
            </thead>
            <tbody>
              {answered.flatMap((r) =>
                quote.items.map((item) => {
                  const cell = cells.get(`${r.id}:${item.productId}`);
                  const sheet = cell?.sheet ?? null;
                  const box = sheet
                    ? boxesForSheet(roundsOf(item), sheet)
                    : null;
                  return (
                    <tr
                      key={`${r.id}:${item.productId}`}
                      className={rowClass}
                      data-quote-sheet-row={`${r.supplierId}:${item.productId}`}
                    >
                      <Td className="font-medium">
                        {supplierName(r.supplierId)}
                      </Td>
                      <Td>{productNameText(t, item.name)}</Td>
                      {sheet ? (
                        <>
                          <Td>
                            <span className="flex flex-wrap gap-1">
                              {cell?.sheetKind ? (
                                <Badge
                                  tone={
                                    cell.sheetKind === "corrected"
                                      ? "warning"
                                      : "neutral"
                                  }
                                >
                                  {t(`supplierSheet.kind.${cell.sheetKind}`)}
                                </Badge>
                              ) : null}
                              {cell?.review && cell.pairSheetId ? (
                                <Link
                                  href={`/app/supplier-sheets/${cell.pairSheetId}`}
                                  className={linkClass}
                                  data-quote-sheet-review={cell.review}
                                >
                                  {t(`supplierSheet.review.${cell.review}`)}
                                </Link>
                              ) : null}
                            </span>
                          </Td>
                          <Td className="tabular-nums">
                            {n(sheet.masterBoxQty, 0)}
                          </Td>
                          <Td className="tabular-nums">
                            {sheet.innerBoxQty
                              ? n(sheet.innerBoxQty, 0)
                              : t("supplierSheet.noInner")}
                          </Td>
                          <Td className="tabular-nums">
                            {sheet.boxLengthCm !== null &&
                            sheet.boxWidthCm !== null &&
                            sheet.boxHeightCm !== null
                              ? `${n(sheet.boxLengthCm, 2)} × ${n(sheet.boxWidthCm, 2)} × ${n(sheet.boxHeightCm, 2)}`
                              : "—"}
                          </Td>
                          <Td className="tabular-nums">{n(sheet.cbm, 4)}</Td>
                          <Td className="tabular-nums">
                            {n(sheet.netWeightKg)}
                          </Td>
                          <Td className="tabular-nums">
                            {n(sheet.grossWeightBoxKg)}
                          </Td>
                          <Td>{sheet.material}</Td>
                          <Td>
                            {sheet.factoryItemCode ?? t("supplierSheet.noCode")}
                          </Td>
                          <Td className="tabular-nums" data-quote-sheet-boxes>
                            {box ? n(box.boxes, 0) : "—"}
                          </Td>
                          <Td className="tabular-nums" data-quote-sheet-cbm>
                            {box ? n(box.cbm, 3) : "—"}
                          </Td>
                        </>
                      ) : (
                        <Td colSpan={11} className="text-xs text-zinc-500">
                          {t("supplierSheet.board.none")}
                        </Td>
                      )}
                      <Td>
                        {cell?.photoDocumentId ? (
                          <a
                            href={`/api/files/${cell.photoDocumentId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-10 overflow-hidden rounded border border-zinc-200"
                            data-quote-sheet-photo
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                            <img
                              src={`/api/files/${cell.photoDocumentId}`}
                              alt={t("supplierSheet.view.photo")}
                              className="h-10 w-10 object-cover"
                            />
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className="text-xs">
                        {cell?.alerts.length ? (
                          <ul
                            className="space-y-0.5 text-amber-800"
                            data-quote-sheet-alerts
                          >
                            {cell.alerts.map((a) => (
                              <li key={a.key} data-quote-sheet-alert={a.key}>
                                ⚠ {alertText(a)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          "—"
                        )}
                      </Td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {quote.status === "open" && closed && !empty && canChoose ? (
        <Card title={t("quote.choose")}>
          <form
            action={chooseQuoteWinnerAction}
            className="space-y-2"
            data-quote-choose-form
          >
            <input type="hidden" name="quoteId" value={quote.id} />
            {responses
              .filter((r) => r.status === "answered")
              .map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="responseId"
                    value={r.id}
                    required
                    data-quote-winner-option={r.supplierId}
                  />
                  {supplierName(r.supplierId)}
                </label>
              ))}
            <Field label={t("demand.notes")}>
              <Textarea name="note" rows={2} />
            </Field>
            <SubmitButton data-quote-choose>
              {t("quote.chooseSubmit")}
            </SubmitButton>
          </form>
        </Card>
      ) : null}
      {quote.status === "open" && !closed ? (
        <p className="mb-3 text-sm text-zinc-600" data-quote-waiting>
          {t("quote.waitingAnswers")}
        </p>
      ) : null}

      {quote.status === "chosen" ? (
        <Card title={t("quote.approval")}>
          {canApprove ? (
            <form
              action={decideQuoteWinnerAction}
              className="space-y-2"
              data-quote-approve-form
            >
              <input type="hidden" name="quoteId" value={quote.id} />
              <Field label={t("strategy.approvalNote")}>
                <Textarea name="note" rows={2} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton
                  name="decision"
                  value="approve"
                  data-quote-approve
                >
                  {t("strategy.approve")}
                </SubmitButton>
                <SubmitButton
                  name="decision"
                  value="reject"
                  variant="secondary"
                  data-quote-reject
                >
                  {t("strategy.reject")}
                </SubmitButton>
              </div>
            </form>
          ) : (
            <p className="text-sm text-zinc-600">
              {t("strategy.waitingApproval")}
            </p>
          )}
        </Card>
      ) : null}

      {quote.status === "approved" ? (
        <Card title={t("quote.approvedTitle")}>
          <ul className="space-y-1 text-sm" data-quote-supplier-requests>
            {requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/app/supplier-requests/${r.id}`}
                  className={linkClass}
                  data-quote-supplier-request={r.id}
                >
                  {t("quote.supplierRequest", { n: r.number })}
                </Link>{" "}
                · {productNameText(t, r.item.productName ?? "")}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {quote.status === "open" && empty && canChoose ? (
        <Card title={t("quote.noAnswer")}>
          <p className="mb-3 text-sm text-zinc-600">
            {t("quote.noAnswerHint")}
          </p>
          <div className="grid gap-3 lg:grid-cols-3" data-quote-no-answer>
            <form action={quoteNoAnswerAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="what" value="reopen" />
              <SubmitButton data-quote-reopen>
                {t("quote.reopen", { hours: quote.hours })}
              </SubmitButton>
            </form>
            <form action={quoteNoAnswerAction} className="space-y-2">
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="what" value="invite" />
              {/* Fornecedor, Trading, Supplier e Factory (dono, 18/11/2026). */}
              <PartyPicker
                name="supplierId"
                type="supplier"
                alsoTypes={["trading", "supplier_partner", "factory"]}
                required
                activeOnly
                labels={partyPickerLabels(t)}
                ariaLabel={t("quote.supplier")}
              />
              <SubmitButton variant="secondary" data-quote-invite>
                {t("quote.inviteMore")}
              </SubmitButton>
            </form>
            <form action={quoteNoAnswerAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="what" value="strategy" />
              <SubmitButton variant="secondary" data-quote-back>
                {t("quote.backToStrategy")}
              </SubmitButton>
            </form>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
