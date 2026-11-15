import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { listLots } from "@/lib/services/divergence-lots";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
} from "@/components/ui";

/*
 * Lotes com divergência (mapa E21; docs/RECEIVING.md): abertos primeiro.
 * Wellmix vê todos; a Trading e o Agente de carga, os dos seus pedidos.
 */
export default async function LotsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/lots");
  requireScreen(user, "orders");
  const t = await getT();
  const rows = await listLots(user);
  return (
    <>
      <PageHeader
        t={t}
        title={t("lot.list.title")}
        subtitle={t("lot.list.subtitle")}
      />
      <Card>
        {rows.length === 0 ? (
          <Empty>{t("lot.list.empty")}</Empty>
        ) : (
          <Table tools={false}>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>{t("lot.order")}</Th>
                <Th>{t("lot.items")}</Th>
                <Th>{t("lot.opened")}</Th>
                <Th>{t("lot.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ lot, order }) => (
                <tr key={lot.id} data-lot-row={lot.number}>
                  <Td>
                    <Link
                      href={`/app/orders/${order.id}/lots/${lot.id}`}
                      className={linkClass}
                    >
                      {t("lot.title", { n: String(lot.number) })}
                    </Link>
                  </Td>
                  <Td>#{order.number}</Td>
                  <Td>{lot.items.map((i) => i.name).join(", ")}</Td>
                  <Td>{formatDate(lot.createdAt, t)}</Td>
                  <Td>
                    <Badge
                      tone={lot.status === "closed" ? "success" : "warning"}
                    >
                      {t(`lot.status.${lot.status}` as DictionaryKey)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
