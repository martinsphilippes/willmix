import { indexBy, listByIds, listColumns } from "@/lib/db/lookup";
import { ServerPager, SortTh } from "@/components/server-table";
import {
  SERVER_TABLE_FROM,
  parseServerPage,
  parseServerSort,
  serverTable,
  type ServerColumn,
} from "@/lib/server-table";
import { LiveSearch } from "@/components/live-search";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import {
  SCREENS,
  SCREEN_LABEL,
  canOpen,
  type Screen,
} from "@/lib/auth/screens";
import { canViewRequest, isAdmin, isWellmix } from "@/lib/auth/permissions";
import { canSeeMoney } from "@/lib/auth/function-access";
import { REQUEST_SCREEN } from "@/lib/request-screens";
import { canDeleteRequest } from "@/lib/services/requests";
import {
  activeRequests,
  closedRequestCount,
  closedRequests,
  groupRequests,
} from "@/lib/services/request-list-data";
import {
  cancelledOrderIds,
  requestDisplayStatus,
  requestStatusTone,
} from "@/lib/services/order-status";
import {
  BatchSelect,
  BulkDeleteBar,
  BulkSelectAll,
} from "@/components/bulk-delete";
import {
  groupRequestRows,
  type RequestListEntry,
} from "@/lib/services/request-groups";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { deleteRequestsAction } from "../actions/requests";
import { sendToStrategyAction } from "../actions/purchase-demand";
import {
  awaitingStrategySend,
  inStrategyQueue,
} from "@/lib/services/purchase-strategy";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore, type Request, type Role } from "@/lib/db";
import { getT } from "@/i18n/server";
import { productNameText } from "@/i18n";
import {
  Alert,
  Badge,
  Button,
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
  Input,
  OpenLink,
  rowClass,
  Stat,
  stageTone,
} from "@/components/ui";
import { TaskItems } from "@/components/task-list";
import { ChatOpenButton } from "@/components/chat-open-button";
import { pendingTasksFor } from "@/lib/services/tasks";
import { customerOrdersInProgress } from "@/lib/services/customer-home";
import { milestoneTitle, orderMilestoneText } from "@/lib/milestones";
import {
  LISTED_SITUATIONS,
  nextStepText,
  requestNextStep,
  todayBrazil,
  type NextStep,
  type RequestSituation,
} from "@/lib/services/request-list";
import { getSettings } from "@/lib/settings";
import { containersText } from "@/lib/request-rounds";
import {
  loadRequestPacking,
  packingRounds,
  packingTotalsLine,
  type RequestPacking,
} from "@/lib/services/request-packing";
import {
  encomendaTotals,
  totalSortText,
  type EncomendaTotals,
  type TotalKey,
  type TotalsLine,
} from "@/lib/request-totals";
import {
  SaleTotalValue,
  TotalValue,
  unitLabel,
} from "@/components/request-total-cells";
import {
  listDraftsForList,
  type ListedDraft,
} from "@/lib/services/request-drafts";
import { demandKind, type DemandKind } from "@/lib/purchase-demand";
import { isStockCustomer } from "@/lib/services/stock-party";
import { requestTurnContext } from "@/lib/services/request-turns";
import {
  turnFilterOf,
  turnNameKey,
  turnTone,
  turnWaitingKey,
  type TurnParty,
} from "@/lib/turn";
import {
  requestComposition,
  type Composition,
  type CompositionItem,
} from "@/lib/request-composition";
import {
  entryDue,
  listCards,
  type CardEntry,
} from "@/lib/services/request-list-cards";
import {
  isOverdue,
  responsibleKey,
  responsibleOf,
  stepDue,
  stepOwner,
  stepPartners,
  type Responsible,
  type StepDue,
} from "@/lib/request-responsible";
import { peopleDirectory } from "@/lib/services/request-responsible";
import { InfoTip } from "@/components/info-tip";
import { ListReturnMemory } from "@/components/list-return";
import {
  ResponsibleTip,
  draftResponsible,
  dueDayText,
  dueHourText,
  dueText,
} from "@/components/request-responsible-tip";
import { ClampText } from "@/components/clamp-text";

const BULK_FORM = "requests-bulk-delete";
/** Colunas de total (dono, 18/11/2026): ordenar por elas lê os totais de todas as linhas. */
const TOTAL_SORT_KEYS = new Set(["price", "pieces", "boxes", "inner", "cbm"]);
/** Fuso dos prazos (o dia de hoje e as horas dos SLA). */
const TIME_ZONE = "America/Sao_Paulo";

export default async function RequestsPage({
  searchParams,
}: PageProps<"/app/requests">) {
  const sp = await searchParams;
  const { view, deleted, skipped, error, group, created, denied } = sp;
  // Lote: ?group=<groupId> mostra só as solicitações criadas juntas.
  const groupId = typeof group === "string" && group ? group : null;
  const showDeleted = view === "deleted";
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "requests");
  // Tela negada no caminho até aqui (?denied=…): aviso, só com chave conhecida.
  const deniedScreen =
    typeof denied === "string" &&
    (SCREENS as readonly string[]).includes(denied)
      ? (denied as Screen)
      : null;
  const t = await getT();
  const store = getStore();
  // Cliente: só as solicitações do próprio login (canViewRequest).
  // Cliente: esta é a página inicial; pendências e pedidos em andamento vêm no topo.
  const customer = user.role === "customer";
  // Tudo numa rodada só: lista, parceiros, pendências e pedidos em andamento.
  const wellmix = isWellmix(user);
  // Só o que ainda é encomenda (dono, 16/11/2026): o banco devolve as da
  // etapa, não o histórico inteiro (src/lib/services/request-list-data.ts).
  // As encerradas, só em "Ver canceladas e excluídas"; o lote (?group=), o
  // lote todo, menos as encerradas.
  const scope = { customerId: customer ? user.partyId! : null };
  const [loaded, closedCount, tasks, inProgress, team] = await Promise.all([
    showDeleted
      ? closedRequests(scope)
      : groupId
        ? groupRequests(groupId, scope).then(async (rows) => ({
            rows,
            cancelled: await cancelledOrderIds(rows.map((r) => r.orderId)),
          }))
        : activeRequests(scope).then((rows) => ({
            rows,
            cancelled: new Set<string>(),
          })),
    showDeleted || groupId ? Promise.resolve(0) : closedRequestCount(scope),
    // Sem Pendências ou Pedidos no perfil (Gestão de telas), os blocos do
    // topo também não aparecem aqui.
    customer && canOpen(user, "tasks")
      ? pendingTasksFor(user)
      : Promise.resolve([]),
    customer && canOpen(user, "orders")
      ? customerOrdersInProgress(user)
      : Promise.resolve([]),
    // Todos os logins: o Analista e quem age na próxima ação (a equipe pela
    // função, os logins do cliente e os dos parceiros).
    wellmix ? store.list("users") : Promise.resolve([]),
  ]);
  const { cancelled } = loaded;
  const visible = loaded.rows.filter((r) => canViewRequest(user, r));
  // Só os clientes das solicitações (antes: todos, ~26 mil).
  const parties = (
    await listByIds(
      store,
      "parties",
      visible.map((r) => r.customerId),
    )
  ).filter((p) => p.type === "customer");
  // Encerradas num lugar só: excluídas (CANCELLED) e com pedido cancelado
  // ficam juntas em "Ver canceladas e excluídas".
  const closed = (r: (typeof visible)[number]) =>
    r.status === "CANCELLED" ||
    requestDisplayStatus(r, cancelled) === "ORDER_CANCELLED";
  const deletedCount = showDeleted ? visible.length : closedCount;
  const byStatus = visible.filter((r) =>
    showDeleted ? closed(r) : !closed(r),
  );
  // Wellmix: filtro por situação (cartões) e busca, como na ordem de venda.
  const situation: RequestSituation = (
    LISTED_SITUATIONS as readonly string[]
  ).includes(String(sp.situ))
    ? (sp.situ as RequestSituation)
    : "all";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 120) : "";
  // Encomenda (B14) ou reposição (B10): etiqueta e filtro (dono, 15/11/2026;
  // docs/PURCHASE_DEMAND.md).
  const kindFilter: DemandKind | null =
    sp.kind === "order" || sp.kind === "replenishment" ? sp.kind : null;
  const today = todayBrazil();
  const now = new Date();
  // Mapas no lugar de buscas na lista inteira a cada linha (auditoria de
  // performance, 14/11/2026: 16 mil solicitações × milhares de parceiros).
  const partyById = indexBy(parties, "id");
  const customerName = (id: string) => partyById.get(id)?.name ?? "";
  const filtering = wellmix && !showDeleted && !groupId;
  // De quem é a vez (dono, 18/11/2026; docs/TURNS.md): a compra de cada
  // encomenda (estratégia, cotação, solicitação ao fornecedor) e, na venda
  // aguardando o cliente, se há login que possa confirmar. O cliente vê só
  // se é a vez dele ou da Wellmix (a compra é interna).
  const turnCtx = wellmix ? await requestTurnContext(byStatus) : null;
  const strategyOf = (r: Request) =>
    wellmix
      ? awaitingStrategySend(r)
        ? ("send" as const)
        : inStrategyQueue(r)
          ? ("queue" as const)
          : null
      : null;
  const turnFilter = filtering ? turnFilterOf(sp.vez) : null;
  // As solicitações da lista (no filtro de um lote, só as dele).
  const pool = byStatus.filter((r) => !groupId || r.groupId === groupId);
  const orderIds = [
    ...new Set(pool.map((r) => r.orderId).filter(Boolean)),
  ] as string[];
  const orders =
    wellmix && orderIds.length
      ? await store.list("orders", { filter: { id: orderIds } })
      : [];
  const orderById = indexBy(orders, "id");
  // Fornecedor do pedido do tipo Trading: a vez aparece como Trading.
  const tradingIds = new Set(
    (
      await listByIds(
        store,
        "parties",
        orders.map((o) => o.supplierId),
      )
    )
      .filter((p) => p.type === "trading")
      .map((p) => p.id),
  );
  /* Wellmix: quem age e o prazo de cada pedido pelos marcos (fase 5g). As
     fotos e os itens dos pedidos são lidos depois, só para as linhas da
     página (composição do pedido, mais abaixo). */
  const nextInfo = wellmix
    ? await import("@/lib/services/request-export").then((m) =>
        m.orderNextInfoOf(orders),
      )
    : new Map<string, { responsibleRole: Role | null; dueAt: string | null }>();
  const teamById = indexBy(team, "id");
  /** O próximo passo de cada produto (a mesma regra das Pendências). */
  const stepCache = new Map<string, NextStep>();
  const nextOf = (r: Request): NextStep => {
    const cached = stepCache.get(r.id);
    if (cached) return cached;
    const order = r.orderId ? orderById.get(r.orderId) : null;
    const info = order ? nextInfo.get(order.id) : undefined;
    const step = requestNextStep({
      status: r.status,
      display: requestDisplayStatus(r, cancelled),
      // Encomenda a enviar para cotação, ou já na Estratégia de Compra.
      strategy: strategyOf(r),
      purchase: turnCtx?.purchaseOf(r) ?? null,
      customerLogin: turnCtx?.customerLoginOf(r) ?? null,
      order: order
        ? {
            status: order.status,
            responsibleRole: info?.responsibleRole ?? null,
            dueAt: info?.dueAt ?? null,
            trading: tradingIds.has(order.supplierId),
          }
        : null,
      today,
    });
    stepCache.set(r.id, step);
    return step;
  };
  /** Prazo da pendência do passo (dono, 19/11/2026, decisão 4). */
  const dueOf = (r: Request) =>
    stepDue(nextOf(r), r, turnCtx?.purchaseOf(r) ?? null);
  const nextText = (n: NextStep) => nextStepText(t, n);
  /**
   * Situação (dono, 18/11/2026; docs/TURNS.md): quem está com a vez
   * ("Aguardando cliente"; para o próprio cliente, "Aguardando você"), com a
   * situação gravada na dica. Sem vez (excluída, pedido cancelado ou
   * encerrado), a situação gravada.
   */
  const situationCell = (list: Request[]) => {
    const parts = new Map<
      string,
      {
        party: TurnParty | null;
        status: ReturnType<typeof requestDisplayStatus>;
        count: number;
      }
    >();
    for (const r of list) {
      const status = requestDisplayStatus(r, cancelled);
      const party = nextOf(r).who;
      const key = party ?? `status:${status}`;
      const cur = parts.get(key);
      parts.set(key, {
        party,
        status: cur?.status ?? status,
        count: (cur?.count ?? 0) + 1,
      });
    }
    return [...parts.values()].map(({ party, status, count: n }) =>
      party ? (
        <span
          key={party}
          title={t(`reqStatusLabel.${status}`)}
          data-request-turn={party}
        >
          <Badge tone={turnTone(party)}>
            {customer && party === "customer"
              ? t("turn.waiting.you")
              : t(turnWaitingKey(party))}
            {n > 1 ? ` ×${n}` : ""}
          </Badge>
        </span>
      ) : (
        <Badge key={status} tone={requestStatusTone(status)}>
          {t(`reqStatusLabel.${status}`)}
          {n > 1 ? ` ×${n}` : ""}
        </Badge>
      ),
    );
  };
  const ownerName = (id: string | null | undefined) =>
    id ? (teamById.get(id)?.name ?? "—") : "—";
  const listQuery = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | null> = {
      situ: situation === "all" ? null : situation,
      q: q || null,
      kind: kindFilter,
      vez: turnFilter,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const str = p.toString();
    return str ? `?${str}` : "";
  };
  // Produtos pedidos juntos viram uma linha só (abre a página do lote). No
  // filtro de um lote (?group=, links antigos) cada produto segue numa linha.
  type Entry = RequestListEntry<Request>;
  const entries: Entry[] = groupId
    ? pool.map((row) => ({ kind: "single", row }))
    : groupRequestRows(pool);
  const batchHref = (id: string) =>
    `/app/requests/batch/${encodeURIComponent(id)}`;
  /* Abrir é sempre no nível do pedido (dono, 18/11/2026), mesmo com um
     produto só: a página do lote, pelo groupId ou, na solicitação criada
     sozinha, pelo id dela. */
  const solicitationHref = (r: { id: string; groupId?: string | null }) =>
    batchHref(r.groupId ?? r.id);
  // Na ordem em que foram pedidos (igual à página do pedido).
  const rowsOf = (e: Entry) =>
    e.kind === "batch"
      ? [...e.rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : [e.row];
  /* Cards por solicitação (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
     seção 6): cada solicitação conta uma vez, os rascunhos de quem vê entram
     no Total e em Rascunhos, e os cards contam sobre tudo o que a busca, o
     tipo e o "Com quem está" deixam, antes da paginação. O card escolhido
     filtra a lista sem mudar a contagem dos outros. */
  type CardItem = CardEntry & { entry: Entry };
  const cardEntries: CardItem[] = entries.map((entry) => {
    const rows = rowsOf(entry);
    return {
      entry,
      customerName: customerName(rows[0].customerId),
      rows: rows.map((r) => ({
        number: r.number ?? null,
        productName: r.productName,
        description: r.description,
        kind: demandKind(r),
        step: nextOf(r),
        due: dueOf(r),
      })),
    };
  });
  // Rascunhos de quem está vendo (só dele, como sempre): todos, na lista.
  const drafts = filtering
    ? (await listDraftsForList(user, "requests", 500)).map((d) => ({
        ...d,
        number: d.draft.number ?? null,
        title: d.draft.title,
        customerName: d.draft.customerName,
      }))
    : [];
  const cards = filtering
    ? listCards(cardEntries, drafts, {
        situation,
        q,
        kind: kindFilter,
        turn: turnFilter,
        now,
        today,
      })
    : null;
  type ListRow =
    | { kind: "draft"; draft: ListedDraft }
    | { kind: "entry"; entry: Entry; card: CardItem };
  // Rascunhos primeiro (dono, 17/11/2026), depois as solicitações.
  const listed: ListRow[] = cards
    ? [
        ...cards.drafts.map((d) => ({ kind: "draft" as const, draft: d })),
        ...cards.entries.map((c) => ({
          kind: "entry" as const,
          entry: c.entry,
          card: c,
        })),
      ]
    : cardEntries.map((c) => ({
        kind: "entry" as const,
        entry: c.entry,
        card: c,
      }));
  /* Totais de cada encomenda (dono, 18/11/2026; docs/ORDER_LEVEL_LISTS.md,
     seção 5): preço (venda prevista, só com "Ver valores e margem"), peças,
     caixas master, caixas inner e CBM, pela embalagem de cada produto: a
     mesma regra da ficha completa e da página da encomenda
     (src/lib/services/request-packing.ts). Lidos para as linhas da página;
     para ordenar a lista longa por um total, para todas. */
  const seeSale = wellmix && canSeeMoney(user);
  const packingById = new Map<string, RequestPacking>();
  const linesOf = new Map<Entry, TotalsLine[]>();
  const totalsOf = new Map<Entry, EncomendaTotals>();
  const fillTotals = async (list: readonly Entry[]) => {
    const todo = list.filter((e) => !totalsOf.has(e));
    if (!todo.length) return;
    const loaded = await loadRequestPacking(
      todo.flatMap(rowsOf).filter((r) => !packingById.has(r.id)),
    );
    for (const [id, packing] of loaded) packingById.set(id, packing);
    for (const e of todo) {
      const lines = rowsOf(e).map((r) =>
        packingTotalsLine(
          r,
          packingById.get(r.id),
          productNameText(t, r.productName),
        ),
      );
      linesOf.set(e, lines);
      totalsOf.set(e, encomendaTotals(lines));
    }
  };
  const entryOf = (row: ListRow) => (row.kind === "entry" ? row.entry : null);
  const totalSort = (key: TotalKey) => (row: ListRow) => {
    const e = entryOf(row);
    return e ? totalSortText(totalsOf.get(e)?.[key].value ?? null) : "";
  };
  /** Instante em Brasília no formato que a ordem entende (AAAA-MM-DD HH:MM). */
  const brazilStamp = (at: string) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(at));
  /** Texto de ordem do prazo: o dia vale até o fim dele. */
  const dueSortText = (due: StepDue | null) =>
    !due ? "" : due.day ? `${due.at} 23:59` : brazilStamp(due.at);
  const columns: ServerColumn<ListRow>[] = [
    {
      key: "number",
      text: (row) =>
        String(
          row.kind === "draft"
            ? (row.draft.draft.number ?? "—")
            : (rowsOf(row.entry).find((r) => r.number)?.number ?? "—"),
        ),
    },
    // Totais (números com ponto: a ordem é numérica; sem dado, no fim).
    ...(seeSale
      ? [
          {
            key: "price",
            text: (row: ListRow) => {
              const e = entryOf(row);
              return e
                ? totalSortText(
                    totalsOf.get(e)?.sale.amounts[0]?.amount ?? null,
                  )
                : "";
            },
          },
        ]
      : []),
    { key: "pieces", text: totalSort("pieces") },
    { key: "boxes", text: totalSort("boxes") },
    { key: "inner", text: totalSort("inner") },
    { key: "cbm", text: totalSort("cbm") },
    {
      // Entregas: a maior programação entre os produtos (a programação
      // gravada em cada um; sem ela, uma entrega só).
      key: "rounds",
      text: (row) =>
        row.kind === "draft"
          ? ""
          : String(
              Math.max(
                1,
                ...rowsOf(row.entry).map((r) => r.schedule?.items?.length ?? 0),
              ),
            ),
    },
    ...(wellmix
      ? [
          {
            key: "customer",
            text: (row: ListRow) =>
              row.kind === "draft"
                ? (row.draft.draft.customerName ?? "—")
                : customerName(rowsOf(row.entry)[0].customerId) || "—",
          },
        ]
      : []),
    {
      key: "status",
      text: (row) =>
        row.kind === "draft"
          ? t("requestDraft.status")
          : rowsOf(row.entry)
              .map((r) => {
                const party = nextOf(r).who;
                return party
                  ? t(turnWaitingKey(party))
                  : t(`reqStatusLabel.${requestDisplayStatus(r, cancelled)}`);
              })
              .join(" "),
    },
    ...(wellmix
      ? [
          {
            key: "next",
            text: (row: ListRow) => {
              if (row.kind === "draft") return t("reqList.draft.next");
              const n = nextOf(rowsOf(row.entry)[0]);
              return n.key === "none" ? "—" : nextText(n);
            },
          },
        ]
      : []),
    {
      key: "deadline",
      text: (row) =>
        row.kind === "draft" ? "" : dueSortText(entryDue(row.card)),
    },
    ...(wellmix
      ? [
          {
            key: "owner",
            text: (row: ListRow) =>
              row.kind === "draft"
                ? ""
                : ownerName(rowsOf(row.entry)[0].ownerUserId),
          },
          {
            key: "date",
            text: (row: ListRow) =>
              (row.kind === "draft"
                ? row.draft.draft.createdAt
                : rowsOf(row.entry)[0].createdAt
              ).slice(0, 10),
          },
        ]
      : []),
  ];
  const serverMode = listed.length > SERVER_TABLE_FROM;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const sort = serverMode ? parseServerSort(one(sp.sort), columns) : null;
  if (sort && TOTAL_SORT_KEYS.has(sort.key))
    await fillTotals(
      listed.flatMap((r) => (r.kind === "entry" ? [r.entry] : [])),
    );
  const paged = serverTable(listed, columns, {
    sort,
    page: parseServerPage(one(sp.page)),
    size: serverMode ? undefined : Math.max(listed.length, 1),
    decimalComma: t.locale === "pt",
  });
  const pagedEntries = paged.rows.flatMap((r) =>
    r.kind === "entry" ? [r.entry] : [],
  );
  await fillTotals(pagedEntries);
  const sortValue = sort ? `${sort.desc ? "-" : ""}${sort.key}` : null;
  /* Encomendas, composição do pedido de cada linha (dono, 16/11/2026): os
     produtos, as fotos e a soma das peças pelos itens do pedido, não pelo
     produto da solicitação. Lidos só para as linhas da página: a lista
     inteira tem ~16 mil pedidos e ~185 mil itens (src/lib/request-composition.ts). */
  const shownRows = pagedEntries.flatMap(rowsOf);
  const shownOrderIds = [
    ...new Set(
      shownRows.map((r) => r.orderId).filter((id): id is string => !!id),
    ),
  ];
  const shownItems = shownOrderIds.length
    ? await listColumns(
        store,
        "order_items",
        ["orderId", "productId", "name", "quantity", "unit"],
        { filter: { orderId: shownOrderIds } },
      )
    : [];
  const itemsByOrder = new Map<string, CompositionItem[]>();
  for (const i of [...shownItems].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )) {
    const list = itemsByOrder.get(i.orderId);
    if (list) list.push(i);
    else itemsByOrder.set(i.orderId, [i]);
  }
  const compositionOf = new Map<Entry, Composition>(
    pagedEntries.map((e) => [e, requestComposition(rowsOf(e), itemsByOrder)]),
  );
  /* Lista no nível do pedido (dono, 18/11/2026): sem foto nem nome de
     produto (um pedido pode ter milhares). Entregas (programações) e
     containers de cada uma pela embalagem dos produtos (a mesma caixa master
     e o mesmo m³ dos totais; decisão 3 de 18/11/2026), no maior container
     das Configurações. */
  const { containerTypes } = await getSettings();
  const referenceContainer =
    [...containerTypes].sort((a, b) => b.capacityCbm - a.capacityCbm)[0] ??
    null;
  const roundsOf = new Map(
    pagedEntries.map((e) => [
      e,
      packingRounds(
        rowsOf(e),
        packingById,
        referenceContainer?.capacityCbm ?? null,
      ),
    ]),
  );
  /* Itens do pedido (histórico do Sankhya) que não estão nas linhas da
     encomenda: os totais dizem que ficaram de fora ("Total parcial"). */
  const fold = (v: string | null | undefined) =>
    (v ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const shownTotals = (e: Entry): EncomendaTotals => {
    const lines = linesOf.get(e) ?? [];
    const rows = rowsOf(e);
    const ids = new Set(rows.map((r) => r.productId).filter(Boolean));
    const names = new Set(rows.map((r) => fold(r.productName)));
    const uncovered = (compositionOf.get(e)?.products ?? [])
      .filter((p) =>
        p.productId ? !ids.has(p.productId) : !names.has(fold(p.name)),
      )
      .map((p) => p.name || "—");
    return uncovered.length
      ? encomendaTotals(lines, uncovered)
      : (totalsOf.get(e) ?? encomendaTotals(lines));
  };
  /* Quem age na próxima ação (dono, 19/11/2026; docs/ORDER_LEVEL_LISTS.md,
     seção 6): a mesma regra das Pendências, lida só para as linhas da
     página. O login (e-mail) só para o administrador. */
  const partnerIds = shownRows.flatMap((r) => {
    const step = nextOf(r);
    return stepOwner(step.key)?.kind === "partners"
      ? stepPartners(step.key, turnCtx?.purchaseOf(r)).map((p) => p.supplierId)
      : [];
  });
  const directory = wellmix
    ? await peopleDirectory(user, {
        users: team,
        requests: shownRows,
        ctx: turnCtx,
        partnerIds,
        customerName: (id) => customerName(id) || null,
        translate: (key) => t(key as DictionaryKey),
      })
    : null;
  const respCache = new Map<string, Responsible | null>();
  const respOf = (r: Request): Responsible | null => {
    if (!directory) return null;
    if (!respCache.has(r.id))
      respCache.set(
        r.id,
        responsibleOf(nextOf(r), r, turnCtx?.purchaseOf(r), directory),
      );
    return respCache.get(r.id) ?? null;
  };
  /** Prazo para mostrar: o dia; no SLA, também a hora (Brasília). */
  const dueDay = (due: StepDue) => dueDayText(t, due);
  const dueHour = (at: string) => dueHourText(t, at);
  const dueLabel = (due: StepDue) => dueText(t, due);
  const dueCell = (due: StepDue | null) => {
    if (!due) return <span className="text-zinc-400">—</span>;
    const late = isOverdue(due, now, today);
    return (
      <span
        className={cx(
          "block whitespace-nowrap tabular-nums",
          late && "font-semibold text-red-700",
        )}
        data-request-due={late ? "late" : "ok"}
      >
        {dueDay(due)}
        {due.day ? null : (
          <span className="block text-[11px] font-normal text-zinc-500">
            {dueHour(due.at)}
          </span>
        )}
        {late ? (
          <span className="block text-[11px] font-medium">
            {t("reqList.late")}
          </span>
        ) : null}
      </span>
    );
  };
  /** 2ª linha da Próxima ação: quem age, com a informação complementar. */
  const respCell = (r: Responsible | null) => <ResponsibleTip r={r} t={t} />;
  /**
   * As ações pendentes da solicitação: os produtos no mesmo passo e com os
   * mesmos responsáveis viram uma só; a que vence antes vem primeiro.
   */
  type ActionGroup = {
    step: NextStep;
    resp: Responsible | null;
    due: StepDue | null;
    count: number;
  };
  const dueTime = (d: StepDue | null) =>
    !d
      ? Number.POSITIVE_INFINITY
      : d.day
        ? Date.parse(`${d.at}T23:59:59-03:00`)
        : Date.parse(d.at);
  const actionsOf = (e: Entry): ActionGroup[] => {
    const groups = new Map<string, ActionGroup>();
    for (const r of rowsOf(e)) {
      const step = nextOf(r);
      if (step.key === "none") continue;
      const resp = respOf(r);
      const due = dueOf(r);
      const key = `${step.key}|${step.stage ?? ""}|${responsibleKey(resp)}`;
      const cur = groups.get(key);
      if (cur) {
        cur.count += 1;
        if (dueTime(due) < dueTime(cur.due)) cur.due = due;
      } else groups.set(key, { step, resp, due, count: 1 });
    }
    return [...groups.values()].sort((a, b) => dueTime(a.due) - dueTime(b.due));
  };
  const actionLine = (g: ActionGroup, main: boolean) => (
    <span
      className="block"
      data-request-next={main ? g.step.key : undefined}
      data-request-action={main ? undefined : g.step.key}
    >
      <span className="block font-medium leading-snug text-zinc-900">
        {nextText(g.step)}
      </span>
      {respCell(g.resp)}
    </span>
  );
  /** Próxima ação: a ação e quem age; ações paralelas, a lista aberta à parte. */
  const nextCell = (e: Entry) => {
    const groups = actionsOf(e);
    if (!groups.length) {
      // Sem ação pendente: o estado (excluída, pedido cancelado, encerrado).
      const first = rowsOf(e)[0];
      const n = nextOf(first);
      return (
        <span className="text-zinc-500" data-request-next="none">
          {n.key === "order"
            ? nextText(n)
            : t(`reqStatusLabel.${requestDisplayStatus(first, cancelled)}`)}
        </span>
      );
    }
    return (
      <>
        {actionLine(groups[0], true)}
        {groups.length > 1 ? (
          <details
            className="mt-1 text-xs"
            data-request-actions={groups.length}
          >
            <summary className="cursor-pointer font-medium text-brand-700">
              {t("reqList.actions.count", { n: groups.length })}
            </summary>
            <ul className="mt-1 space-y-1.5 border-l border-zinc-200 pl-2">
              {groups.map((g, i) => (
                <li key={i}>
                  {actionLine(g, false)}
                  <span className="block text-[11px] text-zinc-500">
                    {t("reqList.actions.products", { n: g.count })}
                    {g.due
                      ? ` · ${t("reqList.resp.due", { date: dueLabel(g.due) })}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </>
    );
  };
  /** Rascunho: a ação do fluxo de rascunho, com quem o salvou (quem vê). */
  const draftOwner = draftResponsible(user, isAdmin(user));
  /** Itens: quantos SKUs diferentes o pedido tem (itens do pedido ou as solicitações). */
  const skusCell = (e: Entry) => {
    const n = compositionOf.get(e)?.products.length ?? rowsOf(e).length;
    return (
      <span
        className="tabular-nums"
        title={t("reqList.skus.hint")}
        data-request-products={n}
      >
        {n}
      </span>
    );
  };
  const roundsCell = (e: Entry) => (
    <span className="tabular-nums" data-request-rounds="">
      {roundsOf.get(e)?.rounds ?? 1}
    </span>
  );
  const containersCell = (e: Entry) => {
    const info = roundsOf.get(e);
    if (!info?.containers)
      return (
        <span
          className="text-zinc-400"
          title={t("reqList.containers.missing")}
          data-request-containers=""
        >
          —
        </span>
      );
    return (
      <span
        className="whitespace-nowrap tabular-nums"
        title={t("reqList.containers.hint", {
          code: referenceContainer?.code ?? "",
        })}
        data-request-containers=""
      >
        {containersText(info.containers, (n) =>
          t("reqList.containers.each", { n }),
        )}
      </span>
    );
  };
  const pageListHref = (patch: { sort?: string | null; page?: number }) => {
    const p = new URLSearchParams();
    if (situation !== "all") p.set("situ", situation);
    if (q) p.set("q", q);
    if (kindFilter) p.set("kind", kindFilter);
    if (turnFilter) p.set("vez", turnFilter);
    if (showDeleted) p.set("view", "deleted");
    if (groupId) p.set("group", groupId);
    const value = patch.sort !== undefined ? patch.sort : sortValue;
    if (value) p.set("sort", value);
    if (patch.page) p.set("page", String(patch.page + 1));
    const str = p.toString();
    return str ? `/app/requests?${str}` : "/app/requests";
  };
  /* Cabeçalhos curtos numa linha (dono, 19/11/2026), cada um com a
     explicação acessível por mouse, toque e teclado (InfoTip). */
  const headLabel = (key: string) =>
    key === "cbm"
      ? unitLabel(t("reqList.head.cbm"))
      : t(`reqList.head.${key}` as DictionaryKey);
  const headHint = (key: string) => (
    <InfoTip
      label={t("reqList.head.hintLabel", {
        title: t(`reqList.head.${key}` as DictionaryKey),
      })}
      data-request-head-hint={key}
    >
      {t(`reqList.head.${key}.hint` as DictionaryKey)}
    </InfoTip>
  );
  const head = "whitespace-nowrap px-2 py-1.5";
  const header = (
    key: string,
    column: string | null,
    className?: string,
    hint = true,
  ) =>
    serverMode && column ? (
      <SortTh
        key={key}
        label={headLabel(key)}
        column={column}
        sort={sort}
        href={(value) => pageListHref({ sort: value })}
        t={t}
        className={cx(head, className)}
        hint={hint ? headHint(key) : null}
      />
    ) : (
      <Th key={key} className={cx(head, className)} data-request-head={key}>
        {headLabel(key)}
        {hint ? <> {headHint(key)}</> : null}
      </Th>
    );
  /**
   * Tipo e porta de entrada da demanda (docs/PURCHASE_DEMAND.md): saíram da
   * coluna Solicitação, que mostra só o número (dono, 19/11/2026), e ficam na
   * dica do número ("Encomenda · Vendedor"). A Estratégia de compra segue
   * com as etiquetas.
   */
  const demandOf = (r: Request) => {
    const kind = demandKind(r);
    if (!kind || (kind === "order" && isStockCustomer(r.customerId)))
      return null;
    return {
      kind,
      channel: r.channel ?? null,
      text: [
        t(`demand.kind.${kind}.one`),
        ...(r.channel ? [t(`demand.channel.${r.channel}`)] : []),
      ].join(" · "),
    };
  };
  /** Célula compacta (menos espaço vertical). */
  const cell = "px-2 py-1.5";
  const listedRequests = listed.flatMap((r) =>
    r.kind === "entry" ? rowsOf(r.entry) : [],
  );
  const anyDeletable = listedRequests.some((r) => canDeleteRequest(user, r));
  // Enviar para cotação (dono, 18/11/2026; docs/PURCHASE_DEMAND.md): a
  // encomenda Solicitado ainda não enviada entra na Estratégia de Compra. A
  // mesma seleção serve para enviar e para excluir.
  const canSend = (r: Request) =>
    wellmix && !showDeleted && awaitingStrategySend(r);
  const selectable = (r: Request) => canDeleteRequest(user, r) || canSend(r);
  const anySendable = listedRequests.some(canSend);
  const anySelectable = !showDeleted && (anyDeletable || anySendable);
  const count = (v: string | string[] | undefined) =>
    typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0;
  const errorKey = `reqDelete.error.${typeof error === "string" ? error : ""}`;
  const batchErrorKey = `reqBatch.error.${typeof error === "string" ? error : ""}`;
  const counts = cards?.counts ?? null;

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
        // Encomendas (dono, 15/11/2026): o mesmo nome do menu, para o
        // cliente e para a Wellmix.
        title={t("nav.demands")}
        subtitle={customer ? t("home.welcome", { name: user.name }) : undefined}
        // O cliente cria pela vitrine (cartão abaixo). Outro login que receba
        // a tela (Gestão de telas) só consulta: não cria solicitação.
        // Wellmix (dono, 16/11/2026): "+ Adicionar" abre TS - Trading Sales;
        // quem não abre essa tela segue para a Nova solicitação de Encomendas.
        actions={
          wellmix ? (
            <LinkButton
              href={
                canOpen(user, "requestTs")
                  ? REQUEST_SCREEN.ts.path
                  : "/app/requests/new"
              }
              variant="primary"
              data-request-add
            >
              + {t("requestScreen.add")}
            </LinkButton>
          ) : undefined
        }
      />
      {customer ? (
        <div className="mb-3 space-y-4">
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 shadow-sm">
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
              className="w-full px-5 py-2.5 text-base sm:w-auto"
            >
              + {t("requests.new")}
            </LinkButton>
          </section>

          {/* Pendências (tabela, largura inteira) e, embaixo, os pedidos em andamento. */}
          {tasks.length > 0 || inProgress.length > 0 ? (
            <div className="grid items-start gap-4">
              {tasks.length > 0 ? (
                <section className="min-w-0 space-y-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
                    {t("customerHome.pending.title")}
                    <Badge tone="warning">{tasks.length}</Badge>
                  </h2>
                  <TaskItems tasks={tasks} t={t} />
                </section>
              ) : null}

              {inProgress.length > 0 ? (
                <section className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-semibold text-zinc-900">
                      {t("customerHome.orders.title")}
                    </h2>
                    <TextLink href="/app/orders">
                      {t("customerHome.orders.all")}
                    </TextLink>
                  </div>
                  <ul
                    className={cx(
                      "grid gap-3",
                      tasks.length > 0
                        ? "sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"
                        : "sm:grid-cols-2 lg:grid-cols-3",
                    )}
                  >
                    {inProgress.map((o) => (
                      <li key={o.order.id}>
                        <Card>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-500">
                                #{o.order.number}
                              </p>
                              <p className="font-semibold text-zinc-900">
                                {productNameText(t, o.productName)}
                              </p>
                            </div>
                            <Badge
                              tone={stageTone(o.blocked ? "blocked" : "active")}
                            >
                              {o.milestone
                                ? milestoneTitle(t, o.milestone)
                                : orderMilestoneText(t, o.order.status)}
                              {o.blocked
                                ? ` · ${t("stageStatus.blocked")}`
                                : ""}
                            </Badge>
                          </div>
                          <div className="mt-2 flex h-5 items-center gap-2">
                            <Progress percent={o.percent} />
                            <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-600">
                              {o.percent}%
                            </span>
                          </div>
                          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
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
                                  {formatDate(o.stageDueAt, t)}
                                </dd>
                              </div>
                            ) : null}
                            {o.eta ? (
                              <div>
                                <dt className="text-xs text-zinc-500">
                                  {t("customerHome.orders.eta")}
                                </dt>
                                <dd className="tabular-nums text-zinc-800">
                                  {formatDate(o.eta, t)}
                                </dd>
                              </div>
                            ) : null}
                          </dl>
                          <div className="mt-3">
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
            </div>
          ) : null}

          <h2 className="text-base font-semibold text-zinc-900">
            {t("customerHome.requests.title")}
          </h2>
        </div>
      ) : null}
      {/* Volta dos detalhes: a lista abre como estava (busca, filtros,
          página e rolagem; src/lib/list-return.ts). */}
      <ListReturnMemory list="requests" />
      {deniedScreen ? (
        <div className="mb-3">
          <Alert tone="warning">
            {t("access.denied", { screen: t(SCREEN_LABEL[deniedScreen]) })}
          </Alert>
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
      {count(sp.strategySent) > 0 ? (
        <div
          className="mb-3"
          role="status"
          data-strategy-sent={count(sp.strategySent)}
        >
          <Alert tone="success">
            {t("reqSend.done", { n: count(sp.strategySent) })}
            {count(sp.strategySkipped) > 0
              ? ` ${t("reqSend.skipped", { n: count(sp.strategySkipped) })}`
              : ""}{" "}
            {canOpen(user, "purchaseStrategy") ? (
              <TextLink href="/app/purchase-strategy">
                {t("reqSend.open")}
              </TextLink>
            ) : null}
          </Alert>
        </div>
      ) : null}
      {typeof error === "string" && error ? (
        <div className="mb-3">
          <Alert tone="danger">
            {t(errorKey as DictionaryKey) !== errorKey
              ? t(errorKey as DictionaryKey)
              : t(batchErrorKey as DictionaryKey) !== batchErrorKey
                ? t(batchErrorKey as DictionaryKey)
                : t("common.error")}
          </Alert>
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        {groupId ? (
          <>
            <span className="text-zinc-600" data-batch-filter>
              {t("reqBatch.filter", { n: pool.length })}
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
      {filtering && cards && counts ? (
        <div className="mb-3 space-y-2" data-request-filters>
          {/* Total | Abertas | Rascunhos | Atrasadas (dono, 19/11/2026),
              contados por solicitação; o escolhido fica marcado. */}
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            data-request-cards
          >
            {LISTED_SITUATIONS.map((k) => (
              <div
                key={k}
                title={t(`reqList.situ.${k}.hint`)}
                data-request-card={k}
                data-request-card-count={counts[k]}
              >
                <Stat
                  compact
                  label={t(`reqList.situ.${k}`)}
                  value={counts[k]}
                  href={`/app/requests${listQuery({ situ: k === "all" ? null : k })}`}
                  tone={
                    situation === k
                      ? undefined
                      : k === "late" && counts.late > 0
                        ? "danger"
                        : "neutral"
                  }
                  active={situation === k}
                />
              </div>
            ))}
          </div>
          {/* Os chips Todas / Encomendas / Reposições saíram (dono, 18/11/2026):
              a Reposição tem tela própria. O ?kind= dos links antigos vale. */}
          {/* Com quem está a vez (dono, 18/11/2026; docs/TURNS.md). */}
          {cards.chips.length || turnFilter ? (
            <nav
              className="flex flex-wrap items-center gap-2 text-sm"
              aria-label={t("turn.filter.title")}
              title={t("turn.filter.hint")}
              data-turn-filter
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {t("turn.filter.title")}
              </span>
              {(
                [
                  { party: null, count: null },
                  ...cards.chips,
                  ...(turnFilter &&
                  !cards.chips.some((c) => c.party === turnFilter)
                    ? [{ party: turnFilter, count: 0 }]
                    : []),
                ] as { party: TurnParty | null; count: number | null }[]
              ).map(({ party, count: n }) => (
                <a
                  key={party ?? "all"}
                  href={`/app/requests${listQuery({ vez: party })}`}
                  aria-current={turnFilter === party ? "page" : undefined}
                  data-turn={party ?? "all"}
                  className={cx(
                    "rounded-full border px-3 py-1",
                    turnFilter === party
                      ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50",
                  )}
                >
                  {party ? t(turnNameKey(party)) : t("turn.filter.all")}
                  {n !== null ? ` · ${n}` : ""}
                </a>
              ))}
            </nav>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <form
              method="get"
              action="/app/requests"
              className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
              data-request-search
            >
              {situation !== "all" ? (
                <input type="hidden" name="situ" value={situation} />
              ) : null}
              {kindFilter ? (
                <input type="hidden" name="kind" value={kindFilter} />
              ) : null}
              {turnFilter ? (
                <input type="hidden" name="vez" value={turnFilter} />
              ) : null}
              <Input
                name="q"
                defaultValue={q}
                placeholder={t("reqList.search")}
                aria-label={t("reqList.search")}
                className="w-full max-w-md"
              />
              <LiveSearch />
              <Button type="submit" variant="primary">
                {t("reqList.searchButton")}
              </Button>
            </form>
            <LinkButton
              href={`/app/requests/export${listQuery({})}`}
              data-request-export
            >
              {t("reqList.export")}
            </LinkButton>
          </div>
        </div>
      ) : null}
      {anySelectable ? (
        <BulkDeleteBar
          formId={BULK_FORM}
          action={anyDeletable ? deleteRequestsAction : sendToStrategyAction}
          showDelete={anyDeletable}
          lead={
            anySendable
              ? {
                  action: sendToStrategyAction,
                  label: t("reqSend.button"),
                  confirmText: t("reqSend.confirm"),
                  marker: "strategy",
                }
              : undefined
          }
          labels={{
            selectAll: t("reqDelete.selectAll"),
            clear: t("reqDelete.clear"),
            selected: t("reqDelete.selected"),
            deleteSelected: t("reqDelete.deleteSelected"),
            confirmMany: t("reqDelete.confirmMany"),
          }}
        />
      ) : null}
      {listed.length === 0 ? (
        <Empty>
          {customer
            ? t("customerHome.requests.empty")
            : filtering && (q || situation !== "all" || turnFilter)
              ? t("reqList.empty")
              : t("common.none")}
        </Empty>
      ) : (
        <Table tools={!serverMode} returnKey="requests">
          <thead>
            <tr>
              {anySelectable ? (
                <Th className="w-10 px-2 py-1.5">
                  <BulkSelectAll
                    formId={BULK_FORM}
                    label={t("reqDelete.selectAll")}
                  />
                </Th>
              ) : null}
              {/* Solicitação | Cliente | Itens | Valor | Peças | Master |
                  Inner | CBM (m³) | Situação | Cont./prog. | Entregas |
                  Próxima ação | Prazo | Analista | Data (dono, 19/11/2026).
                  MOQ e Pedido saíram da tabela (seguem na página da
                  solicitação e no CSV). */}
              {header("number", "number", "w-px")}
              {wellmix
                ? header("customer", "customer", "min-w-[11rem]", false)
                : null}
              {header("items", null, "text-right")}
              {seeSale ? header("value", "price", "text-right") : null}
              {header("pieces", "pieces", "text-right")}
              {header("master", "boxes", "text-right")}
              {header("inner", "inner", "text-right")}
              {header("cbm", "cbm", "text-right")}
              {header("situation", "status")}
              {header("containers", null, "text-right")}
              {header("deliveries", "rounds", "text-right")}
              {wellmix ? header("next", "next", "min-w-[13rem]") : null}
              {header("deadline", "deadline")}
              {wellmix ? header("owner", "owner") : null}
              {wellmix ? header("date", "date") : null}
              <Th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {paged.rows.map((row) => {
              if (row.kind === "draft") {
                const { draft } = row.draft;
                /* O número e o ícone abrem a mesma tela de detalhes das
                   enviadas, pelo id do rascunho (dono, 19/11/2026;
                   docs/ORDER_LEVEL_LISTS.md, seção 7), só para consulta;
                   "Continuar edição" fica lá. */
                const href = batchHref(draft.id);
                return (
                  <tr
                    key={`draft-${draft.id}`}
                    className={cx(rowClass, "bg-amber-50/40")}
                    data-request-list-draft={draft.id}
                  >
                    {anySelectable ? <Td className={cell} /> : null}
                    <Td className={cx(cell, "whitespace-nowrap tabular-nums")}>
                      {/* Só o número persistente (reservado no rascunho),
                          como o das enviadas: abre os detalhes. */}
                      <TextLink
                        href={href}
                        aria-label={t("reqList.draft.open", {
                          n: draft.number ?? "",
                        })}
                        className="font-semibold text-zinc-900 no-underline hover:underline"
                        data-request-draft-open=""
                        data-list-return=""
                      >
                        <span data-request-number>{draft.number ?? "—"}</span>
                      </TextLink>
                    </Td>
                    {wellmix ? (
                      <Td className={cx(cell, "min-w-[11rem]")}>
                        <ClampText
                          text={
                            draft.customerName ?? t("requestDraft.noCustomer")
                          }
                          more={t("reqList.more")}
                          less={t("reqList.less")}
                        />
                      </Td>
                    ) : null}
                    <Td className={cx(cell, "text-right tabular-nums")}>
                      {draft.itemCount}
                    </Td>
                    {seeSale ? (
                      <Td className={cx(cell, "text-right text-zinc-400")}>
                        —
                      </Td>
                    ) : null}
                    <Td className={cx(cell, "text-right text-zinc-400")}>—</Td>
                    <Td className={cx(cell, "text-right text-zinc-400")}>—</Td>
                    <Td className={cx(cell, "text-right text-zinc-400")}>—</Td>
                    <Td className={cx(cell, "text-right text-zinc-400")}>—</Td>
                    <Td className={cx(cell, "whitespace-nowrap")}>
                      <Badge tone="neutral">{t("requestDraft.status")}</Badge>
                    </Td>
                    <Td className={cx(cell, "text-right text-zinc-400")}>—</Td>
                    <Td className={cx(cell, "text-right text-zinc-400")}>—</Td>
                    {wellmix ? (
                      <Td className={cell}>
                        <span className="block" data-request-next="draft">
                          <span className="block font-medium leading-snug text-zinc-900">
                            {t("reqList.draft.next")}
                          </span>
                          {respCell(draftOwner)}
                        </span>
                      </Td>
                    ) : null}
                    <Td className={cx(cell, "text-zinc-400")}>—</Td>
                    {wellmix ? (
                      <Td className={cx(cell, "text-zinc-400")}>—</Td>
                    ) : null}
                    {wellmix ? (
                      <Td
                        className={cx(cell, "whitespace-nowrap tabular-nums")}
                      >
                        {formatDate(draft.createdAt, t)}
                      </Td>
                    ) : null}
                    <Td className={cx(cell, "text-right")}>
                      <div className="flex items-center justify-end gap-1">
                        <OpenLink
                          href={href}
                          label={t("reqList.draft.view")}
                          data-request-list-draft-open
                          data-list-return=""
                        />
                        {/* A conversa do rascunho com o cliente dele, que
                            passa para a solicitação no envio (dono,
                            19/11/2026; docs/ORDER_LEVEL_LISTS.md, seção 8). */}
                        <ChatOpenButton
                          target={{ draftId: draft.id }}
                          label={t("chat.openDraft")}
                        />
                      </div>
                    </Td>
                  </tr>
                );
              }
              const entry = row.entry;
              // Na ordem em que foram pedidos (igual à página do pedido).
              const rows = rowsOf(entry);
              const first = rows[0];
              const href = solicitationHref(first);
              const deletable = rows.filter((r) => canDeleteRequest(user, r));
              const pickable = rows.filter(selectable);
              const statuses = rows.map((r) =>
                requestDisplayStatus(r, cancelled),
              );
              const number = rows.find((r) => r.number)?.number ?? null;
              // Pedido cancelado: a dica não diz mais que "o pedido continua".
              const lockedHint = statuses.includes("ORDER_CANCELLED")
                ? t("reqStatusLabel.ORDER_CANCELLED")
                : t("reqDelete.ordered");
              const names = rows.map((r) => productNameText(t, r.productName));
              const tot = shownTotals(entry);
              const sortOf = (key: TotalKey) => totalSortText(tot[key].value);
              const due = entryDue(row.card);
              const demand = demandOf(first);
              return (
                <tr
                  key={entry.kind === "batch" ? entry.groupId : first.id}
                  className={rowClass}
                  data-batch-row={entry.kind === "batch" ? "" : undefined}
                  data-request-row={first.id}
                >
                  {anySelectable ? (
                    <Td className={cx(cell, "w-10")}>
                      {pickable.length > 0 ? (
                        entry.kind === "batch" ? (
                          <BatchSelect
                            formId={BULK_FORM}
                            groupKey={entry.groupId}
                            ids={pickable.map((r) => r.id)}
                            label={`${t("reqBatch.selectBatch")}: ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}`}
                          />
                        ) : (
                          <input
                            type="checkbox"
                            name="ids"
                            value={first.id}
                            form={BULK_FORM}
                            aria-label={`${t("reqDelete.selectOne")}: ${names[0]}`}
                            className="h-4 w-4 accent-brand-600"
                          />
                        )
                      ) : (
                        <input
                          type="checkbox"
                          disabled
                          aria-label={lockedHint}
                          title={lockedHint}
                          className="h-4 w-4 cursor-not-allowed opacity-40"
                        />
                      )}
                    </Td>
                  ) : null}
                  {/* Só o número real e persistente, como link (dono,
                      19/11/2026): sem "#", produto, subtítulo ou etiqueta. */}
                  <Td className={cx(cell, "whitespace-nowrap tabular-nums")}>
                    <TextLink
                      href={href}
                      aria-label={t("reqList.number.open", { n: number ?? "" })}
                      title={demand?.text}
                      className="font-semibold text-zinc-900 no-underline hover:underline"
                      data-request-open
                      data-demand-tags={demand?.kind}
                      data-demand-channel={demand?.channel ?? undefined}
                      data-list-return=""
                    >
                      <span data-request-number>{number ?? "—"}</span>
                    </TextLink>
                  </Td>
                  {wellmix ? (
                    <Td className={cx(cell, "min-w-[11rem]")}>
                      <ClampText
                        text={customerName(first.customerId) || "—"}
                        more={t("reqList.more")}
                        less={t("reqList.less")}
                      />
                    </Td>
                  ) : null}
                  <Td className={cx(cell, "text-right")}>{skusCell(entry)}</Td>
                  {seeSale ? (
                    <Td
                      className={cx(cell, "text-right")}
                      data-sort={totalSortText(
                        tot.sale.amounts[0]?.amount ?? null,
                      )}
                    >
                      <SaleTotalValue t={t} sale={tot.sale} />
                    </Td>
                  ) : null}
                  <Td
                    className={cx(cell, "text-right")}
                    data-sort={sortOf("pieces")}
                  >
                    <TotalValue t={t} part={tot.pieces} total="pieces" />
                  </Td>
                  <Td
                    className={cx(cell, "text-right")}
                    data-sort={sortOf("boxes")}
                  >
                    <TotalValue t={t} part={tot.boxes} total="boxes" />
                  </Td>
                  <Td
                    className={cx(cell, "text-right")}
                    data-sort={sortOf("inner")}
                  >
                    <TotalValue t={t} part={tot.inner} total="inner" />
                  </Td>
                  <Td
                    className={cx(cell, "text-right")}
                    data-sort={sortOf("cbm")}
                  >
                    <TotalValue t={t} part={tot.cbm} total="cbm" />
                  </Td>
                  {/* Selos numa linha (sem quebrar o texto de cada um). */}
                  <Td className={cx(cell, "whitespace-nowrap")}>
                    <span
                      className="flex flex-wrap gap-1"
                      data-request-situation
                    >
                      {situationCell(rows)}
                    </span>
                  </Td>
                  <Td className={cx(cell, "text-right")}>
                    {containersCell(entry)}
                  </Td>
                  <Td className={cx(cell, "text-right")}>
                    {roundsCell(entry)}
                  </Td>
                  {wellmix ? (
                    <Td className={cx(cell, "min-w-[13rem]")}>
                      {nextCell(entry)}
                    </Td>
                  ) : null}
                  <Td className={cell} data-sort={dueSortText(due)}>
                    {dueCell(due)}
                  </Td>
                  {wellmix ? (
                    <Td className={cx(cell, "whitespace-nowrap")}>
                      {ownerName(first.ownerUserId)}
                    </Td>
                  ) : null}
                  {wellmix ? (
                    <Td className={cx(cell, "whitespace-nowrap tabular-nums")}>
                      {formatDate(first.createdAt, t)}
                    </Td>
                  ) : null}
                  <Td className={cx(cell, "text-right")}>
                    <div className="flex items-center justify-end gap-1">
                      <OpenLink
                        href={href}
                        label={t("reqList.open")}
                        data-list-return=""
                      />
                      {!showDeleted && deletable.length > 0 ? (
                        <form action={deleteRequestsAction}>
                          {deletable.map((r) => (
                            <input
                              key={r.id}
                              type="hidden"
                              name="ids"
                              value={r.id}
                            />
                          ))}
                          <ConfirmDeleteButton
                            label={
                              entry.kind === "batch"
                                ? t("reqBatch.deleteAll")
                                : t("reqDelete.delete")
                            }
                            confirmText={
                              entry.kind === "batch"
                                ? t("reqBatch.deleteAllConfirm")
                                : t("reqDelete.confirmOne")
                            }
                          />
                        </form>
                      ) : null}
                      {/* Conversa do pedido: abre pela primeira solicitação dele. */}
                      <ChatOpenButton
                        target={{ requestId: first.id }}
                        label={t("chat.open")}
                      />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {serverMode && listed.length ? (
        <ServerPager
          page={paged}
          href={(page) => pageListHref({ page })}
          t={t}
        />
      ) : null}
    </>
  );
}
