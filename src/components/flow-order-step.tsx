import type { Requirement, User } from "@/lib/db/schema";
import { requirementLabel, productNameText, type Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore } from "@/lib/db";
import { canViewOrder, isWellmix } from "@/lib/auth/permissions";
import { canSubmitRequirement } from "@/lib/workflow/engine";
import { isRoutedLaneKey, laneInputKeys } from "@/lib/purchase-lanes";
import {
  blockLabelKey,
  flowStepOfImportKey,
  flowStepsOf,
  orderInStepHref,
  stepId,
  stepLabelKey,
  type FlowStep,
} from "@/lib/flow";
import { RequirementForm } from "./requirement-form";
import { ImportFlowCard } from "./import-flow-card";
import { ProductionCard } from "./production-card";
import { ReceivingCard } from "./receiving-card";
import { ArtworkCard } from "./artwork-card";
import { FreightOrderCard } from "./freight-order-card";
import { InspectionResultCard } from "./inspection-result-card";
import { ownScreenOf } from "./flow-step-forms";
import {
  Badge,
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
 * O pedido na tela do passo (dono, 14/11/2026; docs/FLOW_MENU.md): a visão é
 * do passo e das necessidades operacionais dele, não do pedido inteiro.
 * Mostra tudo o que o passo tem para este pedido, feito e aberto: os itens
 * de etapa do passo (com o formulário onde ainda dá para agir), os passos do
 * embarque, da origem, da certificação e das amostras do passo e o cartão do
 * passo (produção, recebimento, artes, frete). No passo Pedidos (onde o
 * pedido é criado): só a criação (resumo, itens, programação de compra e os
 * itens da criação). Só a Wellmix.
 */

const IMPORT_GROUPS = ["certification", "origin", "import", "samples"] as const;

export async function FlowOrderInStep({
  user,
  step,
  orderId,
  t,
  notices,
}: {
  user: User;
  step: FlowStep;
  orderId: string;
  t: Translate;
  notices: {
    import: string | null;
    production: string | null;
    receiving: string | null;
    artwork: string | null;
    freight: string | null;
    freightN: number;
  };
}) {
  const store = getStore();
  const order = await store.get("orders", orderId);
  // Parceiro: só o pedido dele (a mesma regra do detalhe do pedido).
  const wellmix = isWellmix(user);
  if (!order || !canViewOrder(user, order)) return null;
  const id = stepId(step);
  const returnTo = orderInStepHref(step, order.id);
  const [stages, requirements, supplier, customer] = await Promise.all([
    store.list("stages", { filter: { orderId: order.id } }),
    store.list("requirements", { filter: { orderId: order.id } }),
    order.supplierId
      ? store.get("parties", order.supplierId)
      : Promise.resolve(null),
    order.customerId
      ? store.get("parties", order.customerId)
      : Promise.resolve(null),
  ]);
  const stageById = new Map(stages.map((s) => [s.id, s]));
  // Itens de etapa do passo (de qualquer etapa do pedido), feitos e abertos;
  // o parceiro só vê os do papel dele (ou os que ele pode fazer).
  const mine = requirements
    .filter(
      (r) =>
        wellmix || r.role === user.role || canSubmitRequirement(user, order, r),
    )
    .filter((r) => {
      const stage = stageById.get(r.stageId);
      return flowStepsOf({
        kind: "requirement",
        stageKey: stage?.key ?? null,
        items: [{ key: r.key }],
      }).some((x) => stepId(x) === id);
    })
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  // Arquivos: dos itens feitos e os que a validação e a arte final usam.
  const docIds = new Set<string>();
  for (const r of mine) {
    if (r.documentId) docIds.add(r.documentId);
    for (const input of laneInputKeys(r.key, requirements))
      docIds.add(input.documentId);
  }
  const docs = docIds.size
    ? await store.list("documents", { filter: { id: [...docIds] } })
    : [];
  const docOf = (did: string | null) =>
    (did && docs.find((d) => d.id === did)) || null;
  const routing = mine.some((r) => isRoutedLaneKey(r.key))
    ? await import("@/lib/services/cert-art-routing")
    : null;
  const ctx = routing ? await routing.loadRoutingContext() : null;
  const canAct = (r: Requirement) => {
    const stage = stageById.get(r.stageId);
    return (
      r.status !== "done" &&
      (stage?.status === "active" || stage?.status === "blocked") &&
      canSubmitRequirement(user, order, r) &&
      (!routing ||
        !ctx ||
        !isRoutedLaneKey(r.key) ||
        routing.canActOnLane(user, r.key, order, ctx, requirements))
    );
  };

  // Passos do embarque, da origem, da certificação e das amostras do passo.
  const importFlow = await import("@/lib/services/import-flow");
  const importViews =
    order.status === "CANCELLED"
      ? []
      : (
          await Promise.all(
            IMPORT_GROUPS.map((g) =>
              importFlow.importFlowView(user, order, g).catch(() => []),
            ),
          )
        )
          .flat()
          .filter((v) => {
            const s = flowStepOfImportKey(v.template.key);
            return s && stepId(s) === id;
          });

  // Cartão do passo para este pedido.
  // Produção: a Wellmix e o fornecedor do pedido (a regra do pedido).
  const production =
    (wellmix ||
      (user.role === "supplier" && order.supplierId === user.partyId)) &&
    step.block === "production" &&
    ["pre-production", "production", "inspection"].includes(step.key)
      ? await (
          await import("@/lib/services/production")
        )
          .productionView(order)
          .catch(() => null)
      : null;
  const report =
    wellmix && step.block === "production" && step.key === "inspection"
      ? await (
          await import("@/lib/services/inspection-report")
        )
          .inspectionReport(order.id)
          .catch(() => null)
      : null;
  const receivingSvc = await import("@/lib/services/receiving");
  const receiving =
    wellmix &&
    step.block === "delivery" &&
    (step.key === "storage" || step.key === "return") &&
    (receivingSvc.RECEIVING_STATUSES as readonly string[]).includes(
      order.status,
    )
      ? await receivingSvc.receivingView(order)
      : null;
  const artworkSvc = await import("@/lib/services/artwork");
  const artwork =
    step.block === "order" &&
    step.key === "art" &&
    order.status !== "CANCELLED" &&
    order.status !== "ORDER_CREATED" &&
    artworkSvc.canFixArt(user, order)
      ? await artworkSvc.artworkView(user, order).catch(() => null)
      : null;
  const freight =
    wellmix &&
    step.block === "production" &&
    step.key === "logistics" &&
    order.status !== "CANCELLED";

  // Nomes de quem enviou e validou (passos e produção).
  const userIds = new Set<string>();
  for (const v of importViews) {
    if (v.step?.submittedByUserId) userIds.add(v.step.submittedByUserId);
    if (v.step?.validatedByUserId) userIds.add(v.step.validatedByUserId);
  }
  for (const h of production?.track?.etdHistory ?? []) userIds.add(h.byUserId);
  for (const f of production?.track?.followups ?? []) userIds.add(f.byUserId);
  for (const r of mine)
    if (r.submittedByUserId) userIds.add(r.submittedByUserId);
  if (report)
    JSON.stringify(report, (key, value) => {
      if (key.endsWith("UserId") && typeof value === "string")
        userIds.add(value);
      return value;
    });
  const names = new Map(
    (userIds.size
      ? await store.list("users", { filter: { id: [...userIds] } })
      : []
    ).map((u) => [u.id, u.name]),
  );
  const name = (uid: string | null | undefined) =>
    (uid && names.get(uid)) || "—";

  // Passo Pedidos (criação): resumo, itens e programação de compra.
  const creation = wellmix && step.block === "order" && step.key === "orders";
  const items = creation
    ? await store.list("order_items", { filter: { orderId: order.id } })
    : [];
  const { OrderRoundsSection } = creation
    ? await import("@/app/app/orders/[id]/_components/rounds")
    : { OrderRoundsSection: null };

  const nothing =
    !mine.length &&
    !importViews.length &&
    !production &&
    !receiving &&
    !artwork &&
    !freight &&
    !creation;

  return (
    <div className="space-y-4" data-flow-order={order.id}>
      <Card
        title={t("flow.order.title", {
          n: order.number,
          step: t(stepLabelKey(step)),
        })}
        actions={
          <TextLink
            href={`/app/flow/${step.block}/${step.key}`}
            data-flow-back-step
          >
            {t("flow.order.back", { step: t(stepLabelKey(step)) })}
          </TextLink>
        }
      >
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {/* Fornecedor e cliente: só a Wellmix (o parceiro vê o pedido dele). */}
          {wellmix ? (
            <>
              <div>
                <dt className="text-xs text-zinc-500">
                  {t("flow.all.supplier")}
                </dt>
                <dd className="font-medium text-zinc-900">
                  {supplier?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">
                  {t("flow.order.customer")}
                </dt>
                <dd className="font-medium text-zinc-900">
                  {customer?.name ?? "—"}
                </dd>
              </div>
            </>
          ) : null}
          <div>
            <dt className="text-xs text-zinc-500">{t("flow.all.stage")}</dt>
            <dd className="font-medium text-zinc-900" data-flow-order-stage>
              {t(`stage.${order.status}` as DictionaryKey)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{t("flow.order.created")}</dt>
            <dd className="font-medium text-zinc-900">
              {formatDate(order.createdAt, t)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-zinc-500">
          {t("flow.order.hint", { block: t(blockLabelKey(step.block)) })}
        </p>
      </Card>

      {creation ? (
        <Card title={t("flow.order.items")}>
          {items.length ? (
            <Table tools={false}>
              <thead>
                <tr>
                  <Th>{t("flow.order.product")}</Th>
                  <Th className="text-right">{t("flow.order.quantity")}</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className={rowClass} data-flow-order-item>
                    <Td>{productNameText(t, i.name)}</Td>
                    <Td className="text-right tabular-nums">
                      {i.quantity.toLocaleString(t.intl)} {i.unit}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>{t("common.none")}</Empty>
          )}
        </Card>
      ) : null}
      {creation && OrderRoundsSection ? (
        <OrderRoundsSection order={order} wellmix spawned={null} t={t} />
      ) : null}

      {mine.length ? (
        <Card title={t("flow.order.items.step")}>
          <ul className="divide-y divide-zinc-100" data-flow-order-requirements>
            {mine.map((r) => {
              const doc = docOf(r.documentId);
              const own = ownScreenOf(r.key, order.id);
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 py-2.5 @container"
                  data-flow-order-requirement={r.key}
                  data-status={r.status}
                >
                  <div className="min-w-0 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-900">
                        {requirementLabel(t, r)}
                      </span>
                      <Badge
                        tone={
                          r.status === "done"
                            ? "success"
                            : r.status === "rejected"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {t(`reqStatus.${r.status}`)}
                      </Badge>
                    </div>
                    {r.status !== "pending" ? (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {doc ? (
                          <TextLink
                            href={`/api/files/${doc.id}`}
                            target="_blank"
                          >
                            {doc.name} (v{doc.version})
                          </TextLink>
                        ) : r.value && r.type !== "confirm" ? (
                          <span>{r.value}</span>
                        ) : null}{" "}
                        · {name(r.submittedByUserId)} ·{" "}
                        {formatDate(r.submittedAt, t)}
                      </p>
                    ) : null}
                    {r.note ? (
                      <p className="mt-0.5 text-xs text-zinc-600">{r.note}</p>
                    ) : null}
                    {laneInputKeys(r.key, requirements).map((input) => {
                      const file = docOf(input.documentId);
                      return file ? (
                        <span
                          key={file.id}
                          className="mr-3 mt-0.5 inline-block text-xs text-zinc-600"
                        >
                          {t(input.label)}:{" "}
                          <TextLink
                            href={`/api/files/${file.id}`}
                            target="_blank"
                          >
                            {file.name} (v{file.version})
                          </TextLink>
                        </span>
                      ) : null;
                    })}
                  </div>
                  {canAct(r) ? (
                    own ? (
                      <div>
                        <LinkButton href={own.href} variant="secondary">
                          {t(own.label)}
                        </LinkButton>
                      </div>
                    ) : (
                      <RequirementForm
                        requirement={r}
                        orderId={order.id}
                        t={t}
                        returnTo={returnTo}
                      />
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {importViews.length ? (
        <ImportFlowCard
          t={t}
          order={order}
          steps={importViews}
          names={names}
          title={t(stepLabelKey(step))}
          anchor={
            step.key === "certification" ? "certification" : "import-flow"
          }
          notice={notices.import}
          returnTo={returnTo}
        />
      ) : null}

      {report ? (
        <InspectionResultCard t={t} report={report} userName={name} />
      ) : null}
      {production ? (
        <ProductionCard
          t={t}
          user={user}
          order={order}
          view={production}
          wellmix={wellmix}
          names={names}
          notice={notices.production}
          sections={
            step.key === "inspection"
              ? ["inspection"]
              : step.key === "pre-production"
                ? ["plan"]
                : ["plan", "followup"]
          }
          returnTo={returnTo}
        />
      ) : null}
      {receiving ? (
        <ReceivingCard
          t={t}
          order={order}
          view={receiving}
          notice={notices.receiving}
          sections={step.key === "storage" ? ["storage"] : ["return"]}
          returnTo={returnTo}
        />
      ) : null}
      {artwork ? (
        <ArtworkCard
          t={t}
          order={order}
          view={artwork}
          wellmix={wellmix}
          notice={notices.artwork}
          returnTo={returnTo}
        />
      ) : null}
      {freight ? (
        <FreightOrderCard
          t={t}
          user={user}
          orderId={order.id}
          notice={notices.freight}
          count={notices.freightN}
          error={null}
          returnTo={returnTo}
        />
      ) : null}

      {nothing ? <Empty>{t("flow.order.empty")}</Empty> : null}
    </div>
  );
}
