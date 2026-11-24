import type { Translate } from "@/i18n";
import { orderMilestoneText } from "@/lib/milestones";
import { getStore } from "@/lib/db";
import type { FlowEntity } from "@/lib/services/flow";
import { orderInStepHref, stepId, type FlowStep } from "@/lib/flow";
import { elsewhereOf, openSummary } from "@/lib/flow-open-summary";
import { Empty, Table, Td, TextLink, Th, rowClass } from "./ui";
import { loadOrderCells } from "@/lib/services/order-cells";
import {
  OrderStandardHeads,
  OrderTermsTds,
  OrderTotalsTds,
  orderHeadText,
} from "./order-standard-cells";
import { partyOfRole, turnTone, turnWaitingKey } from "@/lib/turn";
import { ClampText } from "./clamp-text";
import { StatusLink } from "./status-link";

/*
 * Aba "Todos no passo" (dono, 14/11/2026; docs/FLOW_MENU.md): todos os
 * pedidos que estão no passo agora, de qualquer responsável, com o que está
 * aberto nele, a etapa do pedido, o fornecedor e há quantos dias; o link
 * abre o detalhe do pedido.
 */

const DAY = 86_400_000;

export async function FlowAll({
  step,
  entities,
  t,
  partner = false,
  seeValue = false,
  paged = false,
  emptyText,
  now = new Date(),
}: {
  step: FlowStep;
  /** Parceiro: os pedidos dele, sem a coluna do fornecedor. */
  partner?: boolean;
  /** Valor total do pedido: só com "Ver valores e margem". */
  seeValue?: boolean;
  /**
   * Uma página da lista (Wellmix, 50 por página): a busca e as páginas são
   * as da tela, em todos os pedidos do passo; a tabela fica sem a busca e as
   * páginas dela, que só olhavam esta página (dono, 17/11/2026).
   */
  paged?: boolean;
  /** Texto de "nada" no lugar do padrão (ex.: a busca não achou). */
  emptyText?: string;
  entities: FlowEntity[];
  t: Translate;
  now?: Date;
}) {
  const here = stepId(step);
  if (!entities.length)
    return <Empty>{emptyText ?? t("flow.all.empty")}</Empty>;
  const supplierIds = [
    ...new Set(entities.map((e) => e.order.supplierId).filter(Boolean)),
  ];
  const parties =
    !partner && supplierIds.length
      ? await getStore().list("parties", { filter: { id: supplierIds } })
      : [];
  const nameOf = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";
  /* Wellmix: a tabela padrão de pedidos (dono, 22 e 23/11/2026;
     docs/ORDER_TABLES.md), com as colunas do passo (o que está aberto e há
     quantos dias) no fim. As condições vêm da solicitação de cada pedido. O
     parceiro segue com a lista dele. */
  const cells = partner
    ? null
    : await loadOrderCells(
        entities.map((e) => ({
          key: e.order.id,
          requestIds: e.order.requestId ? [e.order.requestId] : [],
        })),
      ).catch(() => null);
  const num = "whitespace-nowrap text-right tabular-nums";
  return (
    <>
      <p className="mb-2 text-sm text-zinc-600">
        {t(partner ? "flow.all.hint.partner" : "flow.all.hint")}
      </p>
      <Table searchable={!paged} paginated={!paged}>
        <thead>
          {partner ? (
            <tr>
              <Th>{t("flow.all.order")}</Th>
              {partner ? null : <Th>{t("flow.all.supplier")}</Th>}
              <Th>{t("milestone.current")}</Th>
              <Th>{t("flow.all.open")}</Th>
              <Th>{t("flow.all.since")}</Th>
              <Th>
                <span className="sr-only">{t("common.actions")}</span>
              </Th>
            </tr>
          ) : (
            <tr data-order-table="flow">
              <Th>{orderHeadText(t, "number")}</Th>
              <OrderStandardHeads t={t} seeValue={seeValue} />
              <Th>{t("flow.all.open")}</Th>
              <Th>{t("flow.all.since")}</Th>
              <Th>
                <span className="sr-only">{t("common.actions")}</span>
              </Th>
            </tr>
          )}
        </thead>
        <tbody>
          {entities.map((e) => {
            const since = e.since ? Date.parse(e.since) : NaN;
            const days = Number.isFinite(since)
              ? Math.max(0, Math.floor((now.getTime() - since) / DAY))
              : null;
            // Linha fina (dono, 24/11/2026): o aberto numa linha só, com o
            // "ver mais" (e os produtos ao abrir); o fornecedor também.
            const open = openSummary(e.items, t, here);
            const clamp = (text: string, width: string, detail?: string) => (
              <ClampText
                text={text}
                lines={1}
                more={t("requestSheet.more")}
                less={t("requestSheet.less")}
                className={width}
                detail={detail || null}
              />
            );
            const supplierName = nameOf(e.order.supplierId);
            const supplierCell =
              supplierName === "—" ? "—" : clamp(supplierName, "max-w-[11rem]");
            const openCell = open.text
              ? clamp(open.text, "max-w-[18rem]", open.products.join("; "))
              : "—";
            // Tudo o que falta é de outro passo (o cadastro do Pedido novo):
            // "Ver" abre o pedido, onde a pendência dele aponta; a tela do
            // passo só mostraria os itens deste passo.
            const elsewhere =
              e.items.length > 0 &&
              e.items.every((i) => elsewhereOf(i, here) !== null);
            const viewHref = elsewhere
              ? `/app/orders/${encodeURIComponent(e.order.id)}`
              : orderInStepHref(step, e.order.id);
            if (!partner) {
              const cell = cells?.byKey.get(e.order.id);
              const requirements = e.items.flatMap((i) =>
                i.kind === "requirement" ? [i.requirement] : [],
              );
              const turn = partyOfRole(requirements[0]?.role, {
                trading:
                  parties.find((p) => p.id === e.order.supplierId)?.type ===
                  "trading",
              });
              return (
                <tr
                  key={e.order.id}
                  className={rowClass}
                  data-flow-all-order={e.order.id}
                >
                  <Td className="whitespace-nowrap font-medium text-zinc-900">
                    #{e.order.number}
                  </Td>
                  <OrderTermsTds
                    t={t}
                    cells={cell}
                    createdAt={e.order.createdAt}
                    compact
                  />
                  {/* Status: de quem é a vez no que está aberto no passo. */}
                  <Td className="whitespace-nowrap">
                    {turn ? (
                      // O status leva ao lugar de agir (dono, 24/11/2026).
                      <StatusLink tone={turnTone(turn)} href={viewHref}>
                        {t(turnWaitingKey(turn))}
                      </StatusLink>
                    ) : (
                      "—"
                    )}
                  </Td>
                  {/* Situação: o marco atual do pedido. */}
                  <Td className="whitespace-nowrap">
                    {orderMilestoneText(t, e.order.status)}
                  </Td>
                  {/* Prazo: o item do passo não guarda prazo próprio. */}
                  <Td>—</Td>
                  <Td className={num}>{cell?.items ?? "—"}</Td>
                  <Td className={num}>{cell?.deliveries ?? "—"}</Td>
                  <OrderTotalsTds t={t} cells={cell} seeValue={seeValue} />
                  <Td>{supplierCell}</Td>
                  <Td
                    className="text-xs text-zinc-600"
                    data-flow-all-elsewhere={elsewhere ? "" : undefined}
                    data-flow-all-open=""
                  >
                    {openCell}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {days === null ? "—" : t("flow.cases.days", { n: days })}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <TextLink href={viewHref} data-flow-all-view>
                      {t("flow.all.view")}
                    </TextLink>
                  </Td>
                </tr>
              );
            }
            return (
              <tr
                key={e.order.id}
                className={rowClass}
                data-flow-all-order={e.order.id}
              >
                <Td className="whitespace-nowrap font-medium text-zinc-900">
                  #{e.order.number}
                </Td>
                {partner ? null : <Td>{supplierCell}</Td>}
                <Td className="whitespace-nowrap">
                  {orderMilestoneText(t, e.order.status)}
                </Td>
                <Td
                  className="text-xs text-zinc-600"
                  data-flow-all-elsewhere={elsewhere ? "" : undefined}
                  data-flow-all-open=""
                >
                  {openCell}
                </Td>
                <Td className="whitespace-nowrap">
                  {days === null ? "—" : t("flow.cases.days", { n: days })}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <TextLink href={viewHref} data-flow-all-view>
                    {t("flow.all.view")}
                  </TextLink>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
