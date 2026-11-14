import type { User } from "@/lib/db/schema";
import type { FlowCase as Task } from "@/lib/services/flow";
import type { Translate } from "@/i18n";
import { getStore } from "@/lib/db";
import { flowStepOfImportKey, stepId, type FlowStep } from "@/lib/flow";
import { ImportFlowCard } from "./import-flow-card";
import { TextLink } from "./ui";

/*
 * Resolver na tela do passo (dono, 14/11/2026: "quebrar as páginas que
 * juntam muitas atividades"; docs/FLOW_MENU.md): para cada pedido com caso
 * aberto no passo, o mesmo cartão de passos do detalhe do pedido, só com os
 * passos deste ponto do mapa (certificação, booking, container, documentos,
 * presença de carga, canal, nota fiscal, amostras). Mesmas regras e Server
 * Actions do pedido; a ação volta para esta tela. O detalhe do pedido
 * continua com tudo.
 */
const GROUPS = ["certification", "origin", "import", "samples"] as const;
/** Pedidos por tela (os demais seguem na tabela, com o atalho). */
const MAX_ORDERS = 15;

export async function FlowStepWork({
  user,
  step,
  tasks,
  t,
  notice,
}: {
  user: User;
  step: FlowStep;
  tasks: Task[];
  t: Translate;
  notice: string | null;
}) {
  const orderIds = [
    ...new Set(
      tasks
        .filter(
          (x) =>
            x.orderId &&
            (x.kind === "import_step" ||
              x.kind === "import_validate" ||
              x.kind === "cert_step" ||
              x.kind === "cert_validate"),
        )
        .map((x) => x.orderId as string),
    ),
  ].slice(0, MAX_ORDERS);
  if (!orderIds.length) return null;
  const store = getStore();
  const importFlow = await import("@/lib/services/import-flow");
  const orders = await store.list("orders", { filter: { id: orderIds } });
  const id = stepId(step);
  const cards = (
    await Promise.all(
      orders.map(async (order) => {
        const views = (
          await Promise.all(
            GROUPS.map((g) =>
              importFlow.importFlowView(user, order, g).catch(() => []),
            ),
          )
        )
          .flat()
          .filter((v) => {
            const s = flowStepOfImportKey(v.template.key);
            return s && stepId(s) === id;
          });
        return { order, views };
      }),
    )
  ).filter((c) => c.views.length);
  if (!cards.length) return null;
  const userIds = new Set<string>();
  for (const c of cards)
    for (const v of c.views) {
      if (v.step?.submittedByUserId) userIds.add(v.step.submittedByUserId);
      if (v.step?.validatedByUserId) userIds.add(v.step.validatedByUserId);
    }
  const names = new Map(
    (userIds.size
      ? await store.list("users", { filter: { id: [...userIds] } })
      : []
    ).map((u) => [u.id, u.name]),
  );
  const returnTo = `/app/flow/${step.block}/${step.key}`;
  return (
    <section className="mt-6 space-y-4" data-flow-work>
      <h2 className="text-base font-semibold text-zinc-900">
        {t("flow.work.title")}
      </h2>
      {cards
        .sort((a, b) => a.order.number - b.order.number)
        .map(({ order, views }) => (
          <div key={order.id} data-flow-work-order={order.id}>
            <ImportFlowCard
              t={t}
              order={order}
              steps={views}
              names={names}
              title={t("flow.work.order", { n: order.number })}
              anchor={
                step.key === "certification" ? "certification" : "import-flow"
              }
              notice={notice}
              returnTo={returnTo}
              hints={[
                <TextLink key="open" href={`/app/orders/${order.id}`}>
                  {t("flow.work.openOrder")}
                </TextLink>,
              ]}
            />
          </div>
        ))}
    </section>
  );
}
