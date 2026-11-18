import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { can, canSeePurchasePrice } from "@/lib/auth/function-access";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText } from "@/i18n";
import { getStore, type LastPurchase, type Request } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import {
  RECIPIENT_ISSUES,
  RECIPIENT_WARNINGS,
} from "@/lib/purchase-recipients";
import {
  canApproveStrategy,
  canChooseStrategy,
  openDecisions,
  closedRecipients,
  pendingRecipients,
  recentStrategySends,
  strategyBoard,
} from "@/lib/services/purchase-strategy";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  formatDate,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { DemandTags } from "@/components/demand-tags";
import { partyPickerLabels } from "@/components/party-picker-labels";
import {
  decideStrategyAction,
  orderFromStrategyAction,
} from "../actions/purchase-demand";
import {
  StrategyQueue,
  type StrategyLineData,
  type StrategyTexts,
} from "./_components/strategy-queue";

/*
 * Estratégia de Compra (mapa B10?; dono, 15/11/2026 e 18/11/2026;
 * docs/PURCHASE_DEMAND.md, "Estratégia de Compra por produto"): um produto
 * por linha, com a encomenda de origem, o cliente, a quantidade, a
 * especificação, a programação de entrega e a última compra. Por produto:
 * cotar com o fornecedor da última compra, cotar com outros parceiros ou o
 * pedido direto. Resumo, confirmação e o resultado por destinatário (envios
 * recentes). Depois, as estratégias em andamento: o pedido direto esperando
 * a aprovação da Diretoria de compras e as aprovadas a gerar pedido.
 */
export default async function PurchaseStrategyPage({
  searchParams,
}: PageProps<"/app/purchase-strategy">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "purchaseStrategy");
  if (!isWellmix(user)) redirect("/app");
  const { error, chosen, decided } = await searchParams;
  const t = await getT();
  const store = getStore();
  const [board, decisions, sends] = await Promise.all([
    strategyBoard(t),
    openDecisions(),
    recentStrategySends(),
  ]);
  const decisionDemandIds = decisions.flatMap((d) => d.demandIds);
  const decisionDemands = decisionDemandIds.length
    ? await store.list("requests", { filter: { id: decisionDemandIds } })
    : [];
  const parties = await listByIds(
    store,
    "parties",
    decisionDemands.map((d) => d.customerId),
  );
  const partyName = (id: string) =>
    parties.find((p) => p.id === id)?.name ?? "—";
  const canChoose = canChooseStrategy(user);
  const canApprove = canApproveStrategy(user);
  const canOrder =
    can(user, "purchaseOrder.generate") && canOpen(user, "orders");
  // Preço da última compra: só com "Ver preço de compra" (dono, 15/11/2026;
  // docs/LINHA_DE_VISAO.md, seção 7). Sem ela, o pedido sai com o preço
  // gravado na decisão.
  const seesPrice = canSeePurchasePrice(user);

  const lines: StrategyLineData[] = board.lines.map((l) => {
    const d = l.demand;
    const n = d.number ?? "—";
    return {
      demandId: d.id,
      origin:
        l.kind === "replenishment"
          ? t("strategy.line.replenishment", { n })
          : t("strategy.line.order", { n }),
      demandHref: `/app/requests/${d.id}`,
      batch:
        d.groupId && l.batchSize > 1
          ? {
              label: t("strategy.line.batch", { n: l.batchSize }),
              href: `/app/requests/batch/${encodeURIComponent(d.groupId)}`,
            }
          : null,
      productName: productNameText(t, d.productName),
      productHref: d.productId ? `/app/products/${d.productId}` : null,
      quantity: `${d.quantity.toLocaleString(t.intl)} ${d.unit}`,
      customerName: l.kind === "replenishment" ? null : l.customerName,
      specification: d.specification?.trim() || null,
      schedule: (d.schedule?.items ?? []).map((i) =>
        t("strategy.line.scheduleItem", {
          index: i.index,
          quantity: i.quantity.toLocaleString(t.intl),
          date: formatDate(i.expectedAt, t),
        }),
      ),
      desiredAt: d.desiredAt ? formatDate(d.desiredAt, t) : null,
      deadline: d.deadline ? formatDate(d.deadline, t) : null,
      // Nome e código (famílias de mesmo nome no Sankhya; docs/PARTNER_FAMILIES.md).
      family: l.family
        ? {
            key: l.family.key,
            name: `${l.family.name} · ${t("partyFamilies.code", { code: l.family.key })}`,
          }
        : null,
      last: l.last
        ? {
            supplierId: l.last.supplierId,
            supplierName: l.last.supplierName ?? "—",
            price:
              seesPrice && l.last.unitPrice !== null
                ? `${l.last.currency ?? ""} ${l.last.unitPrice.toLocaleString(t.intl, { maximumFractionDigits: 4 })}`.trim()
                : null,
            orderHref: `/app/orders/${l.last.orderId}`,
            orderLabel: `#${l.last.orderNumber} · ${formatDate(l.last.date, t)}`,
            leadTime:
              l.last.leadTimeDays !== null
                ? t("strategy.days", { n: l.last.leadTimeDays })
                : null,
            incoterm: l.last.incoterm,
            moq: l.last.moq !== null ? l.last.moq.toLocaleString(t.intl) : null,
          }
        : null,
      linkedIds: l.linkedIds,
      suggestedIds: l.suggestedIds,
      blocked: d.productId
        ? null
        : `${t("strategy.noProduct")}: ${t("strategy.noProductHint")}`,
    };
  });
  const texts: StrategyTexts = {
    queueTitle: t("strategy.queue.title", { n: lines.length }),
    queueEmpty: t("strategy.queue.empty"),
    customer: t("strategy.line.customer"),
    quantity: t("strategy.line.quantity"),
    spec: t("strategy.line.spec"),
    schedule: t("strategy.line.schedule"),
    desiredAt: t("strategy.line.desiredAt"),
    deadline: t("strategy.line.deadline"),
    family: t("strategy.line.family"),
    noFamily: t("strategy.line.noFamily"),
    choose: t("strategy.line.choose"),
    lastTitle: t("strategy.last.supplier"),
    lastPrice: t("strategy.last.price"),
    lastOrder: t("strategy.last.date"),
    lastLeadTime: t("strategy.last.leadTime"),
    lastIncoterm: t("strategy.last.incoterm"),
    lastMoq: t("strategy.last.moq"),
    noHistory: t("strategy.option.noHistory"),
    choices: {
      skip: t("strategy.option.skip"),
      quote_last: t("strategy.choice.quote_last"),
      quote: t("strategy.choice.quote"),
      last_supplier: t("strategy.choice.last_supplier"),
    },
    lastHint: t("strategy.option.lastHint"),
    directHint: t("strategy.option.directHint"),
    linked: t("strategy.recipients.linked"),
    suggested: t("strategy.recipients.suggested"),
    none: t("strategy.recipients.none"),
    search: t("strategy.recipients.search"),
    added: t("strategy.recipients.added"),
    checking: t("strategy.recipients.checking"),
    allOk: t("strategy.recipients.allOk"),
    clear: t("strategy.recipients.clear"),
    logins: t("strategy.recipients.logins"),
    ok: t("strategy.recipients.ok"),
    lastBadge: t("strategy.recipients.lastBadge"),
    issues: Object.fromEntries(
      RECIPIENT_ISSUES.map((i) => [
        i,
        t(`strategy.issue.${i}` as DictionaryKey),
      ]),
    ),
    warnings: Object.fromEntries(
      RECIPIENT_WARNINGS.map((w) => [
        w,
        t(`strategy.warning.${w}` as DictionaryKey),
      ]),
    ),
    fix: t("strategy.issue.fix"),
    review: t("strategy.review"),
    reviewNone: t("strategy.review.none"),
    summaryTitle: t("strategy.summary.title"),
    summaryHint: t("strategy.summary.hint"),
    receives: t("strategy.summary.receives"),
    blockedOut: t("strategy.summary.blocked"),
    direct: t("strategy.summary.direct"),
    noRecipient: t("strategy.summary.noRecipient"),
    missingRecipient: t("strategy.summary.missingRecipient"),
    confirm: t("strategy.summary.confirm"),
    back: t("strategy.summary.back"),
    fixFirst: t("strategy.summary.fixFirst"),
    note: t("strategy.note"),
    working: t("strategy.summary.working"),
    picker: partyPickerLabels(t, true),
  };

  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `strategy.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;

  const reference = (ref: LastPurchase | undefined) =>
    ref ? (
      <dl
        className="grid gap-x-4 gap-y-0.5 text-xs text-zinc-700 sm:grid-cols-3"
        data-last-purchase={ref.orderNumber}
      >
        <div>
          <dt className="text-zinc-500">{t("strategy.last.supplier")}</dt>
          <dd className="font-medium">{ref.supplierName ?? "—"}</dd>
        </div>
        {seesPrice ? (
          <div>
            <dt className="text-zinc-500">{t("strategy.last.price")}</dt>
            <dd className="font-medium tabular-nums">
              {ref.unitPrice !== null
                ? `${ref.currency ?? ""} ${ref.unitPrice.toLocaleString(t.intl, { maximumFractionDigits: 4 })}`
                : "—"}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-zinc-500">{t("strategy.last.date")}</dt>
          <dd>
            <Link href={`/app/orders/${ref.orderId}`} className={linkClass}>
              #{ref.orderNumber}
            </Link>{" "}
            · {formatDate(ref.date, t)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.leadTime")}</dt>
          <dd>
            {ref.leadTimeDays !== null
              ? t("strategy.days", { n: ref.leadTimeDays })
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.incoterm")}</dt>
          <dd>{ref.incoterm ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("strategy.last.moq")}</dt>
          <dd className="tabular-nums">
            {ref.moq !== null ? ref.moq.toLocaleString(t.intl) : "—"}
          </dd>
        </div>
      </dl>
    ) : (
      <p className="text-xs font-medium text-amber-800" data-no-last-purchase>
        {t("strategy.noLastPurchase")}
      </p>
    );

  const demandRow = (d: Request, checkbox: boolean) => (
    <li
      key={d.id}
      className="flex flex-wrap items-start gap-x-3 gap-y-1 py-1.5"
      data-strategy-demand={d.id}
    >
      {checkbox ? (
        <input
          type="checkbox"
          name="demandIds"
          value={d.id}
          defaultChecked
          className="mt-1 h-4 w-4"
          aria-label={productNameText(t, d.productName)}
        />
      ) : null}
      <span className="min-w-0 flex-1 text-sm">
        <Link href={`/app/requests/${d.id}`} className={linkClass}>
          {d.number ? `nº ${d.number}` : "—"}
        </Link>{" "}
        · {d.quantity.toLocaleString(t.intl)} {d.unit}
        {d.desiredAt
          ? ` · ${t("demand.desiredAt")}: ${formatDate(d.desiredAt, t)}`
          : ""}
        <span className="block text-xs text-zinc-600">
          {partyName(d.customerId)}
        </span>
        <DemandTags t={t} request={d} />
      </span>
    </li>
  );

  return (
    <div data-strategy-page={lines.length}>
      <PageHeader
        t={t}
        title={t("strategy.title")}
        subtitle={t("strategy.subtitle")}
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {typeof chosen === "string" ? (
        <div className="mb-3" role="status" data-strategy-chosen>
          <Alert tone="success">{t("strategy.chosen", { n: chosen })}</Alert>
        </div>
      ) : null}
      {typeof decided === "string" ? (
        <div className="mb-3" role="status" data-strategy-decided>
          <Alert tone="success">{t("strategy.decided", { n: decided })}</Alert>
        </div>
      ) : null}
      {board.toSend ? (
        <div className="mb-3" data-strategy-to-send={board.toSend}>
          <Alert tone="info">
            {t("strategy.toSend", { n: board.toSend })}{" "}
            <Link href="/app/requests" className={linkClass}>
              {t("strategy.toSendLink")}
            </Link>
          </Alert>
        </div>
      ) : null}

      <StrategyQueue
        lines={lines}
        checks={Object.fromEntries(board.checks)}
        texts={texts}
        canChoose={canChoose}
      />

      <div className="mt-4" />
      <Card title={t("strategy.open", { n: decisions.length })}>
        {decisions.length ? (
          <div className="space-y-3">
            {decisions.map((d) => {
              const demands = decisionDemands.filter((r) =>
                d.demandIds.includes(r.id),
              );
              const ref = d.reference?.[0];
              return (
                <section
                  key={d.id}
                  id={`decision-${d.id}`}
                  className="rounded-2xl border border-zinc-200 p-3"
                  data-strategy-decision={d.status}
                  data-strategy-decision-choice={d.choice}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">
                      {t("strategy.decision", { n: d.number })}
                    </h3>
                    <Badge tone={d.status === "pending" ? "warning" : "success"}>
                      {t(`strategy.status.${d.status}` as DictionaryKey)}
                    </Badge>
                    <Badge tone="neutral">
                      {t(`strategy.choice.${d.choice}`)}
                    </Badge>
                  </div>
                  {d.note ? (
                    <p className="mt-1 text-xs text-zinc-600">{d.note}</p>
                  ) : null}
                  <ul className="mt-2 divide-y divide-zinc-100">
                    {demands.map((r) => demandRow(r, false))}
                  </ul>
                  {d.choice === "last_supplier" ? (
                    <div className="mt-2">{reference(ref)}</div>
                  ) : null}
                  {d.status === "pending" && canApprove ? (
                    <form
                      action={decideStrategyAction}
                      className="mt-3 grid gap-2 border-t border-zinc-100 pt-3"
                      data-strategy-approve-form
                    >
                      <input type="hidden" name="id" value={d.id} />
                      <Field label={t("strategy.approvalNote")}>
                        <Textarea name="note" rows={2} />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton
                          name="decision"
                          value="approve"
                          data-strategy-approve
                        >
                          {t("strategy.approve")}
                        </SubmitButton>
                        <SubmitButton
                          name="decision"
                          value="reject"
                          variant="secondary"
                          data-strategy-reject
                        >
                          {t("strategy.reject")}
                        </SubmitButton>
                      </div>
                    </form>
                  ) : d.status === "pending" ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      {t("strategy.waitingApproval")}
                    </p>
                  ) : null}
                  {d.status === "approved" &&
                  d.choice === "last_supplier" &&
                  ref ? (
                    canOrder ? (
                      <form
                        action={orderFromStrategyAction}
                        className="mt-3 grid gap-2 border-t border-zinc-100 pt-3 sm:grid-cols-5"
                        data-strategy-order-form
                      >
                        <input type="hidden" name="id" value={d.id} />
                        <Field label={t("common.quantity")}>
                          <Input
                            name="quantity"
                            inputMode="numeric"
                            defaultValue={String(d.quantity)}
                            required
                          />
                        </Field>
                        {seesPrice ? (
                          <>
                            <Field label={t("strategy.last.price")}>
                              <Input
                                name="unitPrice"
                                inputMode="decimal"
                                defaultValue={
                                  ref.unitPrice !== null
                                    ? String(ref.unitPrice)
                                    : ""
                                }
                                data-strategy-order-price
                              />
                            </Field>
                            <Field label={t("strategy.currency")}>
                              <Input
                                name="currency"
                                defaultValue={ref.currency ?? "USD"}
                                maxLength={3}
                                required
                              />
                            </Field>
                          </>
                        ) : null}
                        <Field label={t("strategy.last.leadTime")}>
                          <Input
                            name="leadTimeDays"
                            inputMode="numeric"
                            defaultValue={
                              ref.leadTimeDays !== null
                                ? String(ref.leadTimeDays)
                                : ""
                            }
                          />
                        </Field>
                        <Field label={t("strategy.last.incoterm")}>
                          <Select
                            name="incoterm"
                            defaultValue={
                              ref.incoterm === "EXW" || ref.incoterm === "FOB"
                                ? ref.incoterm
                                : ""
                            }
                          >
                            <option value="">—</option>
                            <option value="FOB">FOB</option>
                            <option value="EXW">EXW</option>
                          </Select>
                        </Field>
                        <div className="sm:col-span-5">
                          <SubmitButton data-strategy-order>
                            {t("strategy.generateOrder")}
                          </SubmitButton>
                        </div>
                      </form>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">
                        {t("strategy.waitingOrder")}
                      </p>
                    )
                  ) : null}
                  {d.status === "approved" &&
                  (d.choice === "quote" || d.choice === "quote_last") ? (
                    <p
                      className="mt-2 text-xs text-zinc-600"
                      data-strategy-quote-pending
                    >
                      {t("strategy.quotePending")}{" "}
                      {d.quoteId ? (
                        <Link
                          href={`/app/purchase-quotes/${d.quoteId}`}
                          className={linkClass}
                          data-strategy-quote-link={d.quoteId}
                        >
                          {t("strategy.openQuote")}
                        </Link>
                      ) : null}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        ) : (
          <Empty>{t("strategy.openEmpty")}</Empty>
        )}
      </Card>

      <Card title={t("strategy.sends.title")}>
        {sends.length ? (
          <ul className="divide-y divide-zinc-100" data-strategy-sends>
            {sends.map((send) => {
              const missing = pendingRecipients(send);
              const closed = closedRecipients(send);
              return (
                <li
                  key={send.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm"
                  data-strategy-send={send.id}
                >
                  <Link
                    href={`/app/purchase-strategy/sends/${send.id}`}
                    className={linkClass}
                  >
                    {t("strategy.sends.one", { n: send.number })}
                  </Link>
                  <span className="text-xs text-zinc-500">
                    {formatDate(send.createdAt, t)} ·{" "}
                    {t("strategy.sends.lines", { n: send.lines.length })}
                  </span>
                  <Badge
                    tone={missing ? "warning" : closed ? "neutral" : "success"}
                  >
                    {missing
                      ? t("strategy.sends.failures", { n: missing })
                      : closed
                        ? t("strategy.sends.closed", { n: closed })
                        : t("strategy.sends.ok")}
                  </Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>{t("strategy.sends.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}
