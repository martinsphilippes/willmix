import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/function-access";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText } from "@/i18n";
import { getStore } from "@/lib/db";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import { lastPurchases } from "@/lib/services/purchase-strategy";
import {
  quoteClosed,
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
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  linkClass,
  rowClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { PartyPicker } from "@/components/party-picker";
import { partyPickerLabels } from "@/components/party-picker-labels";
import {
  answerQuoteAction,
  chooseQuoteWinnerAction,
  decideQuoteWinnerAction,
  quoteNoAnswerAction,
} from "../../actions/purchase-demand";
import { QuoteDeadline } from "../_time";

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
    const state = responseState(response, now);
    const editable = quote.status === "open" && state !== "expired";
    return (
      <div data-quote-supplier={quote.id}>
        <PageHeader
          t={t}
          title={t("quote.one", { n: quote.number })}
          subtitle={t("quote.supplier.hint", { hours: quote.hours })}
        />
        <ActionError t={t} code={errorCode} text={errorText} fields={null} />
        {typeof sp.answered === "string" ? (
          <div className="mb-3" role="status" data-quote-answered>
            <Alert tone="success">
              {t(
                sp.answered === "declined"
                  ? "quote.supplier.declinedDone"
                  : "quote.supplier.answeredDone",
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
            <form
              action={answerQuoteAction}
              className="space-y-3"
              data-quote-answer-form
            >
              <input type="hidden" name="quoteId" value={quote.id} />
              <Table tools={false}>
                <thead>
                  <tr>
                    <Th>{t("common.product")}</Th>
                    <Th>{t("common.quantity")}</Th>
                    <Th>{t("quote.unitPrice")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map((item) => (
                    <tr key={item.productId} className={rowClass}>
                      <Td>{productNameText(t, item.name)}</Td>
                      <Td className="tabular-nums">
                        {item.quantity.toLocaleString(t.intl)} {item.unit}
                      </Td>
                      <Td>
                        <input
                          type="hidden"
                          name="productId"
                          value={item.productId}
                        />
                        <Input
                          name={`price.${item.productId}`}
                          inputMode="decimal"
                          defaultValue={
                            response.prices
                              ?.find((p) => p.productId === item.productId)
                              ?.unitPrice.toString() ?? ""
                          }
                          data-quote-price={item.productId}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t("strategy.currency")}>
                  <Select
                    name="currency"
                    defaultValue={response.currency ?? "USD"}
                    data-quote-currency
                  >
                    {SHEET_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("strategy.last.incoterm")}>
                  <Select
                    name="incoterm"
                    defaultValue={response.incoterm ?? "FOB"}
                    data-quote-incoterm
                  >
                    {SHEET_INCOTERMS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("strategy.last.leadTime")}>
                  <Input
                    name="leadTimeDays"
                    inputMode="numeric"
                    defaultValue={response.leadTimeDays?.toString() ?? ""}
                    data-quote-lead
                  />
                </Field>
                <Field label={t("quote.port")}>
                  <Input
                    name="port"
                    defaultValue={response.port ?? ""}
                    data-quote-port
                  />
                </Field>
                <Field label={t("strategy.last.moq")}>
                  <Input
                    name="moq"
                    inputMode="numeric"
                    defaultValue={response.moq?.toString() ?? ""}
                  />
                </Field>
              </div>
              <Field label={t("demand.notes")}>
                <Textarea
                  name="note"
                  rows={2}
                  defaultValue={response.note ?? ""}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton data-quote-submit>
                  {t("quote.answer")}
                </SubmitButton>
                <SubmitButton
                  name="decline"
                  value="1"
                  variant="secondary"
                  data-quote-decline
                >
                  {t("quote.decline")}
                </SubmitButton>
              </div>
            </form>
          ) : (
            <p className="text-sm text-zinc-600" data-quote-locked>
              {t("quote.supplier.locked")}
            </p>
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
  const [suppliers, refs, requests] = await Promise.all([
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
  ]);
  const supplierName = (sid: string) =>
    suppliers.find((p) => p.id === sid)?.name ?? sid;
  const closed = quoteClosed(responses, now);
  const empty = quoteEmpty(responses, now);
  const canChoose = can(user, "purchaseQuote.choose");
  const canApprove = can(user, "purchaseQuote.approve");
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
  const notice = (["chosen", "decided", "reopened", "invited"] as const).find(
    (k) => typeof sp[k] === "string",
  );
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
      <Card title={t("quote.compare")}>
        <Table tools={false}>
          <thead>
            <tr>
              <Th>{t("quote.supplier")}</Th>
              <Th>{t("quote.state")}</Th>
              {quote.items.map((i) => (
                <Th key={i.productId}>
                  {productNameText(t, i.name)}
                  <span className="block text-xs font-normal text-zinc-500">
                    {i.quantity.toLocaleString(t.intl)} {i.unit}
                  </span>
                </Th>
              ))}
              <Th>{t("quote.total")}</Th>
              <Th>{t("quote.conditions")}</Th>
            </tr>
          </thead>
          <tbody>
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
                  {quote.items.map((i) => {
                    const p = r.prices?.find(
                      (x) => x.productId === i.productId,
                    );
                    return (
                      <Td key={i.productId} className="tabular-nums">
                        {p ? `${r.currency ?? ""} ${p.unitPrice}` : "—"}
                      </Td>
                    );
                  })}
                  <Td className="tabular-nums">
                    {total(r) !== null
                      ? `${r.currency ?? ""} ${total(r)!.toLocaleString(t.intl, { maximumFractionDigits: 2 })}`
                      : "—"}
                  </Td>
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
      </Card>

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
              <PartyPicker
                name="supplierId"
                type="supplier"
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
