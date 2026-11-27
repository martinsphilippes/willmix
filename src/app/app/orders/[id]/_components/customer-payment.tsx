import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { Order, User } from "@/lib/db/schema";
import { getStore } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import {
  customerPaymentView,
  listPaymentPlans,
} from "@/lib/services/customer-payment";
import {
  chargeCustomerAction,
  chooseOrderPaymentPlanAction,
  decideOrderPaymentPlanAction,
  saveManualChargeAction,
  syncOrderChargesAction,
} from "@/app/app/actions/customer-payment";
import { Alert, Badge, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { AsideFold } from "./aside-fold";

/*
 * Pagamento do cliente no pedido (dono, 15/11/2026; docs/CUSTOMER_PAYMENT.md):
 * a forma de pagamento escolhida (com a alçada), o vendedor, as parcelas com
 * o valor, o evento, o vencimento e o boleto de cada uma (lido do Sankhya ou
 * registrado pelo financeiro), e a cobrança ao cliente. O cliente do pedido
 * vê a forma aprovada e os boletos.
 */
export async function CustomerPaymentGate({
  user,
  order,
  notice,
  title,
  folded = false,
  t,
}: {
  user: User;
  order: Order;
  /** Título da seção (a mesma moldura das outras seções do pedido). */
  title: string;
  /**
   * Na lateral direita do pedido, recolhido (dono, 27/11/2026): abre na volta
   * de uma ação dele (?payment=, ?charges=, ?charge=) ou pela âncora.
   */
  folded?: boolean;
  /** Volta de uma ação (?payment=, ?charges=, ?charge=). */
  notice: { payment?: string; charges?: string; charge?: string };
  t: Translate;
}) {
  const view = await customerPaymentView(user, order);
  if (!view) return null;
  const store = getStore();
  const wellmix = isWellmix(user);
  const [plans, users] = await Promise.all([
    view.canChoose ? listPaymentPlans() : Promise.resolve([]),
    wellmix
      ? store.list("users", { filter: { active: true } })
      : Promise.resolve([] as User[]),
  ]);
  const staff = users
    .filter((u) => isWellmix(u))
    .sort((a, b) => a.name.localeCompare(b.name));
  const nameOf = (id: string | null | undefined) =>
    (id && users.find((u) => u.id === id)?.name) || "—";
  const plan = view.plan;
  // A forma escolhida na Nova solicitação (dono, 16/11/2026) já vem marcada
  // enquanto o pedido não tem forma.
  const requestPlanId =
    !plan && view.canChoose && order.requestId
      ? ((await store.get("requests", order.requestId))?.orderTerms?.paymentPlan
          ?.planId ?? "")
      : "";
  const money = (n: number | null) =>
    n === null
      ? "—"
      : n.toLocaleString(t.intl, {
          style: "currency",
          currency: view.currency,
        });
  const day = (iso: string | null) =>
    iso
      ? new Date(`${iso}T12:00:00`).toLocaleDateString(t.intl, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";
  const eventLabel = (event: string, days: number) => {
    const name = t(`customerPayment.event.${event}` as DictionaryKey);
    return days > 0
      ? t("customerPayment.eventDays", { event: name, days })
      : name;
  };
  const statusTone = {
    approved: "success",
    pending: "warning",
    rejected: "danger",
  } as const;

  const body = (
      <div
        className={
          folded
            ? "space-y-4"
            : "@container space-y-4 rounded-2xl border border-zinc-200 bg-white p-4"
        }
        data-customer-payment={plan?.status ?? "none"}
      >
        {notice.payment ? (
          <Alert tone="success">
            {t(`customerPayment.notice.${notice.payment}` as DictionaryKey)}
          </Alert>
        ) : null}
        {notice.charges !== undefined ? (
          <Alert tone="success">
            {t("customerPayment.notice.synced", { n: notice.charges })}
          </Alert>
        ) : null}
        {notice.charge ? (
          <Alert tone="success">
            {t(
              `customerPayment.notice.charge.${notice.charge}` as DictionaryKey,
            )}
          </Alert>
        ) : null}

        {/* A forma escolhida e a alçada. */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-zinc-500">
              {t("customerPayment.plan")}
            </p>
            <p
              className="font-semibold text-zinc-900"
              data-customer-payment-plan
            >
              {plan?.name ?? t("customerPayment.none")}
            </p>
            {wellmix ? (
              <p className="mt-0.5 text-xs text-zinc-500">
                {t("customerPayment.seller")}:{" "}
                <span data-customer-payment-seller>
                  {nameOf(view.sellerUserId)}
                </span>
                {plan?.saleNunota
                  ? ` · ${t("customerPayment.saleNunota")}: ${plan.saleNunota}`
                  : ""}
              </p>
            ) : null}
          </div>
          {plan ? (
            <Badge tone={statusTone[plan.status]}>
              <span data-customer-payment-status={plan.status}>
                {t(`customerPayment.status.${plan.status}` as DictionaryKey)}
              </span>
            </Badge>
          ) : null}
        </div>
        {plan && wellmix && plan.requiresApproval ? (
          <p className="text-xs text-zinc-600" data-customer-payment-approval>
            {t("customerPayment.approval", {
              name: nameOf(plan.approverUserId),
            })}
            {plan.decidedAt
              ? ` · ${t("customerPayment.decided", {
                  name: nameOf(plan.decidedByUserId),
                  date: day(plan.decidedAt.slice(0, 10)),
                })}`
              : ""}
            {plan.decisionNote ? ` · “${plan.decisionNote}”` : ""}
          </p>
        ) : null}
        {view.canDecide ? (
          <form
            action={decideOrderPaymentPlanAction}
            className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3"
            data-customer-payment-decide
          >
            <input type="hidden" name="orderId" value={order.id} />
            <p className="text-sm font-medium text-amber-900">
              {t("customerPayment.decideTitle")}
            </p>
            <Field label={t("customerPayment.decisionNote")}>
              <Textarea name="note" rows={2} maxLength={500} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <SubmitButton name="decision" value="approve">
                {t("customerPayment.approve")}
              </SubmitButton>
              <SubmitButton name="decision" value="reject" variant="secondary">
                {t("customerPayment.reject")}
              </SubmitButton>
            </div>
          </form>
        ) : null}

        {/* As parcelas e os boletos. */}
        {plan ? (
          <div className="overflow-x-auto">
            <p
              className="mb-2 text-xs text-zinc-500"
              data-customer-payment-hold-hint
            >
              {t("customerPayment.holdHint")}
            </p>
            {view.sellTotal === null ? (
              <p className="mb-2 text-xs text-amber-800">
                {t("customerPayment.noSale")}
              </p>
            ) : null}
            <table
              className="w-full min-w-[40rem] text-sm"
              data-customer-payment-installments
            >
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="py-1.5 pr-2 font-medium">
                    {t("customerPayment.col.installment")}
                  </th>
                  <th className="py-1.5 pr-2 font-medium">
                    {t("customerPayment.col.when")}
                  </th>
                  <th className="py-1.5 pr-2 text-right font-medium">
                    {t("customerPayment.col.amount")}
                  </th>
                  <th className="py-1.5 pr-2 font-medium">
                    {t("customerPayment.col.due")}
                  </th>
                  <th className="py-1.5 font-medium">
                    {t("customerPayment.col.boleto")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {view.installments.map((row) => (
                  <tr
                    key={row.index}
                    data-customer-installment={row.index}
                    data-state={row.state}
                    className="align-top"
                  >
                    <td className="py-2 pr-2">
                      <span className="font-medium text-zinc-900">
                        {row.index}
                      </span>{" "}
                      <span className="text-zinc-500">
                        ({row.percent.toLocaleString(t.intl)}%)
                      </span>
                    </td>
                    <td className="py-2 pr-2">
                      {eventLabel(row.event, row.days)}
                      <span className="block text-xs text-zinc-500">
                        {row.eventDate
                          ? t("customerPayment.eventOn", {
                              date: day(row.eventDate),
                            })
                          : t("customerPayment.eventPending")}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {row.percent > 0 ? money(row.amount) : "—"}
                      {row.interest ? (
                        <span
                          className="block text-xs text-zinc-500"
                          data-customer-installment-interest
                        >
                          {t("customerPayment.interest", {
                            value: money(row.interest),
                            rate: (
                              plan.monthlyInterestPercent ?? 0
                            ).toLocaleString(t.intl),
                          })}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2">{day(row.dueDate)}</td>
                    <td className="py-2">
                      <span
                        className="text-xs font-medium"
                        data-customer-installment-state
                      >
                        {t(
                          `customerPayment.state.${row.state}` as DictionaryKey,
                        )}
                      </span>
                      {wellmix && plan.releases?.[String(row.index)] ? (
                        <span
                          className="block text-xs text-amber-700"
                          data-customer-installment-released
                        >
                          {t("customerPayment.released", {
                            date: day(
                              plan.releases[String(row.index)].at.slice(0, 10),
                            ),
                          })}
                        </span>
                      ) : null}
                      {row.charge ? (
                        <div className="mt-1 space-y-0.5 text-xs text-zinc-700">
                          {row.charge.barcode ? (
                            <p
                              className="break-all font-mono"
                              data-customer-installment-barcode
                            >
                              {row.charge.barcode}
                            </p>
                          ) : null}
                          {row.charge.nossoNumero ? (
                            <p>
                              {t("customerPayment.nossoNumero")}:{" "}
                              {row.charge.nossoNumero}
                            </p>
                          ) : null}
                          {row.charge.amount !== null ? (
                            <p>
                              {t("customerPayment.boletoAmount")}:{" "}
                              {money(row.charge.amount)}
                            </p>
                          ) : null}
                          {row.charge.nufin ? (
                            <p className="text-zinc-500">
                              NUFIN {row.charge.nufin}
                            </p>
                          ) : null}
                          {row.charge.documentId ? (
                            <a
                              href={`/api/files/${row.charge.documentId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-brand-700 underline underline-offset-2"
                            >
                              {t("customerPayment.pdf")}
                            </a>
                          ) : null}
                          {row.charge.paidAt ? (
                            <p className="text-emerald-700">
                              {t("customerPayment.paidOn", {
                                date: day(row.charge.paidAt),
                              })}
                            </p>
                          ) : null}
                          {wellmix && row.charge.chargedAt ? (
                            <p className="text-zinc-500">
                              {t("customerPayment.chargedOn", {
                                date: day(row.charge.chargedAt.slice(0, 10)),
                              })}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {view.canCharge &&
                      row.charge &&
                      row.charge.status !== "paid" ? (
                        <form action={chargeCustomerAction} className="mt-1">
                          <input
                            type="hidden"
                            name="orderId"
                            value={order.id}
                          />
                          <input type="hidden" name="index" value={row.index} />
                          <SubmitButton
                            variant="secondary"
                            data-customer-installment-charge={row.index}
                          >
                            {t("customerPayment.charge")}
                          </SubmitButton>
                        </form>
                      ) : null}
                      {view.canManageCharges && row.percent > 0 ? (
                        <details className="mt-1 text-xs">
                          <summary className="cursor-pointer text-brand-700">
                            {t("customerPayment.manual")}
                          </summary>
                          <form
                            action={saveManualChargeAction}
                            className="mt-2 grid gap-2 @md:grid-cols-2"
                            data-customer-installment-manual={row.index}
                          >
                            <input
                              type="hidden"
                              name="orderId"
                              value={order.id}
                            />
                            <input
                              type="hidden"
                              name="index"
                              value={row.index}
                            />
                            <Field label={t("customerPayment.col.due")}>
                              <Input
                                type="date"
                                name="dueDate"
                                defaultValue={
                                  row.charge?.dueDate ?? row.dueDate ?? ""
                                }
                              />
                            </Field>
                            <Field label={t("customerPayment.boletoAmount")}>
                              <Input
                                name="amount"
                                inputMode="decimal"
                                defaultValue={
                                  row.charge?.amount ?? row.amount ?? ""
                                }
                              />
                            </Field>
                            <Field label={t("customerPayment.barcode")}>
                              <Input
                                name="barcode"
                                maxLength={120}
                                defaultValue={row.charge?.barcode ?? ""}
                              />
                            </Field>
                            <Field label={t("customerPayment.nossoNumero")}>
                              <Input
                                name="nossoNumero"
                                maxLength={40}
                                defaultValue={row.charge?.nossoNumero ?? ""}
                              />
                            </Field>
                            <Field label={t("customerPayment.pdf")}>
                              <Input
                                type="file"
                                name="file"
                                accept="application/pdf,image/*"
                              />
                            </Field>
                            <label className="flex items-center gap-2 self-end text-sm">
                              <input
                                type="checkbox"
                                name="paid"
                                defaultChecked={row.charge?.status === "paid"}
                              />
                              {t("customerPayment.markPaid")}
                            </label>
                            <div className="@md:col-span-2">
                              <SubmitButton variant="secondary">
                                {t("common.save")}
                              </SubmitButton>
                            </div>
                          </form>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {view.canManageCharges ? (
          <form
            action={syncOrderChargesAction}
            className="flex flex-wrap items-center gap-2"
            data-customer-payment-sync
          >
            <input type="hidden" name="orderId" value={order.id} />
            <SubmitButton variant="secondary">
              {t("customerPayment.sync")}
            </SubmitButton>
            <span className="text-xs text-zinc-500">
              {plan?.saleNunota
                ? t("customerPayment.syncHint", { nunota: plan.saleNunota })
                : t("customerPayment.syncNoNunota")}
            </span>
          </form>
        ) : null}

        {/* Escolher ou trocar a forma, o vendedor e o NUNOTA da venda. */}
        {view.canChoose ? (
          <details
            open={!plan}
            className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-zinc-800">
              {plan ? t("customerPayment.change") : t("customerPayment.choose")}
            </summary>
            <form
              action={chooseOrderPaymentPlanAction}
              className="mt-3 grid gap-3 @2xl:grid-cols-3"
              data-customer-payment-choose
            >
              <input type="hidden" name="orderId" value={order.id} />
              <Field label={t("customerPayment.plan")}>
                <Select
                  name="planId"
                  required
                  defaultValue={plan?.planId ?? requestPlanId}
                >
                  <option value="">{t("customerPayment.choosePlan")}</option>
                  {plans
                    .filter((p) => p.active || p.id === plan?.planId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.requiresApproval
                          ? ` (${t("customerPayment.needsApproval")})`
                          : ""}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={t("customerPayment.seller")}>
                <Select
                  name="sellerUserId"
                  defaultValue={view.sellerUserId ?? ""}
                >
                  <option value="">{t("customerPayment.noSeller")}</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t("customerPayment.saleNunota")}
                hint={t("customerPayment.saleNunotaHint")}
              >
                <Input
                  name="saleNunota"
                  inputMode="numeric"
                  pattern="\d{1,10}"
                  defaultValue={plan?.saleNunota ?? ""}
                />
              </Field>
              <div className="@2xl:col-span-3">
                <SubmitButton>{t("common.save")}</SubmitButton>
                {(order.customerCharges ?? []).length ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("customerPayment.lockedByCharges")}
                  </p>
                ) : null}
              </div>
            </form>
          </details>
        ) : null}
      </div>
  );
  if (folded) {
    const returned =
      !!notice.payment ||
      notice.charges !== undefined ||
      !!notice.charge;
    return (
      <AsideFold id="customer-payment" title={title} open={returned}>
        {body}
      </AsideFold>
    );
  }
  return (
    <section
      id="customer-payment"
      className="mt-6 min-w-0 scroll-mt-24"
      data-order-section="customer-payment"
    >
      <h2 className="mb-2 text-base font-semibold text-brand-700">{title}</h2>
      {body}
    </section>
  );
}
