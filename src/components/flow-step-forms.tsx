import type { Requirement, User } from "@/lib/db/schema";
import type { Task } from "@/lib/services/tasks";
import { requirementLabel, type Translate } from "@/i18n";
import { getStore } from "@/lib/db";
import { isWellmix } from "@/lib/auth/permissions";
import { canSubmitRequirement } from "@/lib/workflow/engine";
import { isRoutedLaneKey, laneInputKeys } from "@/lib/purchase-lanes";
import { itemsInStep, stepId, type FlowStep } from "@/lib/flow";
import { RequirementForm } from "./requirement-form";
import { ProductionCard } from "./production-card";
import { ArtworkCard } from "./artwork-card";
import { Badge, Card, TextLink } from "./ui";

/*
 * Resolver na tela do passo (dono, 14/11/2026; docs/FLOW_MENU.md), segunda
 * parte da divisão do detalhe do pedido: os itens de etapa do passo (arte,
 * validação, arte final, certificado, medidas, assinatura…), a produção
 * (dados e ETD, follow 5/15/25, inspeção e SKUs) e as não conformidades da
 * arte, com os mesmos formulários e Server Actions do pedido. A ação volta
 * para a tela do passo. O detalhe do pedido continua com tudo.
 */

/** Pedidos por tela (os demais seguem na tabela, com o atalho). */
const MAX_ORDERS = 15;

const pathOf = (step: FlowStep) => `/app/flow/${step.block}/${step.key}`;

const ordersOf = (tasks: Task[], kinds: string[]) =>
  [
    ...new Set(
      tasks
        .filter((x) => x.orderId && kinds.includes(x.kind))
        .map((x) => x.orderId as string),
    ),
  ].slice(0, MAX_ORDERS);

/** Itens de etapa do passo, pedido a pedido, com o formulário de cada um. */
export async function FlowRequirementWork({
  user,
  step,
  tasks,
  t,
}: {
  user: User;
  step: FlowStep;
  tasks: Task[];
  t: Translate;
}) {
  const id = stepId(step);
  const byOrder = new Map<string, Set<string>>();
  for (const task of tasks) {
    if (task.kind !== "requirement" || !task.orderId) continue;
    const keys = byOrder.get(task.orderId) ?? new Set<string>();
    for (const item of itemsInStep(step, task)) keys.add(item.key);
    // Sem itens (pendência só da etapa): a etapa inteira cai neste passo.
    if (!task.items?.length) keys.add("*");
    if (keys.size) byOrder.set(task.orderId, keys);
  }
  const orderIds = [...byOrder.keys()].slice(0, MAX_ORDERS);
  if (!orderIds.length) return null;
  const store = getStore();
  const [orders, requirements] = await Promise.all([
    store.list("orders", { filter: { id: orderIds } }),
    store.list("requirements", { filter: { orderId: orderIds } }),
  ]);
  const stages = await store.list("stages", { filter: { orderId: orderIds } });
  const openStage = new Set(
    stages
      .filter((s) => s.status === "active" || s.status === "blocked")
      .map((s) => s.id),
  );
  // Arquivos que a validação e a arte final usam (a arte, o certificado).
  const inputIds = new Set<string>();
  for (const r of requirements)
    for (const input of laneInputKeys(
      r.key,
      requirements.filter((x) => x.orderId === r.orderId),
    ))
      inputIds.add(input.documentId);
  const docs = inputIds.size
    ? await store.list("documents", { filter: { id: [...inputIds] } })
    : [];
  const docOf = (did: string) => docs.find((d) => d.id === did) ?? null;
  const routing = requirements.some((r) => isRoutedLaneKey(r.key))
    ? await import("@/lib/services/cert-art-routing")
    : null;
  const ctx = routing ? await routing.loadRoutingContext() : null;
  const cards = orders
    .sort((a, b) => a.number - b.number)
    .map((order) => {
      const keys = byOrder.get(order.id)!;
      const siblings = requirements.filter((r) => r.orderId === order.id);
      const rows = siblings.filter(
        (r) =>
          openStage.has(r.stageId) &&
          r.status !== "done" &&
          (keys.has(r.key) || keys.has("*")) &&
          canSubmitRequirement(user, order, r) &&
          (!routing ||
            !ctx ||
            !isRoutedLaneKey(r.key) ||
            routing.canActOnLane(user, r.key, order, ctx, siblings)),
      );
      return { order, rows, siblings };
    })
    .filter((c) => c.rows.length);
  if (!cards.length) return null;
  const returnTo = pathOf(step);
  return (
    <section className="mt-6 space-y-4" data-flow-requirements={id}>
      {cards.map(({ order, rows, siblings }) => (
        <Card
          key={order.id}
          title={t("flow.work.order", { n: order.number })}
          actions={
            <TextLink href={`/app/orders/${order.id}`}>
              {t("flow.work.openOrder")}
            </TextLink>
          }
        >
          <ul
            className="divide-y divide-zinc-100"
            data-flow-requirement-order={order.id}
          >
            {rows.map((r: Requirement) => (
              <li
                key={r.id}
                className="flex flex-col gap-2 py-2.5 @container"
                data-flow-requirement={r.key}
              >
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">
                      {requirementLabel(t, r)}
                    </span>
                    <Badge
                      tone={r.status === "rejected" ? "danger" : "neutral"}
                    >
                      {t(`reqStatus.${r.status}`)}
                    </Badge>
                  </div>
                  {r.status === "rejected" && r.note ? (
                    <p className="mt-0.5 text-xs text-red-700">{r.note}</p>
                  ) : null}
                  {laneInputKeys(r.key, siblings).map((input) => {
                    const doc = docOf(input.documentId);
                    return doc ? (
                      <span
                        key={doc.id}
                        className="mr-3 mt-0.5 inline-block text-xs text-zinc-600"
                        data-lane-input={input.label}
                      >
                        {t(input.label)}:{" "}
                        <TextLink href={`/api/files/${doc.id}`} target="_blank">
                          {doc.name} (v{doc.version})
                        </TextLink>
                      </span>
                    ) : null;
                  })}
                </div>
                <RequirementForm
                  requirement={r}
                  orderId={order.id}
                  t={t}
                  returnTo={returnTo}
                />
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </section>
  );
}

/** Produção do pedido no passo: Produção (dados, ETD e follow) ou Inspeção. */
export async function FlowProductionWork({
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
  const inspection = step.key === "inspection";
  const orderIds = ordersOf(
    tasks,
    inspection ? ["sku_inspection", "sku_fix"] : ["production_follow"],
  );
  if (!orderIds.length) return null;
  const store = getStore();
  const { productionView } = await import("@/lib/services/production");
  const orders = await store.list("orders", { filter: { id: orderIds } });
  const views = (
    await Promise.all(
      orders.map(async (order) => ({
        order,
        view: await productionView(order).catch(() => null),
      })),
    )
  ).filter((v) => v.view);
  if (!views.length) return null;
  const userIds = new Set<string>();
  for (const { view } of views) {
    for (const h of view?.track?.etdHistory ?? []) userIds.add(h.byUserId);
    for (const f of view?.track?.followups ?? []) userIds.add(f.byUserId);
  }
  const names = new Map(
    (userIds.size
      ? await store.list("users", { filter: { id: [...userIds] } })
      : []
    ).map((u) => [u.id, u.name]),
  );
  return (
    <section className="mt-6 space-y-4" data-flow-production={step.key}>
      {views
        .sort((a, b) => a.order.number - b.order.number)
        .map(({ order, view }) => (
          <div key={order.id} data-flow-production-order={order.id}>
            <p className="mb-1 text-sm font-semibold text-zinc-800">
              {t("flow.work.order", { n: order.number })} ·{" "}
              <TextLink href={`/app/orders/${order.id}`}>
                {t("flow.work.openOrder")}
              </TextLink>
            </p>
            <ProductionCard
              t={t}
              user={user}
              order={order}
              view={view!}
              wellmix={isWellmix(user)}
              names={names}
              notice={notice}
              sections={inspection ? ["inspection"] : ["plan", "followup"]}
              returnTo={pathOf(step)}
            />
          </div>
        ))}
    </section>
  );
}

/** Não conformidades da arte (correção da agência e revisão da Wellmix). */
export async function FlowArtworkWork({
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
  const orderIds = ordersOf(tasks, ["art_fix", "art_review"]);
  if (!orderIds.length) return null;
  const store = getStore();
  const artworkSvc = await import("@/lib/services/artwork");
  const orders = await store.list("orders", { filter: { id: orderIds } });
  const views = (
    await Promise.all(
      orders
        .filter((o) => artworkSvc.canFixArt(user, o))
        .map(async (order) => ({
          order,
          view: await artworkSvc.artworkView(user, order).catch(() => null),
        })),
    )
  ).filter((v) => v.view);
  if (!views.length) return null;
  return (
    <section className="mt-6 space-y-4" data-flow-artwork>
      {views
        .sort((a, b) => a.order.number - b.order.number)
        .map(({ order, view }) => (
          <div key={order.id} data-flow-artwork-order={order.id}>
            <p className="mb-1 text-sm font-semibold text-zinc-800">
              {t("flow.work.order", { n: order.number })} ·{" "}
              <TextLink href={`/app/orders/${order.id}`}>
                {t("flow.work.openOrder")}
              </TextLink>
            </p>
            <ArtworkCard
              t={t}
              order={order}
              view={view!}
              wellmix={isWellmix(user)}
              notice={notice}
              returnTo={pathOf(step)}
            />
          </div>
        ))}
    </section>
  );
}
