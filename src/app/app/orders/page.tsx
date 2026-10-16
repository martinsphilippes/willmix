import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canSeeSupplier, isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { STAGE_KEYS, REQUEST_STATUSES } from "@/lib/db/schema";
import { pipelineFor } from "@/lib/services/pipeline";
import { Empty, PageHeader, formatDate } from "@/components/ui";
import { OrdersTable, type OrdersTableRow } from "@/components/orders-table";

/*
 * Pedidos: todos os pedidos (em andamento, bloqueados, concluídos e
 * cancelados, este com a etapa em que parou) e, para a Wellmix, também as
 * solicitações que ainda não viraram pedido. Filtro em todas as colunas.
 */

/**
 * Dia em Brasília (AAAA-MM-DD), como nas Pendências: prazo só com a data
 * (AAAA-MM-DD ou meia-noite UTC) vale como está; instante (atualização) vira
 * o dia de Brasília.
 */
function brazilDay(value: string | Date | null) {
  if (!value) return "";
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/.test(value)
  )
    return value.slice(0, 10);
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

export default async function OrdersPage({
  searchParams,
}: PageProps<"/app/orders">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getT();
  const params = await searchParams;
  const rows = await pipelineFor(user);
  const wellmix = isWellmix(user);
  const showCustomer = wellmix;
  const showSupplier = canSeeSupplier(user) && user.role !== "supplier";

  // Ordem das etapas no fluxo: solicitação antes do pedido; cancelada por último.
  const rank = (row: (typeof rows)[number]) =>
    row.phase.kind === "stage"
      ? 100 + STAGE_KEYS.indexOf(row.phase.key)
      : row.phase.key === "CANCELLED"
        ? 999
        : REQUEST_STATUSES.indexOf(
            row.phase.key as (typeof REQUEST_STATUSES)[number],
          );
  const tableRows: OrdersTableRow[] = rows.map((r) => ({
    key: r.key,
    href: r.href,
    number:
      r.kind === "order"
        ? `#${r.number ?? "—"}`
        : r.number
          ? t("orders.panel.requestNumber", { n: r.number })
          : "—",
    isRequest: r.kind === "request",
    product: r.product,
    customer: r.customer ?? "",
    supplier: r.supplier ?? "",
    phase:
      r.phase.kind === "stage"
        ? t(`stage.${r.phase.key}` as DictionaryKey)
        : t(`reqStatusLabel.${r.phase.key}` as DictionaryKey),
    phaseKey: `${r.phase.kind}:${r.phase.key}`,
    phaseRank: rank(r),
    state: r.state,
    progress: r.progress,
    due: brazilDay(r.dueAt),
    dueLabel: formatDate(r.dueAt, t),
    updated: brazilDay(r.updatedAt),
    updatedLabel: formatDate(r.updatedAt, t),
  }));
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v.slice(0, 120) : undefined;

  return (
    <>
      <PageHeader
        help={{ body: "help.orders.body" }}
        t={t}
        title={t("orders.title")}
      />
      {tableRows.length === 0 ? (
        <Empty>{t("common.none")}</Empty>
      ) : (
        <OrdersTable
          rows={tableRows}
          showCustomer={showCustomer}
          showSupplier={showSupplier}
          today={brazilDay(new Date())}
          initial={{
            n: one(params.n),
            p: one(params.p),
            c: one(params.c),
            s: one(params.s),
            ph: one(params.ph),
            st: one(params.st),
            pr: one(params.pr),
            d: one(params.d),
            u: one(params.u),
            sort: one(params.sort),
          }}
          labels={{
            number: "#",
            product: t("common.product"),
            customer: t("common.customer"),
            supplier: t("common.supplier"),
            phase: t("orders.stage"),
            state: t("common.status"),
            progress: t("common.progress"),
            due: t("common.due"),
            updated: t("orders.panel.updated"),
            all: t("orders.panel.all"),
            search: t("orders.panel.search"),
            states: {
              active: t("orders.panel.state.active"),
              blocked: t("orders.panel.state.blocked"),
              done: t("orders.panel.state.done"),
              cancelled: t("orders.panel.state.cancelled"),
            },
            progressOptions: {
              none: t("orders.panel.progress.none"),
              partial: t("orders.panel.progress.partial"),
              full: t("orders.panel.progress.full"),
            },
            dueOptions: {
              overdue: t("orders.panel.due.overdue"),
              week: t("orders.panel.due.week"),
              none: t("orders.panel.due.none"),
            },
            updatedOptions: {
              today: t("orders.panel.updated.today"),
              week: t("orders.panel.updated.week"),
              month: t("orders.panel.updated.month"),
            },
            request: t("orders.panel.request"),
            count: t("orders.panel.count", {
              shown: "{shown}",
              total: "{total}",
            }),
            clear: t("orders.panel.clear"),
            empty: t("orders.panel.empty"),
            sortBy: t("orders.panel.sortBy"),
          }}
        />
      )}
    </>
  );
}
