import Link from "next/link";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { inviteLate, listInvitesFor } from "@/lib/services/booking-invites";
import { getStore } from "@/lib/db";
import type { User } from "@/lib/db/schema";
import { isWellmix } from "@/lib/auth/permissions";
import {
  Alert,
  Badge,
  Empty,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
  rowClass,
  type Tone,
} from "@/components/ui";

/*
 * Tabela dos convites para booking concorrente (docs/BOOKING_INVITES.md): o
 * parceiro vê os dele; a Wellmix, todos. Usada na tela dos convites e na aba
 * "Convites de book" da Cotação (dono, 22/11/2026; docs/QUOTATION.md).
 */

const STATUS_TONE: Record<string, Tone> = {
  open: "warning",
  answered: "success",
  cancelled: "neutral",
};

export async function InvitesTable({ user, t }: { user: User; t: Translate }) {
  const rows = await listInvitesFor(user);
  const wellmix = isWellmix(user);
  const parties =
    wellmix && rows?.length
      ? await getStore().list("parties", {
          filter: { id: [...new Set(rows.map((r) => r.partnerId))] },
        })
      : [];
  const sorted = [...(rows ?? [])].sort(
    (a, b) =>
      (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) ||
      a.dueAt.localeCompare(b.dueAt),
  );
  return (
    <>
      {rows === null ? (
        <Alert tone="warning">
          {t("supplierRequests.selection.schemaMissing")}
        </Alert>
      ) : sorted.length === 0 ? (
        <Empty>{t("bookingInvites.list.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("bookingInvites.col.number")}</Th>
              <Th>{t("bookingInvites.col.item")}</Th>
              {wellmix ? <Th>{t("bookingInvites.col.partner")}</Th> : null}
              <Th>{t("bookingInvites.col.quantity")}</Th>
              <Th>{t("bookingInvites.col.due")}</Th>
              <Th>{t("bookingInvites.col.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => (
              <tr
                key={i.id}
                className={rowClass}
                data-booking-invite-row={i.status}
              >
                <Td className="tabular-nums">
                  <Link
                    href={`/app/supplier-requests/invites/${i.id}`}
                    className={linkClass}
                    data-booking-invite-open={i.id}
                  >
                    {i.number}
                  </Link>
                </Td>
                <Td>
                  <span className="font-medium">
                    {i.item.description ?? i.item.productName ?? "—"}
                  </span>
                  {i.item.factoryItemCode ? (
                    <span className="block text-xs text-zinc-500">
                      {i.item.factoryItemCode}
                    </span>
                  ) : null}
                </Td>
                {wellmix ? (
                  <Td>
                    {parties.find((p) => p.id === i.partnerId)?.name ?? "—"}
                  </Td>
                ) : null}
                <Td className="tabular-nums">
                  {i.item.quantity?.toLocaleString(t.intl) ?? "—"}
                </Td>
                <Td className="whitespace-nowrap">{formatDate(i.dueAt, t)}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={STATUS_TONE[i.status]}>
                      {t(`bookingInvites.status.${i.status}` as DictionaryKey)}
                    </Badge>
                    {inviteLate(i) ? (
                      <Badge tone="danger">{t("bookingInvites.late")}</Badge>
                    ) : null}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
