import { headers } from "next/headers";
import type { Order } from "@/lib/db";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { parseTerms, sameTerms } from "@/lib/supplier-terms";
import { supplierPaymentView } from "@/lib/services/supplier-payment";
import { orderPayable } from "@/lib/services/supplier-terms";
import {
  applySupplierTermsAction,
  markSupplierPaymentPaidAction,
} from "@/app/app/actions/supplier-terms";
import { SupplierPaymentPanel } from "./supplier-payment-panel";
import { SubmitButton } from "./submit-button";
import {
  INSTALLMENT_TONE,
  describeTerms,
  formatDay,
  termWhen,
} from "./supplier-terms-text";
import {
  Alert,
  Badge,
  Card,
  Table,
  Td,
  TextLink,
  Th,
  Field,
  Input,
  cx,
  formatDate,
  formatMoney,
} from "./ui";

/**
 * Pagamento ao fornecedor no pedido, fora do fluxo das etapas: condição
 * combinada, parcelas com vencimento e situação e, para a Wellmix, o pagamento
 * da parcela da vez. O fornecedor do pedido vê a previsão (sem os dados do
 * banco nem as ações).
 */
export async function SupplierPaymentCard({
  order,
  t,
  wellmix,
  notice,
}: {
  order: Order;
  t: Translate;
  wellmix: boolean;
  /** Aviso de sucesso vindo da ação (pagamento registrado, condição aplicada). */
  notice?: string | null;
}) {
  let view = null;
  if (wellmix) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "https";
    view = await supplierPaymentView(
      order,
      `${proto}://${host}/app/orders/${order.id}`,
    );
  }
  const payable = view
    ? {
        schedule: view.schedule,
        source: view.termsSource,
        supplier: view.supplier,
      }
    : await orderPayable(order);
  const { schedule, source, supplier } = payable;
  const cancelled = order.status === "CANCELLED";
  const supplierTerms = parseTerms(supplier?.paymentTerms ?? null);
  // Com dinheiro já lançado, a condição do pedido não muda (o servidor recusa).
  const differs =
    wellmix &&
    !schedule.legacySettled &&
    schedule.paid + schedule.requested === 0 &&
    source === "order" &&
    !!supplierTerms &&
    !sameTerms(schedule.terms, supplierTerms);
  const next = view?.installment ?? null;
  // Abre sozinho só quando a parcela da vez vence em breve ou já venceu.
  const urgent =
    !!next && (next.status === "overdue" || next.status === "due_soon");
  const money = (n: number) => formatMoney(n, schedule.currency, t);

  return (
    <Card
      className="md:col-span-2"
      title={
        <span id="supplier-payment" className="scroll-mt-24">
          {t("supplierTerms.card")}
        </span>
      }
      actions={
        wellmix ? (
          <TextLink href="/app/payables" className="text-xs">
            {t("nav.payables")}
          </TextLink>
        ) : null
      }
    >
      <div className="space-y-3" data-supplier-payment>
        {notice ? <Alert tone="success">{notice}</Alert> : null}
        <p className="text-xs text-zinc-500">
          {wellmix
            ? t("supplierTerms.offFlow")
            : t("supplierTerms.supplierHint")}
        </p>

        {schedule.terms ? (
          <p className="text-sm text-zinc-700">
            <span className="font-medium text-zinc-500">
              {t("supplierTerms.condition")}:
            </span>{" "}
            <span className="font-semibold text-zinc-900" data-terms-text>
              {describeTerms(t, schedule.terms)}
            </span>{" "}
            {source ? (
              <span className="text-xs text-zinc-500">
                ({t(`supplierTerms.source.${source}`)})
              </span>
            ) : null}
            {wellmix ? (
              <>
                {" · "}
                <TextLink
                  href={`/app/parties/${order.supplierId}#payment-terms`}
                  className="text-xs"
                >
                  {t("supplierTerms.edit")}
                </TextLink>
              </>
            ) : null}
          </p>
        ) : schedule.legacySettled ? null : (
          <p
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            data-terms-missing
          >
            {t("supplierTerms.missing")}{" "}
            {wellmix ? (
              <TextLink href={`/app/parties/${order.supplierId}#payment-terms`}>
                {t("supplierTerms.configure")}
              </TextLink>
            ) : null}
          </p>
        )}

        {differs && supplierTerms ? (
          <form
            action={applySupplierTermsAction}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700"
          >
            <input type="hidden" name="orderId" value={order.id} />
            <span>
              {t("supplierTerms.applyHint", {
                terms: describeTerms(t, supplierTerms),
              })}
            </span>
            <SubmitButton variant="secondary">
              {t("supplierTerms.applyCurrent")}
            </SubmitButton>
          </form>
        ) : null}

        {schedule.total === null ? (
          <p className="text-sm text-zinc-500">{t("supplierPay.noFob")}</p>
        ) : null}

        {schedule.installments.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("supplierTerms.col.installment")}</Th>
                <Th>{t("supplierTerms.col.due")}</Th>
                <Th className="text-right">{t("supplierTerms.col.amount")}</Th>
                <Th>{t("supplierTerms.col.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {schedule.installments.map((i) => (
                <tr
                  key={i.index}
                  data-installment={i.index}
                  data-status={i.status}
                >
                  <Td className="whitespace-nowrap">
                    <span className="font-medium text-zinc-900">
                      {i.index}/{i.count}
                    </span>{" "}
                    <span className="text-xs text-zinc-500">
                      {i.percent.toLocaleString(t.intl, {
                        maximumFractionDigits: 2,
                      })}
                      %
                    </span>
                  </Td>
                  <Td>
                    {i.dueDate ? (
                      <>
                        <span
                          className={cx(
                            "whitespace-nowrap tabular-nums",
                            i.status === "overdue" &&
                              "font-semibold text-red-700",
                          )}
                        >
                          {formatDay(i.dueDate, t)}
                        </span>
                        <span className="block text-xs text-zinc-500">
                          {termWhen(t, i.base, i.days)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-600">
                        {t("supplierTerms.waiting", {
                          when: termWhen(t, i.base, i.days),
                        })}
                      </span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    <span className="font-semibold text-zinc-900">
                      {money(i.amount)}
                    </span>
                    {i.paid > 0 && i.paid < i.amount - 0.005 ? (
                      <span className="block text-xs text-zinc-500">
                        {t("supplierTerms.partial", { paid: money(i.paid) })}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={INSTALLMENT_TONE[i.status]}>
                      {t(`supplierTerms.status.${i.status}` as DictionaryKey)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}

        {schedule.total !== null ? (
          <p className="text-xs tabular-nums text-zinc-600" data-payment-totals>
            {t("supplierTerms.totals", {
              paid: money(schedule.paid),
              requested: money(schedule.requested),
              open: money(schedule.open),
            })}
          </p>
        ) : null}

        {schedule.legacySettled ? (
          <p
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            data-legacy-settled
          >
            {t("supplierTerms.legacySettled")}
          </p>
        ) : null}

        {/* Pedidos ao banco/financeiro ainda sem "pago": marcar aqui, em vez de
            registrar outro pagamento (contaria em dobro). */}
        {view && view.pending.length ? (
          <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
            <p className="text-sm font-semibold text-sky-900">
              {t("supplierTerms.pendingTitle")}
            </p>
            <p className="text-xs text-sky-900/80">
              {t("supplierTerms.pendingHint")}
            </p>
            <ul className="space-y-2">
              {view.pending.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-sky-100 bg-white p-2"
                  data-pending-payment={p.id}
                >
                  <p className="text-sm">
                    <span className="font-semibold text-zinc-900">
                      {formatMoney(p.amount, p.currency, t)}
                    </span>{" "}
                    <span className="text-xs text-zinc-500">
                      {p.note ? `${p.note} · ` : ""}
                      {formatDate(p.createdAt, t)}
                    </span>
                  </p>
                  {/* Também em pedido cancelado: o dinheiro que já saiu fica registrado. */}
                  {wellmix ? (
                    <form
                      action={markSupplierPaymentPaidAction}
                      className="mt-1.5 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="paymentId" value={p.id} />
                      <div className="w-32 min-w-0">
                        {/* Câmbio = R$ por 1 unidade da moeda do pagamento (como a PTAX). */}
                        <Field label={t("finance.fx")}>
                          <Input
                            name="fxRate"
                            type="number"
                            step="any"
                            placeholder={t("finance.fx.unitHint", {
                              currency: p.currency,
                            })}
                          />
                        </Field>
                      </div>
                      <div className="min-w-48 flex-1">
                        <Field label={t("requests.payment.proof")}>
                          <Input name="proof" type="file" />
                        </Field>
                      </div>
                      <SubmitButton variant="secondary">
                        {t("supplierTerms.markPaid")}
                      </SubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {view && !cancelled && view.due !== null && view.due > 0 ? (
          /* Pagar a parcela da vez: aberto quando vence em breve ou já venceu. */
          <details
            open={urgent}
            className="group rounded-xl border border-zinc-200 bg-white"
            data-pay-installment={next?.index ?? "balance"}
          >
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-brand-800">
              {next
                ? t("supplierTerms.payNow", {
                    n: next.index,
                    count: next.count,
                  })
                : t("supplierTerms.payBalance")}{" "}
              · {money(view.due)}
              {next?.dueDate ? (
                <span className="font-normal text-zinc-500">
                  {" "}
                  · {formatDay(next.dueDate, t)}
                </span>
              ) : null}
            </summary>
            <div className="border-t border-zinc-100 px-3 pb-3">
              <SupplierPaymentPanel order={order} t={t} view={view} />
            </div>
          </details>
        ) : view && !cancelled ? (
          /* Nada a pagar agora (ou FOB desconhecido): o registro de um
             pagamento feito por fora continua à mão. */
          <>
            {schedule.total !== null && !schedule.legacySettled ? (
              <p className="text-xs text-emerald-700">
                {t("supplierTerms.settled")}
              </p>
            ) : null}
            <SupplierPaymentPanel order={order} t={t} view={view} manualOnly />
          </>
        ) : null}
      </div>
    </Card>
  );
}
