import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canViewRequest, isWellmix } from "@/lib/auth/permissions";
import { canDeleteRequest } from "@/lib/services/requests";
import { BulkDeleteBar, BulkSelectAll } from "@/components/bulk-delete";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { deleteRequestsAction } from "../actions/requests";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import {
  Alert,
  Badge,
  Card,
  Empty,
  LinkButton,
  PageHeader,
  Progress,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  rowClass,
  stageTone,
} from "@/components/ui";
import { TaskItems } from "@/components/task-list";
import { pendingTasksFor } from "@/lib/services/tasks";
import { customerOrdersInProgress } from "@/lib/services/customer-home";

const BULK_FORM = "requests-bulk-delete";

export default async function RequestsPage({
  searchParams,
}: PageProps<"/app/requests">) {
  const { view, deleted, skipped, error, group, created } = await searchParams;
  // Lote: ?group=<groupId> mostra só as solicitações criadas juntas.
  const groupId = typeof group === "string" && group ? group : null;
  const showDeleted = view === "deleted";
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!(isWellmix(user) || user.role === "customer")) redirect("/app");
  const t = await getT();
  const store = getStore();
  // Cliente: só as solicitações do próprio login (canViewRequest).
  // Cliente: esta é a página inicial; pendências e pedidos em andamento vêm no topo.
  const customer = user.role === "customer";
  // Tudo numa rodada só: lista, parceiros, pendências e pedidos em andamento.
  const [allRequests, parties, tasks, inProgress] = await Promise.all([
    store.list("requests", {
      filter: customer ? { customerId: user.partyId! } : undefined,
      orderBy: "createdAt",
      direction: "desc",
    }),
    store.list("parties", { filter: { type: "customer" } }),
    customer ? pendingTasksFor(user) : Promise.resolve([]),
    customer ? customerOrdersInProgress(user) : Promise.resolve([]),
  ]);
  const visible = allRequests.filter((r) => canViewRequest(user, r));
  // Excluídas (CANCELLED) saem da lista; ficam no filtro "Ver excluídas".
  const deletedCount = visible.filter((r) => r.status === "CANCELLED").length;
  const byStatus = visible.filter((r) =>
    showDeleted ? r.status === "CANCELLED" : r.status !== "CANCELLED",
  );
  const requests = byStatus.filter((r) => !groupId || r.groupId === groupId);
  // Tamanho de cada lote (selo na lista): só o que este usuário vê nesta
  // mesma lista (excluídas não contam), igual ao filtro do selo.
  const groupSize = new Map<string, number>();
  for (const r of byStatus)
    if (r.groupId)
      groupSize.set(r.groupId, (groupSize.get(r.groupId) ?? 0) + 1);
  const anyDeletable = requests.some((r) => canDeleteRequest(user, r));
  const count = (v: string | string[] | undefined) =>
    typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0;
  const errorKey = `reqDelete.error.${typeof error === "string" ? error : ""}`;

  return (
    <>
      <PageHeader
        help={
          customer
            ? {
                body: "help.customerHome.body",
                steps: "help.customerHome.steps",
              }
            : { body: "help.requests.body", steps: "help.requests.steps" }
        }
        t={t}
        title={t("requests.title")}
        subtitle={customer ? t("home.welcome", { name: user.name }) : undefined}
        actions={
          customer ? undefined : (
            <LinkButton href="/app/requests/new" variant="primary">
              + {t("requests.new")}
            </LinkButton>
          )
        }
      />
      {customer ? (
        <div className="mb-8 space-y-8">
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 shadow-sm">
            <div className="min-w-0 max-w-xl">
              <h2 className="text-lg font-semibold text-zinc-900">
                {t("customerHome.cta.title")}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                {t("customerHome.cta.body")}
              </p>
            </div>
            <LinkButton
              href="/app/requests/new"
              variant="primary"
              className="w-full px-6 py-3 text-base sm:w-auto"
            >
              + {t("requests.new")}
            </LinkButton>
          </section>

          {tasks.length > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                {t("customerHome.pending.title")}
                <Badge tone="warning">{tasks.length}</Badge>
              </h2>
              <TaskItems tasks={tasks} t={t} />
            </section>
          ) : null}

          {inProgress.length > 0 ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-zinc-900">
                  {t("customerHome.orders.title")}
                </h2>
                <TextLink href="/app/orders">
                  {t("customerHome.orders.all")}
                </TextLink>
              </div>
              <ul className="grid gap-3 md:grid-cols-2">
                {inProgress.map((o) => (
                  <li key={o.order.id}>
                    <Card>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-500">
                            #{o.order.number}
                          </p>
                          <p className="font-semibold text-zinc-900">
                            {o.productName}
                          </p>
                        </div>
                        <Badge
                          tone={stageTone(o.blocked ? "blocked" : "active")}
                        >
                          {t(`stage.${o.stageKey}`)}
                          {o.blocked ? ` · ${t("stageStatus.blocked")}` : ""}
                        </Badge>
                      </div>
                      <div className="mt-3 flex h-5 items-center gap-2">
                        <Progress percent={o.percent} />
                        <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-600">
                          {o.percent}%
                        </span>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-zinc-500">
                            {t("customerHome.orders.next")}
                          </dt>
                          <dd
                            className={cx(
                              "font-medium",
                              o.waitingOnYou
                                ? "text-amber-700"
                                : "text-zinc-800",
                            )}
                          >
                            {o.waitingOnYou
                              ? t("customerHome.orders.withYou")
                              : t("customerHome.orders.withWellmix")}
                          </dd>
                        </div>
                        {o.stageDueAt ? (
                          <div>
                            <dt className="text-xs text-zinc-500">
                              {t("customerHome.orders.stageDue")}
                            </dt>
                            <dd
                              className={cx(
                                "tabular-nums",
                                o.overdue
                                  ? "font-semibold text-red-700"
                                  : "text-zinc-800",
                              )}
                            >
                              {formatDate(o.stageDueAt)}
                            </dd>
                          </div>
                        ) : null}
                        {o.eta ? (
                          <div>
                            <dt className="text-xs text-zinc-500">
                              {t("customerHome.orders.eta")}
                            </dt>
                            <dd className="tabular-nums text-zinc-800">
                              {formatDate(o.eta)}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                      <div className="mt-4">
                        <LinkButton
                          href={`/app/orders/${o.order.id}`}
                          className="w-full sm:w-auto"
                        >
                          {t("customerHome.orders.follow")}
                        </LinkButton>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <h2 className="-mb-5 text-base font-semibold text-zinc-900">
            {t("customerHome.requests.title")}
          </h2>
        </div>
      ) : null}
      {count(created) > 1 ? (
        <div className="mb-3" data-batch-created>
          <Alert tone="success">
            {t("reqBatch.created", { n: count(created) })}
          </Alert>
        </div>
      ) : null}
      {count(deleted) > 0 ? (
        <div className="mb-3">
          <Alert tone="success">
            {t("reqDelete.done", { n: count(deleted) })}
            {count(skipped) > 0
              ? ` ${t("reqDelete.skipped", { n: count(skipped) })}`
              : ""}
          </Alert>
        </div>
      ) : null}
      {typeof error === "string" && error ? (
        <div className="mb-3">
          <Alert tone="danger">
            {t(errorKey as DictionaryKey) !== errorKey
              ? t(errorKey as DictionaryKey)
              : t("common.error")}
          </Alert>
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        {groupId ? (
          <>
            <span className="text-zinc-600" data-batch-filter>
              {t("reqBatch.filter", { n: requests.length })}
            </span>
            <TextLink href="/app/requests">{t("reqBatch.all")}</TextLink>
          </>
        ) : showDeleted ? (
          <>
            <span className="text-zinc-600">{t("reqDelete.deletedTitle")}</span>
            <TextLink href="/app/requests">
              {t("reqDelete.backToList")}
            </TextLink>
          </>
        ) : deletedCount > 0 ? (
          <TextLink href="/app/requests?view=deleted" className="ml-auto">
            {t("reqDelete.showDeleted", { n: deletedCount })}
          </TextLink>
        ) : null}
      </div>
      {!showDeleted && anyDeletable ? (
        <BulkDeleteBar
          formId={BULK_FORM}
          action={deleteRequestsAction}
          labels={{
            selectAll: t("reqDelete.selectAll"),
            clear: t("reqDelete.clear"),
            selected: t("reqDelete.selected"),
            deleteSelected: t("reqDelete.deleteSelected"),
            confirmMany: t("reqDelete.confirmMany"),
          }}
        />
      ) : null}
      {requests.length === 0 ? (
        <Empty>
          {customer ? t("customerHome.requests.empty") : t("common.none")}
        </Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              {!showDeleted && anyDeletable ? (
                <Th className="w-10">
                  <BulkSelectAll
                    formId={BULK_FORM}
                    label={t("reqDelete.selectAll")}
                  />
                </Th>
              ) : null}
              <Th>{t("common.product")}</Th>
              {isWellmix(user) ? <Th>{t("common.customer")}</Th> : null}
              <Th>{t("common.quantity")}</Th>
              <Th>{t("common.status")}</Th>
              <Th>{t("requests.deadline")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className={rowClass}>
                {!showDeleted && anyDeletable ? (
                  <Td className="w-10">
                    {canDeleteRequest(user, r) ? (
                      <input
                        type="checkbox"
                        name="ids"
                        value={r.id}
                        form={BULK_FORM}
                        aria-label={`${t("reqDelete.selectOne")}: ${r.productName}`}
                        className="h-4 w-4 accent-brand-600"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        disabled
                        aria-label={t("reqDelete.ordered")}
                        title={t("reqDelete.ordered")}
                        className="h-4 w-4 cursor-not-allowed opacity-40"
                      />
                    )}
                  </Td>
                ) : null}
                <Td className="min-w-40 font-medium text-zinc-900">
                  {r.productName}
                  {r.groupId && (groupSize.get(r.groupId) ?? 0) > 1 ? (
                    <TextLink
                      href={`/app/requests?group=${encodeURIComponent(r.groupId)}`}
                      className="ml-2 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-800 no-underline ring-1 ring-inset ring-brand-200"
                      data-batch-badge
                    >
                      {t("reqBatch.badge", { n: groupSize.get(r.groupId)! })}
                    </TextLink>
                  ) : null}
                </Td>
                {isWellmix(user) ? (
                  <Td className="min-w-32">
                    {parties.find((p) => p.id === r.customerId)?.name ?? "—"}
                  </Td>
                ) : null}
                <Td className="whitespace-nowrap tabular-nums">
                  {r.quantity} {r.unit}
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge
                    tone={
                      r.status === "ORDERED"
                        ? "success"
                        : r.status === "CANCELLED"
                          ? "neutral"
                          : r.status === "WAITING_DOWN_PAYMENT"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {t(`reqStatusLabel.${r.status}`)}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {formatDate(r.deadline)}
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <TextLink href={`/app/requests/${r.id}`}>
                      {t("tasks.open")}
                    </TextLink>
                    {!showDeleted && canDeleteRequest(user, r) ? (
                      <form action={deleteRequestsAction}>
                        <input type="hidden" name="ids" value={r.id} />
                        <ConfirmDeleteButton
                          label={t("reqDelete.delete")}
                          confirmText={t("reqDelete.confirmOne")}
                        />
                      </form>
                    ) : null}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
