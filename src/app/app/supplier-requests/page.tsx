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
import {
  finishedLate,
  groupRequests,
  negotiationTurn,
} from "@/lib/supplier-requests";
import { dictionaries } from "@/i18n/dictionaries";
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
  linkClass,
  rowClass,
} from "@/components/ui";
import { can, canSeePurchasePrice } from "@/lib/auth/function-access";
import { getStore, type PurchaseQuote } from "@/lib/db";
import {
  quoteClosed,
  quoteEmpty,
  sweepQuotes,
} from "@/lib/services/purchase-quote";
import { turnTone, turnWaitingKey } from "@/lib/turn";
import { QuoteDeadline } from "../purchase-quotes/_time";
import { InvitesTable } from "./_components/invites-table";

/*
 * Solicitações ao fornecedor (docs/SUPPLIER_REQUESTS.md): a Wellmix vê todas;
 * o fornecedor, só as do próprio cadastro. Duas abas (dono, 18/11/2026): "Em
 * negociação" (a primeira) e "Encerradas" (todos os produtos decididos), onde
 * a solicitação com todos os produtos cadastrados ganha "Gerar pedido", que
 * leva ao quadro "Gerar pedido de compra" (por fornecedor, para juntar outras
 * solicitações do mesmo fornecedor e ajustar a quantidade).
 */

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
  const tabProducts = new Set(requests.flat().map((p) => p.bookingItemId)).size;
  // Pedido de compra (docs/PURCHASE_ORDER.md), só na aba Encerradas: os
  // produtos aprovados de cada fornecedor que ainda não estão em pedido.
  const purchase =
    closedTab && showPurchase ? await listPurchaseCandidates(user) : null;
  const purchaseCustomer = purchase?.length
    ? await purchaseOrderCustomer()
    : null;

  return (
    <>
      <PageHeader
        t={t}
        title={t(
          wellmix ? "quotation.list.title" : "supplierRequests.list.title",
        )}
        subtitle={t(
          wellmix
            ? "quotation.list.subtitle"
            : "supplierRequests.list.subtitleSupplier",
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
              openRequests.length + openQuotes.length,
            ],
            [
              "closed",
              "/app/supplier-requests?tab=closed",
              closedRequests.length + closedQuotes.length,
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
      ) : requests.length || tabQuotes.length ? (
        <Card>
          <p className="mb-2 text-sm text-zinc-600" data-supplier-request-count>
            {t(
              wellmix ? "quotation.list.count" : "supplierRequests.list.count",
              {
                n: requests.length + tabQuotes.length,
                products:
                  tabProducts +
                  new Set(
                    tabQuotes.flatMap((q) => q.items.map((i) => i.productId)),
                  ).size,
              },
            )}
          </p>
          <Table>
            <thead>
              <tr>
                <Th>{t("supplierRequests.col.number")}</Th>
                {wellmix ? <Th>{t("quotation.col.origin")}</Th> : null}
                <Th>{t("supplierRequests.col.status")}</Th>
                {wellmix ? <Th>{t("supplierRequests.col.supplier")}</Th> : null}
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
                const pieces = q.items.reduce((sum, i) => sum + i.quantity, 0);
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
                    className={rowClass}
                    data-quotation-quote-row={q.id}
                  >
                    <Td>
                      <Link href={href} className={linkClass}>
                        {q.number}
                      </Link>
                    </Td>
                    <Td>{t("quotation.origin.demand")}</Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
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
                        {turn ? (
                          <span data-quote-turn={turn}>
                            <Badge tone={turnTone(turn)}>
                              {t(turnWaitingKey(turn))}
                            </Badge>
                          </span>
                        ) : null}
                      </span>
                    </Td>
                    <Td className="max-w-56 whitespace-normal">
                      <span title={names.join(", ")}>
                        {names.length === 1
                          ? names[0]
                          : t("quotation.list.suppliers", { n: names.length })}
                      </span>
                    </Td>
                    <Td className="tabular-nums" data-quote-products={q.id}>
                      {new Set(q.items.map((i) => i.productId)).size}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {t("supplierRequests.detail.pieces", {
                        n: pieces.toLocaleString(t.intl),
                      })}
                    </Td>
                    <Td className="tabular-nums">{rounds}</Td>
                    <Td>—</Td>
                    <Td>
                      {t("supplierRequests.list.answered", {
                        n: mine.filter((r) => r.status === "answered").length,
                        total: mine.length,
                      })}
                      {due ? (
                        <span className="block">
                          <QuoteDeadline t={t} dueAt={due} now={now} />
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums">
                      {dateTime(q.createdAt, t)}
                    </Td>
                    <Td>—</Td>
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
                const turns = products.map((p) => negotiationTurn(p));
                const turn = turns.includes("supplier")
                  ? "supplier"
                  : turns.includes("wellmix")
                    ? "wellmix"
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
                    {wellmix ? (
                      <Td data-quotation-origin>
                        {t(
                          r.bookingLotId
                            ? "quotation.origin.book"
                            : "quotation.origin.demand",
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
                      {turn ? (
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {t(
                            `supplierRequests.negotiation.turn.${turn}` as DictionaryKey,
                          )}
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
                    <Td className="whitespace-nowrap tabular-nums">
                      {dateTime(r.createdAt, t)}
                    </Td>
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
                    {orderState ? (
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
                    ) : null}
                    <Td>
                      <OpenLink
                        href={href}
                        label={t("tasks.open")}
                        data-supplier-request-open={r.id}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Empty>
          {t(
            entries.length || quotes.length
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
