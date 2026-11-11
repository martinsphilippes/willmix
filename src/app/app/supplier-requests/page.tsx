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
  distinctProductsByGroup,
  finishedLate,
  negotiationTurn,
} from "@/lib/supplier-requests";
import { dictionaries } from "@/i18n/dictionaries";
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
    wellmix && canOpen(user, "orders")
      ? await listPurchaseCandidates(user)
      : null;
  const purchaseCustomer = purchase?.length
    ? await purchaseOrderCustomer()
    : null;

  // Produtos distintos: na lista toda e em cada grupo (fornecedor + booking).
  const rows = entries ?? [];
  const distinctTotal = new Set(rows.map((e) => e.request.bookingItemId)).size;
  const perGroup = distinctProductsByGroup(rows.map((e) => e.request));

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
              n: entries.length,
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
              {entries.map(({ request: r, supplier }) => (
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
                      <Badge tone={STATUS_TONE[r.status]}>
                        {t(
                          `supplierRequests.status.${r.status}` as DictionaryKey,
                        )}
                      </Badge>
                      <SlaBadge sla={slaOf(r, slaMinutes, now)} t={t} />
                    </span>
                    {negotiationTurn(r) ? (
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {t(
                          `supplierRequests.negotiation.turn.${negotiationTurn(r)}` as DictionaryKey,
                        )}
                      </span>
                    ) : null}
                  </Td>
                  {wellmix ? <Td>{supplier?.name ?? "—"}</Td> : null}
                  <Td>
                    <span className="block max-w-64 whitespace-normal">
                      {r.item.description ?? r.item.productName ?? "—"}
                    </span>
                    <span className="block text-xs text-zinc-500">
                      {r.item.factoryItemCode ?? ""}
                    </span>
                  </Td>
                  <Td className="tabular-nums">
                    {t("supplierRequests.detail.pieces", {
                      n: r.quantity.toLocaleString(t.intl),
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
                      {perGroup.get(`${r.supplierId}:${r.bookingLotId}`) ?? 1}
                    </Link>
                  </Td>
                  <Td>
                    {answerText(t, r)}
                    {r.orderId ? (
                      <Link
                        href={`/app/orders/${r.orderId}`}
                        className={`${linkClass} block text-xs`}
                        data-supplier-request-order={r.orderId}
                      >
                        {t("purchaseOrder.list.order")}
                      </Link>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {dateTime(r.createdAt, t)}
                  </Td>
                  <Td
                    className="whitespace-nowrap"
                    data-supplier-request-finished={r.id}
                  >
                    {r.decidedAt ? (
                      <>
                        <span className="block tabular-nums">
                          {dateTime(r.decidedAt, t)}
                        </span>
                        <span className="mt-0.5 inline-flex">
                          <Badge
                            tone={
                              finishedLate(r, slaMinutes) ? "danger" : "success"
                            }
                          >
                            {t(
                              finishedLate(r, slaMinutes)
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
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Empty>{t("supplierRequests.list.empty")}</Empty>
      )}
    </>
  );
}
