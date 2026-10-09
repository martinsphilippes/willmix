import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { ORDER_CANCEL_REASONS, type Order } from "@/lib/db";
import {
  cancelOrderAction,
  rejectCancelRequestAction,
  requestOrderCancelAction,
  updateCancelSettlementAction,
} from "@/app/app/actions/order-cancel";
import { Alert, Card, Field, Select, Textarea, cx, formatDate } from "./ui";
import { SubmitButton } from "./submit-button";

/*
 * Cancelamento na tela do pedido:
 * - CancelledBanner: para todos que veem o pedido cancelado (acerto financeiro
 *   só Wellmix e cliente; a Wellmix edita).
 * - CancelRequestAlert: Wellmix vê o pedido de cancelamento do cliente.
 * - AdminCancelCard: só administrador, em qualquer etapa.
 * - CustomerCancelCard: cliente pede o cancelamento até a produção começar.
 */

export function CancelledBanner({
  t,
  order,
  byName,
  wellmix,
  admin,
  customer,
}: {
  t: Translate;
  order: Order;
  byName: string;
  wellmix: boolean;
  admin: boolean;
  customer: boolean;
}) {
  if (order.status !== "CANCELLED") return null;
  const stage = order.cancelStageKey
    ? t(`stage.${order.cancelStageKey}` as DictionaryKey)
    : null;
  return (
    <div
      id="cancel"
      className={cx(
        "mb-3 grid items-start gap-3",
        (admin || wellmix || customer) && "lg:grid-cols-2",
      )}
      data-order-cancelled
    >
      <Alert tone="danger">
        <strong>
          {t("cancel.banner", {
            date: formatDate(order.cancelledAt, t),
            user: byName,
          })}
        </strong>
        {stage ? ` ${t("cancel.bannerStage", { stage })}` : null}
        {order.cancelReason ? (
          <span className="block">
            {t("cancel.reason")}:{" "}
            {t(`cancel.reason.${order.cancelReason}` as DictionaryKey)}
            {order.cancelNote ? ` · ${order.cancelNote}` : null}
          </span>
        ) : null}
        {wellmix && order.erpNumber ? (
          <span className="block">
            {t("cancel.erpWarning", { erp: order.erpNumber })}
          </span>
        ) : null}
      </Alert>
      {admin ? (
        <Card title={t("cancel.settlementLabel")}>
          <form action={updateCancelSettlementAction} className="space-y-2">
            <input type="hidden" name="orderId" value={order.id} />
            <Field
              label={t("cancel.settlementLabel")}
              hint={t("cancel.settlementHint")}
            >
              <Textarea
                name="settlement"
                maxLength={2000}
                rows={3}
                defaultValue={order.cancelSettlement ?? ""}
              />
            </Field>
            <SubmitButton>{t("cancel.settlementSave")}</SubmitButton>
          </form>
        </Card>
      ) : wellmix || customer ? (
        <Alert tone="info">
          <strong>{t("cancel.settlementLabel")}:</strong>{" "}
          {order.cancelSettlement || t("cancel.settlementEmpty")}
        </Alert>
      ) : null}
    </div>
  );
}

export function CancelRequestAlert({
  t,
  order,
  admin,
}: {
  t: Translate;
  order: Order;
  admin: boolean;
}) {
  if (order.status === "CANCELLED" || order.cancelRequestStatus !== "requested")
    return null;
  return (
    <div id="cancel" className="mb-3" data-cancel-request>
      <Alert tone="warning">
        <strong>{t("cancel.request.wellmixTitle")}</strong>
        <span className="block">
          {t("cancel.request.wellmixBody", {
            date: formatDate(order.cancelRequestedAt, t),
            reason: order.cancelRequestReason ?? "—",
          })}
        </span>
        {admin ? (
          <form
            action={rejectCancelRequestAction}
            className="mt-2 flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="orderId" value={order.id} />
            <div className="min-w-0 max-w-2xl flex-1 basis-64">
              <Field label={t("cancel.request.response")}>
                <Textarea
                  name="response"
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={2}
                  className="bg-white"
                />
              </Field>
            </div>
            <SubmitButton variant="secondary">
              {t("cancel.request.reject")}
            </SubmitButton>
          </form>
        ) : null}
      </Alert>
    </div>
  );
}

export function AdminCancelCard({
  t,
  order,
  money,
}: {
  t: Translate;
  order: Order;
  money: { received: string; paid: string } | null;
}) {
  if (order.status === "CANCELLED") return null;
  return (
    <Card title={t("cancel.title")}>
      <form action={cancelOrderAction} className="space-y-2" data-order-cancel>
        <input type="hidden" name="orderId" value={order.id} />
        <p className="text-xs text-zinc-500">{t("cancel.hint")}</p>
        {money ? (
          <p className="text-sm text-zinc-700">{t("cancel.money", money)}</p>
        ) : null}
        <Field label={t("cancel.reason")}>
          <Select
            name="reason"
            required
            defaultValue={
              order.cancelRequestStatus === "requested"
                ? "customer_withdrew"
                : ""
            }
          >
            <option value="" disabled>
              —
            </option>
            {ORDER_CANCEL_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`cancel.reason.${r}` as DictionaryKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("cancel.note")}>
          <Textarea name="note" maxLength={1000} rows={2} />
        </Field>
        <Field label={t("cancel.settlement")} hint={t("cancel.settlementHint")}>
          <Textarea name="settlement" maxLength={2000} rows={2} />
        </Field>
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="confirm"
            value="1"
            required
            className="mt-0.5"
          />
          <span>{t("cancel.confirm")}</span>
        </label>
        <SubmitButton variant="danger">{t("cancel.submit")}</SubmitButton>
      </form>
    </Card>
  );
}

export function CustomerCancelCard({
  t,
  order,
  canRequest,
}: {
  t: Translate;
  order: Order;
  canRequest: boolean;
}) {
  if (order.status === "CANCELLED" || order.status === "CLOSED") return null;
  const status = order.cancelRequestStatus ?? null;
  if (status === "requested")
    return (
      <Card title={t("cancel.request.title")}>
        <p className="text-sm text-zinc-700" data-cancel-pending>
          {t("cancel.request.pending", {
            date: formatDate(order.cancelRequestedAt, t),
          })}
        </p>
      </Card>
    );
  return (
    <Card title={t("cancel.request.title")}>
      <div className="space-y-2">
        {status === "rejected" ? (
          <Alert tone="warning">
            {t("cancel.request.rejected", {
              response: order.cancelRequestResponse ?? "—",
            })}
          </Alert>
        ) : null}
        {canRequest ? (
          <form
            action={requestOrderCancelAction}
            className="space-y-2"
            data-cancel-request-form
          >
            <input type="hidden" name="orderId" value={order.id} />
            <p className="text-xs text-zinc-500">{t("cancel.request.hint")}</p>
            <Field label={t("cancel.request.reason")}>
              <Textarea
                name="reason"
                required
                minLength={3}
                maxLength={1000}
                rows={2}
              />
            </Field>
            <SubmitButton variant="secondary">
              {t("cancel.request.submit")}
            </SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-zinc-600">
            {t("cancel.request.closedWindow")}
          </p>
        )}
      </div>
    </Card>
  );
}
