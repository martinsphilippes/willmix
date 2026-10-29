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
  const phaseLabel = (r: (typeof rows)[number]) =>
    r.phase.kind === "stage"
      ? t(`stage.${r.phase.key}` as DictionaryKey)
      : t(`reqStatusLabel.${r.phase.key}` as DictionaryKey);
  const refLabel = (r: (typeof rows)[number]) =>
    r.kind === "order"
      ? `#${r.number ?? "—"}`
      : r.number
        ? t("orders.panel.requestNumber", { n: r.number })
        : "—";
  const money = (value: number | null, currency: string | null) =>
    value === null
      ? null
      : `${currency ?? ""} ${value.toLocaleString(t.intl, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        })}`.trim();

  // Como no Sankhya: uma linha por solicitação (os produtos do mesmo lote
  // juntos) e, embaixo, os itens da linha escolhida. Cada produto continua
  // com o próprio pedido; a linha resume o grupo.
  const groups = new Map<string, (typeof rows)[number][]>();
  for (const r of rows)
    groups.set(r.groupKey, [...(groups.get(r.groupKey) ?? []), r]);
  const STATE_WEIGHT = {
    blocked: 0,
    active: 1,
    done: 2,
    cancelled: 3,
  } as const;
  const tableRows: OrdersTableRow[] = [...groups.values()].map((members) => {
    const sorted = [...members].sort(
      (a, b) => (a.number ?? 0) - (b.number ?? 0) || a.key.localeCompare(b.key),
    );
    const first = sorted[0];
    const live = sorted.filter((r) => r.state !== "cancelled");
    // Etapa: a do produto mais atrasado no fluxo (o que ainda segura o grupo).
    const lead = [...(live.length ? live : sorted)].sort(
      (a, b) => rank(a) - rank(b),
    )[0];
    const state = sorted
      .map((r) => r.state)
      .sort((a, b) => STATE_WEIGHT[a] - STATE_WEIGHT[b])[0];
    const progresses = sorted
      .map((r) => r.progress)
      .filter((p): p is number => p !== null);
    const dues = live
      .map((r) => r.dueAt)
      .filter((d): d is string => !!d)
      .sort((a, b) => brazilDay(a).localeCompare(brazilDay(b)));
    const updated = sorted
      .map((r) => r.updatedAt)
      .sort()
      .at(-1)!;
    const single = sorted.length === 1;
    const suppliers = [
      ...new Set(sorted.map((r) => r.supplier).filter((s): s is string => !!s)),
    ];
    const orderRefs = sorted.filter((r) => r.kind === "order").map(refLabel);
    return {
      key: first.groupKey,
      href: single ? first.href : (first.groupHref ?? first.href),
      number:
        single || !first.requestNumber
          ? refLabel(first)
          : t("orders.panel.requestNumber", { n: first.requestNumber }),
      // Embaixo do número: os pedidos do grupo (ou "Solicitação").
      subtitle: single
        ? first.kind === "request"
          ? t("orders.panel.request")
          : first.requestNumber
            ? t("orders.panel.requestNumber", { n: first.requestNumber })
            : null
        : orderRefs.length
          ? orderRefs.join(" · ")
          : t("orders.panel.request"),
      isRequest: sorted.every((r) => r.kind === "request"),
      product: first.product,
      items: sorted.flatMap((r) =>
        r.items.map((i) => ({
          name: i.name,
          variant: i.variant,
          quantity: `${i.quantity.toLocaleString(t.intl)} ${i.unit}`,
          price: wellmix ? money(i.unitPrice, i.currency) : null,
          supplier: r.supplier ?? "",
          ref: refLabel(r),
          href: r.href,
          phase: phaseLabel(r),
          state: r.state,
          progress: r.progress,
          dueLabel: formatDate(r.dueAt, t),
          due: brazilDay(r.dueAt),
        })),
      ),
      customer: first.customer ?? "",
      supplier: suppliers.join(", "),
      phase: phaseLabel(lead),
      phaseKey: `${lead.phase.kind}:${lead.phase.key}`,
      phaseRank: rank(lead),
      state,
      progress: progresses.length
        ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length)
        : null,
      due: dues.length ? brazilDay(dues[0]) : "",
      dueLabel: dues.length ? formatDate(dues[0], t) : formatDate(null, t),
      updated: brazilDay(updated),
      updatedLabel: formatDate(updated, t),
    };
  });
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
            moreItems: t("orders.panel.moreItems", { n: "{n}" }),
            itemsOf: t("orders.panel.itemsOf", { ref: "{ref}" }),
            pickRow: t("orders.panel.pickRow"),
            price: t("orders.panel.unitPrice"),
            seq: t("orders.panel.seq"),
            variant: t("orders.panel.variant"),
            quantity: t("common.quantity"),
            ref: t("orders.panel.ref"),
            moreItem: t("orders.panel.moreItem"),
            items: t("orders.panel.items"),
            showItems: t("orders.panel.showItems"),
            hideItems: t("orders.panel.hideItems"),
            openOrder: t("orders.panel.openOrder"),
            openRequest: t("orders.panel.openRequest"),
            noItems: t("orders.panel.noItems"),
          }}
        />
      )}
    </>
  );
}
