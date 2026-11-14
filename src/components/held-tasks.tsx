import type { User } from "@/lib/db/schema";
import type { Translate } from "@/i18n";
import { heldTasksFor } from "@/lib/services/tasks";
import { caseTitle } from "./flow-cases";
import {
  Card,
  Empty,
  LinkButton,
  Table,
  Td,
  TextLink,
  Th,
  formatDate,
  rowClass,
} from "./ui";

/*
 * Pendências do histórico do Sankhya em espera até o go-live na tela
 * Pendências (dono, 14/11/2026; docs/SANKHYA.md): só a atividade em aberto
 * de cada pedido, com a mesma regra de quem faz, por página de pedidos e
 * fora das bolinhas do menu, do SLA e dos avisos.
 */
export async function HeldTasks({
  user,
  page,
  t,
}: {
  user: User;
  page: number;
  t: Translate;
}) {
  const held = await heldTasksFor(user, page);
  if (!held.orders) return null;
  const href = (p: number) => `/app/tasks?heldPage=${p}#held-tasks`;
  return (
    <Card
      className="mt-6 scroll-mt-20 border-dashed"
      title={
        <span id="held-tasks" data-held-tasks={held.tasks.length}>
          {t("goLive.held.title", { n: held.orders })}
        </span>
      }
      actions={
        held.pages > 1 ? (
          <span className="flex items-center gap-2 text-xs text-zinc-600">
            {held.page > 1 ? (
              <LinkButton href={href(held.page - 1)} variant="secondary">
                {t("goLive.held.prev")}
              </LinkButton>
            ) : null}
            <span data-held-tasks-page={held.page}>
              {t("goLive.held.page", { page: held.page, pages: held.pages })}
            </span>
            {held.page < held.pages ? (
              <LinkButton href={href(held.page + 1)} variant="secondary">
                {t("goLive.held.next")}
              </LinkButton>
            ) : null}
          </span>
        ) : null
      }
    >
      <p className="mb-3 text-sm text-zinc-600">{t("goLive.held.hint")}</p>
      {held.tasks.length ? (
        <Table>
          <thead>
            <tr>
              <Th>{t("flow.cases.what")}</Th>
              <Th>{t("flow.cases.due")}</Th>
              <Th>
                <span className="sr-only">{t("common.actions")}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {held.tasks.map((task, i) => (
              <tr
                key={`${task.orderId}-${task.stageKey}-${i}`}
                className={rowClass}
                data-held-task={task.orderId ?? ""}
              >
                <Td>
                  <div className="font-medium text-zinc-900">
                    {caseTitle(task, t)}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {task.items?.map((x) => x.label).join(", ") || task.detail}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">
                  {task.dueAt ? formatDate(task.dueAt, t) : "—"}
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <TextLink href={task.link}>{t("goLive.held.open")}</TextLink>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>{t("goLive.held.empty")}</Empty>
      )}
    </Card>
  );
}
