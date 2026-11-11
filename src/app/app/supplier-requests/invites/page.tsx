import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { inviteLate, listInvitesFor } from "@/lib/services/booking-invites";
import { getStore } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import {
  Alert,
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
  rowClass,
  type Tone,
} from "@/components/ui";

/*
 * Convites para booking concorrente (docs/BOOKING_INVITES.md): o parceiro vê
 * os dele e responde subindo o booking; a Wellmix vê todos.
 */

const STATUS_TONE: Record<string, Tone> = {
  open: "warning",
  answered: "success",
  cancelled: "neutral",
};

export default async function BookingInvitesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/supplier-requests/invites");
  requireScreen(user, "quotes");
  const t = await getT();
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
      <PageHeader
        t={t}
        title={t("bookingInvites.list.title")}
        subtitle={t(
          wellmix
            ? "bookingInvites.list.subtitleWellmix"
            : "bookingInvites.list.subtitle",
        )}
        actions={
          <LinkButton href="/app/supplier-requests">
            {t("nav.supplierRequests")}
          </LinkButton>
        }
      />
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
