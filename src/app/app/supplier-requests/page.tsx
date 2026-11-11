import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { isWellmix } from "@/lib/auth/permissions";
import { listSupplierRequests } from "@/lib/services/supplier-requests";
import { getT } from "@/i18n/server";
import { STATUS_TONE, answerText } from "./_components/status";
import { SlaBadge, dateTime } from "./_components/negotiation";
import {
  notifyLateSupplierRequests,
  slaOf,
  supplierRequestSlaMinutes,
} from "@/lib/services/supplier-request-negotiation";
import {
  finishedLate,
  groupRequests,
  negotiationTurn,
} from "@/lib/supplier-requests";
import { dictionaries } from "@/i18n/dictionaries";
import { SUPPLIER_REQUEST_STATUSES } from "@/lib/db/schema";
import { fallbackError } from "@/i18n/error-text";
import {
  listPurchaseCandidates,
  purchaseOrderCustomer,
} from "@/lib/services/purchase-order";
import { PurchaseOrderCard } from "./_components/purchase-order";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  linkClass,
  rowClass,
} from "@/components/ui";
import { can } from "@/lib/auth/function-access";

/*
 * Solicitações ao fornecedor (docs/SUPPLIER_REQUESTS.md): a Wellmix vê todas;
 * o fornecedor, só as do próprio cadastro.
 */

export default async function SupplierRequestsPage({
  searchParams,
}: PageProps<"/app/supplier-requests">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/supplier-requests");
  requireScreen(user, "quotes");
  const t = await getT();
  // SLA estourado: avisa uma vez (Wellmix e fornecedor) ao abrir a lista.
  await notifyLateSupplierRequests().catch((error) =>
    console.error("notifyLateSupplierRequests", error),
  );
  const entries = await listSupplierRequests(user);
  const wellmix = isWellmix(user);
  const slaMinutes = await supplierRequestSlaMinutes();
  const now = new Date();
  const query = await searchParams;
  const error = typeof query.error === "string" ? query.error : "";
  const errorKey = [
    `purchaseOrder.error.${error}`,
    `supplierRequests.error.${error}`,
    `common.${error}`,
  ].find((k) => k in dictionaries.pt) as DictionaryKey | undefined;
  const errorText = !error
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, error);
  // Pedido de compra (docs/PURCHASE_ORDER.md): os produtos aprovados de cada
  // fornecedor que ainda não estão em pedido.
  const purchase =
    wellmix && canOpen(user, "orders") && can(user, "purchaseOrder.generate")
      ? await listPurchaseCandidates(user)
      : null;
  const purchaseCustomer = purchase?.length
    ? await purchaseOrderCustomer()
    : null;

  // Uma linha por solicitação: os produtos abertos juntos para o fornecedor
  // ficam dentro dela (a antiga, sem batchId, é uma linha sozinha).
  const rows = entries ?? [];
  const distinctTotal = new Set(rows.map((e) => e.request.bookingItemId)).size;
  const supplierOf = new Map(rows.map((e) => [e.request.id, e.supplier]));
  const requests = groupRequests(rows.map((e) => e.request)).map((list) =>
    [...list].sort(
      (a, b) => a.number - b.number || a.createdAt.localeCompare(b.createdAt),
    ),
  );

  return (
    <>
      <PageHeader
        t={t}
        title={t("supplierRequests.list.title")}
        subtitle={t(
          wellmix
            ? "supplierRequests.list.subtitle"
            : "supplierRequests.list.subtitleSupplier",
        )}
        actions={
          wellmix && canOpen(user, "booking") ? (
            <LinkButton href="/app/booking/selection" variant="primary">
              {t("supplierRequests.list.toSelection")}
            </LinkButton>
          ) : null
        }
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      {purchase?.length ? (
        <div className="mb-4" id="pedido-de-compra">
          <PurchaseOrderCard
            groups={purchase}
            customer={purchaseCustomer}
            t={t}
          />
        </div>
      ) : null}
      {entries === null ? (
        <Alert tone="warning">
          {t("supplierRequests.selection.schemaMissing")}
        </Alert>
      ) : entries.length ? (
        <Card>
          <p className="mb-2 text-sm text-zinc-600" data-supplier-request-count>
            {t("supplierRequests.list.count", {
              n: requests.length,
              products: distinctTotal,
            })}
          </p>
          <Table>
            <thead>
              <tr>
                <Th>{t("supplierRequests.col.number")}</Th>
                <Th>{t("supplierRequests.col.status")}</Th>
                {wellmix ? <Th>{t("supplierRequests.col.supplier")}</Th> : null}
                <Th>{t("supplierRequests.col.item")}</Th>
                <Th>{t("supplierRequests.col.quantity")}</Th>
                <Th>{t("supplierRequests.col.products")}</Th>
                <Th>{t("supplierRequests.col.answer")}</Th>
                <Th>{t("supplierRequests.col.createdAt")}</Th>
                <Th>{t("supplierRequests.col.finishedAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {requests.map((products) => {
                const r = products[0];
                const supplier = supplierOf.get(r.id) ?? null;
                const many = products.length > 1;
                const statuses = SUPPLIER_REQUEST_STATUSES.filter((status) =>
                  products.some((p) => p.status === status),
                );
                const slas = products.map((p) => slaOf(p, slaMinutes, now));
                const sla =
                  slas.find((x) => x?.late) ?? slas.find((x) => x) ?? null;
                const turns = products.map((p) => negotiationTurn(p));
                const turn = turns.includes("supplier")
                  ? "supplier"
                  : turns.includes("wellmix")
                    ? "wellmix"
                    : null;
                const pieces = products.reduce((sum, p) => sum + p.quantity, 0);
                const distinct = new Set(products.map((p) => p.bookingItemId))
                  .size;
                const answered = products.filter((p) => p.supplierCanDo).length;
                const orderIds = [
                  ...new Set(
                    products
                      .map((p) => p.orderId)
                      .filter((id): id is string => !!id),
                  ),
                ];
                // Finalizada: quando todos os produtos foram decididos.
                const finished = products.every((p) => p.decidedAt)
                  ? products
                      .map((p) => p.decidedAt as string)
                      .sort()
                      .at(-1)!
                  : null;
                const late = products.some((p) => finishedLate(p, slaMinutes));
                return (
                  <tr
                    key={r.id}
                    className={rowClass}
                    data-supplier-request-row={r.id}
                  >
                    <Td>
                      <Link
                        href={`/app/supplier-requests/${r.id}`}
                        className={linkClass}
                      >
                        {r.number}
                      </Link>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {statuses.map((status) => (
                          <Badge key={status} tone={STATUS_TONE[status]}>
                            {t(
                              `supplierRequests.status.${status}` as DictionaryKey,
                            )}
                            {many
                              ? ` · ${products.filter((p) => p.status === status).length}`
                              : ""}
                          </Badge>
                        ))}
                        <SlaBadge sla={sla} t={t} />
                      </span>
                      {turn ? (
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {t(
                            `supplierRequests.negotiation.turn.${turn}` as DictionaryKey,
                          )}
                        </span>
                      ) : null}
                    </Td>
                    {wellmix ? <Td>{supplier?.name ?? "—"}</Td> : null}
                    <Td>
                      {products.slice(0, 4).map((p) => (
                        <span
                          key={p.id}
                          className="block max-w-64 whitespace-normal"
                        >
                          {p.item.description ?? p.item.productName ?? "—"}
                          {p.item.factoryItemCode ? (
                            <span className="text-xs text-zinc-500">
                              {` · ${p.item.factoryItemCode}`}
                            </span>
                          ) : null}
                        </span>
                      ))}
                      {products.length > 4 ? (
                        <span className="block text-xs text-zinc-500">
                          {t("supplierRequests.list.more", {
                            n: products.length - 4,
                          })}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="tabular-nums">
                      {t("supplierRequests.detail.pieces", {
                        n: pieces.toLocaleString(t.intl),
                      })}
                    </Td>
                    <Td
                      className="tabular-nums"
                      data-supplier-request-products={r.id}
                    >
                      <Link
                        href={`/app/supplier-requests/${r.id}`}
                        className={linkClass}
                      >
                        {distinct}
                      </Link>
                    </Td>
                    <Td>
                      {many
                        ? t("supplierRequests.list.answered", {
                            n: answered,
                            total: products.length,
                          })
                        : answerText(t, r)}
                      {orderIds.map((orderId) => (
                        <Link
                          key={orderId}
                          href={`/app/orders/${orderId}`}
                          className={`${linkClass} block text-xs`}
                          data-supplier-request-order={orderId}
                        >
                          {t("purchaseOrder.list.order")}
                        </Link>
                      ))}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {dateTime(r.createdAt, t)}
                    </Td>
                    <Td
                      className="whitespace-nowrap"
                      data-supplier-request-finished={r.id}
                    >
                      {finished ? (
                        <>
                          <span className="block tabular-nums">
                            {dateTime(finished, t)}
                          </span>
                          <span className="mt-0.5 inline-flex">
                            <Badge tone={late ? "danger" : "success"}>
                              {t(
                                late
                                  ? "supplierRequests.list.finishedLate"
                                  : "supplierRequests.list.finishedOnTime",
                              )}
                            </Badge>
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Empty>{t("supplierRequests.list.empty")}</Empty>
      )}
    </>
  );
}
