import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canViewOrder,
  canViewRequest,
  isWellmix,
} from "@/lib/auth/permissions";
import { canDeleteRequest } from "@/lib/services/requests";
import {
  cancelledOrderIds,
  requestDisplayStatus,
  requestStatusTone,
} from "@/lib/services/order-status";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
} from "@/components/ui";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SubmitButton } from "@/components/submit-button";
import { deleteRequestsAction } from "../../../actions/requests";
import type { DictionaryKey } from "@/i18n/dictionaries";

/*
 * Lote de solicitações: os produtos pedidos juntos (mesmo groupId) numa
 * página só. Cada produto segue com a própria cotação, fornecedor e pedido;
 * daqui se abre cada um. Mesmo isolamento da lista: só aparece o que o
 * usuário pode ver (canViewRequest); nada visível = 404.
 */
export default async function RequestBatchPage({
  params,
  searchParams,
}: PageProps<"/app/requests/batch/[groupId]">) {
  const { groupId } = await params;
  const { created, deleted, skipped, error } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(isWellmix(user) || user.role === "customer")) redirect("/app");
  const t = await getT();
  const store = getStore();
  const rows = (
    await store.list("requests", {
      filter: { groupId },
      orderBy: "createdAt",
    })
  ).filter((r) => canViewRequest(user, r));
  if (!rows.length) notFound();

  const orderIds = rows
    .map((r) => r.orderId)
    .filter((id): id is string => !!id);
  const [cancelled, orders, customer] = await Promise.all([
    cancelledOrderIds(orderIds),
    orderIds.length
      ? store.list("orders", { filter: { id: orderIds } })
      : Promise.resolve([]),
    isWellmix(user)
      ? store.get("parties", rows[0].customerId)
      : Promise.resolve(null),
  ]);
  const deletable = rows.filter((r) => canDeleteRequest(user, r));
  const count = (v: string | string[] | undefined) =>
    typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0;
  const createdCount = count(created);
  // Mesmas mensagens de erro da lista (lote criado com falha depois, exclusão).
  const errorText = (code: string) => {
    for (const prefix of ["reqBatch.error.", "reqDelete.error."]) {
      const key = `${prefix}${code}` as DictionaryKey;
      if (t(key) !== key) return t(key);
    }
    return t("common.error");
  };

  return (
    <>
      <PageHeader
        help={{ body: "help.requests.body", steps: "help.requests.steps" }}
        t={t}
        title={t("reqBatch.title", { n: rows.length })}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {customer ? (
              <span className="font-medium text-zinc-700">{customer.name}</span>
            ) : null}
            <span>{formatDate(rows[0].createdAt, t)}</span>
          </span>
        }
        actions={
          <TextLink href="/app/requests">{t("reqDelete.backToList")}</TextLink>
        }
      />
      {typeof error === "string" && error ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText(error)}</Alert>
        </div>
      ) : null}
      {count(deleted) > 0 ? (
        <div className="mb-3">
          <Alert tone="success">
            {t("reqDelete.done", { n: count(deleted) })}
            {count(skipped) > 0
              ? ` ${t("reqDelete.skipped", { n: count(skipped) })}`
              : ""}
          </Alert>
        </div>
      ) : null}
      {createdCount > 1 ? (
        <div className="mb-3" data-batch-created>
          <Alert tone="success">
            {t("reqBatch.created", { n: createdCount })}
          </Alert>
        </div>
      ) : null}
      <p className="mb-3 text-sm text-zinc-600">{t("reqBatch.pageHint")}</p>
      <Table>
        <thead>
          <tr>
            <Th>{t("common.product")}</Th>
            <Th>{t("common.quantity")}</Th>
            <Th>{t("common.status")}</Th>
            <Th>{t("requests.deadline")}</Th>
            <Th>{t("requests.order")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = requestDisplayStatus(r, cancelled);
            const order = r.orderId
              ? orders.find((o) => o.id === r.orderId)
              : null;
            return (
              <tr key={r.id} className={rowClass} data-batch-item={r.id}>
                <Td className="min-w-40 font-medium text-zinc-900">
                  <TextLink
                    href={`/app/requests/${r.id}`}
                    className="text-zinc-900 no-underline hover:underline"
                  >
                    {r.productName}
                  </TextLink>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {r.quantity} {r.unit}
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge tone={requestStatusTone(status)}>
                    {t(`reqStatusLabel.${status}`)}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {formatDate(r.deadline, t)}
                </Td>
                <Td className="whitespace-nowrap">
                  {order && canViewOrder(user, order) ? (
                    <TextLink href={`/app/orders/${order.id}`}>
                      {t("reqBatch.order", { n: order.number })}
                    </TextLink>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <TextLink href={`/app/requests/${r.id}`}>
                      {t("tasks.open")}
                    </TextLink>
                    {canDeleteRequest(user, r) ? (
                      <form action={deleteRequestsAction}>
                        <input type="hidden" name="ids" value={r.id} />
                        <input type="hidden" name="groupId" value={groupId} />
                        <ConfirmDeleteButton
                          label={t("reqDelete.delete")}
                          confirmText={t("reqDelete.confirmOne")}
                        />
                      </form>
                    ) : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {deletable.length > 1 ? (
        <form action={deleteRequestsAction} className="mt-3">
          {deletable.map((r) => (
            <input key={r.id} type="hidden" name="ids" value={r.id} />
          ))}
          <SubmitButton
            variant="secondary"
            className="text-red-700"
            confirmText={t("reqBatch.deleteAllConfirm")}
            data-batch-delete-all
          >
            {t("reqBatch.deleteAll")}
          </SubmitButton>
        </form>
      ) : null}
    </>
  );
}
