import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { listPackagingBriefsFor } from "@/lib/services/packaging-brief";
import { BRIEF_TONE } from "@/components/packaging-brief-card";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Badge,
  Empty,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  isOverdue,
  linkClass,
  rowClass,
} from "@/components/ui";

/** Briefings de embalagem da agência (a Wellmix vê todos), abertos primeiro. */
export default async function PackagingListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const wellmix = isWellmix(user);
  requireScreen(user, "packaging");
  const t = await getT();
  const rows = await listPackagingBriefsFor(user);

  return (
    <>
      <PageHeader
        t={t}
        title={t("packBrief.title")}
        subtitle={t("packBrief.subtitle")}
      />
      {rows.length === 0 ? (
        <Empty>{t("packBrief.empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("packBrief.col.product")}</Th>
              <Th>{t("packBrief.col.request")}</Th>
              {wellmix ? <Th>{t("packBrief.col.owner")}</Th> : null}
              <Th>{t("packBrief.col.items")}</Th>
              <Th>{t("packBrief.col.deadline")}</Th>
              <Th>{t("packBrief.col.status")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ brief, request, agencyName, missing }) => {
              const open = brief.status === "open";
              return (
                <tr
                  key={brief.id}
                  className={rowClass}
                  data-packaging-row={brief.id}
                  data-status={brief.status}
                >
                  <Td>
                    <Link
                      href={`/app/packaging/${brief.id}`}
                      className={linkClass}
                    >
                      {request?.productName ?? "—"}
                    </Link>
                    {request ? (
                      <span className="block text-xs text-zinc-500">
                        {request.quantity.toLocaleString(t.intl)} {request.unit}
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    {request?.number
                      ? t("packBrief.request", { n: request.number })
                      : "—"}
                  </Td>
                  {wellmix ? (
                    <Td>{agencyName ?? t("packBrief.owner.wellmix")}</Td>
                  ) : null}
                  <Td>
                    {brief.status === "cancelled"
                      ? "—"
                      : brief.status === "transferred"
                        ? // Depois do pedido, a arte segue pelo pedido (o briefing não a acompanha).
                          t("packBrief.status.transferred")
                        : missing.length
                          ? `${t("packBrief.item.missing")}: ${missing
                              .map((k) =>
                                t(`packBrief.item.${k}` as DictionaryKey),
                              )
                              .join(", ")}`
                          : t("packBrief.status.ready")}
                  </Td>
                  <Td
                    className={
                      open && isOverdue(brief.dueAt)
                        ? "font-semibold text-red-700"
                        : undefined
                    }
                  >
                    {formatDate(brief.dueAt, t)}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={BRIEF_TONE[brief.status]}>
                        {t(`packBrief.status.${brief.status}` as DictionaryKey)}
                      </Badge>
                      {(open || brief.status === "ready") && !brief.orderId ? (
                        <Badge tone="warning">{t("packBrief.presale")}</Badge>
                      ) : null}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
