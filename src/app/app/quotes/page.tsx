import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { QuoteStatus } from "@/lib/db";
import { quotesForUser } from "@/lib/services/quotes-list";
import {
  Badge,
  Empty,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  formatMoney,
  isOverdue,
  rowClass,
  type Tone,
} from "@/components/ui";

/*
 * Cotações do fornecedor (a Wellmix vê todas): para responder, enviadas
 * (aguardando a decisão; dá para corrigir e reenviar), escolhidas e não
 * escolhidas. Os filtros são links (?status=…), funcionam sem JavaScript.
 */
const TABS: QuoteStatus[] = ["invited", "answered", "selected", "rejected"];

const TONE: Record<QuoteStatus, Tone> = {
  invited: "warning",
  answered: "info",
  selected: "success",
  rejected: "neutral",
};

export default async function QuotesPage({
  searchParams,
}: PageProps<"/app/quotes">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/quotes");
  const wellmix = isWellmix(user);
  requireScreen(user, "quotes");
  const t = await getT();
  const { status } = await searchParams;
  const active = TABS.find((s) => s === status) ?? null;
  const all = await quotesForUser(user);
  const shown = active ? all.filter((q) => q.status === active) : all;
  const count = (s: QuoteStatus) => all.filter((q) => q.status === s).length;
  const chip = (on: boolean) =>
    cx(
      "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition",
      on
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50",
    );
  const badge = (n: number, on: boolean) => (
    <span
      className={cx(
        "rounded-full px-1.5 text-xs",
        on ? "bg-white/20" : "bg-zinc-100 text-zinc-600",
      )}
    >
      {n}
    </span>
  );

  return (
    <>
      <PageHeader
        help={{ body: "help.quotes.body" }}
        t={t}
        title={t("quotes.list.title")}
      />
      {all.length === 0 ? (
        <Empty>{t("quotes.list.empty")}</Empty>
      ) : (
        <>
          <nav
            className="mb-3 flex flex-wrap items-center gap-2"
            aria-label={t("quotes.list.title")}
            data-quote-tabs
          >
            <Link
              href="/app/quotes"
              aria-current={!active ? "page" : undefined}
              className={chip(!active)}
              data-quote-tab="all"
            >
              {t("quotes.list.all")} {badge(all.length, !active)}
            </Link>
            {TABS.filter((s) => count(s) > 0 || s === active).map((s) => (
              <Link
                key={s}
                href={`/app/quotes?status=${s}`}
                aria-current={active === s ? "page" : undefined}
                className={chip(active === s)}
                data-quote-tab={s}
              >
                {t(`quotes.list.tab.${s}`)} {badge(count(s), active === s)}
              </Link>
            ))}
          </nav>
          {shown.length === 0 ? (
            <Empty>{t("quotes.list.emptyTab")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("common.product")}</Th>
                  {wellmix ? <Th>{t("common.supplier")}</Th> : null}
                  <Th>{t("common.quantity")}</Th>
                  <Th>{t("common.status")}</Th>
                  <Th>{t("quotes.list.when")}</Th>
                  <Th>{t("quotes.list.price")}</Th>
                  <Th>
                    <span className="sr-only">{t("quotes.list.open")}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((q) => {
                  const toAnswer = q.status === "invited";
                  // Enviada é a que tem data de resposta (rascunho não conta).
                  const sent = !!q.answeredAt;
                  const due = toAnswer && isOverdue(q.validUntil);
                  return (
                    <tr key={q.id} className={rowClass} data-quote-row={q.id}>
                      <Td className="min-w-44">
                        <TextLink
                          href={`/app/quotes/${q.id}`}
                          className="font-medium"
                        >
                          {q.productName}
                        </TextLink>
                        {q.requestNumber ? (
                          <span className="block text-xs tabular-nums text-zinc-500">
                            {t("requests.numbered", { n: q.requestNumber })}
                          </span>
                        ) : null}
                      </Td>
                      {wellmix ? (
                        <Td className="min-w-32">{q.supplierName ?? "—"}</Td>
                      ) : null}
                      <Td className="whitespace-nowrap tabular-nums">
                        {q.quantity.toLocaleString(t.intl)} {q.unit}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone={TONE[q.status]}>
                          {/* "Convidado" vira o que fazer: "Para responder". */}
                          {toAnswer
                            ? t("quotes.list.tab.invited")
                            : q.requestCancelled
                              ? t("quotes.list.requestCancelled")
                              : t(`quoteStatus.${q.status}`)}
                        </Badge>
                      </Td>
                      <Td
                        className={cx(
                          "whitespace-nowrap tabular-nums",
                          due && "font-semibold text-red-700",
                        )}
                      >
                        {toAnswer
                          ? `${t("quotes.list.until")} ${formatDate(q.validUntil, t)}`
                          : sent
                            ? `${t("quotes.list.sentOn")} ${formatDate(q.answeredAt, t)}`
                            : t("quotes.list.notAnswered")}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums">
                        {q.price !== null && sent
                          ? formatMoney(q.price, q.currency, t)
                          : "—"}
                        {q.leadTimeDays != null && sent ? (
                          <span className="block text-xs text-zinc-500">
                            {t("quoteSent.lead", { days: q.leadTimeDays })}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        <LinkButton
                          href={`/app/quotes/${q.id}`}
                          variant={toAnswer ? "primary" : "secondary"}
                        >
                          {toAnswer
                            ? t("quotes.list.answer")
                            : t("quotes.list.open")}
                        </LinkButton>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </>
      )}
    </>
  );
}
