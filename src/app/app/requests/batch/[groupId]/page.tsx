import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  canViewOrder,
  canViewRequest,
  isWellmix,
} from "@/lib/auth/permissions";
import { RFQ_OPEN_STATUSES, canDeleteRequest } from "@/lib/services/requests";
import { listProductSuppliers } from "@/lib/services/product-suppliers";
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
  Card,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  rowClass,
} from "@/components/ui";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SubmitButton } from "@/components/submit-button";
import {
  deleteRequestsAction,
  openBatchRfqAction,
} from "../../../actions/requests";
import type { DictionaryKey } from "@/i18n/dictionaries";

/*
 * Lote de solicitações: os produtos pedidos juntos (mesmo groupId) numa
 * página só. Cada produto segue com a própria cotação, fornecedor e pedido;
 * daqui se abre cada um. Mesmo isolamento da lista: só aparece o que o
 * usuário pode ver (canViewRequest); nada visível = 404. A Wellmix abre aqui a
 * RFQ do lote inteiro (os mesmos fornecedores para todos os produtos).
 */
export default async function RequestBatchPage({
  params,
  searchParams,
}: PageProps<"/app/requests/batch/[groupId]">) {
  const { groupId } = await params;
  const { created, deleted, skipped, error, rfq } = await searchParams;
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
  const wellmix = isWellmix(user);
  const number = rows.find((r) => r.number)?.number ?? null;

  /* RFQ do lote (só a Wellmix): produtos ainda em cotação, quem já foi
     convidado em cada um e quem fornece cada produto (vai para o topo). */
  const rfqRows = wellmix
    ? rows.filter((r) => RFQ_OPEN_STATUSES.includes(r.status))
    : [];
  const [quotes, suppliers, products] = wellmix
    ? await Promise.all([
        store.list("quotes", { filter: { requestId: rows.map((r) => r.id) } }),
        rfqRows.length
          ? store.list("parties", {
              filter: { type: "supplier", active: true },
              orderBy: "name",
            })
          : Promise.resolve([]),
        rfqRows.some((r) => r.productId)
          ? store.list("products", {
              filter: {
                id: [
                  ...new Set(
                    rfqRows
                      .map((r) => r.productId)
                      .filter((id): id is string => !!id),
                  ),
                ],
              },
            })
          : Promise.resolve([]),
      ])
    : [[], [], []];
  const productSuppliers = new Map<string, Set<string>>();
  for (const p of products)
    productSuppliers.set(
      p.id,
      new Set([
        ...(p.supplierId ? [p.supplierId] : []),
        ...(await listProductSuppliers(p.id)).map((l) => l.supplierId),
      ]),
    );
  const supplies = (supplierId: string) =>
    rfqRows.filter(
      (r) => r.productId && productSuppliers.get(r.productId)?.has(supplierId),
    ).length;
  const invitedIn = (supplierId: string) =>
    rfqRows.filter((r) =>
      quotes.some((q) => q.requestId === r.id && q.supplierId === supplierId),
    ).length;
  const rfqSuppliers = suppliers
    .map((s) => ({
      ...s,
      supplies: supplies(s.id),
      invited: invitedIn(s.id),
    }))
    .sort((a, b) => b.supplies - a.supplies || a.name.localeCompare(b.name));
  const allInvited =
    rfqSuppliers.length > 0 &&
    rfqSuppliers.every((s) => s.invited === rfqRows.length);
  const quoteCount = (requestId: string) => {
    const of = quotes.filter((q) => q.requestId === requestId);
    return {
      invited: of.length,
      // Respondida de fato: rejeitada sem resposta (outra escolhida, produto
      // excluído) não conta.
      answered: of.filter((q) => !!q.answeredAt).length,
    };
  };
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
        title={
          number
            ? t("reqBatch.titleNumbered", { number, n: rows.length })
            : t("reqBatch.title", { n: rows.length })
        }
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
      {count(rfq) > 0 ? (
        <div className="mb-3" data-batch-rfq-done>
          <Alert tone="success">
            {count(rfq) === 1
              ? t("reqBatch.rfqDoneOne")
              : t("reqBatch.rfqDone", { n: count(rfq) })}
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
            {wellmix ? <Th>{t("reqBatch.quotes")}</Th> : null}
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
                {wellmix ? (
                  <Td className="whitespace-nowrap tabular-nums">
                    <span data-batch-quotes>
                      {quoteCount(r.id).invited
                        ? t("reqBatch.quotesCount", quoteCount(r.id))
                        : "—"}
                    </span>
                  </Td>
                ) : null}
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
      {rfqRows.length ? (
        <div id="rfq" className="mt-4 max-w-2xl scroll-mt-24" data-batch-rfq>
          <Card title={t("reqBatch.rfqTitle")}>
            <form action={openBatchRfqAction} className="space-y-2.5">
              <input type="hidden" name="groupId" value={groupId} />
              {!rfqSuppliers.length ? (
                /* Nenhum fornecedor ativo: diz o que fazer em vez de um cartão vazio. */
                <p className="text-sm text-zinc-600" data-batch-rfq-empty>
                  {t("reqBatch.rfqNoSuppliers")}{" "}
                  <TextLink href="/app/parties?type=supplier">
                    {t("reqBatch.rfqNoSuppliersLink")}
                  </TextLink>
                </p>
              ) : (
                <p className="text-sm text-zinc-600">
                  {allInvited
                    ? t("rfq.allInvited")
                    : rfqRows.length === 1
                      ? t("reqBatch.rfqHintOne")
                      : t("reqBatch.rfqHint", { n: rfqRows.length })}
                </p>
              )}
              <div className="grid gap-1.5 sm:grid-cols-2">
                {rfqSuppliers.map((s) => {
                  const done = s.invited === rfqRows.length;
                  return (
                    <label
                      key={s.id}
                      className={cx(
                        "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-sm transition",
                        done
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-500"
                          : "cursor-pointer border-zinc-300 bg-white text-zinc-900 hover:border-brand-300 has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-900",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="supplierIds"
                        value={s.id}
                        disabled={done}
                        defaultChecked={done}
                        className="h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <span>
                        <span className="font-medium">{s.name}</span>{" "}
                        <span className="text-zinc-500">· {s.country}</span>
                        {s.supplies ? (
                          <span
                            className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700"
                            data-rfq-supplying
                          >
                            {t("reqBatch.rfqSupplies", { n: s.supplies })}
                          </span>
                        ) : null}
                        {s.invited ? (
                          <span className="ml-1.5 text-xs text-zinc-500">
                            {done
                              ? t("reqBatch.rfqInvited")
                              : t("reqBatch.rfqPartial", { n: s.invited })}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
              {allInvited || !rfqSuppliers.length ? null : (
                <SubmitButton data-batch-rfq-submit>
                  {rfqRows.length === 1
                    ? t("reqBatch.rfqSubmitOne")
                    : t("reqBatch.rfqSubmit", { n: rfqRows.length })}
                </SubmitButton>
              )}
            </form>
          </Card>
        </div>
      ) : null}
    </>
  );
}
