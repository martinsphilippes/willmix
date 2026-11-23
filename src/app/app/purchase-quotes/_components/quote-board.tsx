import Link from "next/link";
import {
  can,
  canSeeMoney,
  canSeePurchasePrice,
} from "@/lib/auth/function-access";
import { itemPrices } from "@/lib/order-table";
import { turnTone, turnWaitingKey } from "@/lib/turn";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText } from "@/i18n";
import { getStore } from "@/lib/db";
import { lastPurchases } from "@/lib/services/purchase-strategy";
import {
  quoteClosed,
  quoteEmpty,
  responseState,
} from "@/lib/services/purchase-quote";
import {
  Alert,
  Badge,
  Card,
  Field,
  LinkButton,
  OpenLink,
  PageHeader,
  Table,
  Td,
  Textarea,
  Th,
  cx,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { PartyPicker } from "@/components/party-picker";
import { partyPickerLabels } from "@/components/party-picker-labels";
import {
  chooseQuoteWinnerAction,
  decideQuoteWinnerAction,
  quoteNoAnswerAction,
  setQuoteInnerAction,
} from "../../actions/purchase-demand";
import { QuoteDeadline } from "../_time";
import { boardSheetCells } from "@/lib/services/supplier-sheets";
import { boxesForSheet, type CatalogAlert } from "@/lib/supplier-sheet";
import { isPieceUnit } from "@/lib/moq";
import { listMaterials } from "@/lib/services/materials";
import { materialsText } from "@/lib/materials";
import { quoteInnerState } from "@/lib/quote-inner";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import { ChatOpenButton } from "@/components/chat-open-button";
import { productPhotoList } from "@/lib/services/product-list";
import { itemLogistics } from "@/lib/services/item-logistics";
import { canOpen } from "@/lib/auth/screens";
import type {
  Product,
  PurchaseQuote,
  PurchaseQuoteItem,
  User,
} from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import { ClampText } from "@/components/clamp-text";
import { HoverZoomPhoto } from "@/components/hover-zoom-photo";
import { quoteItemHref } from "@/lib/quote-item-href";
import { quoteSamplingReady } from "@/lib/quote-sampling";
import { soldBeforeProducts } from "@/lib/services/supplier-sheets";

/*
 * Ficha técnica das respostas (dono, 21/11/2026): linha fina e minimalista,
 * letra menor e nenhum texto quebrando a linha; o que não cabe fica recolhido
 * numa linha com "…" e o "mais" ao lado.
 */
const slimTh = "whitespace-nowrap px-2 py-1.5 text-[10px]";
const slimTd = "whitespace-nowrap px-2 py-1 align-middle text-xs";

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
      <Td className="tabular-nums">
        {product?.innerBoxQty ? n(product.innerBoxQty) : "—"}
      </Td>
      <Td className="tabular-nums" data-quote-boxes={item.productId}>
        {l.unitsPerBox !== null ? n(l.boxes) : "—"}
      </Td>
    </>
  );
}

/*
 * Quadro da cotação de compra para a Wellmix (mapa B13;
 * docs/PURCHASE_DEMAND.md): os produtos, o quadro comparativo com a última
 * compra como referência, a ficha técnica das respostas, a escolha da
 * vencedora, a aprovação e o que fazer sem resposta. Usado nos dois
 * endereços: a Cotação unificada (/app/supplier-requests/<cotação>, dono,
 * 22/11/2026; docs/QUOTATION.md) e a tela de sempre (/app/purchase-quotes).
 */
export async function QuoteBoard({
  user,
  quote,
  sp,
  t,
  now,
  home = null,
}: {
  user: User;
  quote: PurchaseQuote;
  sp: Record<string, string | string[] | undefined>;
  t: Translate;
  now: Date;
  /** "quotation": as ações voltam para a Cotação unificada. */
  home?: "quotation" | null;
}) {
  const errorCode = typeof sp.error === "string" ? sp.error : "";
  const errorKey = `quote.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const homeField = home ? (
    <input type="hidden" name="home" value={home} />
  ) : null;
  const store = getStore();
  const responses = await store.list("purchase_quote_responses", {
    filter: { quoteId: quote.id },
  });
  const productIds = [...new Set(quote.items.map((i) => i.productId))];
  const [suppliers, refs, requests, products, photos, demands, catalog] =
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
      // Os materiais da ficha pelo nome no idioma de quem lê (21/11/2026).
      listMaterials({ includeInactive: true }),
    ]);
  const materialById = new Map(catalog.map((m) => [m.id, m]));
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
    ["opened", "chosen", "decided", "reopened", "invited", "inner"] as const
  ).find((k) => typeof sp[k] === "string");
  // Caixa inner a definir (dono, 21/11/2026): pedida sem o número ou
  // diferente entre as encomendas; o Comprador define aqui.
  /* Tabela padrão de itens (docs/ORDER_TABLES.md): Situação, Status e Prazo
     da cotação, e os preços Wellmix da encomenda de cada produto (só com
     "Ver valores e margem"). */
  const itemHead = (key: string) =>
    t(`orderItems.head.${key}` as DictionaryKey);
  const seesSale = canSeeMoney(user);
  const stdState =
    quote.status !== "open"
      ? quote.status
      : empty
        ? "empty"
        : closed
          ? "closed"
          : "open";
  const stdTurn =
    stdState === "open"
      ? ("supplier" as const)
      : stdState === "cancelled" || stdState === "approved"
        ? null
        : ("wellmix" as const);
  const stdDue =
    stdState === "open"
      ? (responses
          .filter((r) => r.status === "invited")
          .map((r) => r.dueAt)
          .sort()
          .at(-1) ?? null)
      : null;
  const salePrice = (
    demand: (typeof demands)[number] | undefined,
    key: "ipi" | "ipiFreight",
  ) => {
    const value = itemPrices(demand?.priceForecast ?? null)[key];
    return value !== null
      ? `${demand?.priceForecast?.currency ?? "BRL"} ${value.toLocaleString(
          t.intl,
          { minimumFractionDigits: 2, maximumFractionDigits: 4 },
        )}`
      : "—";
  };
  const innerText = (item: PurchaseQuoteItem) => {
    const state = quoteInnerState(item.inner);
    return state.kind === "required"
      ? t("quote.inner.required", { n: state.qty.toLocaleString(t.intl) })
      : state.kind === "pending"
        ? t("quote.inner.pendingTitle")
        : t("quote.inner.none");
  };
  const pendingInner = quote.items.filter(
    (i) => quoteInnerState(i.inner).kind === "pending",
  );
  // Ficha técnica de cada resposta (dono, 20/11/2026): o que cada fornecedor
  // informou, as caixas e o m³ pela caixa dele e os avisos do cadastro.
  const cells = await boardSheetCells(quote, responses);
  const answered = responses.filter((r) => r.status === "answered");
  // Só vence quem tem a amostra de todos os produtos aprovada ou é
  // conhecido do produto (dono, 22/11/2026; docs/SUPPLIER_SAMPLING.md).
  const sampleReady = new Map(
    await Promise.all(
      answered.map(
        async (r) =>
          [
            r.id,
            quoteSamplingReady(
              r,
              productIds,
              await soldBeforeProducts(r.supplierId, productIds).catch(
                () => new Set<string>(),
              ),
            ),
          ] as const,
      ),
    ),
  );
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
        actions={
          <LinkButton href="/app/supplier-requests">
            {t("quotation.detail.back")}
          </LinkButton>
        }
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
              {/* Tabela padrão de itens (dono, 22 e 23/11/2026;
                  docs/ORDER_TABLES.md): as colunas padrão primeiro e a da
                  cotação (inner exigida pelo cliente) no fim. Situação,
                  Status e Prazo são os da cotação. */}
              <Th>{itemHead("sequence")}</Th>
              <Th>{itemHead("photo")}</Th>
              <Th>{itemHead("step")}</Th>
              <Th>{itemHead("status")}</Th>
              <Th>{itemHead("sla")}</Th>
              <Th>{itemHead("code")}</Th>
              <Th>{itemHead("description")}</Th>
              {seesSale ? (
                <>
                  <Th>{itemHead("priceNoIpi")}</Th>
                  <Th>{itemHead("priceIpi")}</Th>
                  <Th>{itemHead("priceIpiFreight")}</Th>
                </>
              ) : null}
              <Th>{itemHead("perBox")}</Th>
              <Th>{itemHead("perInner")}</Th>
              <Th>{itemHead("boxes")}</Th>
              <Th>{itemHead("pieces")}</Th>
              <Th>{itemHead("cbm")}</Th>
              <Th>{t("quote.inner.col")}</Th>
              <Th>
                <span className="sr-only">{t("chat.open")}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, index) => {
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
                  <Td className="tabular-nums">{index + 1}</Td>
                  <Td className="w-14">
                    <PhotoGallery
                      name={name}
                      {...galleryProps(
                        t,
                        product ? productPhotoList(product, photos) : [],
                      )}
                    />
                  </Td>
                  <Td className="whitespace-nowrap">
                    {t(`quote.status.${stdState}` as DictionaryKey)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {stdTurn ? (
                      <Badge tone={turnTone(stdTurn)}>
                        {t(turnWaitingKey(stdTurn))}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {stdDue ? formatDate(stdDue, t) : "—"}
                  </Td>
                  <Td className="whitespace-nowrap font-mono text-xs text-zinc-700">
                    {product?.sku ?? "—"}
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
                  {seesSale ? (
                    <>
                      <Td>—</Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {salePrice(demand, "ipi")}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {salePrice(demand, "ipiFreight")}
                      </Td>
                    </>
                  ) : null}
                  {boxCells(t, item, product)}
                  <Td className="whitespace-nowrap tabular-nums">
                    {item.quantity.toLocaleString(t.intl)} {item.unit}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {(() => {
                      const cbm = itemLogistics({
                        quantity: item.quantity,
                        product,
                      }).cbm;
                      return cbm !== null ? n(cbm) : "—";
                    })()}
                  </Td>
                  <Td
                    className="text-xs"
                    data-quote-inner-state={quoteInnerState(item.inner).kind}
                  >
                    {innerText(item)}
                  </Td>
                  <Td>
                    <span className="flex items-center justify-end gap-1">
                      {demand ? (
                        <ChatOpenButton
                          target={{ requestId: demand.id }}
                          label={t("chat.open")}
                        />
                      ) : null}
                      {/* O produto na cotação: o quadro comparativo dele,
                          com a conversa e a contraproposta por fornecedor
                          (dono, 22/11/2026; docs/QUOTATION.md). */}
                      <OpenLink
                        href={quoteItemHref(quote.id, item.productId)}
                        label={t("quotation.item.open")}
                        data-quote-item-open={item.productId}
                      />
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      {pendingInner.length && quote.status === "open" ? (
        <Card title={t("quote.inner.pendingTitle")}>
          <div className="space-y-3" data-quote-inner-fix>
            <p className="text-xs text-zinc-600">
              {t("quote.inner.pendingHint")}
            </p>
            {pendingInner.map((item) => {
              const state = quoteInnerState(item.inner);
              if (state.kind !== "pending") return null;
              const name = productNameText(t, item.name);
              const values = state.requested
                .map((v) =>
                  v === 0
                    ? t("quote.inner.noneValue")
                    : v.toLocaleString(t.intl),
                )
                .join(", ");
              return (
                <div
                  key={item.productId}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                  data-quote-inner-fix-item={item.productId}
                >
                  <p className="text-sm text-zinc-900">
                    {state.issue === "missing"
                      ? t("quote.inner.missing", { product: name })
                      : t("quote.inner.conflict", {
                          product: name,
                          values,
                        })}
                  </p>
                  {canChoose ? (
                    <form
                      action={setQuoteInnerAction}
                      className="mt-2 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="quoteId" value={quote.id} />
                      {homeField}
                      <input
                        type="hidden"
                        name="productId"
                        value={item.productId}
                      />
                      <label className="block text-xs font-medium text-zinc-700">
                        {t("quote.inner.qty")}
                        <input
                          name="innerQty"
                          inputMode="numeric"
                          autoComplete="off"
                          className="mt-1 block h-9 w-28 rounded-md border border-zinc-300 bg-white px-2.5 text-right text-[13px] tabular-nums"
                          data-quote-inner-input={item.productId}
                        />
                      </label>
                      <SubmitButton
                        name="mode"
                        value="qty"
                        data-quote-inner-set={item.productId}
                      >
                        {t("quote.inner.set")}
                      </SubmitButton>
                      <SubmitButton
                        name="mode"
                        value="none"
                        variant="secondary"
                        data-quote-inner-none={item.productId}
                      >
                        {t("quote.inner.setNone")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
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
                          r.incoterm === "EXW" && r.incotermValue != null
                            ? `EXW (${r.currency ?? ""} ${r.incotermValue.toLocaleString(t.intl, { maximumFractionDigits: 4 })})`
                            : r.incoterm,
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
              <tr data-quote-sheet-head>
                <Th className={slimTh}>{t("quote.supplier")}</Th>
                <Th className={slimTh}>{t("common.product")}</Th>
                <Th className={slimTh}>{t("supplierSheet.board.col.kind")}</Th>
                <Th className={slimTh}>
                  {t("supplierSheet.board.col.masterBoxQty")}
                </Th>
                <Th className={slimTh}>
                  {t("supplierSheet.board.col.innerBoxQty")}
                </Th>
                <Th className={slimTh}>{t("supplierSheet.board.col.dims")}</Th>
                <Th className={slimTh}>{t("supplierSheet.board.col.cbm")}</Th>
                <Th className={slimTh}>
                  {t("supplierSheet.board.col.netWeight")}
                </Th>
                <Th className={slimTh}>
                  {t("supplierSheet.board.col.grossWeight")}
                </Th>
                <Th className={slimTh}>
                  {t("supplierSheet.board.col.material")}
                </Th>
                <Th className={slimTh}>{t("supplierSheet.board.col.code")}</Th>
                <Th className={slimTh}>{t("supplierSheet.board.col.boxes")}</Th>
                <Th className={slimTh}>
                  {t("supplierSheet.board.col.totalCbm")}
                </Th>
                <Th className={slimTh}>{t("supplierSheet.board.col.photo")}</Th>
                <Th className={slimTh}>
                  {t("supplierSheet.board.col.alerts")}
                </Th>
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
                      <Td className={cx(slimTd, "font-medium")}>
                        <ClampText
                          lines={1}
                          text={supplierName(r.supplierId)}
                          more={t("reqList.more")}
                          less={t("reqList.less")}
                          className="max-w-[12rem]"
                        />
                      </Td>
                      <Td className={slimTd}>
                        <ClampText
                          lines={1}
                          text={productNameText(t, item.name)}
                          more={t("reqList.more")}
                          less={t("reqList.less")}
                          className="max-w-[11rem]"
                        />
                      </Td>
                      {sheet ? (
                        <>
                          <Td className={slimTd}>
                            <span className="flex flex-nowrap items-center gap-1">
                              {cell?.sheetKind ? (
                                <Badge
                                  tone={
                                    cell.sheetKind === "corrected"
                                      ? "warning"
                                      : "neutral"
                                  }
                                  className="px-1.5 py-0 text-[10px]"
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
                          <Td className={cx(slimTd, "tabular-nums")}>
                            {n(sheet.masterBoxQty, 0)}
                          </Td>
                          <Td
                            className={cx(slimTd, "tabular-nums")}
                            data-quote-sheet-inner
                          >
                            {(() => {
                              // O inner é a exigência do cliente (21/11/2026);
                              // nas fichas antigas, o que ele informava.
                              const state = quoteInnerState(item.inner);
                              if (state.kind === "required")
                                return n(state.qty, 0);
                              if (state.kind === "pending")
                                return t("quote.inner.pendingTitle");
                              return sheet.innerBoxQty === null
                                ? "—"
                                : sheet.innerBoxQty
                                  ? n(sheet.innerBoxQty, 0)
                                  : t("supplierSheet.noInner");
                            })()}
                          </Td>
                          <Td className={cx(slimTd, "tabular-nums")}>
                            {sheet.boxLengthCm !== null &&
                            sheet.boxWidthCm !== null &&
                            sheet.boxHeightCm !== null
                              ? `${n(sheet.boxLengthCm, 2)} × ${n(sheet.boxWidthCm, 2)} × ${n(sheet.boxHeightCm, 2)}`
                              : "—"}
                          </Td>
                          <Td className={cx(slimTd, "tabular-nums")}>
                            {n(sheet.cbm, 4)}
                          </Td>
                          <Td className={cx(slimTd, "tabular-nums")}>
                            {n(sheet.netWeightKg)}
                          </Td>
                          <Td
                            className={cx(slimTd, "tabular-nums")}
                            data-quote-sheet-gross={
                              sheet.grossWeightBoxKg === null
                                ? "unknown"
                                : "given"
                            }
                          >
                            {sheet.grossWeightBoxKg === null
                              ? t("quote.sheet.grossUnknownDeclared")
                              : n(sheet.grossWeightBoxKg)}
                          </Td>
                          <Td className={slimTd} data-quote-sheet-material>
                            <ClampText
                              lines={1}
                              text={
                                sheet.materialIds?.length
                                  ? materialsText(
                                      sheet.materialIds,
                                      materialById,
                                      t.intl,
                                    ) || sheet.material
                                  : sheet.material
                              }
                              more={t("reqList.more")}
                              less={t("reqList.less")}
                              className="max-w-[9rem]"
                            />
                            {!sheet.materialIds?.length && sheet.material ? (
                              <span className="block text-[10px] text-amber-800">
                                {t("quote.material.outside")}
                              </span>
                            ) : null}
                          </Td>
                          <Td className={slimTd}>
                            <ClampText
                              lines={1}
                              text={
                                sheet.factoryItemCode ??
                                t("supplierSheet.noCode")
                              }
                              more={t("reqList.more")}
                              less={t("reqList.less")}
                              className="max-w-[8rem]"
                            />
                          </Td>
                          <Td
                            className={cx(slimTd, "tabular-nums")}
                            data-quote-sheet-boxes
                          >
                            {box ? n(box.boxes, 0) : "—"}
                          </Td>
                          <Td
                            className={cx(slimTd, "tabular-nums")}
                            data-quote-sheet-cbm
                          >
                            {box ? n(box.cbm, 3) : "—"}
                          </Td>
                        </>
                      ) : (
                        <Td
                          colSpan={11}
                          className={cx(slimTd, "text-zinc-500")}
                        >
                          {t("supplierSheet.board.none")}
                        </Td>
                      )}
                      <Td className={slimTd}>
                        {cell?.photoDocumentId ? (
                          <a
                            href={`/api/files/${cell.photoDocumentId}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t("supplierSheet.view.photo")}
                            className="inline-flex align-middle"
                            data-quote-sheet-photo
                          >
                            <HoverZoomPhoto
                              photoId={cell.photoDocumentId}
                              size="h-6 w-6"
                            />
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td className={cx(slimTd, "text-amber-800")}>
                        {cell?.alerts.length ? (
                          <span
                            data-quote-sheet-alerts={cell.alerts
                              .map((a) => a.key)
                              .join(" ")}
                          >
                            <ClampText
                              lines={1}
                              text={cell.alerts
                                .map((a) => `⚠ ${alertText(a)}`)
                                .join(" · ")}
                              more={t("reqList.more")}
                              less={t("reqList.less")}
                              className="max-w-[16rem]"
                            />
                          </span>
                        ) : (
                          <span className="text-zinc-800">—</span>
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
            {homeField}
            <p
              className="text-xs text-zinc-500"
              data-quote-choose-sampling-hint
            >
              {t("quoteSampling.choose.hint")}
            </p>
            {answered.map((r) => {
              const ready = sampleReady.get(r.id) ?? false;
              return (
                <label
                  key={r.id}
                  className={cx(
                    "flex items-center gap-2 text-sm",
                    !ready && "text-zinc-400",
                  )}
                >
                  <input
                    type="radio"
                    name="responseId"
                    value={r.id}
                    required
                    disabled={!ready}
                    data-quote-winner-option={r.supplierId}
                    data-quote-winner-ready={ready ? "1" : "0"}
                  />
                  {supplierName(r.supplierId)}
                  {ready ? null : (
                    <span className="text-xs text-amber-800">
                      ({t("quoteSampling.choose.blocked")})
                    </span>
                  )}
                </label>
              );
            })}
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
              {homeField}
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
              {homeField}
              <input type="hidden" name="what" value="reopen" />
              <SubmitButton data-quote-reopen>
                {t("quote.reopen", { hours: quote.hours })}
              </SubmitButton>
            </form>
            <form action={quoteNoAnswerAction} className="space-y-2">
              <input type="hidden" name="quoteId" value={quote.id} />
              {homeField}
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
              {homeField}
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
