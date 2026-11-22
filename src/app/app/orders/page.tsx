import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canSeeSupplier, isWellmix } from "@/lib/auth/permissions";
import { canSeeMoney } from "@/lib/auth/function-access";
import { ORDER_COLUMNS, ORDER_ITEM_COLUMNS } from "@/lib/order-table";
import {
  loadOrderCells,
  type OrderCellsResult,
} from "@/lib/services/order-cells";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { REQUEST_STATUSES } from "@/lib/db/schema";
import { blockLabelKey } from "@/lib/flow";
import { MILESTONES, milestoneRank, milestoneTitle } from "@/lib/milestones";
import {
  turnCounts,
  turnNameKey,
  turnTone,
  turnWaitingKey,
  type TurnParty,
} from "@/lib/turn";
import { getStore, type Product, type ProductPhoto } from "@/lib/db";
import {
  loadPipelineItems,
  pipelineFor,
  type PipelineItem,
} from "@/lib/services/pipeline";
import {
  ORDERS_FILTER_KEYS,
  ORDERS_PAGE_SIZE,
  filterOrderRows,
  ordersPage,
  ordersPhaseFilter,
  parseOrdersSort,
} from "@/lib/orders-filter";
import {
  JOURNEY_STEPS,
  journeyPercent,
  type JourneyStep,
} from "@/lib/services/journey";
import { itemLogistics, logisticsTotals } from "@/lib/services/item-logistics";
import { productPhotoList } from "@/lib/services/product-list";
import { Empty, PageHeader, formatDate } from "@/components/ui";
import { CreateOrderButton } from "@/components/create-order-button";
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
  // Itens dos pedidos lidos só onde a tela precisa (com o resumo em uso):
  // ver abaixo e loadPipelineItems (auditoria de performance, 14/11/2026).
  const rows = await pipelineFor(user, { lazyItems: true });
  const wellmix = isWellmix(user);
  const showCustomer = wellmix;
  const showSupplier = canSeeSupplier(user) && user.role !== "supplier";

  // Marco atual do pedido (docs/MILESTONES.md, fase 4a) na coluna e no
  // filtro, na ordem dos 16 marcos: solicitação antes do pedido; cancelada
  // (sem a etapa em que parou) por último.
  const rank = (row: (typeof rows)[number]) =>
    row.milestone
      ? 100 + milestoneRank(row.milestone)
      : row.phase.kind === "stage"
        ? 100 + milestoneRank(null)
        : row.phase.key === "CANCELLED"
          ? 999
          : REQUEST_STATUSES.indexOf(
              row.phase.key as (typeof REQUEST_STATUSES)[number],
            );
  const phaseLabel = (r: (typeof rows)[number]) =>
    r.milestone
      ? milestoneTitle(t, r.milestone)
      : r.phase.kind === "stage"
        ? t(`stage.${r.phase.key}` as DictionaryKey)
        : t(`reqStatusLabel.${r.phase.key}` as DictionaryKey);
  const phaseKeyOf = (r: (typeof rows)[number]) =>
    r.milestone ? `milestone:${r.milestone}` : `${r.phase.kind}:${r.phase.key}`;
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
  // Produtos e fotos: só os dos itens da página mostrada (carregados depois
  // do filtro e da paginação, mais abaixo).
  const store = getStore();
  let productById = new Map<string, Product>();
  let photos: ProductPhoto[] = [];
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
  for (const r of rows) {
    const list = groups.get(r.groupKey);
    if (list) list.push(r);
    else groups.set(r.groupKey, [r]);
  }
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

  /* Tabela padrão (dono, 22/11/2026; docs/ORDER_TABLES.md): o que vem da
     solicitação ligada a cada pedido, lido só para as linhas da página. */
  const seeTerms = wellmix || user.role === "customer";
  const seeValue = wellmix && canSeeMoney(user);
  let cells: OrderCellsResult = { byKey: new Map(), byRequest: new Map() };
  const turnText = (turn: TurnParty | null) =>
    turn
      ? (user.role === "customer" && turn === "customer") ||
        (user.role === "supplier" &&
          (turn === "supplier" || turn === "trading"))
        ? t("turn.waiting.you")
        : t(turnWaitingKey(turn))
      : "";
  const standardItem = (r: (typeof rows)[number], i: PipelineItem) => {
    const own = r.requestId ? cells.byRequest.get(r.requestId) : undefined;
    // Preço e embalagem da solicitação só valem para o produto dela (o
    // pedido do Sankhya com vários itens não tem solicitação por item).
    const single = r.items.length === 1 ? own : undefined;
    const product = i.productId ? (productById.get(i.productId) ?? null) : null;
    const inner = single?.packing?.inner?.value ?? product?.innerBoxQty ?? null;
    const price = (value: number | null | undefined) =>
      seeValue && value !== null && value !== undefined
        ? money(value, single?.currency ?? "BRL")
        : null;
    return {
      description: [i.name, i.variant, wellmix ? i.specification : null]
        .map((part) => (part ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" · "),
      turn: r.turn ?? "",
      turnLabel: turnText(r.turn),
      turnTone: r.turn ? turnTone(r.turn) : ("neutral" as const),
      priceIpi: price(single?.prices.ipi),
      priceIpiFreight: price(single?.prices.ipiFreight),
      perInner: wellmix && inner ? num(inner, 0) : null,
      pieces: `${i.quantity.toLocaleString(t.intl)} ${i.unit}`.trim(),
    };
  };
  const standardRow = (
    members: (typeof rows)[number][],
    key: string,
  ): NonNullable<OrdersTableRow["std"]> => {
    const c = seeTerms ? cells.byKey.get(key) : undefined;
    const created = members
      .map((r) => r.createdAt)
      .filter((d): d is string => !!d)
      .sort()[0];
    const tracks = [
      ...new Set(members.map((r) => r.track).filter((v): v is string => !!v)),
    ];
    return {
      track: tracks.join(", "),
      negotiationDate: formatDate(c?.negotiationDate ?? created ?? null, t),
      saleType: c?.terms.saleType
        ? t(`orderTable.saleType.${c.terms.saleType}`)
        : "",
      paymentTerm: c?.terms.installments ? String(c.terms.installments) : "",
      paymentMethod: c?.terms.paymentName ?? "",
      billing: c?.terms.billing
        ? t(`orderTable.billing.${c.terms.billing}`)
        : "",
      vip:
        wellmix && c?.terms.vip
          ? t(`orderTerms.tier.${c.terms.vip}` as DictionaryKey)
          : "",
      group: wellmix ? (c?.group ?? "") : "",
      customerCode: wellmix ? (c?.customerCode ?? "") : "",
      deliveries: c ? String(c.deliveries) : "",
      cbm:
        c && c.cbm.value !== null
          ? `${num(c.cbm.value, 3)}${c.cbm.missing.length ? " *" : ""}`
          : "",
      value:
        seeValue && c
          ? c.sale.amounts
              .map((a) => money(a.amount, a.currency))
              .filter(Boolean)
              .join(" · ")
          : "",
    };
  };

  /** Item completo (linhas da página): textos formatados e detalhe. */
  const itemRow = (
    r: (typeof rows)[number],
    i: PipelineItem,
  ): OrdersTableRow["items"][number] => ({
    orderItemId: r.kind === "order" ? (i.id ?? null) : null,
    name: i.name,
    variant: i.variant,
    quantity: `${i.quantity.toLocaleString(t.intl)} ${i.unit}`,
    // Preço de compra: só com "Ver preço de compra" (o serviço já não manda o valor).
    price:
      wellmix && i.unitPrice !== null ? money(i.unitPrice, i.currency) : null,
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
    ...standardItem(r, i),
  });
  const buildRow = (
    members: (typeof rows)[number][],
    detailed: boolean,
  ): OrdersTableRow => {
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
      // Produtos diferentes (SKUs): com os itens lidos, pelo cadastro (ou o
      // nome); sem eles, quantos itens cada pedido tem.
      productCount: detailed
        ? new Set(
            sorted.flatMap((r) =>
              r.items.map((i) => i.productId ?? `n:${i.name}`),
            ),
          ).size
        : sorted.reduce((n, r) => n + (r.itemCount || r.items.length), 0),
      // Resumo (todas as linhas, só para filtrar e ordenar): sem os textos
      // formatados dos itens. Cada toLocaleString/formatDate cria um
      // formatador; com ~100 mil itens isso passava de 20 s.
      items: sorted.flatMap((r) =>
        r.items.map((i) =>
          detailed
            ? itemRow(r, i)
            : {
                orderItemId: null,
                name: i.name,
                variant: i.variant,
                quantity: "",
                price: null,
                supplier: "",
                ref: "",
                href: r.href,
                phase: "",
                state: r.state,
                progress: null,
                step: r.journey,
                stepLabel: null,
                dueLabel: "",
                due: "",
                detail: null,
              },
        ),
      ),
      itemsTotals: detailed ? itemsTotals(sorted) : null,
      ...(detailed ? { std: standardRow(sorted, first.groupKey) } : {}),
      customer: first.customer ?? "",
      supplier: suppliers.join(", "),
      phase: phaseLabel(lead),
      phaseKey: phaseKeyOf(lead),
      phaseRank: rank(lead),
      // Quem está com a vez (docs/TURNS.md): a do produto que segura o
      // grupo; para quem vê, "Aguardando você" quando é a vez dele.
      turn: lead.turn ?? "",
      turnLabel: turnText(lead.turn),
      turnTone: lead.turn ? turnTone(lead.turn) : "neutral",
      state,
      progress: stepPercent(journeyLead.journey),
      step: journeyLead.journey,
      stepLabel: stepLabel(journeyLead.journey),
      due: dues.length ? brazilDay(dues[0]) : "",
      dueLabel: !detailed
        ? ""
        : dues.length
          ? formatDate(dues[0], t)
          : formatDate(null, t),
      updated: brazilDay(updated),
      updatedLabel: detailed ? formatDate(updated, t) : "",
    };
  };

  // Filtro, ordem e página no servidor (com milhares de pedidos do Sankhya,
  // mandar tudo ao navegador passava do tempo da Vercel). O detalhe dos
  // itens (foto, código, caixas, volume) só sai para as linhas da página.
  const today = brazilDay(new Date());
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v.slice(0, 120) : undefined;
  // Itens ainda não lidos: o filtro de produto procura em todos os itens de
  // todos os pedidos (lê só nome e variação); sem ele, basta saber se o
  // pedido tem itens (o filtro de progresso conta o produto de cada pedido
  // com itens), e o item fica com o nome do primeiro produto.
  if ((one(params.p) ?? "").trim())
    await loadPipelineItems(user, rows, "names");
  else
    for (const r of rows)
      if (r.itemsPending && r.itemCount > 0 && !r.items.length)
        r.items = [
          {
            name: r.product,
            variant: null,
            quantity: 0,
            unit: "",
            unitPrice: null,
            currency: null,
            productId: null,
            variantData: null,
            specification: null,
          },
        ];
  const entries = [...groups.values()].map((members) => ({
    members,
    row: buildRow(members, false),
  }));
  const filters = Object.fromEntries(
    ORDERS_FILTER_KEYS.map((k) => [k, one(params[k]) ?? ""]),
  );
  // Link antigo pela etapa (?ph=stage:PREPARATION ou só a chave): o marco dela.
  filters.ph = ordersPhaseFilter(filters.ph);
  const entryOf = new Map(entries.map((e) => [e.row, e]));
  const matched = filterOrderRows(
    entries.map((e) => e.row),
    filters,
    parseOrdersSort(one(params.sort)),
    { today, showCustomer, showSupplier },
  );
  const { page, pages, start } = ordersPage(one(params.pg), matched.length);
  const pageEntries = matched
    .slice(start, start + ORDERS_PAGE_SIZE)
    .map((r) => entryOf.get(r)!);
  // Os itens inteiros só dos pedidos da página.
  await loadPipelineItems(
    user,
    pageEntries.flatMap((e) => e.members),
    "full",
  );
  const productIds = wellmix
    ? [
        ...new Set(
          pageEntries
            .flatMap((e) => e.members.flatMap((r) => r.items))
            .map((i) => i.productId)
            .filter((id): id is string => !!id),
        ),
      ]
    : [];
  if (productIds.length) {
    const [products, productPhotos] = await Promise.all([
      store.list("products", { filter: { id: productIds } }),
      store.list("product_photos", { filter: { productId: productIds } }),
    ]);
    productById = new Map(products.map((p) => [p.id, p]));
    photos = productPhotos;
  }
  if (seeTerms)
    cells = await loadOrderCells(
      pageEntries.map((e) => ({
        key: e.members[0].groupKey,
        requestIds: [
          ...new Set(
            e.members.map((r) => r.requestId).filter((v): v is string => !!v),
          ),
        ],
      })),
    );
  const tableRows: OrdersTableRow[] = pageEntries.map((e) =>
    buildRow(e.members, true),
  );
  // As listas dos filtros vêm de todas as linhas (situações das
  // solicitações); os 16 marcos entram sempre, agrupados pelo bloco.
  const phaseSeen = new Map<string, { label: string; rank: number }>();
  for (const { row } of entries)
    if (!phaseSeen.has(row.phaseKey))
      phaseSeen.set(row.phaseKey, { label: row.phase, rank: row.phaseRank });
  const seenOptions = [...phaseSeen.entries()]
    .filter(([key]) => !key.startsWith("milestone:"))
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([key, v]) => [key, v.label] as [string, string]);
  const phaseOptions: Array<[string, string, string?]> = [
    ...seenOptions.filter(([key]) => key !== "request:CANCELLED"),
    ...MILESTONES.map(
      (m) =>
        [
          `milestone:${m.key}`,
          milestoneTitle(t, m.key),
          t(blockLabelKey(m.block)),
        ] as [string, string, string],
    ),
    ...seenOptions.filter(([key]) => key === "request:CANCELLED"),
  ];
  const stateOptions = (
    ["blocked", "active", "done", "cancelled"] as const
  ).filter((st) => entries.some((e) => e.row.state === st));
  // Com quem está a vez (docs/TURNS.md): as partes presentes, na ordem.
  const turnOptions = turnCounts(
    entries.map((e) => (e.row.turn || null) as TurnParty | null),
  ).map(({ party }) => [party, t(turnNameKey(party))] as [string, string]);
  return (
    <>
      <PageHeader
        help={{ body: "help.orders.body" }}
        t={t}
        title={t("orders.title")}
        actions={<CreateOrderButton user={user} t={t} />}
      />
      {entries.length === 0 ? (
        <Empty>{t("common.none")}</Empty>
      ) : (
        <OrdersTable
          rows={tableRows}
          showCustomer={showCustomer}
          showSupplier={showSupplier}
          showTerms={seeTerms}
          showValue={seeValue}
          today={today}
          paging={{
            page,
            pages,
            matched: matched.length,
            total: entries.length,
            phases: phaseOptions,
            states: [...stateOptions],
            turns: turnOptions,
          }}
          initial={{
            n: one(params.n),
            p: one(params.p),
            c: one(params.c),
            s: one(params.s),
            ph: filters.ph || undefined,
            st: one(params.st),
            pr: one(params.pr),
            d: one(params.d),
            u: one(params.u),
            w: one(params.w),
            sort: one(params.sort),
          }}
          labels={{
            number: "#",
            product: t("common.product"),
            products: t("reqList.col.skus"),
            customer: t("common.customer"),
            supplier: t("common.supplier"),
            phase: t("milestone.current"),
            state: t("common.status"),
            turn: t("turn.filter.title"),
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
            pageOf: t("orders.panel.pageOf", {
              page: "{page}",
              pages: "{pages}",
            }),
            pagePrev: t("orders.panel.pagePrev"),
            pageNext: t("orders.panel.pageNext"),
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
            std: Object.fromEntries(
              ORDER_COLUMNS.map((key) => [
                key,
                t(
                  `orderTable.head.${
                    key === "customerName"
                      ? "customer"
                      : key === "sla"
                        ? "deadline"
                        : key
                  }` as DictionaryKey,
                ),
              ]),
            ),
            stdItem: Object.fromEntries(
              ORDER_ITEM_COLUMNS.map((key) => [
                key,
                t(`orderItems.head.${key}` as DictionaryKey),
              ]),
            ),
            track: t("orderTable.track", { id: "{id}" }),
          }}
        />
      )}
    </>
  );
}
