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
import { canViewRequest, isWellmix } from "@/lib/auth/permissions";
import { REQUEST_SCREEN } from "@/lib/request-screens";
import { canDeleteRequest } from "@/lib/services/requests";
import {
  activeRequests,
  closedRequestCount,
  closedRequests,
  groupRequests,
  groupSizes,
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
  earliestDeadline,
  groupRequestRows,
  statusCounts,
  type RequestListEntry,
} from "@/lib/services/request-groups";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { deleteRequestsAction } from "../actions/requests";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { getStore, type Role } from "@/lib/db";
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
  inSituation,
  matchesRequest,
  nextStepText,
  nextStepWho,
  requestNextStep,
  todayBrazil,
  type NextStep,
  type RequestSituation,
} from "@/lib/services/request-list";
import { productPhotoList } from "@/lib/services/product-list";
import { PhotoGallery } from "@/components/photo-gallery";
import { galleryProps } from "@/components/photo-gallery-props";
import { DemandTags } from "@/components/demand-tags";
import { listDraftsForList } from "@/lib/services/request-drafts";
import { demandKind, type DemandKind } from "@/lib/purchase-demand";
import {
  requestComposition,
  shortProductName,
  type Composition,
  type CompositionItem,
} from "@/lib/request-composition";

const BULK_FORM = "requests-bulk-delete";

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
  // Mapas no lugar de buscas na lista inteira a cada linha (auditoria de
  // performance, 14/11/2026: 16 mil solicitações × milhares de parceiros).
  const partyById = indexBy(parties, "id");
  const customerName = (id: string) => partyById.get(id)?.name ?? "";
  const situationCounts = Object.fromEntries(
    LISTED_SITUATIONS.map((k) => [
      k,
      byStatus.filter((r) =>
        inSituation(r, requestDisplayStatus(r, cancelled), k, today),
      ).length,
    ]),
  ) as Record<RequestSituation, number>;
  const filtering = wellmix && !showDeleted && !groupId;
  const requests = byStatus
    .filter((r) => !groupId || r.groupId === groupId)
    .filter(
      (r) =>
        !filtering ||
        (inSituation(r, requestDisplayStatus(r, cancelled), situation, today) &&
          (!kindFilter || demandKind(r) === kindFilter) &&
          matchesRequest(r, customerName(r.customerId), q)),
    );
  const orderIds = [
    ...new Set(requests.map((r) => r.orderId).filter(Boolean)),
  ] as string[];
  const orders =
    wellmix && orderIds.length
      ? await store.list("orders", { filter: { id: orderIds } })
      : [];
  const orderById = indexBy(orders, "id");
  const orderNumber = (id: string | null) =>
    id ? (orderById.get(id)?.number ?? null) : null;
  /* Wellmix: quem age e o prazo de cada pedido pelos marcos (fase 5g). As
     fotos e os itens dos pedidos são lidos depois, só para as linhas da
     página (composição do pedido, mais abaixo). */
  const nextInfo = wellmix
    ? await import("@/lib/services/request-export").then((m) =>
        m.orderNextInfoOf(orders),
      )
    : new Map<string, { responsibleRole: Role | null; dueAt: string | null }>();
  const teamById = indexBy(team, "id");
  const nextOf = (r: (typeof requests)[number]): NextStep => {
    const order = r.orderId ? orderById.get(r.orderId) : null;
    const info = order ? nextInfo.get(order.id) : undefined;
    return requestNextStep({
      status: r.status,
      display: requestDisplayStatus(r, cancelled),
      order: order
        ? {
            status: order.status,
            responsibleRole: info?.responsibleRole ?? null,
            dueAt: info?.dueAt ?? null,
          }
        : null,
      today,
    });
  };
  const nextText = (n: NextStep) => nextStepText(t, n);
  const whoText = (n: NextStep) => nextStepWho(t, n);
  /** Próximo passo e com quem está (a vez da Wellmix em destaque). */
  const nextCell = (n: NextStep) =>
    n.key === "none" ? (
      "—"
    ) : (
      <span data-request-next={n.key}>
        <span className="font-medium text-zinc-900">{nextText(n)}</span>
        {n.who ? (
          <span
            className={cx(
              "block text-xs",
              n.who === "wellmix"
                ? "font-medium text-amber-700"
                : "text-zinc-500",
            )}
          >
            {whoText(n)}
          </span>
        ) : null}
        {n.late ? (
          <span className="mt-0.5 block">
            <Badge tone="danger">{t("reqList.late")}</Badge>
          </span>
        ) : null}
      </span>
    );
  const ownerName = (id: string | null | undefined) =>
    id ? (teamById.get(id)?.name ?? "—") : "—";
  const listQuery = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | null> = {
      situ: situation === "all" ? null : situation,
      q: q || null,
      kind: kindFilter,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const str = p.toString();
    return str ? `?${str}` : "";
  };
  // Tamanho de cada lote (selo da linha que ficou sozinha nesta lista, ex.:
  // o outro produto do lote foi excluído ou já virou pedido): o lote todo,
  // lido só para os lotes desta lista.
  const groupSize = await groupSizes(
    visible.map((r) => r.groupId).filter((id): id is string => !!id),
  );
  // Produtos pedidos juntos viram uma linha só (abre a página do lote). No
  // filtro de um lote (?group=, links antigos) cada produto segue numa linha.
  const entries: RequestListEntry<(typeof requests)[number]>[] = groupId
    ? requests.map((row) => ({ kind: "single", row }))
    : groupRequestRows(requests);
  const batchHref = (id: string) =>
    `/app/requests/batch/${encodeURIComponent(id)}`;
  // Lista longa: ordem e página no servidor (auditoria de performance,
  // 14/11/2026: 134 MB de HTML com as 16 mil solicitações do histórico).
  // Curta: inteira, como antes. Busca e situação continuam as do servidor.
  type Entry = (typeof entries)[number];
  const rowsOf = (e: Entry) =>
    e.kind === "batch"
      ? [...e.rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : [e.row];
  const entryColumns: ServerColumn<Entry>[] = [
    {
      key: "number",
      text: (e) => String(rowsOf(e).find((r) => r.number)?.number ?? "—"),
    },
    {
      key: "product",
      text: (e) =>
        rowsOf(e)
          .map((r) => productNameText(t, r.productName))
          .join(", "),
    },
    {
      key: "quantity",
      text: (e) =>
        rowsOf(e)
          .map((r) => `${r.quantity} ${r.unit}`)
          .join(" · "),
    },
    ...(isWellmix(user)
      ? [
          {
            key: "customer",
            text: (e: Entry) => customerName(rowsOf(e)[0].customerId) || "—",
          },
        ]
      : []),
    {
      key: "status",
      text: (e) =>
        rowsOf(e)
          .map((r) => t(`reqStatusLabel.${requestDisplayStatus(r, cancelled)}`))
          .join(" "),
    },
    ...(wellmix
      ? [
          {
            key: "next",
            text: (e: Entry) => {
              const n = nextOf(rowsOf(e)[0]);
              return n.key === "none" ? "—" : nextText(n);
            },
          },
        ]
      : []),
    {
      key: "deadline",
      text: (e) =>
        formatDate(
          e.kind === "batch" ? earliestDeadline(rowsOf(e)) : e.row.deadline,
          t,
        ),
    },
    ...(wellmix
      ? [
          {
            key: "order",
            text: (e: Entry) => {
              const r = rowsOf(e)[0];
              return r.orderId ? `#${orderNumber(r.orderId) ?? "?"}` : "—";
            },
          },
          {
            key: "owner",
            text: (e: Entry) => ownerName(rowsOf(e)[0].ownerUserId),
          },
          {
            key: "date",
            text: (e: Entry) => formatDate(rowsOf(e)[0].createdAt, t),
          },
        ]
      : []),
  ];
  const serverMode = entries.length > SERVER_TABLE_FROM;
  const one = (v: string | string[] | undefined) =>
    typeof v === "string" ? v : undefined;
  const sort = serverMode ? parseServerSort(one(sp.sort), entryColumns) : null;
  const paged = serverTable(entries, entryColumns, {
    sort,
    page: parseServerPage(one(sp.page)),
    size: serverMode ? undefined : Math.max(entries.length, 1),
    decimalComma: t.locale === "pt",
  });
  const sortValue = sort ? `${sort.desc ? "-" : ""}${sort.key}` : null;
  /* Rascunhos de quem está vendo (dono, 17/11/2026): no alto da lista, com a
     situação "Rascunho", na primeira página e sem filtro de situação (a
     busca vale pelo título e pelo cliente). Os da Reposição ficam na fila de
     Reposição. */
  const draftRows =
    filtering &&
    situation === "all" &&
    (!kindFilter || kindFilter === "order") &&
    paged.page === 0
      ? (await listDraftsForList(user, "requests")).filter(
          ({ draft }) =>
            !q ||
            `${draft.title} ${draft.customerName ?? ""}`
              .toLocaleLowerCase()
              .includes(q.toLocaleLowerCase()),
        )
      : [];
  /* Encomendas, composição do pedido de cada linha (dono, 16/11/2026): os
     produtos, as fotos e a soma das peças pelos itens do pedido, não pelo
     produto da solicitação. Lidos só para as linhas da página: a lista
     inteira tem ~16 mil pedidos e ~185 mil itens (src/lib/request-composition.ts). */
  const shownRows = wellmix ? paged.rows.flatMap(rowsOf) : [];
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
    wellmix
      ? paged.rows.map((e) => [e, requestComposition(rowsOf(e), itemsByOrder)])
      : [],
  );
  /* Fotos: a primeira de cada produto, até 12 por linha (a grade mostra 4;
     a galeria, até 12). Só os produtos dessas linhas. */
  const PHOTO_PRODUCTS = 12;
  const photoProductIds = [
    ...new Set(
      [...compositionOf.values()].flatMap((c) =>
        c.products
          .slice(0, PHOTO_PRODUCTS)
          .map((cp) => cp.productId)
          .filter((id): id is string => !!id),
      ),
    ),
  ];
  const [products, photos] = photoProductIds.length
    ? await Promise.all([
        listColumns(store, "products", ["primaryPhotoDocumentId"], {
          filter: { id: photoProductIds },
        }),
        listColumns(
          store,
          "product_photos",
          ["productId", "documentId", "isPrimary", "kind"],
          { filter: { productId: photoProductIds } },
        ),
      ])
    : [[], []];
  const productById = indexBy(products, "id");
  const photoListOf = (productId: string | null) => {
    const p = productId ? productById.get(productId) : null;
    return p ? productPhotoList(p, photos) : [];
  };
  /** Foto: um produto, a galeria dele; vários, a grade (uma miniatura por produto). */
  const photoCell = (e: Entry) => {
    const comp = compositionOf.get(e);
    const first = rowsOf(e)[0];
    const cell = "h-14 w-14";
    if (!comp || comp.products.length <= 1) {
      const only = comp?.products[0];
      return (
        <PhotoGallery
          name={productNameText(t, only?.name ?? first.productName)}
          {...galleryProps(t, photoListOf(only?.productId ?? first.productId))}
          badge={false}
          className={cell}
        />
      );
    }
    const shown = comp.products.slice(0, PHOTO_PRODUCTS).map((cp) => ({
      cp,
      name: productNameText(t, cp.name),
      photo: photoListOf(cp.productId)[0] ?? null,
    }));
    // A galeria: a foto de cada produto, com o nome dele (sem repetir foto).
    const seen = new Set<string>();
    const withPhoto = shown.filter(
      (x) =>
        x.photo &&
        !seen.has(x.photo.documentId) &&
        seen.add(x.photo.documentId),
    );
    const gallery = galleryProps(
      t,
      withPhoto.map((x) => ({ documentId: x.photo!.documentId, kind: null })),
    );
    return (
      <PhotoGallery
        name={t("reqList.photos.title", { n: comp.products.length })}
        photos={gallery.photos.map((ph, i) => ({
          ...ph,
          label: withPhoto[i].name,
        }))}
        labels={gallery.labels}
        badge={false}
        className={cell}
        tiles={{
          list: shown.slice(0, 4).map((x) => ({
            id: x.photo?.documentId ?? null,
            initial: (x.name.trim()[0] ?? "?").toUpperCase(),
            label: x.name,
          })),
          more: Math.max(0, comp.products.length - 4),
        }}
      />
    );
  };
  /** Produtos: o início do nome de cada um (todos; depois de 6, num "+N" que abre). */
  const PRODUCTS_INLINE = 6;
  const productsList = (comp: Composition) => {
    const names = comp.products.map((cp) => productNameText(t, cp.name));
    const inline = names.slice(0, PRODUCTS_INLINE);
    const rest = names.slice(PRODUCTS_INLINE);
    // Um produto só cabe quase inteiro; com mais, o começo de cada um.
    const max = names.length === 1 ? 60 : names.length <= 3 ? 30 : 24;
    return {
      inline: (
        <span data-request-products={names.length}>
          {inline.map((name, i) => (
            <span key={`${name}-${i}`} title={name} data-request-product-name>
              {i > 0 ? <span className="text-zinc-400"> · </span> : null}
              <span className="whitespace-nowrap">
                {shortProductName(name, max)}
              </span>
            </span>
          ))}
        </span>
      ),
      rest: rest.length ? (
        <details className="mt-0.5 text-xs font-normal text-zinc-600">
          <summary
            className="cursor-pointer select-none font-semibold text-brand-800"
            data-request-products-more={rest.length}
          >
            {t("reqList.products.more", { n: rest.length })}
          </summary>
          <span className="mt-0.5 block">
            {rest.map((name, i) => (
              <span key={`${name}-${i}`} title={name}>
                {i > 0 ? " · " : ""}
                <span className="whitespace-nowrap">
                  {shortProductName(name, max)}
                </span>
              </span>
            ))}
          </span>
        </details>
      ) : null,
    };
  };
  /** Quantidade: a soma das peças do pedido (outra unidade, à parte). */
  const totalText = (comp: Composition) =>
    comp.totals.length
      ? comp.totals
          .map(
            (x) =>
              `${x.quantity.toLocaleString(t.intl, { maximumFractionDigits: 2 })} ${x.unit}`,
          )
          .join(" · ")
      : "—";
  /** Pedido da linha (lote: quantos pedidos; uma solicitação: o número com link). */
  const orderCell = (e: Entry) => {
    if (e.kind === "batch") {
      const rows = rowsOf(e);
      return rows.some((r) => r.orderId)
        ? t("reqList.orders", { n: rows.filter((r) => r.orderId).length })
        : "—";
    }
    return e.row.orderId ? (
      <TextLink href={`/app/orders/${e.row.orderId}`}>
        #{orderNumber(e.row.orderId) ?? "?"}
      </TextLink>
    ) : (
      "—"
    );
  };
  const pageListHref = (patch: { sort?: string | null; page?: number }) => {
    const p = new URLSearchParams();
    if (situation !== "all") p.set("situ", situation);
    if (q) p.set("q", q);
    if (kindFilter) p.set("kind", kindFilter);
    if (showDeleted) p.set("view", "deleted");
    if (groupId) p.set("group", groupId);
    const value = patch.sort !== undefined ? patch.sort : sortValue;
    if (value) p.set("sort", value);
    if (patch.page) p.set("page", String(patch.page + 1));
    const str = p.toString();
    return str ? `/app/requests?${str}` : "/app/requests";
  };
  const header = (label: string, column: string, className?: string) =>
    serverMode ? (
      <SortTh
        label={label}
        column={column}
        sort={sort}
        href={(value) => pageListHref({ sort: value })}
        t={t}
        className={className}
      />
    ) : (
      <Th className={className}>{label}</Th>
    );
  const anyDeletable = requests.some((r) => canDeleteRequest(user, r));
  const count = (v: string | string[] | undefined) =>
    typeof v === "string" && /^\d+$/.test(v) ? Number(v) : 0;
  const errorKey = `reqDelete.error.${typeof error === "string" ? error : ""}`;
  const batchErrorKey = `reqBatch.error.${typeof error === "string" ? error : ""}`;

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
      {filtering ? (
        <div className="mb-3 space-y-2" data-request-filters>
          {/* Situação como cartões-filtro (o escolhido fica marcado). */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {LISTED_SITUATIONS.map((k) => (
              <Stat
                key={k}
                compact
                label={t(`reqList.situ.${k}`)}
                value={situationCounts[k]}
                href={`/app/requests${listQuery({ situ: k === "all" ? null : k })}`}
                tone={
                  situation === k
                    ? undefined
                    : k === "late" && situationCounts.late > 0
                      ? "danger"
                      : "neutral"
                }
                active={situation === k}
              />
            ))}
          </div>
          <nav
            className="flex flex-wrap gap-2 text-sm"
            aria-label={t("demand.filter.kind")}
            data-demand-kind-filter
          >
            {([null, "order", "replenishment"] as const).map((k) => (
              <a
                key={k ?? "all"}
                href={`/app/requests${listQuery({ kind: k })}`}
                aria-current={kindFilter === k ? "page" : undefined}
                data-demand-kind={k ?? "all"}
                className={cx(
                  "rounded-full border px-3 py-1",
                  kindFilter === k
                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50",
                )}
              >
                {t(k ? `demand.kind.${k}` : "demand.kind.all")}
              </a>
            ))}
          </nav>
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
      {requests.length === 0 && draftRows.length === 0 ? (
        <Empty>
          {customer
            ? t("customerHome.requests.empty")
            : filtering && (q || situation !== "all")
              ? t("reqList.empty")
              : t("common.none")}
        </Empty>
      ) : (
        <Table tools={!serverMode}>
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
              {header(t("requests.numberShort"), "number", "w-14")}
              {/* Wellmix (dono, 16/11/2026): Foto → Pedido → Produtos →
                  Quantidade → Cliente → Situação → Próximo passo → o resto. */}
              {wellmix ? (
                <Th className="w-16">{t("reqList.col.photo")}</Th>
              ) : null}
              {wellmix ? header(t("reqList.col.order"), "order") : null}
              {header(
                wellmix ? t("reqList.col.products") : t("common.product"),
                "product",
              )}
              {header(t("common.quantity"), "quantity")}
              {isWellmix(user)
                ? header(t("common.customer"), "customer")
                : null}
              {header(t("common.status"), "status")}
              {wellmix ? header(t("reqList.col.next"), "next") : null}
              {header(t("requests.deadline"), "deadline")}
              {wellmix ? header(t("reqList.col.owner"), "owner") : null}
              {wellmix ? header(t("reqList.col.date"), "date") : null}
              <Th />
            </tr>
          </thead>
          <tbody>
            {draftRows.map(({ draft, href }) => (
              <tr
                key={`draft-${draft.id}`}
                className={cx(rowClass, "bg-amber-50/40")}
                data-request-list-draft={draft.id}
              >
                {!showDeleted && anyDeletable ? <Td /> : null}
                <Td className="tabular-nums text-zinc-400">—</Td>
                <Td />
                <Td className="text-zinc-400">—</Td>
                <Td className="min-w-40">
                  <TextLink href={href}>{draft.title}</TextLink>
                  <span className="block text-xs text-zinc-500">
                    {t("requestDraft.listHint")}
                  </span>
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {t("reqBatch.count", { n: draft.itemCount })}
                </Td>
                <Td className="min-w-32">
                  {draft.customerName ?? t("requestDraft.noCustomer")}
                </Td>
                <Td className="whitespace-nowrap">
                  <Badge tone="neutral">{t("requestDraft.status")}</Badge>
                </Td>
                <Td className="text-zinc-400">—</Td>
                <Td className="text-zinc-400">—</Td>
                <Td className="whitespace-nowrap">{user.name}</Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {formatDate(draft.updatedAt, t)}
                </Td>
                <Td className="text-right">
                  <TextLink href={href} data-request-list-draft-open>
                    {t("requestDraft.resume")}
                  </TextLink>
                </Td>
              </tr>
            ))}
            {paged.rows.map((entry) => {
              if (entry.kind === "batch") {
                // Na ordem em que foram pedidos (igual à página do lote).
                const rows = [...entry.rows].sort((a, b) =>
                  a.createdAt.localeCompare(b.createdAt),
                );
                const deletable = rows.filter((r) => canDeleteRequest(user, r));
                const names = rows.map((r) =>
                  productNameText(t, r.productName),
                );
                const comp = compositionOf.get(entry);
                // Próximos passos diferentes do lote (o primeiro e quantos mais).
                const steps = [
                  ...new Map(
                    rows
                      .map((r) => nextOf(r))
                      .filter((n) => n.key !== "none")
                      .map((n) => [`${nextText(n)}|${whoText(n)}`, n]),
                  ).values(),
                ];
                return (
                  <tr key={entry.groupId} className={rowClass} data-batch-row>
                    {!showDeleted && anyDeletable ? (
                      <Td className="w-10">
                        {deletable.length > 0 ? (
                          <BatchSelect
                            formId={BULK_FORM}
                            groupKey={entry.groupId}
                            ids={deletable.map((r) => r.id)}
                            label={`${t("reqBatch.selectBatch")}: ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""}`}
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
                    <Td className="whitespace-nowrap tabular-nums text-zinc-600">
                      <span data-request-number>
                        {rows.find((r) => r.number)?.number ?? "—"}
                      </span>
                    </Td>
                    {wellmix ? (
                      <Td className="w-16">{photoCell(entry)}</Td>
                    ) : null}
                    {wellmix ? (
                      <Td className="whitespace-nowrap" data-request-order="">
                        {orderCell(entry)}
                      </Td>
                    ) : null}
                    <Td className="min-w-48 font-medium text-zinc-900">
                      <TextLink
                        href={batchHref(entry.groupId)}
                        className="text-zinc-900 no-underline hover:underline"
                      >
                        {comp ? (
                          productsList(comp).inline
                        ) : (
                          <>
                            {names.slice(0, 2).join(", ")}
                            {names.length > 2 ? ` +${names.length - 2}` : ""}
                          </>
                        )}
                      </TextLink>
                      {comp ? productsList(comp).rest : null}
                      <span
                        className="ml-2 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-800 ring-1 ring-inset ring-brand-200"
                        data-batch-count
                      >
                        {t("reqBatch.count", { n: rows.length })}
                      </span>
                      <DemandTags t={t} request={rows[0]} />
                    </Td>
                    <Td className="tabular-nums">
                      {comp ? (
                        // A soma das peças do pedido (dono, 16/11/2026).
                        <span
                          className="whitespace-nowrap"
                          data-request-total=""
                        >
                          {totalText(comp)}
                        </span>
                      ) : (
                        <>
                          {/* Mesmos dois primeiros produtos do nome; o resto na página do lote. */}
                          {rows.slice(0, 2).map((r, i) => (
                            <span key={r.id} className="whitespace-nowrap">
                              {i > 0 ? " · " : ""}
                              {r.quantity} {r.unit}
                            </span>
                          ))}
                          {rows.length > 2 ? (
                            <span className="whitespace-nowrap">
                              {` +${rows.length - 2}`}
                            </span>
                          ) : null}
                        </>
                      )}
                    </Td>
                    {isWellmix(user) ? (
                      <Td className="min-w-32">
                        {partyById.get(rows[0].customerId)?.name ?? "—"}
                      </Td>
                    ) : null}
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {statusCounts(
                          rows.map((r) => requestDisplayStatus(r, cancelled)),
                        ).map(({ status, count: n }) => (
                          <Badge key={status} tone={requestStatusTone(status)}>
                            {t(`reqStatusLabel.${status}`)}
                            {n > 1 ? ` ×${n}` : ""}
                          </Badge>
                        ))}
                      </span>
                    </Td>
                    {wellmix ? (
                      <Td className="min-w-40">
                        {steps.length ? (
                          <>
                            {nextCell(steps[0])}
                            {steps.length > 1 ? (
                              <span className="block text-xs text-zinc-500">
                                +{steps.length - 1}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                    ) : null}
                    <Td className="whitespace-nowrap tabular-nums">
                      {formatDate(earliestDeadline(rows), t)}
                    </Td>
                    {wellmix ? (
                      <Td className="whitespace-nowrap">
                        {ownerName(rows[0].ownerUserId)}
                      </Td>
                    ) : null}
                    {wellmix ? (
                      <Td className="whitespace-nowrap tabular-nums">
                        {formatDate(rows[0].createdAt, t)}
                      </Td>
                    ) : null}
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <TextLink href={batchHref(entry.groupId)}>
                          {t("tasks.open")}
                        </TextLink>
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
                              label={t("reqBatch.deleteAll")}
                              confirmText={t("reqBatch.deleteAllConfirm")}
                            />
                          </form>
                        ) : null}
                        {/* Conversa do lote: abre pela primeira solicitação dele. */}
                        <ChatOpenButton
                          target={{ requestId: rows[0].id }}
                          label={t("chat.open")}
                        />
                      </div>
                    </Td>
                  </tr>
                );
              }
              const r = entry.row;
              const comp = compositionOf.get(entry);
              const status = requestDisplayStatus(r, cancelled);
              // Pedido cancelado: a dica não diz mais que "o pedido continua".
              const lockedHint =
                status === "ORDER_CANCELLED"
                  ? t("reqStatusLabel.ORDER_CANCELLED")
                  : t("reqDelete.ordered");
              return (
                <tr key={r.id} className={rowClass}>
                  {!showDeleted && anyDeletable ? (
                    <Td className="w-10">
                      {canDeleteRequest(user, r) ? (
                        <input
                          type="checkbox"
                          name="ids"
                          value={r.id}
                          form={BULK_FORM}
                          aria-label={`${t("reqDelete.selectOne")}: ${productNameText(t, r.productName)}`}
                          className="h-4 w-4 accent-brand-600"
                        />
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
                  <Td className="whitespace-nowrap tabular-nums text-zinc-600">
                    <span data-request-number>{r.number ?? "—"}</span>
                  </Td>
                  {wellmix ? (
                    <Td className="w-16">{photoCell(entry)}</Td>
                  ) : null}
                  {wellmix ? (
                    <Td className="whitespace-nowrap" data-request-order="">
                      {orderCell(entry)}
                    </Td>
                  ) : null}
                  <Td className="min-w-48 font-medium text-zinc-900">
                    <TextLink
                      href={`/app/requests/${r.id}`}
                      className="text-zinc-900 no-underline hover:underline"
                      data-request-open
                    >
                      {comp
                        ? productsList(comp).inline
                        : productNameText(t, r.productName)}
                    </TextLink>
                    {comp ? productsList(comp).rest : null}
                    {r.groupId && (groupSize.get(r.groupId) ?? 0) > 1 ? (
                      <TextLink
                        href={batchHref(r.groupId)}
                        className="ml-2 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-800 no-underline ring-1 ring-inset ring-brand-200"
                        data-batch-badge
                      >
                        {t("reqBatch.badge", { n: groupSize.get(r.groupId)! })}
                      </TextLink>
                    ) : null}
                    {r.variant?.name ? (
                      <span className="block text-xs font-normal text-zinc-500">
                        {r.variant.name}
                      </span>
                    ) : null}
                    <DemandTags t={t} request={r} />
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {comp ? (
                      // A soma das peças do pedido (dono, 16/11/2026).
                      <span data-request-total="">{totalText(comp)}</span>
                    ) : (
                      <>
                        {r.quantity} {r.unit}
                      </>
                    )}
                  </Td>
                  {isWellmix(user) ? (
                    <Td className="min-w-32">
                      {parties.find((p) => p.id === r.customerId)?.name ?? "—"}
                    </Td>
                  ) : null}
                  <Td className="whitespace-nowrap">
                    <Badge tone={requestStatusTone(status)}>
                      {t(`reqStatusLabel.${status}`)}
                    </Badge>
                  </Td>
                  {wellmix ? (
                    <Td className="min-w-40">{nextCell(nextOf(r))}</Td>
                  ) : null}
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatDate(r.deadline, t)}
                  </Td>
                  {wellmix ? (
                    <Td className="whitespace-nowrap">
                      {ownerName(r.ownerUserId)}
                    </Td>
                  ) : null}
                  {wellmix ? (
                    <Td className="whitespace-nowrap tabular-nums">
                      {formatDate(r.createdAt, t)}
                    </Td>
                  ) : null}
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
                      <ChatOpenButton
                        target={{ requestId: r.id }}
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
      {serverMode && entries.length ? (
        <ServerPager
          page={paged}
          href={(page) => pageListHref({ page })}
          t={t}
        />
      ) : null}
    </>
  );
}
