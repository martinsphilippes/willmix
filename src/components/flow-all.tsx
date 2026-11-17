import type { Translate } from "@/i18n";
import { orderMilestoneText } from "@/lib/milestones";
import { requirementLabel } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore } from "@/lib/db";
import type { FlowEntity, FlowEntityItem } from "@/lib/services/flow";
import { orderInStepHref, type FlowStep } from "@/lib/flow";
import { Empty, Table, Td, TextLink, Th, rowClass } from "./ui";

/*
 * Aba "Todos no passo" (dono, 14/11/2026; docs/FLOW_MENU.md): todos os
 * pedidos que estão no passo agora, de qualquer responsável, com o que está
 * aberto nele, a etapa do pedido, o fornecedor e há quantos dias; o link
 * abre o detalhe do pedido.
 */

const DAY = 86_400_000;

function itemLabel(item: FlowEntityItem, t: Translate): string {
  if (item.kind === "requirement") return requirementLabel(t, item.requirement);
  if (item.kind === "import")
    return t(`importFlow.step.${item.key}` as DictionaryKey);
  return item.title ? t(item.title.detail, item.title.values) : "—";
}

export async function FlowAll({
  step,
  entities,
  t,
  partner = false,
  paged = false,
  emptyText,
  now = new Date(),
}: {
  step: FlowStep;
  /** Parceiro: os pedidos dele, sem a coluna do fornecedor. */
  partner?: boolean;
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
  return (
    <>
      <p className="mb-2 text-sm text-zinc-600">
        {t(partner ? "flow.all.hint.partner" : "flow.all.hint")}
      </p>
      <Table searchable={!paged} paginated={!paged}>
        <thead>
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
        </thead>
        <tbody>
          {entities.map((e) => {
            const since = e.since ? Date.parse(e.since) : NaN;
            const days = Number.isFinite(since)
              ? Math.max(0, Math.floor((now.getTime() - since) / DAY))
              : null;
            const labels = [...new Set(e.items.map((i) => itemLabel(i, t)))];
            return (
              <tr
                key={e.order.id}
                className={rowClass}
                data-flow-all-order={e.order.id}
              >
                <Td className="whitespace-nowrap font-medium text-zinc-900">
                  #{e.order.number}
                </Td>
                {partner ? null : <Td>{nameOf(e.order.supplierId)}</Td>}
                <Td className="whitespace-nowrap">
                  {orderMilestoneText(t, e.order.status)}
                </Td>
                <Td className="text-xs text-zinc-600">{labels.join(", ")}</Td>
                <Td className="whitespace-nowrap">
                  {days === null ? "—" : t("flow.cases.days", { n: days })}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <TextLink
                    href={orderInStepHref(step, e.order.id)}
                    data-flow-all-view
                  >
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
