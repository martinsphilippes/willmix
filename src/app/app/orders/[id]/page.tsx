import type { ReactNode } from "react";
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
  type Document,
  type Requirement,
  type User,
} from "@/lib/db";
import { canSubmitRequirement, loadOrderProgress } from "@/lib/workflow/engine";
import { loadOrderFinance } from "@/lib/services/finance";
import { getT } from "@/i18n/server";
import { requirementLabel, type Translate } from "@/i18n";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Empty,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  StepDot,
  Textarea,
  TextLink,
  cx,
  formatDate,
  formatMoney,
  isOverdue,
  linkClass,
  rowClass,
  stageTone,
} from "@/components/ui";
import { RequirementForm } from "@/components/requirement-form";
import { SubmitButton } from "@/components/submit-button";
import {
  assignPartnerAction,
  confirmSupplierPaymentAction,
  createPenaltyAction,
  registerCustomerPaymentAction,
  registerSupplierPaymentAction,
  unblockStageAction,
} from "../../actions";

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/app/orders/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { error } = await searchParams;
  const progress = await loadOrderProgress(id);
  if (!progress || !canViewOrder(user, progress.order)) notFound();
  const { order, stages, requirements } = progress;
  const t = await getT();
  const store = getStore();
  const wellmix = isWellmix(user);

  const [parties, items, documents, payments, penalties, users] =
    await Promise.all([
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
  const finance =
    wellmix || user.role === "customer" ? await loadOrderFinance(order) : null;
  const visiblePayments = payments.filter((p) =>
    wellmix
      ? true
      : user.role === "customer"
        ? p.direction === "customer_in"
        : user.role === "supplier"
          ? p.direction === "supplier_out"
          : false,
  );

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
          </span>
        }
      />
      {error ? (
        <Alert tone="danger">
          {t("common.error")} ({error})
        </Alert>
      ) : null}
      {currentStage?.status === "blocked" ? (
        <div className="mb-4">
          <Alert tone="warning">
            <strong>{t("orders.blocked")}:</strong> {currentStage.blockReason}
          </Alert>
        </div>
      ) : null}
      {order.status === "CLOSED" ? (
        <Alert tone="success">{t("orders.closed")}</Alert>
      ) : null}

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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

          {stages
            .filter(
              (s) => s.key !== "CLOSED" && (wellmix || s.status !== "pending"),
            )
            .map((stage) => {
              const reqs = requirements.filter((r) => r.stageId === stage.id);
              const open =
                stage.status === "active" || stage.status === "blocked";
              return (
                <Card
                  key={stage.id}
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
              );
            })}
        </div>

        <div className="space-y-6">
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
              ]}
            />
            {wellmix && order.erpSyncStatus === "pending" ? (
              <p className="mt-3 text-xs text-amber-700">
                {t("orders.erp.pending")}
              </p>
            ) : null}
          </Card>

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
                    {p.direction === "supplier_out" &&
                    p.status === "confirmed" &&
                    (user.role === "supplier" || wellmix) ? (
                      <form
                        action={confirmSupplierPaymentAction}
                        className="mt-2"
                      >
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
                    className={cx(
                      rowClass,
                      "flex items-center justify-between gap-2 rounded-lg px-2 py-1",
                    )}
                  >
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
                  </li>
                ))}
              </ul>
            )}
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
}) {
  const canAct =
    open &&
    r.status !== "done" &&
    canSubmitRequirement(user, order as never, r);
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
            {r.note ? ` · ${r.note}` : ""}
          </p>
        ) : r.note ? (
          <p className="mt-1 text-xs text-amber-700">{r.note}</p>
        ) : null}
      </div>
      {canAct ? (
        <div className="shrink-0">
          <RequirementForm requirement={r} orderId={order.id} t={t} />
        </div>
      ) : null}
    </li>
  );
}
