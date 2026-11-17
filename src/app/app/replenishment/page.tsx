import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { can } from "@/lib/auth/function-access";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText } from "@/i18n";
import { getSettings } from "@/lib/settings";
import { isOpenDemand, listDemands } from "@/lib/services/purchase-demand";
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
import { ActionError } from "@/components/action-error";
import { REQUEST_SCREEN, REPLENISHMENT_QUERY } from "@/lib/request-screens";
import { listDraftsForList } from "@/lib/services/request-drafts";

/*
 * Reposição (mapa B10; dono, 15/11/2026; docs/PURCHASE_DEMAND.md): a fila do
 * Planner. Entradas: a reposição aberta pelo botão "+ Adicionar" (dono,
 * 16/11/2026: abre a tela Venda - Encomenda como compra para estoque, com a
 * origem reposição; o bloco "Abrir reposição" saiu) e a recompra vinda do
 * pós-venda. Sem sugestão automática pelo estoque: o estoque ainda não é
 * controlado no portal (Configurações, "Reposição automática pelo estoque",
 * desligada e sem efeito).
 */
export default async function ReplenishmentPage({
  searchParams,
}: PageProps<"/app/replenishment">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "requests");
  if (!isWellmix(user)) redirect("/app/requests");
  const { error, opened } = await searchParams;
  const t = await getT();
  // Rascunhos da entrada da Reposição de quem está vendo (dono, 17/11/2026):
  // no alto da fila, com a situação "Rascunho".
  const [rows, settings, drafts] = await Promise.all([
    listDemands("replenishment"),
    getSettings(),
    listDraftsForList(user, "replenishment"),
  ]);
  // "+ Adicionar": a compra para estoque (ação "Abrir reposição") ou, sem ela,
  // a tela Venda - Encomenda de sempre para quem a abre.
  const addHref = can(user, "replenishment.open")
    ? `${REQUEST_SCREEN.sale.path}?${REPLENISHMENT_QUERY}`
    : canOpen(user, "requestSale")
      ? REQUEST_SCREEN.sale.path
      : null;
  const errorCode = typeof error === "string" ? error : "";
  const errorKey = `demand.error.${errorCode}` as DictionaryKey;
  const errorText = errorCode && t(errorKey) !== errorKey ? t(errorKey) : null;
  const open = rows.filter(isOpenDemand);
  return (
    <div data-replenishment-page={open.length}>
      <PageHeader
        t={t}
        title={t("demand.replenishment.title")}
        subtitle={t("demand.replenishment.subtitle")}
        actions={
          addHref ? (
            <LinkButton href={addHref} variant="primary" data-replenishment-add>
              + {t("requestScreen.add")}
            </LinkButton>
          ) : undefined
        }
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {typeof opened === "string" ? (
        <div className="mb-3" role="status" data-replenishment-opened>
          <Alert tone="success">{t("demand.replenishment.opened")}</Alert>
        </div>
      ) : null}
      {!settings.autoReplenishmentByStock ? (
        <p className="mb-3 text-sm text-zinc-600" data-replenishment-manual>
          {t("demand.replenishment.manualOnly")}
        </p>
      ) : null}
      <Card title={t("demand.replenishment.queue", { n: open.length })}>
        {rows.length || drafts.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("demand.number")}</Th>
                <Th>{t("common.product")}</Th>
                <Th>{t("common.quantity")}</Th>
                <Th>{t("demand.source")}</Th>
                <Th>{t("demand.desiredAt")}</Th>
                <Th>{t("demand.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {drafts.map(({ draft, href }) => (
                <tr
                  key={`draft-${draft.id}`}
                  className={`${rowClass} bg-amber-50/40`}
                  data-replenishment-draft={draft.id}
                >
                  <Td>
                    <Link href={href} className={linkClass}>
                      {t("requestDraft.resume")}
                    </Link>
                  </Td>
                  <Td>
                    {draft.title}
                    <span className="block text-xs text-zinc-500">
                      {t("requestDraft.listHint")}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {t("reqBatch.count", { n: draft.itemCount })}
                  </Td>
                  <Td>
                    <Badge tone="neutral">{t("demand.source.planner")}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(draft.updatedAt, t)}
                  </Td>
                  <Td>
                    <Badge tone="neutral">{t("requestDraft.status")}</Badge>
                  </Td>
                </tr>
              ))}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={rowClass}
                  data-replenishment-row={r.id}
                >
                  <Td className="tabular-nums">
                    <Link href={`/app/requests/${r.id}`} className={linkClass}>
                      {r.number ? `#${r.number}` : "—"}
                    </Link>
                  </Td>
                  <Td>{productNameText(t, r.productName)}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {r.quantity.toLocaleString(t.intl)} {r.unit}
                  </Td>
                  <Td>
                    <Badge tone="neutral">
                      {t(
                        r.sourceOrderId
                          ? "demand.source.afterSales"
                          : "demand.source.planner",
                      )}
                    </Badge>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {r.desiredAt ? formatDate(r.desiredAt, t) : "—"}
                  </Td>
                  <Td>
                    <Badge tone={isOpenDemand(r) ? "warning" : "success"}>
                      {t(
                        isOpenDemand(r)
                          ? "demand.status.waitingStrategy"
                          : "demand.status.ordered",
                      )}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("demand.replenishment.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}
