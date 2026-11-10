import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { isWellmix } from "@/lib/auth/permissions";
import { listSupplierRequests } from "@/lib/services/supplier-requests";
import { getT } from "@/i18n/server";
import { STATUS_TONE, answerText } from "./_components/status";
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
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";

/*
 * Solicitações ao fornecedor (docs/SUPPLIER_REQUESTS.md): a Wellmix vê todas;
 * o fornecedor, só as do próprio cadastro.
 */

export default async function SupplierRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/supplier-requests");
  requireScreen(user, "quotes");
  const t = await getT();
  const entries = await listSupplierRequests(user);
  const wellmix = isWellmix(user);

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
      {entries === null ? (
        <Alert tone="warning">
          {t("supplierRequests.selection.schemaMissing")}
        </Alert>
      ) : entries.length ? (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>{t("supplierRequests.col.number")}</Th>
                <Th>{t("supplierRequests.col.status")}</Th>
                {wellmix ? <Th>{t("supplierRequests.col.supplier")}</Th> : null}
                <Th>{t("supplierRequests.col.item")}</Th>
                <Th>{t("supplierRequests.col.quantity")}</Th>
                <Th>{t("supplierRequests.col.answer")}</Th>
                <Th>{t("supplierRequests.col.createdAt")}</Th>
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
                    <Badge tone={STATUS_TONE[r.status]}>
                      {t(
                        `supplierRequests.status.${r.status}` as DictionaryKey,
                      )}
                    </Badge>
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
                  <Td>{answerText(t, r)}</Td>
                  <Td>{formatDate(r.createdAt, t)}</Td>
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
