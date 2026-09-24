import Link from "next/link";
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
  type Stage,
  type User,
} from "@/lib/db";
import { canSubmitRequirement, loadOrderProgress } from "@/lib/workflow/engine";
import { getT } from "@/i18n/server";
import { requirementLabel, type Translate } from "@/i18n";
import {
  Alert,
  Badge,
  Card,
  DescriptionList,
  Field,
  Input,
  PageHeader,
  Progress,
  Select,
  Textarea,
  formatDate,
  formatMoney,
  isOverdue,
} from "@/components/ui";
import { RequirementForm } from "@/components/requirement-form";
import { SubmitButton } from "@/components/submit-button";
import {
  assignPartnerAction,
  confirmSupplierPaymentAction,
  createPenaltyAction,
  registerSupplierPaymentAction,
  unblockStageAction,
} from "../../actions";

type Tone = "success" | "danger" | "info" | "neutral";
const stageTone = (s: Stage): Tone =>
  s.status === "done"
    ? "success"
    : s.status === "blocked"
      ? "danger"
      : s.status === "active"
        ? "info"
        : "neutral";

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
              tone={
                order.status === "CLOSED"
                  ? "success"
                  : currentStage?.status === "blocked"
                    ? "danger"
                    : "info"
              }
            >
              {t(`stage.${order.status}`)}
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
          <Alert tone="danger">
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
            <ol className="grid gap-2 sm:grid-cols-2">
              {stages.map((s) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${s.status === "done" ? "bg-emerald-500 text-white" : s.status === "active" ? "bg-blue-500 text-white" : s.status === "blocked" ? "bg-red-500 text-white" : "bg-zinc-200 text-zinc-500"}`}
                  >
                    {s.status === "done"
                      ? "✓"
                      : s.status === "blocked"
                        ? "!"
                        : s.sequence + 1}
                  </span>
                  <a
                    href={`#stage-${s.id}`}
                    className={
                      s.status === "pending" ? "text-zinc-400" : "text-zinc-900"
                    }
                  >
                    {t(`stage.${s.key}`)}
                  </a>
                  {s.status === "active" || s.status === "blocked" ? (
                    <span className="ml-auto text-xs text-zinc-500">
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
                  className={open ? "border-blue-200" : ""}
                  title={
                    <span
                      id={`stage-${stage.id}`}
                      className="flex flex-wrap items-center gap-2"
                    >
                      {t(`stage.${stage.key}`)}
                      <Badge tone={stageTone(stage)}>
                        {t(`stageStatus.${stage.status}`)}
                      </Badge>
                      {open && stage.dueAt ? (
                        <span
                          className={`text-xs font-normal ${isOverdue(stage.dueAt) ? "text-red-600" : "text-zinc-500"}`}
                        >
                          {t("common.due")}: {formatDate(stage.dueAt)}
                        </span>
                      ) : null}
                    </span>
                  }
                  actions={
                    open ? (
                      <span className="flex items-center gap-2 text-xs text-zinc-500">
                        {t("common.responsible")}:{" "}
                        {t(`role.${stage.responsibleRole}`)}
                        <span className="w-24">
                          <Progress percent={stage.percent} />
                        </span>
                      </span>
                    ) : null
                  }
                >
                  <p className="mb-2 text-xs leading-relaxed text-zinc-500">
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
                        {t("stageStatus.active")}
                      </SubmitButton>
                    </form>
                  ) : null}
                  {stage.key === "SUPPLIER_PAYMENT" && open && wellmix ? (
                    <form
                      action={registerSupplierPaymentAction}
                      className="mt-4 grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-4"
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
                      <Field label="Câmbio">
                        <Input name="fxRate" type="number" step="0.0001" />
                      </Field>
                      <Field label={t("requests.payment.proof")}>
                        <Input name="proof" type="file" />
                      </Field>
                      <div className="sm:col-span-4">
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
                          <Badge tone="warning">{order.erpSyncStatus}</Badge>
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
                    <Field label={t(`party.${type}`)}>
                      <Select name="partyId" defaultValue={order[field] ?? ""}>
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
                    <SubmitButton variant="secondary">
                      {t("orders.assign")}
                    </SubmitButton>
                  </form>
                ))}
              </div>
            </Card>
          ) : null}

          {visiblePayments.length > 0 ? (
            <Card title={t("orders.payments")}>
              <ul className="space-y-2 text-sm">
                {visiblePayments.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-md border border-zinc-100 p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {formatMoney(p.amount, p.currency)}
                      </span>
                      <Badge
                        tone={p.status === "pending" ? "warning" : "success"}
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500">
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
                        className="text-xs underline"
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
              <p className="text-sm text-zinc-500">{t("common.none")}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {visibleDocs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <a
                      href={`/api/files/${d.id}`}
                      className="truncate underline"
                      target="_blank"
                    >
                      {d.name}
                    </a>
                    <span className="shrink-0 text-xs text-zinc-400">
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
                <p className="text-sm text-zinc-500">{t("penalties.empty")}</p>
              ) : null}
              <ul className="space-y-2 text-sm">
                {penalties.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-md border border-zinc-100 p-2"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {formatMoney(p.amount, p.currency)}
                      </span>
                      <Badge tone={p.status === "open" ? "danger" : "neutral"}>
                        {p.status}
                      </Badge>
                    </div>
                    <p className="text-zinc-700">{p.reason}</p>
                    <p className="text-xs text-zinc-500">
                      {t("orders.penalty.responsible")}:{" "}
                      {partyName(p.responsiblePartyId)}
                    </p>
                  </li>
                ))}
              </ul>
              {wellmix ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium">
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
    <li className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-zinc-900">
            {requirementLabel(t, r)}
          </span>
          {!r.required ? (
            <span className="text-xs text-zinc-400">
              ({t("reqStatus.optional")})
            </span>
          ) : null}
          <Badge tone={tone}>{t(`reqStatus.${r.status}`)}</Badge>
          <span className="text-xs text-zinc-400">{t(`role.${r.role}`)}</span>
        </div>
        {r.status !== "pending" ? (
          <p className="mt-1 text-xs text-zinc-500">
            {r.type !== "file" &&
            r.type !== "photo" &&
            r.type !== "confirm" &&
            r.value ? (
              <span className="mr-2 text-zinc-800">{r.value}</span>
            ) : null}
            {doc ? (
              <Link
                href={`/api/files/${doc.id}`}
                target="_blank"
                className="mr-2 underline"
              >
                {doc.name} (v{doc.version})
              </Link>
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
