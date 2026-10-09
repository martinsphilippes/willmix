import { notFound, redirect } from "next/navigation";
import { fallbackError } from "@/i18n/error-text";
import Link from "next/link";
import { SellPriceCalculator } from "@/components/sell-price-calculator";
import {
  fxVariance,
  latestPricingRecord,
  quotePricing,
} from "@/lib/services/quote-pricing";
import { getFxRates } from "@/lib/services/fx";
import {
  requestNcm,
  scheduleNcmSuggestion,
  suggestionsView,
} from "@/lib/services/request-ncm";
import { hasFiscalTable } from "@/lib/services/fiscal";
import { formatNcm } from "@/lib/fiscal";
import { RequestNcmCard } from "@/components/request-ncm-card";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canSeeSupplier,
  canViewOrder,
  canViewRequest,
  isWellmix,
} from "@/lib/auth/permissions";
import { getStore, type FreightQuote } from "@/lib/db";
import { freightByQuote } from "@/lib/services/freight";
import { listProductSuppliers } from "@/lib/services/product-suppliers";
import { batchSiblings, getRequestForUser } from "@/lib/services/requests";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  StepDot,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  formatMoney,
  linkClass,
  rowClass,
  type StepState,
} from "@/components/ui";
import { CurrencySelect } from "@/components/currency-select";
import { SubmitButton } from "@/components/submit-button";
import { PixCopy } from "@/components/pix-copy";
import { pixForRequest } from "@/lib/services/down-payment";
import { submitDownPaymentProofAction } from "../../actions/payments";
import {
  answerQuoteAction,
  confirmDownPaymentAction,
  openRfqAction,
  selectQuoteAction,
  refreshProposalAction,
  setRequesterAction,
} from "../../actions";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { MoneyInput } from "@/components/money-input";
import { RequestScheduleTable } from "@/components/request-schedule-table";

export default async function RequestDetailPage({
  params,
  searchParams,
}: PageProps<"/app/requests/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { error, saved } = await searchParams;
  const request = await getRequestForUser(user, id);
  if (!request) notFound();
  const t = await getT();
  const store = getStore();
  // Lote: outras solicitações criadas junto com esta (só as que este usuário vê).
  const siblings = (await batchSiblings(request)).filter((r) =>
    canViewRequest(user, r),
  );
  const wellmix = isWellmix(user);

  const [customer, quotes, suppliers, documents, payments, customerLogins] =
    await Promise.all([
      store.get("parties", request.customerId),
      store.list("quotes", { filter: { requestId: request.id } }),
      wellmix
        ? store.list("parties", {
            filter: { type: "supplier", active: true },
            orderBy: "name",
          })
        : Promise.resolve([]),
      store.list("documents", { filter: { requestId: request.id } }),
      store.list("payments", { filter: { requestId: request.id } }),
      // Logins deste cliente, para a Wellmix indicar o solicitante.
      wellmix
        ? store.list("users", {
            filter: { role: "customer", partyId: request.customerId },
            orderBy: "name",
          })
        : Promise.resolve([]),
    ]);
  const supplierName = (supplierId: string) =>
    suppliers.find((s) => s.id === supplierId)?.name ?? supplierId;
  // RFQ: quem já fornece este produto aparece primeiro (o principal antes).
  const productForRfq =
    wellmix && request.productId
      ? await store.get("products", request.productId)
      : null;
  const supplying = new Set(
    productForRfq
      ? [
          ...(productForRfq.supplierId ? [productForRfq.supplierId] : []),
          ...(await listProductSuppliers(productForRfq.id)).map(
            (l) => l.supplierId,
          ),
        ]
      : [],
  );
  const rfqSuppliers = [...suppliers].sort((a, b) => {
    const rank = (id: string) =>
      id === productForRfq?.supplierId ? 0 : supplying.has(id) ? 1 : 2;
    return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name);
  });
  const invited = new Set(quotes.map((q) => q.supplierId));
  /* RFQ já aberta: o cartão vira "convidar mais"; todos convidados, sem botão. */
  const rfqOpened = request.status !== "REQUESTED" && quotes.length > 0;
  const allInvited =
    suppliers.length > 0 && suppliers.every((s) => invited.has(s.id));
  /* Frete pedido à companhia marítima por cotação (só a Wellmix vê). */
  const freights = wellmix
    ? await freightByQuote(quotes.map((q) => q.id))
    : new Map<string, FreightQuote[]>();
  const carrierIds = [
    ...new Set([...freights.values()].flat().map((f) => f.carrierId)),
  ];
  const carriers = carrierIds.length
    ? await store.list("parties", { filter: { id: carrierIds } })
    : [];
  const carrierName = (id: string) =>
    carriers.find((c) => c.id === id)?.name ?? "—";
  /* Segunda Onda: origem (recompra, nova proposta, sourcing sob demanda) e link ao
     pedido de origem só para quem pode abri-lo (mesmo isolamento por papel). */
  const origin =
    request.origin && request.origin !== "manual" ? request.origin : null;
  const sourceOrder = request.sourceOrderId
    ? await store.get("orders", request.sourceOrderId)
    : null;
  const sourceOrderLink =
    sourceOrder && canViewOrder(user, sourceOrder)
      ? `/app/orders/${sourceOrder.id}`
      : null;
  const selectedQuote = quotes.find((q) => q.id === request.selectedQuoteId);
  const downPayment = payments.find((p) => p.direction === "customer_in");
  /* Sinal: Pix copia e cola + QR Code (chave configurada pelo admin) e comprovante. */
  const waitingPayment = request.status === "WAITING_DOWN_PAYMENT";
  const pix = waitingPayment
    ? await pixForRequest(request).catch(() => ({
        unavailable: "not_configured" as const,
      }))
    : null;
  /* Valor ao cliente calculado (custo importado + margem) para as cotações respondidas. */
  const selectable =
    wellmix && ["RFQ_OPEN", "QUOTATION_RECEIVED"].includes(request.status)
      ? quotes.filter((q) => q.status === "answered")
      : [];
  const pricing = selectable.length
    ? await quotePricing(request, selectable)
    : null;
  /* Proposta aguardando sinal: o câmbio mudou desde a proposta? */
  const pricingRecord =
    wellmix && waitingPayment ? await latestPricingRecord(request.id) : null;
  const variance = pricingRecord
    ? fxVariance(pricingRecord, await getFxRates())
    : null;
  const { refreshed, ncmConfirmed, ncmSuggested, ncmAi } = await searchParams;
  /* NCM da solicitação (Wellmix): cadastro ou confirmado; sem ele, sugestões. */
  const ncmInfo =
    wellmix && request.status !== "CANCELLED"
      ? await requestNcm(request)
      : null;
  const ncmSuggestionList =
    ncmInfo?.status === "none" ? await suggestionsView(request) : [];
  const ncmPendingAuto =
    ncmInfo?.status === "none" && request.ncmSuggestions == null;
  if (ncmPendingAuto) scheduleNcmSuggestion(request.id);
  const fiscalLoaded = ncmInfo ? await hasFiscalTable() : false;
  const ncmAiCode =
    typeof ncmAi === "string" ? ncmAi.replace(/^ai_/, "") : null;
  const ncmAiReason = ncmAiCode
    ? ncmAiCode === "not_configured"
      ? t("ncm.ai.not_configured")
      : t(`ai.error.${ncmAiCode}` as DictionaryKey) !== `ai.error.${ncmAiCode}`
        ? t(`ai.error.${ncmAiCode}` as DictionaryKey)
        : ncmAiCode
    : null;
  const taxSourceText = (
    source: "sheet" | "table" | "classification" | null,
    ncm: string | null,
  ) =>
    source === "table"
      ? t("pricing.calc.taxSource.table", { ncm: ncm ? formatNcm(ncm) : "—" })
      : source
        ? t(`pricing.calc.taxSource.${source}`)
        : null;
  const proofDoc = downPayment?.proofDocumentId
    ? documents.find((d) => d.id === downPayment.proofDocumentId)
    : undefined;

  return (
    <>
      <PageHeader
        help={{ body: "help.request.body", steps: "help.request.steps" }}
        t={t}
        title={request.productName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                request.status === "ORDERED"
                  ? "success"
                  : request.status === "CANCELLED"
                    ? "neutral"
                    : request.status === "WAITING_DOWN_PAYMENT"
                      ? "warning"
                      : "neutral"
              }
            >
              {t(`reqStatusLabel.${request.status}`)}
            </Badge>
            {wellmix ? (
              <span className="font-medium text-zinc-700">
                {customer?.name}
              </span>
            ) : null}
            {origin ? (
              <Badge tone="brand">{t(`orders.origin.${origin}`)}</Badge>
            ) : null}
            {sourceOrderLink ? (
              <TextLink href={sourceOrderLink} className="text-xs">
                {t("orders.origin.sourceOrder")}
                {sourceOrder ? ` #${sourceOrder.number}` : ""} →
              </TextLink>
            ) : null}
          </span>
        }
        actions={
          request.orderId ? (
            <LinkButton
              href={`/app/orders/${request.orderId}`}
              variant="primary"
            >
              {t("requests.viewOrder")}
            </LinkButton>
          ) : null
        }
      />
      {siblings.length > 0 ? (
        <div className="mb-4" data-batch-siblings>
          <Alert tone="info">
            {t("reqBatch.siblings", { n: siblings.length + 1 })}{" "}
            {siblings.map((s, i) => (
              <span key={s.id}>
                {i > 0 ? ", " : null}
                <TextLink href={`/app/requests/${s.id}`}>
                  {s.productName}
                </TextLink>
              </span>
            ))}
          </Alert>
        </div>
      ) : null}
      {error ? (
        <Alert tone="danger">
          {typeof error === "string" &&
          t(`pricing.error.${error}` as DictionaryKey) !==
            `pricing.error.${error}`
            ? t(`pricing.error.${error}` as DictionaryKey)
            : typeof error === "string" &&
                t(`payments.error.${error}` as DictionaryKey) !==
                  `payments.error.${error}`
              ? t(`payments.error.${error}` as DictionaryKey)
              : typeof error === "string" &&
                  t(`access.error.${error}` as DictionaryKey) !==
                    `access.error.${error}`
                ? t(`access.error.${error}` as DictionaryKey)
                : typeof error === "string" &&
                    t(`reqBatch.error.${error}` as DictionaryKey) !==
                      `reqBatch.error.${error}`
                  ? t(`reqBatch.error.${error}` as DictionaryKey)
                  : fallbackError(t, String(error))}
        </Alert>
      ) : null}
      {saved === "requester" ? (
        <Alert tone="success">{t("access.requesterSaved")}</Alert>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title={t("requests.title")}>
            <DescriptionList
              items={[
                [t("common.quantity"), `${request.quantity} ${request.unit}`],
                [t("requests.deadline"), formatDate(request.deadline, t)],
                [t("requests.description"), request.description],
                [t("requests.specification"), request.specification],
                [t("common.note"), request.notes],
              ]}
            />
            <RequestScheduleTable
              schedule={request.schedule}
              unit={request.unit}
              t={t}
            />
            {documents.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 text-sm">
                {documents.map((d) => (
                  <li key={d.id}>
                    <TextLink href={`/api/files/${d.id}`} target="_blank">
                      {d.name}
                    </TextLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {/* RFQ: Wellmix escolhe fornecedores */}
          {wellmix &&
          ["REQUESTED", "RFQ_OPEN", "QUOTATION_RECEIVED"].includes(
            request.status,
          ) ? (
            <Card
              title={rfqOpened ? t("rfq.inviteMore") : t("requests.rfq.open")}
            >
              <form action={openRfqAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <p className="text-sm text-zinc-600">
                  {allInvited
                    ? t("rfq.allInvited")
                    : rfqOpened
                      ? t("rfq.inviteMoreHint")
                      : t("requests.rfq.select")}
                </p>
                {supplying.size ? (
                  <p className="text-xs text-zinc-500">
                    {t("productSuppliers.rfqHint")}
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  {rfqSuppliers.map((s) => (
                    <label
                      key={s.id}
                      className={cx(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition",
                        invited.has(s.id)
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-500"
                          : "cursor-pointer border-zinc-300 bg-white text-zinc-900 hover:border-brand-300 has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-900",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="supplierIds"
                        value={s.id}
                        disabled={invited.has(s.id)}
                        defaultChecked={invited.has(s.id)}
                        className="h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <span>
                        <span className="font-medium">{s.name}</span>{" "}
                        <span className="text-zinc-500">· {s.country}</span>
                        {supplying.has(s.id) ? (
                          <span
                            className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700"
                            data-rfq-supplying
                          >
                            {t("productSuppliers.rfqLinked")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                {allInvited ? null : (
                  <SubmitButton>
                    {rfqOpened
                      ? t("rfq.inviteSelected")
                      : t("requests.rfq.open")}
                  </SubmitButton>
                )}
              </form>
            </Card>
          ) : null}

          {/* Classificação fiscal: NCM → II (TEC) e IPI (TIPI) no valor ao cliente. */}
          {ncmInfo ? (
            <RequestNcmCard
              t={t}
              requestId={request.id}
              ncm={ncmInfo}
              suggestions={ncmSuggestionList}
              suggestionsPending={ncmPendingAuto}
              hasTable={fiscalLoaded}
              editable={!request.orderId}
              notice={
                ncmConfirmed
                  ? t("ncm.confirmedOk")
                  : typeof ncmSuggested === "string"
                    ? t("ncm.suggestedOk", { count: ncmSuggested })
                    : null
              }
              aiNotice={
                ncmAiReason
                  ? t("ncm.aiUnavailable", { reason: ncmAiReason })
                  : null
              }
            />
          ) : null}

          {/* Comparação de cotações (só Wellmix vê fornecedores e preços FOB) */}
          {wellmix && quotes.length > 0 ? (
            <Card title={t("requests.quotes.compare")}>
              <Table>
                <thead>
                  <tr>
                    <Th>{t("common.supplier")}</Th>
                    <Th>{t("common.price")}</Th>
                    <Th className="whitespace-nowrap">
                      {t("common.leadTime")}
                    </Th>
                    <Th>{t("common.conditions")}</Th>
                    <Th>{t("common.status")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr
                      key={q.id}
                      className={cx(
                        rowClass,
                        q.status === "selected" && "bg-emerald-50/50",
                      )}
                    >
                      <Td className="font-medium text-zinc-900">
                        {supplierName(q.supplierId)}
                      </Td>
                      {q.status === "invited" &&
                      ["RFQ_OPEN", "QUOTATION_RECEIVED"].includes(
                        request.status,
                      ) ? (
                        <Td colSpan={3}>
                          <form
                            action={answerQuoteAction}
                            className="flex flex-wrap items-end gap-2"
                          >
                            <input type="hidden" name="quoteId" value={q.id} />
                            <input
                              type="hidden"
                              name="back"
                              value={`/app/requests/${request.id}`}
                            />
                            <MoneyInput
                              locale={t.intl}
                              name="price"
                              watchField="currency"
                              decimals={4}
                              required
                              className="max-w-44"
                            />
                            <CurrencySelect
                              name="currency"
                              value="USD"
                              t={t}
                              className="max-w-40"
                            />
                            <Input
                              name="leadTimeDays"
                              type="number"
                              min="1"
                              required
                              placeholder={t("common.leadTime")}
                              className="max-w-32"
                            />
                            <Input
                              name="conditions"
                              placeholder={t("common.conditions")}
                              className="max-w-44"
                            />
                            <SubmitButton variant="secondary">
                              {t("requests.quotes.register")}
                            </SubmitButton>
                          </form>
                          <p className="mt-1 text-xs text-zinc-500">
                            {t("requests.quotes.registerHint")}
                          </p>
                        </Td>
                      ) : (
                        <>
                          <Td
                            className={cx(
                              "whitespace-nowrap tabular-nums",
                              q.price === null && "text-zinc-500",
                            )}
                          >
                            {q.price !== null
                              ? `${formatMoney(q.price, q.currency, t)} / ${request.unit}`
                              : t("requests.quotes.waiting")}
                          </Td>
                          <Td className="tabular-nums">
                            {q.leadTimeDays ?? "—"}
                          </Td>
                          <Td>{q.conditions ?? "—"}</Td>
                        </>
                      )}
                      <Td className="whitespace-nowrap">
                        <Badge
                          tone={
                            q.status === "selected"
                              ? "success"
                              : q.status === "answered"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {t(`quoteStatus.${q.status}`)}
                        </Badge>
                        {(freights.get(q.id) ?? []).map((f) => (
                          <Link
                            key={f.id}
                            href={`/app/freight/${f.id}`}
                            className="mt-1 block text-xs text-zinc-600 hover:text-brand-800"
                          >
                            {t("freight.compare.title")}:{" "}
                            {carrierName(f.carrierId)} ·{" "}
                            {f.status === "answered"
                              ? formatMoney(f.amount, f.currency, t)
                              : t("freight.compare.waiting")}
                          </Link>
                        ))}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {["RFQ_OPEN", "QUOTATION_RECEIVED"].includes(request.status) &&
              quotes.some((q) => q.status === "answered") ? (
                <form
                  action={selectQuoteAction}
                  className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 sm:grid-cols-3 sm:p-4"
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <SellPriceCalculator
                    quotes={(pricing?.quotes ?? []).map((p) => {
                      const q = selectable.find((x) => x.id === p.quoteId)!;
                      return {
                        quoteId: p.quoteId,
                        label: `${supplierName(q.supplierId)} · ${formatMoney(q.price, q.currency, t)}`,
                        hasSheet: p.hasSheet,
                        input: p.input,
                        marginSource: p.marginSource,
                        shippingFreightBrl: p.shippingFreight.brl,
                        iiSource: taxSourceText(p.tax.iiSource, p.tax.ncm),
                        ipiSource: taxSourceText(p.tax.ipiSource, p.tax.ncm),
                        ncmPending:
                          p.tax.ncmStatus === "none" && p.tax.iiSource === null,
                        shippingFreightNote:
                          p.shippingFreight.status === "answered"
                            ? t("freight.calc.answered", {
                                carrier: p.shippingFreight.carrierName ?? "—",
                                amount: formatMoney(
                                  p.shippingFreight.amount,
                                  p.shippingFreight.currency ?? "USD",
                                  t,
                                ),
                              })
                            : p.shippingFreight.status === "waiting"
                              ? t("freight.calc.waiting")
                              : null,
                      };
                    })}
                    labels={{
                      supplier: t("common.supplier"),
                      sellPrice: t("requests.sellPrice"),
                      carrierFreight: t("pricing.calc.carrierFreight"),
                      carrierFreightHint: t("pricing.calc.carrierFreightHint"),
                      title: t("pricing.calc.title"),
                      fob: t("pricing.calc.fob"),
                      fx: t("pricing.calc.fx"),
                      freightCarrier: t("pricing.calc.freightCarrier"),
                      freightCbm: t("pricing.calc.freightCbm"),
                      freightNone: t("pricing.calc.freightNone"),
                      importTax: t("pricing.calc.importTax"),
                      ipi: t("pricing.calc.ipi"),
                      insurance: t("pricing.calc.insurance"),
                      customsValue: t("pricing.calc.customsValue"),
                      pis: t("pricing.calc.pis"),
                      cofins: t("pricing.calc.cofins"),
                      icms: t("pricing.calc.icms"),
                      ncmPending: t("pricing.calc.ncmPending"),
                      landed: t("pricing.calc.landed"),
                      margin: t("pricing.calc.margin"),
                      sell: t("pricing.calc.sell"),
                      useCalculated: t("pricing.calc.useCalculated"),
                      noSheet: t("pricing.calc.noSheet"),
                      marginZero: t("pricing.calc.marginZero"),
                      sourceCustomer: t("pricing.calc.source.customer"),
                      sourceLine: t("pricing.calc.source.line"),
                      sourceDefault: t("pricing.calc.source.default"),
                      intl: t.intl,
                      fxStale:
                        pricing?.fx.status === "stale"
                          ? t("pricing.calc.fxStale", {
                              day: pricing.fx.day ?? "—",
                            })
                          : null,
                      missing: {
                        price: t("pricing.calc.missing.price"),
                        fx: t("pricing.calc.missing.fx"),
                        freight: t("pricing.calc.missing.freight"),
                        cbm: t("pricing.calc.missing.cbm"),
                        importTax: t("pricing.calc.missing.importTax"),
                        ipi: t("pricing.calc.missing.ipi"),
                        icms: t("pricing.calc.missing.icms"),
                      },
                    }}
                  />
                  <Field label={t("common.currency")}>
                    <CurrencySelect name="sellCurrency" value="BRL" t={t} />
                  </Field>
                  <Field label={t("requests.downPayment")}>
                    <MoneyInput
                      locale={t.intl}
                      name="downPaymentAmount"
                      watchField="sellCurrency"
                      placeholder={t("ph.request.downPayment")}
                    />
                  </Field>
                  <div className="sm:col-span-3">
                    <SubmitButton>{t("requests.quotes.select")}</SubmitButton>
                  </div>
                </form>
              ) : null}
            </Card>
          ) : null}

          {/* Proposta e sinal */}
          <span id="proposal" className="block scroll-mt-24" />
          {request.status === "WAITING_DOWN_PAYMENT" ||
          request.status === "ORDERED" ? (
            <Card
              title={t("requests.proposal")}
              className={cx(
                request.status === "WAITING_DOWN_PAYMENT" &&
                  "border-brand-300! ring-4 ring-brand-50",
              )}
            >
              {refreshed === "1" ? (
                <div className="mb-3">
                  <Alert tone="success">{t("pricing.refreshed")}</Alert>
                </div>
              ) : null}
              {variance && !downPayment?.proofDocumentId ? (
                <div className="mb-3 space-y-2">
                  <Alert tone="warning">
                    {t("pricing.variance", {
                      pct: `${variance.pct > 0 ? "+" : ""}${variance.pct.toLocaleString(t.intl, { maximumFractionDigits: 2 })}`,
                      currency: variance.currency,
                      from: variance.before.toLocaleString(t.intl, {
                        maximumFractionDigits: 4,
                      }),
                      to: variance.now.toLocaleString(t.intl, {
                        maximumFractionDigits: 4,
                      }),
                    })}
                  </Alert>
                  <form action={refreshProposalAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <SubmitButton variant="secondary">
                      {t("pricing.refresh")}
                    </SubmitButton>
                  </form>
                </div>
              ) : null}
              <DescriptionList
                items={[
                  [
                    t("requests.sellPrice"),
                    <span
                      key="sellPrice"
                      className="text-lg font-bold tracking-tight text-zinc-900 tabular-nums"
                    >
                      {formatMoney(request.sellPrice, request.sellCurrency, t)}
                    </span>,
                  ],
                  [
                    t("requests.downPayment"),
                    <span
                      key="downPayment"
                      className="text-lg font-bold tracking-tight text-zinc-900 tabular-nums"
                    >
                      {formatMoney(
                        request.downPaymentAmount,
                        request.sellCurrency,
                        t,
                      )}
                    </span>,
                  ],
                  [
                    t("common.status"),
                    downPayment ? (
                      <Badge
                        tone={
                          downPayment.status === "pending"
                            ? "warning"
                            : "success"
                        }
                      >
                        {t(`paymentStatus.${downPayment.status}`)}
                      </Badge>
                    ) : (
                      "—"
                    ),
                  ],
                  ...(canSeeSupplier(user) && selectedQuote
                    ? [
                        [
                          t("common.supplier"),
                          supplierName(selectedQuote.supplierId),
                        ] as [string, string],
                      ]
                    : []),
                ]}
              />
              {request.status === "WAITING_DOWN_PAYMENT" ? (
                <div className="mt-5 space-y-3 border-t border-zinc-100 pt-4">
                  <Alert tone="warning">
                    {t("requests.payment.instructions", {
                      amount: formatMoney(
                        request.downPaymentAmount,
                        request.sellCurrency,
                        t,
                      ),
                    })}
                  </Alert>
                  {/* Pix do sinal: copia e cola e QR Code com valor e referência. */}
                  {pix && "payload" in pix ? (
                    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                      <div>
                        <h3 className="text-base font-semibold text-zinc-900">
                          {t("payments.pix.title")}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                          {t("payments.pix.howTo")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado no servidor (data URL) */}
                        <img
                          src={pix.qrDataUrl}
                          alt={t("payments.pix.qrAlt")}
                          className="mx-auto h-48 w-48 shrink-0 rounded-lg border border-zinc-200 bg-white p-2 sm:mx-0"
                        />
                        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="col-span-2">
                            <dt className="text-xs text-zinc-500">
                              {t("payments.pix.receiver")}
                            </dt>
                            <dd className="font-medium text-zinc-900">
                              {pix.receiverName} · {pix.receiverCity}
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-xs text-zinc-500">
                              {t("payments.pix.key")}
                            </dt>
                            <dd className="break-all font-mono text-xs text-zinc-900">
                              {pix.key}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-zinc-500">
                              {t("payments.pix.amount")}
                            </dt>
                            <dd className="font-semibold tabular-nums text-zinc-900">
                              {formatMoney(pix.amount, "BRL", t)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs text-zinc-500">
                              {t("payments.pix.reference")}
                            </dt>
                            <dd className="break-all font-mono text-xs text-zinc-900">
                              {pix.reference}
                            </dd>
                          </div>
                        </dl>
                      </div>
                      <PixCopy
                        payload={pix.payload}
                        labels={{
                          code: t("payments.pix.code"),
                          copy: t("payments.pix.copy"),
                          copied: t("payments.pix.copied"),
                        }}
                      />
                    </div>
                  ) : pix && "unavailable" in pix ? (
                    <Alert tone="neutral">
                      {t(
                        `payments.pix.unavailable.${pix.unavailable}${wellmix ? "Wellmix" : ""}` as DictionaryKey,
                      )}
                    </Alert>
                  ) : null}

                  {/* Comprovante: o cliente anexa; a Wellmix confere e confirma. */}
                  {downPayment?.proofDocumentId ? (
                    <Alert tone={wellmix ? "info" : "success"}>
                      <span className="block">
                        {wellmix
                          ? t("payments.proof.receivedWellmix")
                          : t("payments.proof.sent")}
                      </span>
                      <a
                        href={`/api/files/${downPayment.proofDocumentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className={cx(linkClass, "mt-1 inline-block")}
                      >
                        {t("payments.proof.view")}
                        {proofDoc ? ` (${proofDoc.name})` : ""}
                      </a>
                    </Alert>
                  ) : null}
                  {!wellmix ? (
                    <form
                      action={submitDownPaymentProofAction}
                      className="space-y-3 rounded-xl border border-zinc-200 p-4"
                    >
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <Field
                        label={
                          downPayment?.proofDocumentId
                            ? t("payments.proof.another")
                            : t("payments.proof.label")
                        }
                        hint={t("payments.proof.hint")}
                      >
                        <Input
                          name="proof"
                          type="file"
                          accept="image/*,application/pdf"
                          required
                        />
                      </Field>
                      <SubmitButton className="w-full sm:w-auto">
                        {t("payments.proof.submit")}
                      </SubmitButton>
                    </form>
                  ) : null}
                  {wellmix ? (
                    <form
                      action={confirmDownPaymentAction}
                      className="flex flex-wrap items-end gap-3"
                    >
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <Field label={t("requests.payment.proof")}>
                        <Input name="proof" type="file" />
                      </Field>
                      <SubmitButton>
                        {t("requests.payment.confirm")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          {wellmix ? (
            <Card title={t("access.requesterTitle")}>
              <form action={setRequesterAction} className="space-y-3">
                <input type="hidden" name="requestId" value={request.id} />
                <p className="text-xs leading-relaxed text-zinc-500">
                  {t("access.requesterHint")}
                </p>
                <Select
                  name="requestedForUserId"
                  defaultValue={request.requestedForUserId ?? ""}
                  aria-label={t("access.requester")}
                >
                  <option value="">{t("access.requesterNone")}</option>
                  {customerLogins.map((u) => (
                    <option key={u.id} value={u.id} disabled={!u.active}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </Select>
                <SubmitButton variant="secondary">
                  {t("common.save")}
                </SubmitButton>
              </form>
            </Card>
          ) : null}
          <Card title={t("orders.timeline")}>
            <ol className="-mx-2 space-y-1 text-sm">
              {(
                [
                  "REQUESTED",
                  "RFQ_OPEN",
                  "QUOTATION_RECEIVED",
                  "WAITING_DOWN_PAYMENT",
                  "ORDERED",
                ] as const
              ).map((s, i, arr) => {
                const idx = arr.indexOf(request.status as (typeof arr)[number]);
                const done = idx >= i;
                const current = idx === i;
                const state: StepState = done
                  ? current && s !== "ORDERED"
                    ? "active"
                    : "done"
                  : "pending";
                return (
                  <li
                    key={s}
                    aria-current={state === "active" ? "step" : undefined}
                    className={cx(
                      "flex items-center gap-3 rounded-lg px-2 py-1.5",
                      state === "active" && "bg-brand-50",
                    )}
                  >
                    <StepDot state={state}>{i + 1}</StepDot>
                    <span
                      className={cx(
                        state === "active"
                          ? "font-semibold text-brand-800"
                          : state === "done"
                            ? "text-zinc-900"
                            : "text-zinc-500",
                      )}
                    >
                      {t(`reqStatusLabel.${s}`)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
