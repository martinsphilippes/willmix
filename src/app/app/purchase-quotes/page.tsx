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
  linkClass,
  rowClass,
} from "@/components/ui";
import { QuoteDeadline } from "./_time";

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
              <thead>
                <tr>
                  <Th>{t("quote.number")}</Th>
                  <Th>{t("quote.items")}</Th>
                  <Th>{t("quote.deadline")}</Th>
                  <Th>{t("quote.state")}</Th>
                  <Th>
                    <span className="sr-only">{t("tasks.open")}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ quote, response, state }) => (
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
                    <Td className="tabular-nums" data-quote-products={quote.id}>
                      {productCount(quote)}
                    </Td>
                    <Td>
                      <QuoteDeadline t={t} dueAt={response.dueAt} now={now} />
                    </Td>
                    <Td>
                      <Badge tone={state === "open" ? "warning" : "neutral"}>
                        {t(`quote.response.${state}` as DictionaryKey)}
                      </Badge>
                    </Td>
                    <Td>
                      <OpenLink
                        href={`/app/purchase-quotes/${quote.id}`}
                        label={t("tasks.open")}
                      />
                    </Td>
                  </tr>
                ))}
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
