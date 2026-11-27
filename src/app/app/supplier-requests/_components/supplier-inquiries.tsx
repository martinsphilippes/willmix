import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { User } from "@/lib/db";
import { SUPPLIER_REQUEST_STATUSES } from "@/lib/db/schema";
import { listSupplierRequests } from "@/lib/services/supplier-requests";
import {
  slaOf,
  supplierRequestSlaMinutes,
} from "@/lib/services/supplier-request-negotiation";
import { pendingQuoteProposals } from "@/lib/quote-negotiation";
import {
  supplierInvitations,
  sweepQuotes,
} from "@/lib/services/purchase-quote";
import {
  soldBeforeProducts,
  supplierQuotesCbm,
} from "@/lib/services/supplier-sheets";
import { inviteLate, listInvitesFor } from "@/lib/services/booking-invites";
import { groupRequests } from "@/lib/supplier-requests";
import { requestClosed } from "@/lib/supplier-request-closing";
import {
  supplierRequestStepHref,
  supplierRequestTurn,
} from "@/lib/supplier-request-sampling";
import { requestItemSpecs } from "@/lib/supplier-request-specs";
import {
  inviteCompletion,
  quoteResponseCompletion,
  requestCompletion,
  type Completion,
} from "@/lib/inquiry-completion";
import {
  Alert,
  Badge,
  Card,
  Empty,
  OpenLink,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  cx,
  linkClass,
  rowClass,
} from "@/components/ui";
import { orderHeadText } from "@/components/order-standard-cells";
import { QuoteDeadline } from "../../purchase-quotes/_time";
import { STATUS_TONE } from "./status";
import { SlaBadge } from "./negotiation";
import { requestRounds } from "./request-load";
import { CompletionTd } from "./completion";
import { pinnedColumns } from "@/components/pinned-columns";
import { productNameText } from "@/i18n";

/*
 * Consultas do fornecedor (dono, 27/11/2026): o mesmo passo do fluxo que a
 * Wellmix já vê numa tela só (docs/QUOTATION.md) também junto para ele. Os
 * convites de book, as solicitações sobre os itens dos books dele e as
 * cotações de compra (antes em /app/purchase-quotes) numa tabela só, a
 * tabela padrão de pedidos do fornecedor (docs/ORDER_TABLES.md: as colunas
 * na ordem padrão; as condições de venda e o cliente final da Wellmix não
 * saem para quem é de fora, "—"; para ele o cliente é a Wellmix), e no fim
 * as colunas da tela: Tipo e Completude. Abas "Em negociação" e
 * "Encerradas", como antes.
 */

/** Cor da situação do convite de book (a mesma da tabela dos convites). */
const INVITE_TONE: Record<string, "warning" | "success" | "neutral"> = {
  open: "warning",
  answered: "success",
  cancelled: "neutral",
};

const num = "whitespace-nowrap text-right tabular-nums";
const pin = pinnedColumns(["3.5rem", "7.5rem", "13rem"]);

interface Row {
  key: string;
  /** Data da linha (ordem da tabela: a mais nova primeiro). */
  at: string;
  closed: boolean;
  href: string;
  number: number;
  marks: Record<string, string>;
  numberMarks?: Record<string, string>;
  status: ReactNode;
  step: ReactNode;
  deadline: ReactNode;
  items: number;
  itemsMark?: Record<string, string>;
  rounds: number | null;
  roundsMark?: Record<string, string>;
  cbm: number | null;
  value: string | null;
  kind: DictionaryKey;
  /** O produto (ou o primeiro e "+N"), para ele achar a consulta. */
  product: string;
  completion: Completion;
  openMarks?: Record<string, string>;
}

export async function SupplierInquiries({
  user,
  closedTab,
  t,
}: {
  user: User;
  closedTab: boolean;
  t: Translate;
}) {
  const now = new Date();
  await sweepQuotes(now).catch(() => null);
  const [entries, invites, quotes, slaMinutes] = await Promise.all([
    listSupplierRequests(user),
    listInvitesFor(user).then((x) => x ?? []),
    supplierInvitations(user, now),
    supplierRequestSlaMinutes(),
  ]);
  const quoteProductIds = [
    ...new Set(quotes.flatMap((q) => q.quote.items.map((i) => i.productId))),
  ];
  const [cbm, known] = user.partyId
    ? await Promise.all([
        supplierQuotesCbm(
          user.partyId,
          quotes.map((q) => q.quote),
        ).catch(() => new Map<string, number | null>()),
        quoteProductIds.length
          ? soldBeforeProducts(user.partyId, quoteProductIds).catch(
              () => new Set<string>(),
            )
          : Promise.resolve(new Set<string>()),
      ])
    : [new Map<string, number | null>(), new Set<string>()];
  const waiting = (who: "you" | "wellmix", href?: string | null) => {
    const badge = (
      <Badge tone={who === "you" ? "warning" : "info"}>
        {t(
          who === "you"
            ? "quote.products.waitingYou"
            : "quote.products.waitingWellmix",
        )}
      </Badge>
    );
    return href ? <Link href={href}>{badge}</Link> : badge;
  };
  const money = (currency: string | null, value: number) =>
    `${currency ?? ""} ${value.toLocaleString(t.intl, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`.trim();

  // O primeiro produto e quantos mais (os nomes repetidos contam uma vez).
  const productsText = (names: string[]) => {
    const list = [...new Set(names)];
    return list.length <= 1
      ? (list[0] ?? "—")
      : `${list[0]} ${t("inquiries.moreProducts", { n: list.length - 1 })}`;
  };
  const rows: Row[] = [];

  // Cotações de compra (mapa B13): a resposta dele a cada convite.
  for (const { quote, response, state } of quotes) {
    const href = `/app/purchase-quotes/${quote.id}`;
    const running = quote.status === "open" || quote.status === "chosen";
    const closed = !(running && (state === "open" || state === "answered"));
    const proposal =
      state === "answered" &&
      quote.status === "open" &&
      pendingQuoteProposals(response).length > 0;
    const total = (response.prices ?? []).reduce((sum, p) => {
      const item = quote.items.find((i) => i.productId === p.productId);
      return sum + p.unitPrice * (item?.quantity ?? 0);
    }, 0);
    rows.push({
      key: `q:${response.id}`,
      at: response.invitedAt,
      closed,
      href,
      number: quote.number,
      marks: { "data-quote-invite": quote.id },
      status:
        state === "open" || proposal
          ? waiting("you", href)
          : state === "answered" && running
            ? waiting("wellmix")
            : "—",
      step: (
        <Badge tone={state === "open" ? "warning" : "neutral"}>
          {t(`quote.response.${state}` as DictionaryKey)}
        </Badge>
      ),
      deadline: <QuoteDeadline t={t} dueAt={response.dueAt} now={now} />,
      items: new Set(quote.items.map((i) => i.productId)).size,
      itemsMark: { "data-quote-products": quote.id },
      rounds: Math.max(
        1,
        ...quote.items.map((i) => i.schedule?.items?.length ?? 1),
      ),
      cbm: cbm.get(quote.id) ?? null,
      value:
        response.status === "answered" && response.prices?.length
          ? money(response.currency, total)
          : null,
      kind: "inquiries.kind.quote",
      product: productsText(quote.items.map((i) => productNameText(t, i.name))),
      completion: quoteResponseCompletion(quote, response, known),
    });
  }

  // Convites de book: subir o book concorrente de um item.
  for (const i of invites) {
    const href = `/app/supplier-requests/invites/${i.id}`;
    rows.push({
      key: `i:${i.id}`,
      at: i.createdAt,
      closed: i.status !== "open",
      href,
      number: i.number,
      marks: {
        "data-booking-invite-row": i.status,
        "data-customer-request-invite": i.id,
      },
      numberMarks: { "data-booking-invite-open": i.id },
      status: i.status === "open" ? waiting("you", href) : "—",
      step: (
        <span className="flex flex-col gap-0.5">
          <span className="flex flex-wrap gap-1">
            <Badge tone={INVITE_TONE[i.status]}>
              {t(`bookingInvites.status.${i.status}` as DictionaryKey)}
            </Badge>
            {inviteLate(i) ? (
              <Badge tone="danger">{t("bookingInvites.late")}</Badge>
            ) : null}
          </span>
        </span>
      ),
      deadline:
        i.status === "open" ? (
          <QuoteDeadline t={t} dueAt={i.dueAt} now={now} />
        ) : (
          "—"
        ),
      items: 1,
      rounds: null,
      cbm: null,
      value: null,
      kind: "customerRequests.kind.invite",
      product: i.item.description ?? i.item.productName ?? "—",
      completion: inviteCompletion(i),
    });
  }

  // Solicitações ao fornecedor: uma linha por solicitação (os produtos
  // abertos juntos para ele ficam dentro dela).
  const requests = groupRequests((entries ?? []).map((e) => e.request)).map(
    (list) =>
      [...list].sort(
        (a, b) => a.number - b.number || a.createdAt.localeCompare(b.createdAt),
      ),
  );
  for (const products of requests) {
    const r = products[0];
    const many = products.length > 1;
    const href = `/app/supplier-requests/${r.id}`;
    const statuses = SUPPLIER_REQUEST_STATUSES.filter((status) =>
      products.some((p) => p.status === status),
    );
    const slas = products.map((p) => slaOf(p, slaMinutes, now));
    const sla = slas.find((x) => x?.late) ?? slas.find((x) => x) ?? null;
    const steps = products.map((p) => supplierRequestTurn(p));
    const turn =
      steps.find((s) => s?.party === "supplier") ??
      steps.find((s) => s?.party === "wellmix") ??
      null;
    const turnProduct = turn ? products[steps.indexOf(turn)] : null;
    const turnHref =
      turn && turnProduct
        ? supplierRequestStepHref(turnProduct.id, turn.step)
        : null;
    // m³: a soma dos produtos que têm caixa e CBM (sem nenhum, "—").
    const loads = products
      .map((p) => requestItemSpecs(p).totalCbm)
      .filter((v): v is number => typeof v === "number");
    // Valor: a resposta dele (preço × quantidade), por moeda.
    const byCurrency = new Map<string, number>();
    for (const p of products)
      if (p.supplierCanDo === "yes" && p.supplierPrice !== null)
        byCurrency.set(
          p.supplierCurrency ?? "",
          (byCurrency.get(p.supplierCurrency ?? "") ?? 0) +
            p.supplierPrice * p.quantity,
        );
    rows.push({
      key: `r:${r.id}`,
      at: r.createdAt,
      closed: requestClosed(products),
      href,
      number: r.number,
      marks: { "data-supplier-request-row": r.id },
      status: turn ? (
        <span
          className="flex flex-col gap-0.5"
          data-supplier-request-turn={turn.step}
        >
          {waiting(turn.party === "supplier" ? "you" : "wellmix", turnHref)}
          {turn.party === "supplier" && turnHref ? (
            <Link
              href={turnHref}
              className={`${linkClass} text-xs`}
              data-supplier-request-turn-action={turn.step}
            >
              {t(`reqList.next.${turn.step}` as DictionaryKey)}
            </Link>
          ) : null}
        </span>
      ) : (
        "—"
      ),
      step: (
        <span className="flex flex-wrap gap-1">
          {statuses.map((status) => (
            <Badge key={status} tone={STATUS_TONE[status]}>
              {t(`supplierRequests.status.${status}` as DictionaryKey)}
              {many
                ? ` · ${products.filter((p) => p.status === status).length}`
                : ""}
            </Badge>
          ))}
        </span>
      ),
      deadline: sla ? <SlaBadge sla={sla} t={t} /> : "—",
      items: new Set(products.map((p) => p.bookingItemId ?? p.id)).size,
      itemsMark: { "data-supplier-request-products": r.id },
      rounds: requestRounds(products),
      roundsMark: { "data-supplier-request-rounds": r.id },
      cbm: loads.length
        ? Math.round(loads.reduce((s, v) => s + v, 0) * 1000) / 1000
        : null,
      value: byCurrency.size
        ? [...byCurrency.entries()].map(([c, v]) => money(c, v)).join(" · ")
        : null,
      kind: "customerRequests.kind.request",
      product: productsText(
        products.map(
          (p) =>
            p.item.description ??
            p.item.productName ??
            p.item.factoryItemCode ??
            "—",
        ),
      ),
      completion: requestCompletion(products),
      openMarks: { "data-supplier-request-open": r.id },
    });
  }

  const openRows = rows.filter((x) => !x.closed);
  const closedRows = rows.filter((x) => x.closed);
  const tabRows = (closedTab ? closedRows : openRows).sort((a, b) =>
    b.at.localeCompare(a.at),
  );

  return (
    <>
      <PageHeader
        t={t}
        title={t("customerRequests.title")}
        subtitle={t("customerRequests.subtitle")}
      />
      <nav
        aria-label={t("supplierRequests.tabs.label")}
        className="mb-4 flex gap-1 border-b border-zinc-200 text-sm"
        data-supplier-request-tabs
      >
        {(
          [
            ["open", "/app/supplier-requests", openRows.length],
            ["closed", "/app/supplier-requests?tab=closed", closedRows.length],
          ] as const
        ).map(([id, href, n]) => {
          const active = (id === "closed") === closedTab;
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
              {t(`supplierRequests.tabs.${id}` as DictionaryKey)} ({n})
            </Link>
          );
        })}
      </nav>
      {entries === null ? (
        <div className="mb-3">
          <Alert tone="warning">
            {t("supplierRequests.selection.schemaMissing")}
          </Alert>
        </div>
      ) : null}
      {tabRows.length ? (
        <Card>
          <p className="mb-2 text-sm text-zinc-600" data-supplier-request-count>
            {t("customerRequests.count", {
              n: tabRows.length,
              products: tabRows.reduce((s, x) => s + x.items, 0),
            })}
          </p>
          <Table>
            <thead>
              {/* Colunas do fornecedor (dono, 27/11/2026): sem as condições
                  de venda, o grupo, o cliente e o "Fornecedor" (ele mesmo);
                  Nº, Tipo e Produto primeiro, fixos na rolagem, para ele
                  achar a consulta. */}
              <tr data-order-table="supplier-inquiries">
                {(
                  [
                    orderHeadText(t, "number"),
                    t("customerRequests.col.kind"),
                    t("inquiries.col.product"),
                  ] as const
                ).map((label, i) => (
                  <Th
                    key={label}
                    className={pin.cell(i, true)}
                    style={pin.style(i)}
                  >
                    {label}
                  </Th>
                ))}
                {(["status", "step", "sla"] as const).map((key) => (
                  <Th key={key} className="whitespace-nowrap">
                    {orderHeadText(t, key)}
                  </Th>
                ))}
                <Th className="whitespace-nowrap">
                  {t("inquiries.col.completion")}
                </Th>
                {(["items", "deliveries", "cbm", "value"] as const).map(
                  (key) => (
                    <Th key={key} className="whitespace-nowrap">
                      {orderHeadText(t, key)}
                    </Th>
                  ),
                )}
                <Th className="whitespace-nowrap">
                  {orderHeadText(t, "negotiationDate")}
                </Th>
                <Th>
                  <span className="sr-only">{t("tasks.open")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {tabRows.map((x) => (
                <tr key={x.key} className={cx(rowClass, pin.row)} {...x.marks}>
                  <Td className={pin.cell(0)} style={pin.style(0)}>
                    <div style={pin.box(0)} className="tabular-nums">
                      <Link
                        href={x.href}
                        className={linkClass}
                        {...(x.numberMarks ?? {})}
                      >
                        {x.number}
                      </Link>
                    </div>
                  </Td>
                  <Td
                    className={pin.cell(1)}
                    style={pin.style(1)}
                    data-inquiry-kind
                  >
                    <div style={pin.box(1)} className="whitespace-normal">
                      {t(x.kind)}
                    </div>
                  </Td>
                  <Td
                    className={pin.cell(2)}
                    style={pin.style(2)}
                    data-inquiry-product
                  >
                    <div
                      style={pin.box(2)}
                      className="line-clamp-2 whitespace-normal"
                      title={x.product}
                    >
                      {x.product}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap" data-order-col="status">
                    {x.status}
                  </Td>
                  <Td data-order-col="step">{x.step}</Td>
                  <Td className="whitespace-nowrap" data-order-col="sla">
                    {x.deadline}
                  </Td>
                  <CompletionTd c={x.completion} t={t} />
                  <Td className={num} {...(x.itemsMark ?? {})}>
                    {x.items.toLocaleString(t.intl)}
                  </Td>
                  <Td className={num} {...(x.roundsMark ?? {})}>
                    {x.rounds ?? "—"}
                  </Td>
                  <Td className={num} data-order-col="cbm">
                    {x.cbm !== null
                      ? x.cbm.toLocaleString(t.intl, {
                          maximumFractionDigits: 3,
                        })
                      : "—"}
                  </Td>
                  <Td className={num} data-order-col="value">
                    {x.value ?? "—"}
                  </Td>
                  <Td
                    className="whitespace-nowrap tabular-nums"
                    data-order-col="negotiationDate"
                  >
                    {formatDate(x.at, t)}
                  </Td>
                  <Td>
                    <OpenLink
                      href={x.href}
                      label={t("tasks.open")}
                      {...(x.openMarks ?? {})}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <Empty>
          {t(
            rows.length
              ? closedTab
                ? "supplierRequests.tabs.emptyClosed"
                : "supplierRequests.tabs.emptyOpen"
              : "supplierRequests.list.empty",
          )}
        </Empty>
      )}
    </>
  );
}
