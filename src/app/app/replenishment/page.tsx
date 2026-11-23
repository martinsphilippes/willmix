import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { can, canSeeMoney } from "@/lib/auth/function-access";
import { loadOrderCells } from "@/lib/services/order-cells";
import {
  OrderStandardHeads,
  OrderTermsTds,
  OrderTotalsTds,
  orderHeadText,
} from "@/components/order-standard-cells";
import { turnTone, turnWaitingKey } from "@/lib/turn";
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
import { groupRequestRows } from "@/lib/services/request-groups";

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
  const open = groupRequestRows(rows.filter(isOpenDemand));
  /* Tabela padrão de pedidos (dono, 22 e 23/11/2026; docs/ORDER_TABLES.md):
     as colunas padrão primeiro e as da Reposição (Fonte e Data desejada) no
     fim. As condições vêm da própria solicitação de reposição. */
  const seeValue = canSeeMoney(user);
  const entries = groupRequestRows(rows);
  const keyOf = (entry: (typeof entries)[number]) =>
    entry.kind === "batch" ? entry.groupId : entry.row.id;
  const cells = await loadOrderCells(
    entries.map((entry) => ({
      key: keyOf(entry),
      requestIds: (entry.kind === "batch" ? entry.rows : [entry.row]).map(
        (r) => r.id,
      ),
    })),
  ).catch(() => null);
  const dashes = (n: number) =>
    Array.from({ length: n }, (_, i) => <Td key={i}>—</Td>);
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
                <Th>{orderHeadText(t, "number")}</Th>
                <OrderStandardHeads t={t} seeValue={seeValue} />
                <Th>{t("demand.source")}</Th>
                <Th>{t("demand.desiredAt")}</Th>
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
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatDate(draft.updatedAt, t)}
                  </Td>
                  {/* Condições e cliente: o rascunho ainda não tem. */}
                  {dashes(8)}
                  <Td>—</Td>
                  <Td>
                    <Badge tone="neutral">{t("requestDraft.status")}</Badge>
                    <span className="block text-xs text-zinc-500">
                      {draft.title}
                    </span>
                  </Td>
                  <Td>—</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {draft.itemCount}
                  </Td>
                  {dashes(seeValue ? 4 : 3)}
                  <Td>
                    <Badge tone="neutral">{t("demand.source.planner")}</Badge>
                  </Td>
                  <Td>—</Td>
                </tr>
              ))}
              {entries.map((entry) => {
                // Uma linha por solicitação (dono, 22/11/2026): a reposição
                // com vários produtos abre a página do lote, como em
                // Encomendas; um produto só abre a mesma página pelo id.
                const members =
                  entry.kind === "batch" ? entry.rows : [entry.row];
                const r = members[0];
                const cell = cells?.byKey.get(keyOf(entry));
                const desired = members
                  .map((m) => m.desiredAt)
                  .filter((d): d is string => !!d)
                  .sort()[0];
                const anyOpen = members.some(isOpenDemand);
                const href = `/app/requests/batch/${encodeURIComponent(
                  entry.kind === "batch" ? entry.groupId : (r.groupId ?? r.id),
                )}`;
                return (
                  <tr
                    key={entry.kind === "batch" ? entry.groupId : r.id}
                    className={rowClass}
                    data-replenishment-row={
                      entry.kind === "batch" ? entry.groupId : r.id
                    }
                  >
                    <Td className="tabular-nums">
                      <Link href={href} className={linkClass}>
                        {r.number ? `#${r.number}` : "—"}
                      </Link>
                    </Td>
                    <OrderTermsTds t={t} cells={cell} createdAt={r.createdAt} />
                    {/* Status: de quem é a vez. */}
                    <Td className="whitespace-nowrap">
                      {anyOpen ? (
                        <Badge tone={turnTone("wellmix")}>
                          {t(turnWaitingKey("wellmix"))}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </Td>
                    {/* Situação: o momento da reposição. */}
                    <Td className="whitespace-nowrap">
                      <Badge tone={anyOpen ? "warning" : "success"}>
                        {t(
                          anyOpen
                            ? "demand.status.waitingStrategy"
                            : "demand.status.ordered",
                        )}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {anyOpen && r.deadline ? formatDate(r.deadline, t) : "—"}
                    </Td>
                    <Td
                      className="whitespace-nowrap text-right tabular-nums"
                      data-replenishment-products={members.length}
                    >
                      <span
                        title={members
                          .map((m) => productNameText(t, m.productName))
                          .join(", ")}
                      >
                        {members.length}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {cell?.deliveries ?? "—"}
                    </Td>
                    <OrderTotalsTds t={t} cells={cell} seeValue={seeValue} />
                    <Td>{cell?.supplier ?? "—"}</Td>
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
                      {desired ? formatDate(desired, t) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("demand.replenishment.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}
