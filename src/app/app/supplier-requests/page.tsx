import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { isWellmix } from "@/lib/auth/permissions";
import { listSupplierRequests } from "@/lib/services/supplier-requests";
import { getT } from "@/i18n/server";
import { STATUS_TONE, answerText } from "./_components/status";
import { SlaBadge, dateTime } from "./_components/negotiation";
import {
  notifyLateSupplierRequests,
  slaOf,
  supplierRequestSlaMinutes,
} from "@/lib/services/supplier-request-negotiation";
import { finishedLate, groupRequests } from "@/lib/supplier-requests";
import {
  supplierRequestStepHref,
  supplierRequestTurn,
} from "@/lib/supplier-request-sampling";
import { dictionaries } from "@/i18n/dictionaries";
import { StatusLink } from "@/components/status-link";
import { SUPPLIER_REQUEST_STATUSES } from "@/lib/db/schema";
import { fallbackError } from "@/i18n/error-text";
import {
  listPurchaseCandidates,
  purchaseOrderCustomer,
} from "@/lib/services/purchase-order";
import { PurchaseOrderCard } from "./_components/purchase-order";
import {
  requestContainersPerRound,
  requestRounds,
} from "./_components/request-load";
import {
  requestClosed,
  requestOrderState,
} from "@/lib/supplier-request-closing";
import { getSettings } from "@/lib/settings";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Alert,
  Badge,
  Card,
  Empty,
  LinkButton,
  OpenLink,
  PageHeader,
  Table,
  Td,
  Th,
  cx,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import {
  can,
  canSeeMoney,
  canSeePurchasePrice,
} from "@/lib/auth/function-access";
import { loadOrderCells } from "@/lib/services/order-cells";
import {
  OrderStandardHeads,
  OrderTermsTds,
  OrderTotalsTds,
  orderHeadText,
} from "@/components/order-standard-cells";
import { getStore, type PurchaseQuote } from "@/lib/db";
import {
  quoteClosed,
  quoteEmpty,
  sweepQuotes,
} from "@/lib/services/purchase-quote";
import { turnTone, turnWaitingKey } from "@/lib/turn";
import { supplierRequestResponsibles } from "@/lib/services/supplier-request-turns";
import { samplingSlaDays } from "@/lib/services/supplier-request-sampling";
import {
  ResponsibleLogins,
  ResponsibleTip,
} from "@/components/request-responsible-tip";
import { QuoteDeadline } from "../purchase-quotes/_time";
import { InvitesTable } from "./_components/invites-table";
import { inviteLate, listInvitesFor } from "@/lib/services/booking-invites";
import { SupplierInquiries } from "./_components/supplier-inquiries";
import { CompletionTd } from "./_components/completion";
import { pinnedColumns } from "@/components/pinned-columns";
import type { ReactNode } from "react";
import { quoteCompletion, requestCompletion } from "@/lib/inquiry-completion";

/*
 * Solicitações ao fornecedor (docs/SUPPLIER_REQUESTS.md): a Wellmix vê todas;
 * o fornecedor, só as do próprio cadastro. Duas abas (dono, 18/11/2026): "Em
 * negociação" (a primeira) e "Encerradas" (todos os produtos decididos), onde
 * a solicitação com todos os produtos cadastrados ganha "Gerar pedido", que
 * leva ao quadro "Gerar pedido de compra" (por fornecedor, para juntar outras
 * solicitações do mesmo fornecedor e ajustar a quantidade).
 */

/** Cor da situação do convite de book (a mesma da tabela dos convites). */
const INVITE_TONE: Record<string, "warning" | "success" | "neutral"> = {
  open: "warning",
  answered: "success",
  cancelled: "neutral",
};

export default async function SupplierRequestsPage({
  searchParams,
}: PageProps<"/app/supplier-requests">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/supplier-requests");
  requireScreen(user, "quotes");
  const t = await getT();
  // SLA estourado: avisa uma vez (Wellmix e fornecedor) ao abrir a lista.
  // Depois da resposta (`after`): os avisos gravam e mandam e-mail, e a
  // lista não precisa esperar por eles (o selo de SLA é calculado na hora).
  after(async () => {
    await notifyLateSupplierRequests().catch((error) =>
      console.error("notifyLateSupplierRequests", error),
    );
    await import("@/lib/services/supplier-request-sampling")
      .then((m) => m.notifyLateSampling())
      .catch((error) => console.error("notifyLateSampling", error));
  });
  const wellmix = isWellmix(user);
  // Consultas do fornecedor (dono, 27/11/2026): os convites de book, as
  // solicitações e as cotações de compra numa tabela só, a padrão dele.
  if (!wellmix)
    return (
      <SupplierInquiries
        user={user}
        closedTab={(await searchParams).tab === "closed"}
        t={t}
      />
    );
  // Preço de compra: a Wellmix com "Ver preço de compra"; o fornecedor vê o
  // dele (dono, 15/11/2026; docs/LINHA_DE_VISAO.md, seção 7).
  const seesPrice = !wellmix || canSeePurchasePrice(user);
  const showPurchase =
    wellmix && canOpen(user, "orders") && can(user, "purchaseOrder.generate");
  // Leituras independentes em paralelo.
  const [entries, slaMinutes, query, settings] = await Promise.all([
    listSupplierRequests(user),
    supplierRequestSlaMinutes(),
    searchParams,
    getSettings(),
  ]);
  // Containers por programação: no 40HC (o padrão da seleção) ou no maior.
  const container =
    settings.containerTypes.find((c) => c.code === "40HC") ??
    [...settings.containerTypes].sort(
      (a, b) => b.capacityCbm - a.capacityCbm,
    )[0] ??
    null;
  const now = new Date();
  const closedTab = query.tab === "closed";
  // Cotação unificada (dono, 22/11/2026; docs/QUOTATION.md), só da Wellmix:
  // a lista mostra todas as cotações (as solicitações ao fornecedor e as
  // cotações de compra ainda com os fornecedores) e, numa aba, os convites
  // de book. A cotação de compra aprovada segue na linha da solicitação que
  // nasceu dela; a cancelada vai para Encerradas.
  const invitesTab = wellmix && query.tab === "invites";
  if (wellmix) await sweepQuotes(now).catch(() => null);
  const store = getStore();
  const quotes = wellmix
    ? (
        await store
          .list("purchase_quotes", { orderBy: "createdAt", direction: "desc" })
          .catch(() => [] as PurchaseQuote[])
      ).filter((q) => q.status !== "approved")
    : [];
  const quoteResponses = quotes.length
    ? await store.list("purchase_quote_responses", {
        filter: { quoteId: quotes.map((q) => q.id) },
      })
    : [];
  const quoteSuppliers = quoteResponses.length
    ? await store.list("parties", {
        filter: { id: [...new Set(quoteResponses.map((r) => r.supplierId))] },
      })
    : [];
  // Origem da cotação (dono, 22/11/2026): três, e todas passam pela
  // Estratégia de compra e pela Cotação: Book, Encomenda ou Reposição. Sem
  // book, vale a demanda de onde ela nasceu (a reposição do Planner ou a
  // encomenda do cliente); com as duas na mesma cotação, as duas aparecem.
  const demandIds = wellmix
    ? [
        ...new Set([
          ...quotes.flatMap((q) => q.demandIds ?? []),
          ...(entries ?? []).flatMap((e) =>
            e.request.bookingLotId ? [] : (e.request.demandIds ?? []),
          ),
        ]),
      ]
    : [];
  const demands = demandIds.length
    ? await store
        .list("requests", { filter: { id: demandIds } })
        .catch(() => [])
    : [];
  const replenishment = new Set(
    demands.filter((d) => d.origin === "replenishment").map((d) => d.id),
  );
  const originText = (bookingLotId: string | null, ids: string[] | null) => {
    if (bookingLotId) return t("quotation.origin.book");
    const list = ids ?? [];
    const kinds = [
      list.some((id) => !replenishment.has(id)) || !list.length
        ? t("quotation.origin.order")
        : null,
      list.some((id) => replenishment.has(id))
        ? t("quotation.origin.replenishment")
        : null,
    ].filter(Boolean);
    return kinds.join(" · ");
  };
  const openQuotes = quotes.filter((q) => q.status !== "cancelled");
  const closedQuotes = quotes.filter((q) => q.status === "cancelled");
  const tabQuotes = closedTab ? closedQuotes : openQuotes;
  // "Gerar pedido" de uma linha: os produtos dela vêm marcados no quadro.
  const pickParam = typeof query.pick === "string" ? query.pick : "";
  const pick = pickParam ? new Set(pickParam.split(",").filter(Boolean)) : null;
  const error = typeof query.error === "string" ? query.error : "";
  const errorKey = [
    `purchaseOrder.error.${error}`,
    `supplierRequests.error.${error}`,
    `common.${error}`,
  ].find((k) => k in dictionaries.pt) as DictionaryKey | undefined;
  const errorText = !error
    ? null
    : errorKey
      ? t(errorKey)
      : fallbackError(t, error);

  // Uma linha por solicitação: os produtos abertos juntos para o fornecedor
  // ficam dentro dela (a antiga, sem batchId, é uma linha sozinha). Sem
  // colunas de produto (dono, 18/11/2026): a solicitação pode ter milhares;
  // os produtos ficam na tela da solicitação.
  const rows = entries ?? [];
  const supplierOf = new Map(rows.map((e) => [e.request.id, e.supplier]));
  const allRequests = groupRequests(rows.map((e) => e.request)).map((list) =>
    [...list].sort(
      (a, b) => a.number - b.number || a.createdAt.localeCompare(b.createdAt),
    ),
  );
  const closedRequests = allRequests.filter((list) => requestClosed(list));
  const openRequests = allRequests.filter((list) => !requestClosed(list));
  const requests = closedTab ? closedRequests : openRequests;
  // Vez (dono, 24/11/2026): quem age em cada linha, a mesma peça da tabela
  // da cotação, e o login de quem envia à vista para o administrador. Só a
  // Wellmix; cada fornecedor com o seu tipo (Trading aparece como Trading).
  const supplierType = new Map(
    rows.map((e) => [e.request.supplierId, e.supplier?.type ?? null]),
  );
  const responsible = wellmix
    ? await supplierRequestResponsibles(user, requests.flat(), {
        slaMinutes,
        samplingDays: await samplingSlaDays(),
        tradingOf: (id) => supplierType.get(id) === "trading",
        translate: (key) => t(key as DictionaryKey),
      })
    : new Map<string, null>();
  /* Solicitações do cliente (dono, 23/11/2026; docs/SUPPLIER_REQUESTS.md):
     para o fornecedor, os convites de book entram na mesma tabela das
     solicitações. Em aberto ficam em "Em negociação"; o respondido e o
     cancelado, em "Encerradas". */
  const invites = wellmix ? [] : ((await listInvitesFor(user)) ?? []);
  const openInvites = invites
    .filter((i) => i.status === "open")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const closedInvites = invites.filter((i) => i.status !== "open");
  const tabInvites = closedTab ? closedInvites : openInvites;
  const tabProducts =
    new Set(requests.flat().map((p) => p.bookingItemId)).size +
    new Set(tabInvites.map((i) => i.bookingItemId)).size;
  // Pedido de compra (docs/PURCHASE_ORDER.md), só na aba Encerradas: os
  // produtos aprovados de cada fornecedor que ainda não estão em pedido.
  const purchase =
    closedTab && showPurchase ? await listPurchaseCandidates(user) : null;
  const purchaseCustomer = purchase?.length
    ? await purchaseOrderCustomer()
    : null;

  /* Tabela padrão de pedidos (dono, 22 e 23/11/2026; docs/ORDER_TABLES.md),
     só para a Wellmix: as colunas padrão primeiro, na ordem, e as próprias
     da cotação (Origem, Resposta, Finalizada e o pedido) no fim. O
     fornecedor segue com a lista dele, sem cliente nem venda. Cada cotação
     nasce de uma solicitação só (um cliente); a de book não tem cliente. */
  const seeValue = wellmix && canSeeMoney(user);
  const cells = wellmix
    ? await loadOrderCells([
        ...tabQuotes.map((q) => ({
          key: `q:${q.id}`,
          requestIds: q.demandIds ?? [],
        })),
        ...requests.map((products) => ({
          key: `r:${products[0].id}`,
          requestIds: products[0].bookingLotId
            ? []
            : [...new Set(products.flatMap((p) => p.demandIds ?? []))],
        })),
      ]).catch(() => null)
    : null;
  const numTd = "whitespace-nowrap text-right tabular-nums";
  // Colunas da Consulta (dono, 27/11/2026): Nº, Fornecedor e Origem
  // primeiro, fixas na rolagem; "Tipo de venda" saiu da tabela.
  const pin = pinnedColumns(["4rem", "10rem", "7rem"]);
  const pinned = (
    i: number,
    content: ReactNode,
    mark?: Record<string, string>,
  ) => (
    <Td className={pin.cell(i)} style={pin.style(i)} {...(mark ?? {})}>
      <div style={pin.box(i)} className="whitespace-normal">
        {content}
      </div>
    </Td>
  );
  const termsCells = (key: string, createdAt: string) => (
    <OrderTermsTds
      t={t}
      cells={cells?.byKey.get(key)}
      createdAt={createdAt}
      omit={["saleType"]}
    />
  );
  const totalCells = (key: string) => (
    <OrderTotalsTds t={t} cells={cells?.byKey.get(key)} seeValue={seeValue} />
  );

  return (
    <>
      <PageHeader
        t={t}
        title={t(wellmix ? "quotation.list.title" : "customerRequests.title")}
        subtitle={t(
          wellmix ? "quotation.list.subtitle" : "customerRequests.subtitle",
        )}
      />
      {errorText ? (
        <div className="mb-3">
          <Alert tone="danger">{errorText}</Alert>
        </div>
      ) : null}
      <nav
        aria-label={t("supplierRequests.tabs.label")}
        className="mb-4 flex gap-1 border-b border-zinc-200 text-sm"
        data-supplier-request-tabs
      >
        {(
          [
            [
              "open",
              "/app/supplier-requests",
              openRequests.length + openQuotes.length + openInvites.length,
            ],
            [
              "closed",
              "/app/supplier-requests?tab=closed",
              closedRequests.length +
                closedQuotes.length +
                closedInvites.length,
            ],
            ...(wellmix
              ? ([
                  ["invites", "/app/supplier-requests?tab=invites", null],
                ] as const)
              : []),
          ] as const
        ).map(([id, href, n]) => {
          const active =
            id === "invites"
              ? invitesTab
              : !invitesTab && (id === "closed") === closedTab;
          return (
            <Link
              key={id}
              href={href}
              aria-current={active ? "page" : undefined}
              data-supplier-request-tab={id}
              className={`-mb-px border-b-2 px-3 py-2 ${
                active
                  ? "border-brand-600 font-semibold text-brand-700"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {t(
                (wellmix
                  ? `quotation.tabs.${id}`
                  : `supplierRequests.tabs.${id}`) as DictionaryKey,
              )}
              {n === null ? "" : ` (${n})`}
            </Link>
          );
        })}
      </nav>
      {purchase?.length ? (
        <div className="mb-4" id="pedido-de-compra">
          <PurchaseOrderCard
            groups={purchase}
            customer={purchaseCustomer}
            showPrice={seesPrice}
            pick={pick}
            t={t}
          />
        </div>
      ) : null}
      {invitesTab ? (
        <div data-quotation-invites>
          <InvitesTable user={user} t={t} />
        </div>
      ) : entries === null ? (
        <Alert tone="warning">
          {t("supplierRequests.selection.schemaMissing")}
        </Alert>
      ) : requests.length || tabQuotes.length || tabInvites.length ? (
        <Card>
          <p className="mb-2 text-sm text-zinc-600" data-supplier-request-count>
            {t(wellmix ? "quotation.list.count" : "customerRequests.count", {
              n: requests.length + tabQuotes.length + tabInvites.length,
              products:
                tabProducts +
                new Set(
                  tabQuotes.flatMap((q) => q.items.map((i) => i.productId)),
                ).size,
            })}
          </p>
          <Table>
            <thead>
              {wellmix ? (
                <tr data-order-table="quotation">
                  <Th className={pin.cell(0, true)} style={pin.style(0)}>
                    {orderHeadText(t, "number")}
                  </Th>
                  <Th className={pin.cell(1, true)} style={pin.style(1)}>
                    {orderHeadText(t, "supplier")}
                  </Th>
                  <Th className={pin.cell(2, true)} style={pin.style(2)}>
                    {t("quotation.col.origin")}
                  </Th>
                  <OrderStandardHeads
                    t={t}
                    seeValue={seeValue}
                    omit={["saleType", "supplier"]}
                  />
                  <Th>{t("supplierRequests.col.answer")}</Th>
                  <Th>{t("supplierRequests.col.finishedAt")}</Th>
                  {/* Completude (dono, 27/11/2026). */}
                  <Th className="whitespace-nowrap">
                    {t("inquiries.col.completion")}
                  </Th>
                  {closedTab && showPurchase ? (
                    <Th>{t("supplierRequests.col.order")}</Th>
                  ) : null}
                  <Th>
                    <span className="sr-only">{t("tasks.open")}</span>
                  </Th>
                </tr>
              ) : (
                <tr>
                  <Th>{t("supplierRequests.col.number")}</Th>
                  <Th>{t("customerRequests.col.kind")}</Th>
                  {wellmix ? <Th>{t("quotation.col.origin")}</Th> : null}
                  <Th>{t("supplierRequests.col.status")}</Th>
                  {wellmix ? (
                    <Th>{t("supplierRequests.col.supplier")}</Th>
                  ) : null}
                  <Th>{t("supplierRequests.col.products")}</Th>
                  <Th>{t("supplierRequests.col.quantity")}</Th>
                  <Th>{t("supplierRequests.col.rounds")}</Th>
                  <Th>
                    <span
                      title={t("supplierRequests.col.containersHint", {
                        code: container?.code ?? "—",
                      })}
                    >
                      {t("supplierRequests.col.containersPerRound")}
                    </span>
                  </Th>
                  <Th>{t("supplierRequests.col.answer")}</Th>
                  <Th>{t("supplierRequests.col.createdAt")}</Th>
                  <Th>{t("supplierRequests.col.finishedAt")}</Th>
                  {closedTab && showPurchase ? (
                    <Th>{t("supplierRequests.col.order")}</Th>
                  ) : null}
                  <Th>
                    <span className="sr-only">{t("tasks.open")}</span>
                  </Th>
                </tr>
              )}
            </thead>
            <tbody>
              {tabQuotes.map((q) => {
                // Cotação de compra ainda com os fornecedores: uma linha,
                // com quantos responderam e de quem é a vez.
                const mine = quoteResponses.filter((r) => r.quoteId === q.id);
                const state =
                  q.status !== "open"
                    ? q.status
                    : quoteEmpty(mine, now)
                      ? "empty"
                      : quoteClosed(mine, now)
                        ? "closed"
                        : "open";
                const due =
                  state === "open"
                    ? (mine
                        .filter((r) => r.status === "invited")
                        .map((r) => r.dueAt)
                        .sort()
                        .at(-1) ?? null)
                    : null;
                const names = mine.map(
                  (r) =>
                    quoteSuppliers.find((p) => p.id === r.supplierId)?.name ??
                    "—",
                );
                const rounds = Math.max(
                  1,
                  ...q.items.map((i) => i.schedule?.items?.length ?? 1),
                );
                const href = `/app/supplier-requests/${q.id}`;
                const turn =
                  state === "open"
                    ? "supplier"
                    : state === "cancelled"
                      ? null
                      : "wellmix";
                return (
                  <tr
                    key={q.id}
                    className={cx(rowClass, pin.row)}
                    data-quotation-quote-row={q.id}
                  >
                    {pinned(
                      0,
                      <Link href={href} className={linkClass}>
                        {q.number}
                      </Link>,
                    )}
                    {pinned(
                      1,
                      <span title={names.join(", ")}>
                        {names.length === 0
                          ? "—"
                          : names.length === 1
                            ? names[0]
                            : t("quotation.list.suppliers", {
                                n: names.length,
                              })}
                      </span>,
                    )}
                    {pinned(2, originText(null, q.demandIds), {
                      "data-quotation-origin": "",
                    })}
                    {termsCells(`q:${q.id}`, q.createdAt)}
                    {/* Status: de quem é a vez. */}
                    <Td className="whitespace-nowrap">
                      {turn ? (
                        <span data-quote-turn={turn}>
                          {/* O status leva ao quadro da cotação (dono,
                              24/11/2026), o mesmo lugar da pendência. */}
                          <StatusLink
                            tone={turnTone(turn)}
                            href={`/app/purchase-quotes/${encodeURIComponent(q.id)}`}
                          >
                            {t(turnWaitingKey(turn))}
                          </StatusLink>
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    {/* Situação: o momento da cotação. */}
                    <Td className="whitespace-nowrap">
                      <Badge
                        tone={
                          state === "empty"
                            ? "danger"
                            : state === "open"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {t(`quote.status.${state}` as DictionaryKey)}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {due ? (
                        <QuoteDeadline t={t} dueAt={due} now={now} />
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className={numTd} data-quote-products={q.id}>
                      {new Set(q.items.map((i) => i.productId)).size}
                    </Td>
                    <Td className={numTd}>{rounds}</Td>
                    {totalCells(`q:${q.id}`)}
                    <Td className="whitespace-nowrap">
                      {t("supplierRequests.list.answered", {
                        n: mine.filter((r) => r.status === "answered").length,
                        total: mine.length,
                      })}
                    </Td>
                    <Td>—</Td>
                    <CompletionTd c={quoteCompletion(q, mine)} t={t} />
                    {closedTab && showPurchase ? <Td>—</Td> : null}
                    <Td>
                      <OpenLink
                        href={href}
                        label={t("tasks.open")}
                        data-quotation-quote-open={q.id}
                      />
                    </Td>
                  </tr>
                );
              })}
              {tabInvites.map((i) => {
                // Convite de book (só o fornecedor vê nesta tabela): um item,
                // a quantidade dele e o prazo para subir o book.
                const href = `/app/supplier-requests/invites/${i.id}`;
                return (
                  <tr
                    key={i.id}
                    className={rowClass}
                    data-booking-invite-row={i.status}
                    data-customer-request-invite={i.id}
                  >
                    <Td className="tabular-nums">
                      <Link
                        href={href}
                        className={linkClass}
                        data-booking-invite-open={i.id}
                      >
                        {i.number}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {t("customerRequests.kind.invite")}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        <Badge tone={INVITE_TONE[i.status]}>
                          {t(
                            `bookingInvites.status.${i.status}` as DictionaryKey,
                          )}
                        </Badge>
                        {inviteLate(i) ? (
                          <Badge tone="danger">
                            {t("bookingInvites.late")}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {i.item.description ?? i.item.productName ?? "—"}
                        {i.status === "open"
                          ? ` · ${t("customerRequests.due", {
                              date: formatDate(i.dueAt, t),
                            })}`
                          : ""}
                      </span>
                    </Td>
                    <Td className="tabular-nums">1</Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {i.item.quantity
                        ? t("supplierRequests.detail.pieces", {
                            n: i.item.quantity.toLocaleString(t.intl),
                          })
                        : "—"}
                    </Td>
                    <Td>—</Td>
                    <Td>—</Td>
                    <Td>
                      {i.status === "answered"
                        ? t("bookingInvites.status.answered")
                        : "—"}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {dateTime(i.createdAt, t)}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {i.answeredAt ? dateTime(i.answeredAt, t) : "—"}
                    </Td>
                    {closedTab && showPurchase ? <Td>—</Td> : null}
                    <Td>
                      <OpenLink href={href} label={t("tasks.open")} />
                    </Td>
                  </tr>
                );
              })}
              {requests.map((products) => {
                const r = products[0];
                const supplier = supplierOf.get(r.id) ?? null;
                const many = products.length > 1;
                const statuses = SUPPLIER_REQUEST_STATUSES.filter((status) =>
                  products.some((p) => p.status === status),
                );
                const slas = products.map((p) => slaOf(p, slaMinutes, now));
                const sla =
                  slas.find((x) => x?.late) ?? slas.find((x) => x) ?? null;
                // Vez (dono, 24/11/2026): a negociação e, aprovada, a
                // amostragem (enviar ou validar); o fornecedor primeiro.
                const steps = products.map((p) => supplierRequestTurn(p));
                const turn =
                  steps.find((s) => s?.party === "supplier") ??
                  steps.find((s) => s?.party === "wellmix") ??
                  null;
                // A ação da vez leva ao lugar de agir no produto com a vez
                // (dono, 24/11/2026): "Validar a amostragem" abre o quadro
                // da amostragem dele, como a pendência.
                const turnProduct = turn ? products[steps.indexOf(turn)] : null;
                const turnAction =
                  turn && turnProduct ? (
                    <Link
                      href={supplierRequestStepHref(turnProduct.id, turn.step)}
                      className={`${linkClass} mt-0.5 block text-xs`}
                      data-supplier-request-turn-action={turn.step}
                    >
                      {t(`reqList.next.${turn.step}` as DictionaryKey)}
                    </Link>
                  ) : null;
                // Quem age: o do produto com a vez mostrada.
                const who = turnProduct
                  ? (responsible.get(turnProduct.id) ?? null)
                  : null;
                const pieces = products.reduce((sum, p) => sum + p.quantity, 0);
                const distinct = new Set(products.map((p) => p.bookingItemId))
                  .size;
                const answered = products.filter((p) => p.supplierCanDo).length;
                const orderIds = [
                  ...new Set(
                    products
                      .map((p) => p.orderId)
                      .filter((id): id is string => !!id),
                  ),
                ];
                // Finalizada: quando todos os produtos foram decididos.
                const finished = products.every((p) => p.decidedAt)
                  ? products
                      .map((p) => p.decidedAt as string)
                      .sort()
                      .at(-1)!
                  : null;
                const late = products.some((p) => finishedLate(p, slaMinutes));
                const href = `/app/supplier-requests/${r.id}`;
                const rounds = requestRounds(products);
                const containers = requestContainersPerRound(
                  products,
                  container?.capacityCbm ?? null,
                );
                const orderState =
                  closedTab && showPurchase
                    ? requestOrderState(products)
                    : null;
                const answerCell = (
                  <Td>
                    {many
                      ? t("supplierRequests.list.answered", {
                          n: answered,
                          total: products.length,
                        })
                      : answerText(t, r, seesPrice)}
                    {orderIds.map((orderId) => (
                      <Link
                        key={orderId}
                        href={`/app/orders/${orderId}`}
                        className={`${linkClass} block text-xs`}
                        data-supplier-request-order={orderId}
                      >
                        {t("purchaseOrder.list.order")}
                      </Link>
                    ))}
                  </Td>
                );
                const finishedCell = (
                  <Td
                    className="whitespace-nowrap"
                    data-supplier-request-finished={r.id}
                  >
                    {finished ? (
                      <>
                        <span className="block tabular-nums">
                          {dateTime(finished, t)}
                        </span>
                        <span className="mt-0.5 inline-flex">
                          <Badge tone={late ? "danger" : "success"}>
                            {t(
                              late
                                ? "supplierRequests.list.finishedLate"
                                : "supplierRequests.list.finishedOnTime",
                            )}
                          </Badge>
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </Td>
                );
                const orderCell = orderState ? (
                  <Td data-request-order-state={orderState.kind}>
                    {orderState.kind === "ready" ? (
                      <LinkButton
                        href={`/app/supplier-requests?tab=closed&pick=${orderState.requestIds.join(",")}#pedido-de-compra`}
                        variant="primary"
                        data-request-to-order={r.id}
                      >
                        {t("supplierRequests.toOrder.submit")}
                      </LinkButton>
                    ) : orderState.kind === "missingProduct" ? (
                      <span className="block max-w-48 whitespace-normal text-xs text-zinc-500">
                        {t("supplierRequests.toOrder.missingProduct", {
                          n: orderState.missing,
                        })}
                      </span>
                    ) : orderState.kind === "waitingSample" ? (
                      <span className="block max-w-48 whitespace-normal text-xs text-zinc-500">
                        {t("supplierRequests.toOrder.waitingSample", {
                          n: orderState.waiting,
                        })}
                      </span>
                    ) : orderState.kind === "ordered" ? (
                      <span className="text-xs text-zinc-500">
                        {t("supplierRequests.toOrder.ordered")}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                ) : null;
                const openCell = (
                  <Td>
                    <OpenLink
                      href={href}
                      label={t("tasks.open")}
                      data-supplier-request-open={r.id}
                    />
                  </Td>
                );
                // Wellmix: a tabela padrão, com as colunas da cotação no fim.
                if (wellmix)
                  return (
                    <tr
                      key={r.id}
                      className={cx(rowClass, pin.row)}
                      data-supplier-request-row={r.id}
                    >
                      {pinned(
                        0,
                        <Link href={href} className={linkClass}>
                          {r.number}
                        </Link>,
                      )}
                      {pinned(1, supplier?.name ?? "—")}
                      {pinned(
                        2,
                        originText(r.bookingLotId || null, r.demandIds ?? null),
                        { "data-quotation-origin": "" },
                      )}
                      {termsCells(`r:${r.id}`, r.createdAt)}
                      {/* Status: de quem é a vez e a ação. */}
                      <Td
                        className="whitespace-nowrap"
                        data-supplier-request-turn={turn?.step ?? "none"}
                      >
                        {turn ? (
                          <>
                            <StatusLink
                              tone={turnTone(turn.party)}
                              href={
                                turnProduct
                                  ? supplierRequestStepHref(
                                      turnProduct.id,
                                      turn.step,
                                    )
                                  : null
                              }
                            >
                              {t(turnWaitingKey(turn.party))}
                            </StatusLink>
                            {turnAction}
                            {/* Quem age e, para o administrador, o login
                                de quem envia (dono, 24/11/2026). */}
                            {who ? (
                              <ResponsibleTip
                                r={who}
                                t={t}
                                className="mt-0.5 block max-w-48 whitespace-normal"
                              />
                            ) : null}
                            <ResponsibleLogins
                              r={who}
                              t={t}
                              className="max-w-48"
                            />
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                      {/* Situação: o momento de cada produto. */}
                      <Td>
                        <span className="flex flex-wrap gap-1">
                          {statuses.map((status) => (
                            <Badge key={status} tone={STATUS_TONE[status]}>
                              {t(
                                `supplierRequests.status.${status}` as DictionaryKey,
                              )}
                              {many
                                ? ` · ${products.filter((p) => p.status === status).length}`
                                : ""}
                            </Badge>
                          ))}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {sla ? <SlaBadge sla={sla} t={t} /> : "—"}
                      </Td>
                      <Td
                        className={numTd}
                        data-supplier-request-products={r.id}
                      >
                        {distinct.toLocaleString(t.intl)}
                      </Td>
                      <Td className={numTd} data-supplier-request-rounds={r.id}>
                        {rounds}
                      </Td>
                      {totalCells(`r:${r.id}`)}
                      {answerCell}
                      {finishedCell}
                      <CompletionTd c={requestCompletion(products)} t={t} />
                      {orderCell}
                      {openCell}
                    </tr>
                  );
                return (
                  <tr
                    key={r.id}
                    className={rowClass}
                    data-supplier-request-row={r.id}
                  >
                    <Td>
                      <Link href={href} className={linkClass}>
                        {r.number}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {t("customerRequests.kind.request")}
                    </Td>
                    {wellmix ? (
                      <Td data-quotation-origin>
                        {originText(
                          r.bookingLotId || null,
                          r.demandIds ?? null,
                        )}
                      </Td>
                    ) : null}
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {statuses.map((status) => (
                          <Badge key={status} tone={STATUS_TONE[status]}>
                            {t(
                              `supplierRequests.status.${status}` as DictionaryKey,
                            )}
                            {many
                              ? ` · ${products.filter((p) => p.status === status).length}`
                              : ""}
                          </Badge>
                        ))}
                        <SlaBadge sla={sla} t={t} />
                      </span>
                      {/* De quem é a vez (a parte; antes saía a chave
                          crua "…turn.[object Object]") e, quando é dele, a
                          ação, que leva ao lugar de agir. */}
                      {turn ? (
                        <span
                          className="mt-0.5 block text-xs text-zinc-500"
                          data-supplier-request-turn={turn.step}
                        >
                          {t(
                            `supplierRequests.negotiation.turn.${turn.party}` as DictionaryKey,
                          )}
                          {turn.party === "supplier" ? turnAction : null}
                        </span>
                      ) : null}
                    </Td>
                    {wellmix ? <Td>{supplier?.name ?? "—"}</Td> : null}
                    <Td
                      className="tabular-nums"
                      data-supplier-request-products={r.id}
                    >
                      {distinct.toLocaleString(t.intl)}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {t("supplierRequests.detail.pieces", {
                        n: pieces.toLocaleString(t.intl),
                      })}
                    </Td>
                    <Td
                      className="tabular-nums"
                      data-supplier-request-rounds={r.id}
                    >
                      {rounds}
                    </Td>
                    <Td
                      className="whitespace-nowrap tabular-nums"
                      data-supplier-request-containers={r.id}
                    >
                      {containers
                        ? containers.min === containers.max
                          ? containers.max
                          : `${containers.min}–${containers.max}`
                        : "—"}
                    </Td>
                    {answerCell}
                    <Td className="whitespace-nowrap tabular-nums">
                      {dateTime(r.createdAt, t)}
                    </Td>
                    {finishedCell}
                    {orderCell}
                    {openCell}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Empty>
          {t(
            entries.length || quotes.length || invites.length
              ? closedTab
                ? wellmix
                  ? "quotation.tabs.emptyClosed"
                  : "supplierRequests.tabs.emptyClosed"
                : wellmix
                  ? "quotation.tabs.emptyOpen"
                  : "supplierRequests.tabs.emptyOpen"
              : wellmix
                ? "quotation.list.empty"
                : "supplierRequests.list.empty",
          )}
        </Empty>
      )}
    </>
  );
}
