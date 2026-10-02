import { Fragment, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canSeeInternalCosts,
  canSeeSellPrice,
  canSeeSupplier,
  canViewOrder,
  isWellmix,
} from "@/lib/auth/permissions";
import {
  getStore,
  type AfterSales,
  type Container,
  type Document,
  type InspectionResultRow,
  type Order,
  type OrderItem,
  type PurchaseSnapshot,
  type Request as RequestRow,
  type Requirement,
  type ReviewItem,
  type User,
} from "@/lib/db";
import { canSubmitRequirement, loadOrderProgress } from "@/lib/workflow/engine";
import { loadOrderFinance } from "@/lib/services/finance";
import {
  ackedByUser,
  ackTrails,
  recordAck,
  type AckSummary,
} from "@/lib/services/acknowledgements";
import { containersForOrder } from "@/lib/services/containers";
import {
  isInspectionMeasureKey,
  latestInspectionResult,
} from "@/lib/services/inspection";
import { listOpenReviews } from "@/lib/services/reviews";
import { getSnapshotForOrder } from "@/lib/services/snapshots";
import { getAfterSales } from "@/lib/services/after-sales";
import { getT } from "@/i18n/server";
import { requirementLabel, type Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Empty,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Progress,
  Select,
  StepDot,
  Table,
  Td,
  Textarea,
  TextLink,
  Th,
  cx,
  formatDate,
  formatMoney,
  isOverdue,
  linkClass,
  rowClass,
  stageTone,
} from "@/components/ui";
import { RequirementForm } from "@/components/requirement-form";
import { sheetAccess } from "@/lib/services/purchase-sheet";
import { SubmitButton } from "@/components/submit-button";
import {
  assignPartnerAction,
  createPenaltyAction,
  registerCustomerPaymentAction,
  registerSupplierPaymentAction,
  unblockStageAction,
} from "../../actions";
import {
  acknowledgeDocumentAction,
  acknowledgePaymentAction,
  ensureSnapshotAction,
  remeasureAction,
} from "../../actions/orders-extra";
import {
  answerAfterSalesAction,
  closeAfterSalesAction,
  createFollowUpRequestAction,
  openAfterSalesAction,
} from "../../actions/after-sales";

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { error, remeasure } = await searchParams;
  const progress = await loadOrderProgress(id);
  if (!progress || !canViewOrder(user, progress.order)) notFound();
  const { order, stages, requirements } = progress;
  const t = await getT();
  const store = getStore();
  const wellmix = isWellmix(user);
  /* Nova medição (inspeção bloqueada): só com ?remeasure=1; sem o parâmetro a tela é a de sempre. */
  const remeasureMode = remeasure === "1";
  /* Ficha de compra (Preparação): quem vê ganha o atalho no item do checklist. */
  const sheet = sheetAccess(user, order);
  const sheetHref = sheet.view
    ? `/app/orders/${order.id}/purchase-sheet`
    : null;

  /* Leituras independentes numa rodada só (cada ida ao banco é uma viagem de rede). */
  const customerSide = wellmix || user.role === "customer";
  const delivered = order.status === "CLOSED" || order.status === "DELIVERED";
  const [
    parties,
    items,
    documents,
    payments,
    penalties,
    users,
    finance,
    snapshot,
    inspection,
    openReviews,
    containers,
    afterSales,
    sourceRequest,
    derivedRequests,
  ] = await Promise.all([
    store.list("parties"),
    store.list("order_items", { filter: { orderId: order.id } }),
    store.list("documents", {
      filter: { orderId: order.id },
      orderBy: "createdAt",
      direction: "desc",
    }),
    store.list("payments", { filter: { orderId: order.id } }),
    store.list("penalties", { filter: { orderId: order.id } }),
    store.list("users"),
    wellmix || user.role === "customer"
      ? loadOrderFinance(order)
      : Promise.resolve(null),
    /* Evolução incremental: snapshot da compra, resultado da inspeção e fila (só Wellmix),
       containers do pedido (todos, filtrado) e trilha visualizado/confirmado. */
    wellmix ? getSnapshotForOrder(order.id) : Promise.resolve(null),
    wellmix ? latestInspectionResult(order.id) : Promise.resolve(null),
    wellmix ? listOpenReviews(order.id) : Promise.resolve([] as ReviewItem[]),
    containersForOrder(order.id),
    /* Módulo cliente 2: pós-venda, "comprar de novo / nova proposta" e origem da solicitação.
       Só cliente (dono) e Wellmix; fornecedor e parceiros não veem avaliação nem preço de venda. */
    customerSide ? getAfterSales(order.id) : Promise.resolve(null),
    store.get("requests", order.requestId),
    customerSide
      ? store.list("requests", {
          filter: { sourceOrderId: order.id },
          orderBy: "createdAt",
          direction: "desc",
        })
      : Promise.resolve([] as RequestRow[]),
  ]);
  const partyName = (pid: string | null) =>
    parties.find((p) => p.id === pid)?.name ?? "—";
  const userName = (uid: string | null) =>
    users.find((u) => u.id === uid)?.name ?? "—";
  const docById = (did: string | null) =>
    documents.find((d) => d.id === did) ?? null;
  const visibleDocs = documents.filter((d) => canSeeDoc(user, d));
  const currentStage =
    stages.find((s) => s.id === order.currentStageId) ?? null;
  const overdue = isOverdue(currentStage?.dueAt);
  const visiblePayments = payments.filter((p) =>
    wellmix
      ? true
      : user.role === "customer"
        ? p.direction === "customer_in"
        : user.role === "supplier"
          ? p.direction === "supplier_out"
          : false,
  );

  const showTrail = wellmix || user.role === "supplier";
  /* Trilha: o fornecedor abrindo o pedido registra "visualizado" nos pagamentos a ele
     (o mesmo que a conta corrente faz); confirmar continua sendo o ato explícito do botão. */
  if (user.role === "supplier") {
    await Promise.all(
      visiblePayments.map((p) => recordAck(user, "payment", p.id, "viewed")),
    );
  }
  const origin =
    sourceRequest?.origin && sourceRequest.origin !== "manual"
      ? sourceRequest.origin
      : null;
  const [
    paymentTrails,
    documentTrails,
    confirmedDocs,
    followProduct,
    sourceOrderRow,
  ] = await Promise.all([
    showTrail
      ? ackTrails("payment", visiblePayments, (p) => p.registeredByUserId)
      : Promise.resolve({} as Record<string, AckSummary>),
    ackTrails("document", visibleDocs, (d) => d.uploadedByUserId),
    ackedByUser(
      user.id,
      "document",
      visibleDocs.map((d) => d.id),
      "confirmed",
    ),
    (customerSide || user.role === "broker") && items[0]?.productId
      ? store.get("products", items[0].productId)
      : Promise.resolve(null),
    /* Link ao pedido de origem só para quem pode abri-lo (mesmo isolamento por papel). */
    origin && sourceRequest?.sourceOrderId
      ? store.get("orders", sourceRequest.sourceOrderId)
      : Promise.resolve(null),
  ]);
  const inspectionStage = stages.find((s) => s.key === "INSPECTION") ?? null;
  const inspectionBlocked = inspectionStage?.status === "blocked";
  const sourceOrder =
    sourceOrderRow && canViewOrder(user, sourceOrderRow)
      ? sourceOrderRow
      : null;

  return (
    <>
      <PageHeader
        help={{ body: "help.order.body", steps: "help.order.steps" }}
        t={t}
        title={t("orders.number", { number: order.number })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {items
                .map((i) => `${i.name} · ${i.quantity} ${i.unit}`)
                .join("; ")}
            </span>
            <Badge
              tone={stageTone(
                order.status === "CLOSED"
                  ? "done"
                  : currentStage?.status === "blocked"
                    ? "blocked"
                    : "active",
              )}
            >
              {t(`stage.${order.status}`)}
              {currentStage?.status === "blocked"
                ? ` · ${t("stageStatus.blocked")}`
                : ""}
            </Badge>
            {overdue ? (
              <Badge tone="danger">{t("common.overdue")}</Badge>
            ) : null}
            {origin ? (
              <Badge tone="brand">{t(`orders.origin.${origin}`)}</Badge>
            ) : null}
            {sourceOrder ? (
              <TextLink
                href={`/app/orders/${sourceOrder.id}`}
                className="text-xs"
              >
                {t("orders.origin.sourceOrder")}:{" "}
                {t("orders.number", { number: sourceOrder.number })}
              </TextLink>
            ) : null}
          </span>
        }
      />
      {error ? (
        <Alert tone="danger">
          {typeof error === "string" &&
          t(`sheet.error.${error}` as DictionaryKey) !== `sheet.error.${error}`
            ? t(`sheet.error.${error}` as DictionaryKey)
            : `${t("common.error")} (${error})`}
        </Alert>
      ) : null}
      {currentStage?.status === "blocked" ? (
        <div className="mb-4">
          <Alert tone="warning">
            <strong>{t("orders.blocked")}:</strong>{" "}
            {wellmix || currentStage.key !== "INSPECTION"
              ? currentStage.blockReason
              : t("orders.inspection.genericBlock")}
          </Alert>
        </div>
      ) : null}
      {order.status === "CLOSED" ? (
        <Alert tone="success">{t("orders.closed")}</Alert>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card title={t("orders.timeline")}>
            <ol className="-mx-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {stages.map((s) => (
                <li
                  key={s.id}
                  className={cx(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm",
                    s.status === "active" && "bg-brand-50",
                    s.status === "blocked" && "bg-amber-50",
                  )}
                >
                  <StepDot state={s.status}>{s.sequence + 1}</StepDot>
                  <a
                    href={`#stage-${s.id}`}
                    className={cx(
                      "transition hover:text-brand-700",
                      s.status === "pending"
                        ? "text-zinc-500"
                        : s.status === "active"
                          ? "font-semibold text-brand-800"
                          : s.status === "blocked"
                            ? "font-semibold text-amber-900"
                            : "text-zinc-900",
                    )}
                  >
                    {t(`stage.${s.key}`)}
                  </a>
                  {s.status === "active" || s.status === "blocked" ? (
                    <span className="ml-auto text-xs font-semibold tabular-nums text-zinc-600">
                      {s.percent}%
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>

          {customerSide && (afterSales || (wellmix && delivered)) ? (
            <div id="after-sales">
              <AfterSalesCard
                t={t}
                afterSales={afterSales}
                orderId={order.id}
                user={user}
                wellmix={wellmix}
                answeredBy={userName(afterSales?.answeredByUserId ?? null)}
              />
            </div>
          ) : null}

          {customerSide && delivered && items[0] ? (
            <div id="followup">
              <FollowUpCard
                t={t}
                order={order}
                item={items[0]}
                photoDocumentId={followProduct?.primaryPhotoDocumentId ?? null}
                derived={derivedRequests}
              />
            </div>
          ) : null}

          {stages
            .filter(
              (s) => s.key !== "CLOSED" && (wellmix || s.status !== "pending"),
            )
            .map((stage) => {
              const reqs = requirements.filter((r) => r.stageId === stage.id);
              const open =
                stage.status === "active" || stage.status === "blocked";
              return (
                <Fragment key={stage.id}>
                  <Card
                    className={cx(
                      stage.status === "active" &&
                        "border-brand-300! ring-4 ring-brand-50",
                      stage.status === "blocked" &&
                        "border-amber-400! ring-4 ring-amber-50",
                    )}
                    title={
                      <span
                        id={`stage-${stage.id}`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        {t(`stage.${stage.key}`)}
                        <Badge tone={stageTone(stage.status)}>
                          {t(`stageStatus.${stage.status}`)}
                        </Badge>
                        {open && stage.dueAt ? (
                          <span
                            className={cx(
                              "text-xs",
                              isOverdue(stage.dueAt)
                                ? "font-semibold text-red-700"
                                : "font-normal text-zinc-500",
                            )}
                          >
                            {t("common.due")}: {formatDate(stage.dueAt)}
                          </span>
                        ) : null}
                      </span>
                    }
                    actions={
                      open ? (
                        <span className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>
                            {t("common.responsible")}:{" "}
                            <span className="font-semibold text-zinc-700">
                              {t(`role.${stage.responsibleRole}`)}
                            </span>
                          </span>
                          <span className="w-24">
                            <Progress percent={stage.percent} />
                          </span>
                        </span>
                      ) : null
                    }
                  >
                    <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                      {t(`help.stage.${stage.key}`)}
                    </p>
                    {stage.key === "INSPECTION" && user.role === "supplier" ? (
                      <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-xs leading-relaxed text-brand-800">
                        {t("orders.inspection.blindHint")}
                      </p>
                    ) : null}
                    {stage.key === "INSPECTION" &&
                    stage.status === "blocked" &&
                    (wellmix || user.role === "supplier") ? (
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                        {remeasureMode ? (
                          <>
                            <span className="text-xs text-zinc-600">
                              {t("orders.inspection.remeasureHint")}
                            </span>
                            <TextLink
                              href={`/app/orders/${order.id}#stage-${stage.id}`}
                              className="text-xs"
                            >
                              {t("orders.inspection.remeasureClose")}
                            </TextLink>
                          </>
                        ) : (
                          <TextLink
                            href={`/app/orders/${order.id}?remeasure=1#stage-${stage.id}`}
                          >
                            {t("orders.inspection.remeasure")} →
                          </TextLink>
                        )}
                      </div>
                    ) : null}
                    {stage.status === "pending" ? (
                      <p className="text-sm text-zinc-500">
                        {reqs.map((r) => requirementLabel(t, r)).join(" · ")}
                      </p>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {reqs.map((r) => (
                          <RequirementRow
                            key={r.id}
                            requirement={r}
                            order={order}
                            user={user}
                            t={t}
                            doc={docById(r.documentId)}
                            submittedBy={userName(r.submittedByUserId)}
                            open={open}
                            wellmix={wellmix}
                            remeasure={
                              remeasureMode &&
                              stage.key === "INSPECTION" &&
                              stage.status === "blocked" &&
                              isInspectionMeasureKey(r.key)
                            }
                            sheetHref={sheetHref}
                            sheetEditable={sheet.editSupplier}
                          />
                        ))}
                      </ul>
                    )}
                    {stage.status === "blocked" && wellmix ? (
                      <form action={unblockStageAction} className="mt-3">
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="stageId" value={stage.id} />
                        <SubmitButton variant="secondary">
                          {t("orders.unblock")}
                        </SubmitButton>
                      </form>
                    ) : null}
                    {stage.key === "SUPPLIER_PAYMENT" && open && wellmix ? (
                      <form
                        action={registerSupplierPaymentAction}
                        className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 sm:grid-cols-3 sm:p-4"
                      >
                        <input type="hidden" name="orderId" value={order.id} />
                        <Field label={t("orders.value")}>
                          <Input
                            name="amount"
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            defaultValue={order.fobTotal ?? ""}
                          />
                        </Field>
                        <Field label={t("common.currency")}>
                          <Input
                            name="currency"
                            maxLength={3}
                            defaultValue={order.fobCurrency ?? "USD"}
                          />
                        </Field>
                        <Field label={t("finance.fx")}>
                          <Input name="fxRate" type="number" step="0.0001" />
                        </Field>
                        <div className="sm:col-span-3">
                          <Field label={t("requests.payment.proof")}>
                            <Input name="proof" type="file" />
                          </Field>
                        </div>
                        <div className="sm:col-span-3">
                          <SubmitButton>
                            {t("orders.registerPayment")}
                          </SubmitButton>
                        </div>
                      </form>
                    ) : null}
                  </Card>
                  {stage.key === "INSPECTION" &&
                  wellmix &&
                  stage.status !== "pending" ? (
                    <InspectionResultCard
                      key={`${stage.id}-result`}
                      t={t}
                      result={inspection}
                      reviews={openReviews}
                      measuredBy={userName(
                        inspection?.measuredByUserId ?? null,
                      )}
                      blocked={inspectionBlocked}
                    />
                  ) : null}
                </Fragment>
              );
            })}
        </div>

        <div className="min-w-0 space-y-6">
          <Card title={t("orders.title")}>
            <DescriptionList
              items={[
                ...(user.role !== "customer" &&
                (wellmix || user.role === "legal")
                  ? [
                      [t("common.customer"), partyName(order.customerId)] as [
                        string,
                        string,
                      ],
                    ]
                  : []),
                ...(canSeeSupplier(user) && user.role !== "supplier"
                  ? [
                      [t("common.supplier"), partyName(order.supplierId)] as [
                        string,
                        string,
                      ],
                    ]
                  : []),
                ...(canSeeInternalCosts(user)
                  ? [
                      [
                        t("orders.fob"),
                        formatMoney(order.fobTotal, order.fobCurrency),
                      ] as [string, string],
                    ]
                  : []),
                ...(canSeeSellPrice(user)
                  ? [
                      [
                        t("orders.sell"),
                        formatMoney(order.sellPrice, order.sellCurrency),
                      ] as [string, string],
                    ]
                  : []),
                ...(wellmix
                  ? [
                      [
                        t("orders.erp"),
                        order.erpNumber ?? (
                          <Badge tone="warning">
                            {t(`erpStatus.${order.erpSyncStatus}`)}
                          </Badge>
                        ),
                      ] as [string, ReactNode],
                    ]
                  : []),
                [t("common.date"), formatDate(order.createdAt)],
                /* Visão de Produto: modalidade de operação copiada do cliente (importador de registro).
                   Wellmix, cliente e despachante; nunca fornecedor, agência, armador ou transportador.
                   Pedidos antigos (nulo): nada aparece. */
                ...(order.operationMode &&
                (wellmix ||
                  user.role === "customer" ||
                  user.role === "broker" ||
                  user.role === "legal")
                  ? [
                      [
                        t("operations.mode.title"),
                        <span
                          key="operationMode"
                          className="inline-flex"
                          title={t("operations.mode.orderHint")}
                        >
                          <Badge tone="info">
                            {t(
                              `operations.mode.badge.${order.operationMode}` as DictionaryKey,
                            )}
                          </Badge>
                        </span>,
                      ] as [string, ReactNode],
                    ]
                  : []),
                /* Classificação fiscal (NCM) com validação humana: Wellmix e despachante. */
                ...(followProduct && (wellmix || user.role === "broker")
                  ? [
                      [
                        t("catalog.tax.title"),
                        <TextLink
                          key="tax"
                          href={`/app/products/${followProduct.id}/tax`}
                        >
                          {followProduct.ncm ?? t("catalog.tax.none")}
                        </TextLink>,
                      ] as [string, ReactNode],
                    ]
                  : []),
              ]}
            />
            {wellmix && order.erpSyncStatus === "pending" ? (
              <p className="mt-3 text-xs text-amber-700">
                {t("orders.erp.pending")}
              </p>
            ) : null}
          </Card>

          {wellmix || containers.length > 0 ? (
            <ContainersCard t={t} containers={containers} wellmix={wellmix} />
          ) : null}

          {wellmix ? (
            <div id="snapshot">
              <SnapshotCard
                t={t}
                snapshot={snapshot}
                orderId={order.id}
                supplierName={partyName(snapshot?.supplierId ?? null)}
                createdBy={userName(snapshot?.createdByUserId ?? null)}
              />
            </div>
          ) : null}

          {wellmix ? (
            <Card title={t("orders.partners")}>
              <div className="space-y-3">
                {(
                  [
                    ["agencyId", "agency"],
                    ["brokerId", "broker"],
                    ["shippingLineId", "shipping_line"],
                    ["carrierId", "carrier"],
                  ] as const
                ).map(([field, type]) => (
                  <form
                    key={field}
                    action={assignPartnerAction}
                    className="flex items-end gap-2"
                  >
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="field" value={field} />
                    <div className="min-w-0 flex-1">
                      <Field label={t(`party.${type}`)}>
                        <Select
                          name="partyId"
                          defaultValue={order[field] ?? ""}
                        >
                          <option value="">—</option>
                          {parties
                            .filter((p) => p.type === type && p.active)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </Select>
                      </Field>
                    </div>
                    <SubmitButton variant="secondary">
                      {t("orders.assign")}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </Card>
          ) : null}

          {finance ? (
            <Card title={t("finance.title")}>
              <DescriptionList
                items={[
                  [
                    t("finance.sale"),
                    formatMoney(finance.sell, finance.sellCurrency),
                  ],
                  [
                    t("finance.received"),
                    formatMoney(finance.received, finance.sellCurrency),
                  ],
                  [
                    t("finance.receivable"),
                    <span
                      key="r"
                      className={
                        finance.receivable > 0
                          ? "font-medium text-amber-700"
                          : "text-emerald-700"
                      }
                    >
                      {formatMoney(finance.receivable, finance.sellCurrency)}
                    </span>,
                  ],
                  ...(wellmix
                    ? ([
                        [
                          t("orders.fob"),
                          formatMoney(finance.fob, finance.fobCurrency),
                        ],
                        [
                          t("finance.paid"),
                          formatMoney(finance.paid, finance.fobCurrency),
                        ],
                        [
                          t("finance.payable"),
                          <span
                            key="p"
                            className={
                              finance.payable > 0
                                ? "font-medium text-amber-700"
                                : "text-emerald-700"
                            }
                          >
                            {formatMoney(finance.payable, finance.fobCurrency)}
                          </span>,
                        ],
                        [
                          t("finance.cost"),
                          finance.cost !== null
                            ? `${formatMoney(finance.cost, finance.sellCurrency)}${finance.estimated ? " ~" : ""}`
                            : t("finance.fxMissing"),
                        ],
                        [
                          t("finance.margin"),
                          finance.margin !== null ? (
                            <span
                              key="m"
                              className={
                                finance.margin < 0
                                  ? "font-medium text-red-700"
                                  : "font-medium text-emerald-700"
                              }
                            >
                              {formatMoney(
                                finance.margin,
                                finance.sellCurrency,
                              )}
                              {finance.marginPct !== null
                                ? ` (${finance.marginPct.toFixed(1)}%)`
                                : ""}
                            </span>
                          ) : (
                            "—"
                          ),
                        ],
                      ] as [string, ReactNode][])
                    : []),
                ]}
              />
              {wellmix && finance.receivable > 0 ? (
                <form
                  action={registerCustomerPaymentAction}
                  className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <Field label={t("orders.value")}>
                    <Input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={finance.receivable.toFixed(2)}
                    />
                  </Field>
                  <Field label={t("common.currency")}>
                    <Input
                      name="currency"
                      maxLength={3}
                      defaultValue={finance.sellCurrency}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label={t("finance.method")}>
                      <Input name="method" placeholder="PIX, boleto, TED" />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label={t("requests.payment.proof")}>
                      <Input name="proof" type="file" />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <SubmitButton>{t("finance.registerReceipt")}</SubmitButton>
                  </div>
                </form>
              ) : null}
            </Card>
          ) : null}

          {visiblePayments.length > 0 ? (
            <Card title={t("orders.payments")}>
              <ul className="space-y-2 text-sm">
                {visiblePayments.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-zinc-200/80 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-900">
                        {formatMoney(p.amount, p.currency)}
                      </span>
                      <Badge
                        tone={p.status === "pending" ? "warning" : "success"}
                      >
                        {t(`paymentStatus.${p.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {p.direction === "customer_in"
                        ? t("common.customer")
                        : t("common.supplier")}{" "}
                      · {formatDate(p.confirmedAt ?? p.createdAt)}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                    {p.proofDocumentId &&
                    docById(p.proofDocumentId) &&
                    canSeeDoc(user, docById(p.proofDocumentId)!) ? (
                      <a
                        href={`/api/files/${p.proofDocumentId}`}
                        className={cx(linkClass, "mt-1 inline-block text-xs")}
                        target="_blank"
                      >
                        {t("requests.payment.proof")}
                      </a>
                    ) : null}
                    {showTrail && paymentTrails[p.id] ? (
                      <AckTrail
                        t={t}
                        summary={paymentTrails[p.id]}
                        showNames={wellmix}
                      />
                    ) : null}
                    {p.direction === "supplier_out" &&
                    p.status === "confirmed" &&
                    (user.role === "supplier" || wellmix) ? (
                      <form action={acknowledgePaymentAction} className="mt-2">
                        <input type="hidden" name="paymentId" value={p.id} />
                        <input
                          type="hidden"
                          name="back"
                          value={`/app/orders/${order.id}`}
                        />
                        <SubmitButton variant="secondary">
                          {t("orders.confirmReceipt")}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title={t("orders.documents")}>
            {visibleDocs.length === 0 ? (
              <Empty>{t("common.none")}</Empty>
            ) : (
              <ul className="-mx-2 space-y-0.5 text-sm">
                {visibleDocs.map((d) => (
                  <li
                    key={d.id}
                    className={cx(rowClass, "rounded-lg px-2 py-1")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={`/api/files/${d.id}`}
                        className={cx(linkClass, "min-w-0 truncate")}
                        target="_blank"
                      >
                        {d.name}
                      </a>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {d.type} · v{d.version}
                      </span>
                    </div>
                    {documentTrails[d.id] ? (
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <AckTrail
                          t={t}
                          summary={documentTrails[d.id]}
                          showNames={wellmix}
                        />
                        {d.uploadedByUserId !== user.id ? (
                          confirmedDocs.has(d.id) ? (
                            <span className="text-xs text-emerald-700">
                              ✓ {t("orders.ack.confirmedDoc")}
                            </span>
                          ) : (
                            <form action={acknowledgeDocumentAction}>
                              <input
                                type="hidden"
                                name="documentId"
                                value={d.id}
                              />
                              <input
                                type="hidden"
                                name="back"
                                value={`/app/orders/${order.id}`}
                              />
                              <button
                                type="submit"
                                className={cx(
                                  linkClass,
                                  "inline-flex min-h-9 items-center text-xs",
                                )}
                              >
                                {t("orders.ack.confirmDoc")}
                              </button>
                            </form>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {visibleDocs.length > 0 ? (
              <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
                {t("orders.ack.hint")}
              </p>
            ) : null}
          </Card>

          {wellmix || user.role === "legal" || penalties.length > 0 ? (
            <Card title={t("orders.penalties")}>
              {penalties.length === 0 ? (
                <Empty>{t("penalties.empty")}</Empty>
              ) : null}
              <ul className="space-y-2 text-sm">
                {penalties.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-zinc-200/80 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-900">
                        {formatMoney(p.amount, p.currency)}
                      </span>
                      <Badge tone={p.status === "open" ? "danger" : "neutral"}>
                        {t(`penaltyStatus.${p.status}`)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-zinc-700">{p.reason}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {t("orders.penalty.responsible")}:{" "}
                      {partyName(p.responsiblePartyId)}
                    </p>
                  </li>
                ))}
              </ul>
              {wellmix ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-700 transition hover:text-brand-800">
                    {t("orders.penalty.new")}
                  </summary>
                  <form action={createPenaltyAction} className="mt-2 space-y-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <Field label={t("orders.penalty.reason")}>
                      <Textarea name="reason" required rows={2} />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label={t("orders.value")}>
                        <Input
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                        />
                      </Field>
                      <Field label={t("common.currency")}>
                        <Input
                          name="currency"
                          defaultValue="BRL"
                          maxLength={3}
                        />
                      </Field>
                    </div>
                    <Field label={t("orders.penalty.responsible")}>
                      <Select name="responsiblePartyId" defaultValue="">
                        <option value="">—</option>
                        {[
                          order.supplierId,
                          order.agencyId,
                          order.brokerId,
                          order.shippingLineId,
                          order.carrierId,
                        ]
                          .filter((v): v is string => !!v)
                          .map((pid) => (
                            <option key={pid} value={pid}>
                              {partyName(pid)}
                            </option>
                          ))}
                      </Select>
                    </Field>
                    <Field label={t("orders.penalty.evidence")}>
                      <Input name="evidence" type="file" />
                    </Field>
                    <SubmitButton variant="danger">
                      {t("orders.penalty.new")}
                    </SubmitButton>
                  </form>
                </details>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function canSeeDoc(user: User, d: Document) {
  if (isWellmix(user)) return true;
  if (d.visibility === "all") return true;
  if (d.visibility === "internal") return false;
  if (d.visibility === "customer") return user.role === "customer";
  if (d.visibility === "supplier") return user.role !== "customer";
  return false;
}

function RequirementRow({
  requirement: r,
  order,
  user,
  t,
  doc,
  submittedBy,
  open,
  wellmix,
  remeasure,
  sheetHref,
  sheetEditable,
}: {
  requirement: Requirement;
  order: {
    id: string;
    customerId: string;
    supplierId: string;
    agencyId: string | null;
    brokerId: string | null;
    shippingLineId: string | null;
    carrierId: string | null;
  };
  user: User;
  t: Translate;
  doc: Document | null;
  submittedBy: string;
  open: boolean;
  wellmix: boolean;
  /** Nova medição: reenvio de um requisito de medida já concluído (inspeção bloqueada). */
  remeasure: boolean;
  /** Ficha de compra: link para a ficha (o item não tem formulário próprio). */
  sheetHref: string | null;
  sheetEditable: boolean;
}) {
  const isSheet = r.key === "purchase_sheet";
  const canAct =
    open &&
    r.status !== "done" &&
    canSubmitRequirement(user, order as never, r);
  const canRemeasure =
    remeasure &&
    r.status === "done" &&
    canSubmitRequirement(user, order as never, r);
  /* Inspeção cega: a nota da revisão traz os valores esperados; fora da Wellmix vira texto
     genérico enquanto pendente e some quando resolvida (a reprovação mostra a observação da Wellmix). */
  const note =
    r.key === "inspection_review" && !wellmix && r.note
      ? r.status === "pending"
        ? t("orders.inspection.genericBlock")
        : r.status === "done"
          ? null
          : r.note
      : r.note;
  const tone =
    r.status === "done"
      ? "success"
      : r.status === "rejected"
        ? "danger"
        : "neutral";
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900">
            {requirementLabel(t, r)}
          </span>
          {!r.required ? (
            <span className="text-xs text-zinc-500">
              ({t("reqStatus.optional")})
            </span>
          ) : null}
          <Badge tone={tone}>{t(`reqStatus.${r.status}`)}</Badge>
          <span className="text-xs text-zinc-500">{t(`role.${r.role}`)}</span>
        </div>
        {r.status !== "pending" ? (
          <p className="mt-1 text-xs text-zinc-500">
            {r.type !== "file" &&
            r.type !== "photo" &&
            r.type !== "confirm" &&
            r.type !== "approval" &&
            r.value ? (
              <span className="mr-2 text-zinc-800">{r.value}</span>
            ) : null}
            {doc ? (
              <TextLink
                href={`/api/files/${doc.id}`}
                target="_blank"
                className="mr-2"
              >
                {doc.name} (v{doc.version})
              </TextLink>
            ) : null}
            {t("orders.submitted")}: {submittedBy} · {formatDate(r.submittedAt)}
            {note ? ` · ${note}` : ""}
          </p>
        ) : note ? (
          <p className="mt-1 text-xs text-amber-700">{note}</p>
        ) : null}
      </div>
      {isSheet ? (
        sheetHref ? (
          <div className="shrink-0">
            <LinkButton
              href={sheetHref}
              variant={
                r.status !== "done" && open && sheetEditable
                  ? "primary"
                  : "secondary"
              }
              className="w-full sm:w-auto"
            >
              {r.status !== "done" && open && sheetEditable
                ? t("sheet.open")
                : t("sheet.view")}
            </LinkButton>
          </div>
        ) : null
      ) : canAct ? (
        <div className="shrink-0">
          <RequirementForm requirement={r} orderId={order.id} t={t} />
        </div>
      ) : canRemeasure ? (
        <div className="shrink-0">
          <RequirementForm
            requirement={r}
            orderId={order.id}
            t={t}
            action={remeasureAction}
            defaultValue={r.value}
          />
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------------ */
/* Evolução incremental: trilha, snapshot, resultado da inspeção, containers  */
/* ------------------------------------------------------------------------ */

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rótulo traduzido de um atributo do snapshot (cai no nome técnico se faltar chave). */
function attrLabel(t: Translate, attribute: string) {
  const key = `orders.inspection.attr.${attribute}` as DictionaryKey;
  const translated = t(key);
  return translated === key ? attribute : translated;
}

/** Enviado → visualizado → confirmado. Nomes só para a Wellmix; os demais veem datas. */
function AckTrail({
  t,
  summary,
  showNames,
}: {
  t: Translate;
  summary: AckSummary;
  showNames: boolean;
}) {
  const who = (name: string | null) =>
    showNames && name ? `${t("orders.ack.by")} ${name} ` : "";
  return (
    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
      <span className="whitespace-nowrap">
        {t("orders.ack.sent")} {formatDateTime(summary.sentAt)}
      </span>
      {" · "}
      <span
        className={cx(
          "whitespace-nowrap",
          summary.viewedAt ? "text-zinc-700" : "text-zinc-400",
        )}
      >
        {t("orders.ack.viewed")}{" "}
        {summary.viewedAt
          ? `${who(summary.viewedBy)}${formatDateTime(summary.viewedAt)}`
          : t("orders.ack.pending")}
      </span>
      {" · "}
      <span
        className={cx(
          "whitespace-nowrap",
          summary.confirmedAt ? "text-emerald-700" : "text-zinc-400",
        )}
      >
        {t("orders.ack.confirmed")}{" "}
        {summary.confirmedAt
          ? `${who(summary.confirmedBy)}${formatDateTime(summary.confirmedAt)}`
          : t("orders.ack.pending")}
      </span>
    </p>
  );
}

const dims = (
  a: number | null | undefined,
  b: number | null | undefined,
  c: number | null | undefined,
) => (a || b || c ? `${a ?? "—"} × ${b ?? "—"} × ${c ?? "—"}` : "—");

const numOrDash = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : String(v);

/** "Comprado (snapshot)": o que foi negociado, congelado no pedido. Só Wellmix. */
function SnapshotCard({
  t,
  snapshot,
  orderId,
  supplierName,
  createdBy,
}: {
  t: Translate;
  snapshot: PurchaseSnapshot | null;
  orderId: string;
  supplierName: string;
  createdBy: string;
}) {
  if (!snapshot) {
    return (
      <Card title={t("orders.snapshot.title")}>
        <p className="text-sm text-zinc-600">{t("orders.snapshot.missing")}</p>
        <p className="mt-2 text-xs text-amber-700">
          {t("orders.snapshot.retroWarning")}
        </p>
        <form action={ensureSnapshotAction} className="mt-3">
          <input type="hidden" name="orderId" value={orderId} />
          <SubmitButton variant="secondary">
            {t("orders.snapshot.generate")}
          </SubmitButton>
        </form>
      </Card>
    );
  }
  const retro = !!snapshot.note;
  return (
    <Card
      title={t("orders.snapshot.title")}
      actions={
        retro ? (
          <Badge tone="warning">{t("orders.snapshot.retroactive")}</Badge>
        ) : null
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {t("orders.snapshot.hint")}
      </p>
      <DescriptionList
        items={[
          [t("common.name"), snapshot.name],
          [t("common.supplier"), supplierName],
          [
            t("orders.snapshot.unitPrice"),
            snapshot.unitPrice !== null
              ? `${formatMoney(snapshot.unitPrice, snapshot.currency ?? "USD")} / ${snapshot.unit}`
              : "—",
          ],
          [t("common.quantity"), `${snapshot.quantity} ${snapshot.unit}`],
          [t("orders.snapshot.moq"), numOrDash(snapshot.moq)],
          [t("orders.snapshot.supplierSku"), snapshot.supplierSku ?? "—"],
          [t("orders.snapshot.material"), snapshot.material ?? "—"],
          [t("orders.snapshot.color"), snapshot.color ?? "—"],
          [t("orders.snapshot.pantone"), snapshot.pantone ?? "—"],
          [
            t("orders.snapshot.dimensions"),
            dims(snapshot.lengthCm, snapshot.widthCm, snapshot.heightCm),
          ],
          [t("orders.snapshot.netWeight"), numOrDash(snapshot.netWeightKg)],
          [t("orders.snapshot.grossWeight"), numOrDash(snapshot.grossWeightKg)],
          [t("orders.snapshot.masterBox"), numOrDash(snapshot.masterBoxQty)],
          [t("orders.snapshot.innerBox"), numOrDash(snapshot.innerBoxQty)],
          [
            t("orders.snapshot.boxDimensions"),
            dims(
              snapshot.boxLengthCm,
              snapshot.boxWidthCm,
              snapshot.boxHeightCm,
            ),
          ],
          [t("orders.snapshot.cbm"), numOrDash(snapshot.cbm)],
          [t("common.conditions"), snapshot.conditions ?? "—"],
          [
            t("orders.snapshot.registeredAt"),
            `${formatDate(snapshot.createdAt)} · ${createdBy}`,
          ],
        ]}
      />
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("orders.snapshot.photos")}
        </p>
        {snapshot.photoDocumentIds.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">
            {t("orders.snapshot.noPhotos")}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {snapshot.photoDocumentIds.map((docId) => (
              <a
                key={docId}
                href={`/api/files/${docId}`}
                target="_blank"
                className="block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
                <img
                  src={`/api/files/${docId}`}
                  alt=""
                  loading="lazy"
                  className="h-16 w-16 rounded-lg border border-zinc-200 bg-zinc-50 object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>
      {snapshot.note ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>{t("orders.snapshot.note")}:</strong> {snapshot.note}
        </p>
      ) : null}
    </Card>
  );
}

/** Resultado da inspeção (comprado × inspecionado) e itens abertos na fila. Só Wellmix. */
function InspectionResultCard({
  t,
  result,
  reviews,
  measuredBy,
  blocked,
}: {
  t: Translate;
  result: InspectionResultRow | null;
  reviews: ReviewItem[];
  measuredBy: string;
  blocked: boolean;
}) {
  const tone =
    result?.result === "APPROVED"
      ? "success"
      : result?.result === "DIVERGENT"
        ? "danger"
        : "warning";
  return (
    <Card
      title={t("orders.inspection.title")}
      actions={
        result ? (
          <Badge tone={tone}>
            {t(`orders.inspection.result.${result.result}`)}
          </Badge>
        ) : blocked ? (
          <Badge tone="warning">{t("orders.blocked")}</Badge>
        ) : null
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {t("orders.inspection.hint")}
      </p>
      {!result ? (
        <Empty>{t("orders.inspection.noResult")}</Empty>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t("orders.inspection.attribute")}</Th>
                <Th className="text-right">
                  {t("orders.inspection.expected")}
                </Th>
                <Th className="text-right">{t("orders.inspection.found")}</Th>
                <Th className="text-right">
                  {t("orders.inspection.tolerance")}
                </Th>
                <Th>{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {result.comparisons.map((c) => (
                <tr key={c.attribute} className={rowClass}>
                  <Td className="font-medium">{attrLabel(t, c.attribute)}</Td>
                  <Td className="text-right tabular-nums">
                    {c.expected ?? "—"}
                  </Td>
                  <Td
                    className={cx(
                      "text-right tabular-nums",
                      !c.ok && "font-semibold text-red-700",
                    )}
                  >
                    {c.found ?? "—"}
                  </Td>
                  <Td className="text-right tabular-nums">
                    {c.tolerancePercent !== null
                      ? `${c.tolerancePercent}%`
                      : "—"}
                  </Td>
                  <Td>
                    <Badge tone={c.ok ? "success" : "danger"}>
                      {c.ok
                        ? t("orders.inspection.ok")
                        : t("orders.inspection.divergent")}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-zinc-500">
            {t("orders.inspection.comparedAt")}:{" "}
            {formatDateTime(result.comparedAt)} ·{" "}
            {t("orders.inspection.measuredBy")}: {measuredBy}
          </p>
        </>
      )}
      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("orders.inspection.openReviews")}
            {reviews.length > 0 ? (
              <span className="ml-2">
                <Badge tone="warning">{reviews.length}</Badge>
              </span>
            ) : null}
          </h3>
          <TextLink href="/app/reviews" className="text-xs">
            {t("orders.inspection.reviewsLink")} →
          </TextLink>
        </div>
        {reviews.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">
            {t("orders.inspection.noOpenReviews")}
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2"
              >
                <p className="font-medium text-zinc-900">{r.problem}</p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {t("orders.inspection.expected")}:{" "}
                  <span className="font-medium">{r.expected ?? "—"}</span> ·{" "}
                  {t("orders.inspection.found")}:{" "}
                  <span className="font-medium text-red-700">
                    {r.found ?? "—"}
                  </span>
                  {r.action ? ` · ${r.action}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** Containers em que o pedido está. Cliente e parceiros: só código e ETA. */
function ContainersCard({
  t,
  containers,
  wellmix,
}: {
  t: Translate;
  containers: Container[];
  wellmix: boolean;
}) {
  return (
    <Card title={t("orders.containers.title")}>
      {containers.length === 0 ? (
        <Empty>{t("orders.containers.none")}</Empty>
      ) : (
        <ul className="space-y-2 text-sm">
          {containers.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 p-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">
                  {wellmix ? (
                    <TextLink href={`/app/containers/${c.id}`}>
                      {c.code}
                    </TextLink>
                  ) : (
                    c.code
                  )}
                  {wellmix ? (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {c.type}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {wellmix
                    ? `${t("orders.containers.etd")}: ${formatDate(c.etd)} · `
                    : ""}
                  {t("orders.containers.eta")}: {formatDate(c.eta)}
                </p>
              </div>
              {wellmix ? (
                <Badge
                  tone={
                    c.status === "closed" || c.status === "arrived"
                      ? "success"
                      : c.status === "shipped"
                        ? "info"
                        : "neutral"
                  }
                >
                  {t(`orders.containers.status.${c.status}`)}
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------------ */
/* Módulo cliente 2: pós-venda e "comprar de novo / nova proposta"            */
/* ------------------------------------------------------------------------ */

/** Nota 1–5 como estrelas (texto acessível junto). */
function Stars({ rating, t }: { rating: number | null; t: Translate }) {
  if (rating === null)
    return <span className="text-zinc-500">{t("afterSales.notRated")}</span>;
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${rating}/5`}
      title={`${rating}/5`}
    >
      <span className="tracking-tight text-amber-500" aria-hidden>
        {"★".repeat(filled)}
        <span className="text-zinc-300">{"★".repeat(5 - filled)}</span>
      </span>
      <span className="text-xs font-semibold tabular-nums text-zinc-700">
        {rating}/5
      </span>
    </span>
  );
}

/** Botão grande de escolha única (rádio escondido; visual pelo estado :checked). */
function ChoiceButton({
  name,
  value,
  label,
  defaultChecked,
  required,
  wide,
}: {
  name: string;
  value: string;
  label: string;
  defaultChecked?: boolean;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        required={required}
        className="peer sr-only"
      />
      <span
        className={cx(
          "flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white px-3 text-base font-semibold text-zinc-800 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600",
          wide ? "min-w-24" : "w-12",
        )}
      >
        {label}
      </span>
    </label>
  );
}

/**
 * Pós-venda do pedido: o cliente (dono) responde enquanto "open"; depois as
 * respostas ficam visíveis para ele e para a Wellmix, que encerra com observação.
 * Pedido entregue/encerrado sem registro (anterior ao recurso): a Wellmix abre.
 */
function AfterSalesCard({
  t,
  afterSales,
  orderId,
  user,
  wellmix,
  answeredBy,
}: {
  t: Translate;
  afterSales: AfterSales | null;
  orderId: string;
  user: User;
  wellmix: boolean;
  answeredBy: string;
}) {
  if (!afterSales) {
    return (
      <Card title={t("orders.afterSales.title")}>
        <p className="text-sm text-zinc-600">
          {t("orders.afterSales.openHint")}
        </p>
        <form action={openAfterSalesAction} className="mt-3">
          <input type="hidden" name="orderId" value={orderId} />
          <SubmitButton variant="secondary">
            {t("orders.afterSales.open")}
          </SubmitButton>
        </form>
      </Card>
    );
  }
  const status = afterSales.status;
  const tone =
    status === "open" ? "warning" : status === "answered" ? "info" : "success";
  const canAnswer = status === "open" && user.role === "customer";
  const interest = (v: AfterSales["repurchaseInterest"]) =>
    v ? t(`orders.afterSales.repurchase.${v}`) : "—";
  return (
    <Card
      title={t("orders.afterSales.title")}
      actions={
        <Badge tone={tone}>{t(`orders.afterSales.status.${status}`)}</Badge>
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {t("orders.afterSales.hint")}
      </p>

      {canAnswer ? (
        <form action={answerAfterSalesAction} className="space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="afterSalesId" value={afterSales.id} />
          <fieldset>
            <legend className="text-sm font-medium text-zinc-800">
              {t("orders.afterSales.rating")}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <ChoiceButton
                  key={n}
                  name="rating"
                  value={String(n)}
                  label={String(n)}
                  required
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {t("orders.afterSales.ratingHint")}
            </p>
          </fieldset>
          <Field label={t("orders.afterSales.experience")}>
            <Textarea name="experience" rows={2} maxLength={2000} />
          </Field>
          <Field label={t("orders.afterSales.problems")}>
            <Textarea name="problems" rows={2} maxLength={2000} />
          </Field>
          <Field label={t("orders.afterSales.perceivedCosts")}>
            <Textarea name="perceivedCosts" rows={2} maxLength={2000} />
          </Field>
          <Field label={t("orders.afterSales.suggestions")}>
            <Textarea name="suggestions" rows={2} maxLength={2000} />
          </Field>
          <fieldset>
            <legend className="text-sm font-medium text-zinc-800">
              {t("orders.afterSales.repurchase")}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["yes", "maybe", "no"] as const).map((v) => (
                <ChoiceButton
                  key={v}
                  name="repurchaseInterest"
                  value={v}
                  label={t(`orders.afterSales.repurchase.${v}`)}
                  wide
                />
              ))}
            </div>
          </fieldset>
          <div className="border-t border-zinc-100 pt-4">
            <SubmitButton pendingText="...">
              {t("orders.afterSales.submit")}
            </SubmitButton>
          </div>
        </form>
      ) : status === "open" ? (
        <p className="text-sm text-zinc-600">
          {t("orders.afterSales.waitingCustomer")}
        </p>
      ) : (
        <>
          {user.role === "customer" && status === "answered" ? (
            <div className="mb-3">
              <Alert tone="success">{t("orders.afterSales.thanks")}</Alert>
            </div>
          ) : null}
          <DescriptionList
            items={[
              [
                t("orders.afterSales.rating"),
                <Stars key="s" rating={afterSales.rating} t={t} />,
              ],
              [
                t("orders.afterSales.repurchase"),
                interest(afterSales.repurchaseInterest),
              ],
              [t("orders.afterSales.experience"), afterSales.experience ?? "—"],
              [t("orders.afterSales.problems"), afterSales.problems ?? "—"],
              [
                t("orders.afterSales.perceivedCosts"),
                afterSales.perceivedCosts ?? "—",
              ],
              [
                t("orders.afterSales.suggestions"),
                afterSales.suggestions ?? "—",
              ],
              [
                t("orders.afterSales.answeredAt"),
                `${formatDateTime(afterSales.answeredAt)}${
                  wellmix ? ` · ${answeredBy}` : ""
                }`,
              ],
              ...(status === "closed"
                ? ([
                    [
                      t("orders.afterSales.closedAt"),
                      formatDateTime(afterSales.closedAt),
                    ],
                    [t("orders.afterSales.notes"), afterSales.notes ?? "—"],
                  ] as [string, ReactNode][])
                : []),
            ]}
          />
        </>
      )}

      {wellmix && status !== "closed" ? (
        <form
          action={closeAfterSalesAction}
          className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 sm:p-4"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="afterSalesId" value={afterSales.id} />
          <Field
            label={t("orders.afterSales.notes")}
            hint={t("orders.afterSales.closeHint")}
          >
            <Textarea name="notes" rows={2} maxLength={2000} />
          </Field>
          <SubmitButton variant="secondary">
            {t("orders.afterSales.close")}
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}

/**
 * "Comprar de novo" (reposição) e "Quero nova proposta": abre uma solicitação
 * pré-preenchida a partir deste pedido. Mostra só o preço de venda (nunca FOB).
 */
function FollowUpCard({
  t,
  order,
  item,
  photoDocumentId,
  derived,
}: {
  t: Translate;
  order: Order;
  item: OrderItem;
  photoDocumentId: string | null;
  derived: RequestRow[];
}) {
  const unitSell =
    order.sellPrice !== null && item.quantity > 0
      ? order.sellPrice / item.quantity
      : null;
  return (
    <Card title={t("orders.followup.title")}>
      <p className="mb-3 text-xs leading-relaxed text-zinc-500">
        {t("orders.followup.hint")}
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        {photoDocumentId ? (
          <a
            href={`/api/files/${photoDocumentId}`}
            target="_blank"
            className="block shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido por /api/files com sessão */}
            <img
              src={`/api/files/${photoDocumentId}`}
              alt={item.name}
              loading="lazy"
              className="h-28 w-28 rounded-xl border border-zinc-200 bg-zinc-50 object-cover"
            />
          </a>
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-center text-xs text-zinc-400">
            {t("orders.followup.noPhoto")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <DescriptionList
            items={[
              [t("common.product"), item.name],
              [
                t("orders.followup.lastQuantity"),
                `${item.quantity} ${item.unit}`,
              ],
              [
                t("orders.followup.lastPrice"),
                unitSell !== null
                  ? `${formatMoney(unitSell, order.sellCurrency)} / ${item.unit}`
                  : "—",
              ],
              [t("orders.followup.lastDate"), formatDate(order.createdAt)],
            ]}
          />
        </div>
      </div>
      <form
        action={createFollowUpRequestAction}
        className="mt-4 grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 sm:grid-cols-2 sm:p-4"
      >
        <input type="hidden" name="orderId" value={order.id} />
        <Field label={t("orders.followup.newQuantity")}>
          <Input
            name="quantity"
            type="number"
            min="0.01"
            step="any"
            required
            defaultValue={item.quantity}
          />
        </Field>
        <Field label={t("requests.deadline")}>
          <Input name="deadline" type="date" />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("orders.followup.notes")}>
            <Textarea name="notes" rows={2} maxLength={2000} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <SubmitButton name="origin" value="replenishment" pendingText="...">
            {t("orders.followup.buyAgain")}
          </SubmitButton>
          <SubmitButton
            name="origin"
            value="proposal"
            variant="secondary"
            pendingText="..."
          >
            {t("orders.followup.newProposal")}
          </SubmitButton>
        </div>
        <p className="text-xs leading-relaxed text-zinc-500 sm:col-span-2">
          {t("orders.followup.buyAgainHint")}
        </p>
      </form>
      {derived.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("orders.followup.derived")}
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {derived.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200/80 px-3 py-2"
              >
                <TextLink href={`/app/requests/${r.id}`} className="min-w-0">
                  {r.productName} · {r.quantity} {r.unit}
                </TextLink>
                {r.origin && r.origin !== "manual" ? (
                  <Badge tone="brand">{t(`orders.origin.${r.origin}`)}</Badge>
                ) : null}
                <Badge
                  tone={
                    r.status === "ORDERED"
                      ? "success"
                      : r.status === "CANCELLED"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {t(`reqStatusLabel.${r.status}`)}
                </Badge>
                <span className="text-xs text-zinc-500">
                  {formatDate(r.createdAt)}
                </span>
                {r.orderId ? (
                  <TextLink
                    href={`/app/orders/${r.orderId}`}
                    className="text-xs"
                  >
                    {t("requests.viewOrder")} →
                  </TextLink>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
