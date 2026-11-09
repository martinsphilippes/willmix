import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canSeeSupplier, isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { STAGE_KEYS, REQUEST_STATUSES } from "@/lib/db/schema";
import { getStore, type Product, type ProductPhoto } from "@/lib/db";
import { pipelineFor, type PipelineItem } from "@/lib/services/pipeline";
import {
  JOURNEY_STEPS,
  journeyPercent,
  type JourneyStep,
} from "@/lib/services/journey";
import { itemLogistics, logisticsTotals } from "@/lib/services/item-logistics";
import { productPhotoList } from "@/lib/services/product-list";
import { Empty, PageHeader, formatDate } from "@/components/ui";
import { galleryProps } from "@/components/photo-gallery-props";
import {
  OrdersTable,
  type OrdersItemDetail,
  type OrdersItemsTotals,
  type OrdersTableRow,
} from "@/components/orders-table";

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
  requireScreen(user, "orders");
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

  /*
   * Tabela de itens com as colunas da folha do fornecedor (foto, código, cód.
   * do item, especificação, cor, peso, quantidade por caixa, caixas, volume
   * e valor): só a Wellmix, a mesma regra da foto, do código e do preço FOB
   * nos itens do pedido. Para os demais nada disso sai do servidor.
   */
  const productIds = wellmix
    ? [
        ...new Set(
          rows
            .flatMap((r) => r.items.map((i) => i.productId))
            .filter((id): id is string => !!id),
        ),
      ]
    : [];
  const store = getStore();
  const [products, photos] = productIds.length
    ? await Promise.all([
        store.list("products", { filter: { id: productIds } }),
        store.list("product_photos", { filter: { productId: productIds } }),
      ])
    : [[] as Product[], [] as ProductPhoto[]];
  const productById = new Map(products.map((p) => [p.id, p]));
  const num = (n: number, digits = 2) =>
    n.toLocaleString(t.intl, { maximumFractionDigits: digits });
  /** Conta do item (a mesma da folha do fornecedor) e preço × quantidade. */
  const figures = (i: PipelineItem) => {
    const product = i.productId ? (productById.get(i.productId) ?? null) : null;
    return {
      product,
      logistics: itemLogistics({
        quantity: i.quantity,
        variant: i.variantData,
        product,
        specification: i.specification,
      }),
      amount:
        i.unitPrice !== null
          ? Math.round(i.unitPrice * i.quantity * 100) / 100
          : null,
    };
  };
  const itemDetail = (i: PipelineItem): OrdersItemDetail | null => {
    if (!wellmix) return null;
    const { product, logistics: l, amount } = figures(i);
    const gallery = galleryProps(
      t,
      product ? productPhotoList(product, photos) : [],
    );
    return {
      photos: gallery.photos,
      gallery: gallery.labels,
      sku: l.sku,
      supplierSku: l.supplierSku,
      specification: l.specification,
      color: l.color,
      weight: l.weightKg !== null ? num(l.weightKg) : null,
      perBox: l.unitsPerBox !== null ? num(l.unitsPerBox, 0) : null,
      // Sem quantidade por caixa no cadastro, "—" (não um 0 enganoso).
      boxes: l.unitsPerBox !== null ? num(l.boxes, 0) : null,
      cbm: l.cbm !== null ? num(l.cbm, 3) : null,
      amount: money(amount, i.currency),
    };
  };
  /** Total dos itens que seguem (cancelados fora; grupo todo cancelado: todos). */
  const itemsTotals = (
    members: (typeof rows)[number][],
  ): OrdersItemsTotals | null => {
    if (!wellmix) return null;
    const live = members.filter((r) => r.state !== "cancelled");
    const totals = logisticsTotals(
      (live.length ? live : members)
        .flatMap((r) => r.items)
        .map((i) => {
          const { logistics, amount } = figures(i);
          return {
            quantity: i.quantity,
            unit: i.unit,
            logistics,
            amount,
            currency: i.currency,
          };
        }),
    );
    const amounts = Object.entries(totals.amounts)
      .map(([currency, value]) => money(value, currency))
      .filter((s): s is string => !!s);
    return {
      weight: totals.weightKg !== null ? num(totals.weightKg) : null,
      quantity: totals.quantity
        ? `${totals.quantity.value.toLocaleString(t.intl)} ${totals.quantity.unit}`
        : null,
      boxes: totals.boxes !== null ? num(totals.boxes, 0) : null,
      cbm: totals.cbm !== null ? num(totals.cbm, 3) : null,
      amount: amounts.length ? amounts.join(" · ") : null,
    };
  };

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
  // Progresso: o passo da viagem (os quadrados da Control Tower), 0% a 100%.
  const stepLabel = (step: JourneyStep | null) =>
    step ? t(`board.card.${step}` as DictionaryKey) : null;
  const stepPercent = (step: JourneyStep | null) =>
    step ? journeyPercent(step) : null;
  const stepIndex = (step: JourneyStep | null) =>
    step ? JOURNEY_STEPS.indexOf(step) : Number.POSITIVE_INFINITY;

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
    // Progresso do grupo: o produto mais atrasado na viagem (a mesma regra da Etapa).
    const journeyLead = [...(live.length ? live : sorted)].sort(
      (a, b) => stepIndex(a.journey) - stepIndex(b.journey),
    )[0];
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
          orderItemId: r.kind === "order" ? (i.id ?? null) : null,
          name: i.name,
          variant: i.variant,
          quantity: `${i.quantity.toLocaleString(t.intl)} ${i.unit}`,
          price: wellmix ? money(i.unitPrice, i.currency) : null,
          supplier: r.supplier ?? "",
          ref: refLabel(r),
          href: r.href,
          phase: phaseLabel(r),
          state: r.state,
          progress: stepPercent(r.journey),
          step: r.journey,
          stepLabel: stepLabel(r.journey),
          dueLabel: formatDate(r.dueAt, t),
          due: brazilDay(r.dueAt),
          detail: itemDetail(i),
        })),
      ),
      itemsTotals: itemsTotals(sorted),
      customer: first.customer ?? "",
      supplier: suppliers.join(", "),
      phase: phaseLabel(lead),
      phaseKey: `${lead.phase.kind}:${lead.phase.key}`,
      phaseRank: rank(lead),
      state,
      progress: stepPercent(journeyLead.journey),
      step: journeyLead.journey,
      stepLabel: stepLabel(journeyLead.journey),
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
            // Os passos da viagem; quem não vê solicitações, só os do pedido.
            journey: {
              groupRequest: t("board.block.request"),
              groupOrder: t("board.block.order"),
              steps: JOURNEY_STEPS.filter(
                (step) => wellmix || step.startsWith("ord"),
              ).map((step) => [
                step,
                `${stepLabel(step)} (${journeyPercent(step)}%)`,
              ]),
              cancelled: t("orders.panel.state.cancelled"),
              stoppedAt: t("board.stoppedAt", { step: "{step}" }),
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
            chat: t("chat.open"),
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
            // Os mesmos nomes de coluna da folha do fornecedor.
            image: t("sale.col.photo"),
            code: t("sale.col.code"),
            itemCode: t("sale.col.supplierSku"),
            spec: t("sale.col.spec"),
            color: t("sale.col.color"),
            weight: t("sale.col.weight"),
            perBox: t("sale.col.perBox"),
            boxes: t("sale.col.boxes"),
            cbm: t("sale.col.cbm"),
            amount: t("supp.sale.col.amount"),
            total: t("sale.total"),
            more: t("sale.more"),
          }}
        />
      )}
    </>
  );
}
