import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { turnTone, turnWaitingKey } from "@/lib/turn";
import { getStore, type PurchaseQuote } from "@/lib/db";
import {
  quoteClosed,
  quoteEmpty,
  supplierInvitations,
  sweepQuotes,
} from "@/lib/services/purchase-quote";
import {
  Badge,
  Card,
  Empty,
  OpenLink,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
  rowClass,
} from "@/components/ui";
import { QuoteDeadline } from "./_time";
import {
  OrderStandardHeads,
  orderHeadText,
} from "@/components/order-standard-cells";
import { supplierQuotesCbm } from "@/lib/services/supplier-sheets";

/*
 * Cotação de compra (mapa B13; dono, 15/11/2026; docs/PURCHASE_DEMAND.md).
 * A Wellmix vê todas as cotações, com quantos responderam e o prazo; o
 * fornecedor vê só os convites dele. Uma linha por cotação, sem colunas de
 * produto (dono, 18/11/2026): "Produtos" é quantos produtos distintos; os
 * produtos ficam na tela da cotação.
 */
const productCount = (q: Pick<PurchaseQuote, "items">) =>
  new Set(q.items.map((i) => i.productId)).size;
export default async function PurchaseQuotesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "quotes");
  const t = await getT();
  const now = new Date();
  // Lembrete antes de vencer e o aviso de "sem resposta" (o relógio corre).
  await sweepQuotes(now).catch(() => null);

  if (!isWellmix(user)) {
    const rows = await supplierInvitations(user, now);
    const [cbm, supplierParty] = await Promise.all([
      user.partyId
        ? supplierQuotesCbm(
            user.partyId,
            rows.map((r) => r.quote),
          ).catch(() => new Map<string, number | null>())
        : Promise.resolve(new Map<string, number | null>()),
      user.partyId
        ? getStore()
            .get("parties", user.partyId)
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    const supplierName = supplierParty?.name ?? "—";
    return (
      <div data-quote-list="supplier">
        <PageHeader
          t={t}
          title={t("quote.title")}
          subtitle={t("quote.supplier.subtitle")}
        />
        <Card>
          {rows.length ? (
            <Table>
              {/* Tabela padrão de pedidos para o fornecedor (dono, 24/11/2026;
                  docs/ORDER_TABLES.md): todas as colunas, na ordem padrão.
                  As condições de venda e o cliente final da Wellmix não saem
                  para quem é de fora ("—"); para ele o cliente é a Wellmix,
                  o m³ é pela caixa dele e o valor é o da resposta dele. */}
              <thead>
                <tr data-order-table="supplier-quotes">
                  <Th>{orderHeadText(t, "number")}</Th>
                  <OrderStandardHeads t={t} seeValue />
                  <Th>
                    <span className="sr-only">{t("tasks.open")}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ quote, response, state }) => {
                  const total = (response.prices ?? []).reduce((sum, p) => {
                    const item = quote.items.find(
                      (i) => i.productId === p.productId,
                    );
                    return sum + p.unitPrice * (item?.quantity ?? 0);
                  }, 0);
                  const rounds = Math.max(
                    1,
                    ...quote.items.map((i) => i.schedule?.items?.length ?? 1),
                  );
                  return (
                    <tr
                      key={response.id}
                      className={rowClass}
                      data-quote-invite={quote.id}
                    >
                      <Td>
                        <Link
                          href={`/app/purchase-quotes/${quote.id}`}
                          className={linkClass}
                        >
                          #{quote.number}
                        </Link>
                      </Td>
                      <Td
                        className="whitespace-nowrap tabular-nums"
                        data-order-col="negotiationDate"
                      >
                        {formatDate(response.invitedAt, t)}
                      </Td>
                      {(
                        [
                          "saleType",
                          "paymentTerm",
                          "paymentMethod",
                          "billing",
                          "vip",
                          "group",
                          "customerCode",
                        ] as const
                      ).map((key) => (
                        <Td key={key} data-order-col={key}>
                          —
                        </Td>
                      ))}
                      <Td data-order-col="customerName">Wellmix</Td>
                      {/* Status: de quem é a vez. */}
                      <Td className="whitespace-nowrap">
                        {state === "open" ? (
                          <Badge tone="warning">
                            {t("quote.products.waitingYou")}
                          </Badge>
                        ) : state === "answered" && quote.status === "open" ? (
                          <Badge tone="info">
                            {t("quote.products.waitingWellmix")}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </Td>
                      {/* Situação: o momento da resposta dele. */}
                      <Td className="whitespace-nowrap">
                        <Badge tone={state === "open" ? "warning" : "neutral"}>
                          {t(`quote.response.${state}` as DictionaryKey)}
                        </Badge>
                      </Td>
                      <Td>
                        <QuoteDeadline t={t} dueAt={response.dueAt} now={now} />
                      </Td>
                      <Td
                        className="text-right tabular-nums"
                        data-quote-products={quote.id}
                      >
                        {productCount(quote)}
                      </Td>
                      <Td className="text-right tabular-nums">{rounds}</Td>
                      <Td
                        className="whitespace-nowrap text-right tabular-nums"
                        data-order-col="cbm"
                      >
                        {typeof cbm.get(quote.id) === "number"
                          ? cbm.get(quote.id)!.toLocaleString(t.intl, {
                              maximumFractionDigits: 3,
                            })
                          : "—"}
                      </Td>
                      <Td className="whitespace-nowrap text-right tabular-nums">
                        {response.status === "answered" &&
                        response.prices?.length
                          ? `${response.currency ?? ""} ${total.toLocaleString(t.intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()
                          : "—"}
                      </Td>
                      <Td data-order-col="supplier">{supplierName}</Td>
                      <Td>
                        <OpenLink
                          href={`/app/purchase-quotes/${quote.id}`}
                          label={t("tasks.open")}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <Empty>{t("quote.supplier.empty")}</Empty>
          )}
        </Card>
      </div>
    );
  }

  const store = getStore();
  const quotes = await store
    .list("purchase_quotes", { orderBy: "createdAt", direction: "desc" })
    .catch(() => [] as PurchaseQuote[]);
  const responses = quotes.length
    ? await store.list("purchase_quote_responses", {
        filter: { quoteId: quotes.map((q) => q.id) },
      })
    : [];
  const stateOf = (q: PurchaseQuote) => {
    const mine = responses.filter((r) => r.quoteId === q.id);
    if (q.status !== "open") return q.status;
    if (quoteEmpty(mine, now)) return "empty";
    return quoteClosed(mine, now) ? "closed" : "open";
  };
  return (
    <div data-quote-list="wellmix">
      <PageHeader
        t={t}
        title={t("quote.title")}
        subtitle={t("quote.subtitle")}
      />
      <Card>
        {quotes.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t("quote.number")}</Th>
                <Th>{t("quote.items")}</Th>
                <Th>{t("quote.answers")}</Th>
                <Th>{t("quote.deadline")}</Th>
                <Th>{t("quote.state")}</Th>
                <Th>
                  <span className="sr-only">{t("tasks.open")}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const mine = responses.filter((r) => r.quoteId === q.id);
                const state = stateOf(q);
                // Prazo: o último dos fornecedores que ainda podem responder.
                const due =
                  state === "open"
                    ? (mine
                        .filter((r) => r.status === "invited")
                        .map((r) => r.dueAt)
                        .sort()
                        .at(-1) ?? null)
                    : null;
                return (
                  <tr key={q.id} className={rowClass} data-quote-row={q.id}>
                    <Td>
                      <Link
                        href={`/app/purchase-quotes/${q.id}`}
                        className={linkClass}
                      >
                        #{q.number}
                      </Link>
                    </Td>
                    <Td className="tabular-nums" data-quote-products={q.id}>
                      {productCount(q)}
                    </Td>
                    <Td className="tabular-nums">
                      {mine.filter((r) => r.status === "answered").length}/
                      {mine.length}
                    </Td>
                    <Td>
                      {due ? (
                        <QuoteDeadline t={t} dueAt={due} now={now} />
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
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
                      {/* De quem é a vez (docs/TURNS.md): no prazo, os
                          fornecedores respondem; depois, a Wellmix escolhe,
                          decide ou aprova. */}
                      {state === "open" ||
                      state === "closed" ||
                      state === "empty" ||
                      state === "chosen" ? (
                        <span
                          className="ml-1 inline-block"
                          data-quote-turn={
                            state === "open" ? "supplier" : "wellmix"
                          }
                        >
                          <Badge
                            tone={turnTone(
                              state === "open" ? "supplier" : "wellmix",
                            )}
                          >
                            {t(
                              turnWaitingKey(
                                state === "open" ? "supplier" : "wellmix",
                              ),
                            )}
                          </Badge>
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <OpenLink
                        href={`/app/purchase-quotes/${q.id}`}
                        label={t("tasks.open")}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty>{t("quote.empty")}</Empty>
        )}
      </Card>
    </div>
  );
}
