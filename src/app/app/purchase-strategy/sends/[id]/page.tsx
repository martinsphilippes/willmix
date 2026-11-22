import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { productNameText } from "@/i18n";
import { errorTextFor } from "@/i18n/error-text";
import { getStore, type StrategyRecipientStatus } from "@/lib/db";
import { listByIds } from "@/lib/db/lookup";
import { AUTO_ACTOR_ID } from "@/lib/purchase-demand";
import { partyTypeLabel } from "@/lib/partner-types";
import {
  canChooseStrategy,
  getStrategySend,
  sendRetryable,
} from "@/lib/services/purchase-strategy";
import { getPartnerTypeCatalog } from "@/lib/services/partner-types";
import {
  Alert,
  Badge,
  Card,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  linkClass,
  rowClass,
  type Tone,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionError } from "@/components/action-error";
import { retryStrategySendAction } from "../../../actions/purchase-demand";

/*
 * Resultado de um envio da Estratégia de Compra (dono, 18/11/2026;
 * docs/PURCHASE_DEMAND.md): por produto, a escolha, a cotação aberta e o que
 * aconteceu com cada destinatário (recebeu, já tinha recebido, ficou de fora
 * por uma pendência ou deu erro). "Tentar de novo" refaz só quem ficou de
 * fora ou deu erro, sem convidar duas vezes quem já recebeu.
 */

const STATUS_TONE: Record<StrategyRecipientStatus, Tone> = {
  sent: "success",
  already: "neutral",
  blocked: "warning",
  failed: "danger",
};

export default async function StrategySendPage({
  params,
  searchParams,
}: PageProps<"/app/purchase-strategy/sends/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "purchaseStrategy");
  if (!isWellmix(user)) redirect("/app");
  const { id } = await params;
  const sp = await searchParams;
  const t = await getT();
  const send = await getStrategySend(id);
  if (!send) notFound();
  const store = getStore();
  const partyIds = send.lines.flatMap((l) => [
    ...l.recipientIds,
    ...l.recipients.map((r) => r.partyId),
  ]);
  const [demands, parties, quotes, creator, catalog] = await Promise.all([
    listByIds(
      store,
      "requests",
      send.lines.flatMap((l) => l.demandIds ?? [l.demandId]),
    ),
    listByIds(store, "parties", partyIds),
    listByIds(
      store,
      "purchase_quotes",
      send.lines.map((l) => l.quoteId).filter((q): q is string => !!q),
    ),
    send.createdByUserId === AUTO_ACTOR_ID
      ? null
      : store.get("users", send.createdByUserId),
    getPartnerTypeCatalog(),
  ]);
  const errorCode = typeof sp.error === "string" ? sp.error : "";
  const errorText = errorCode
    ? errorTextFor(t, errorCode, ["strategy.error"])
    : null;
  const lineError = (code: string) =>
    errorTextFor(t, code, ["strategy.error", "quote.error"]);
  const canRetry = canChooseStrategy(user) && sendRetryable(send);
  return (
    <div
      data-strategy-send-page={send.id}
      data-strategy-send-status={send.status}
    >
      <PageHeader
        t={t}
        title={t("strategy.send.title", { n: send.number })}
        subtitle={t("strategy.send.subtitle")}
      />
      <ActionError t={t} code={errorCode} text={errorText} fields={null} />
      {sp.done === "1" ? (
        <div className="mb-3" role="status" data-strategy-send-done>
          <Alert tone="success">{t("strategy.send.done")}</Alert>
        </div>
      ) : null}
      {typeof sp.retried === "string" && /^\d{1,4}$/.test(sp.retried) ? (
        <div className="mb-3" role="status" data-strategy-send-retried>
          <Alert tone="success">
            {t("strategy.send.retried", { n: sp.retried })}
          </Alert>
        </div>
      ) : null}
      <p className="mb-3 text-xs text-zinc-600">
        {/* Envio do portal sozinho (cliente confirmou; dono, 22/11/2026). */}
        {send.createdByUserId === AUTO_ACTOR_ID ? (
          <span data-strategy-send-auto>
            {t("strategy.send.byAuto", {
              date: formatDate(send.createdAt, t),
            })}
          </span>
        ) : (
          t("strategy.send.by", {
            name: creator?.name ?? "—",
            date: formatDate(send.createdAt, t),
          })
        )}{" "}
        · {t("strategy.send.runs", { n: send.runs })}
      </p>

      <div className="space-y-3">
        {send.lines.map((line) => {
          const demand = demands.find((d) => d.id === line.demandId);
          // A solicitação inteira (dono, 18/11/2026): todos os produtos dela.
          const names = (line.demandIds ?? [line.demandId])
            .map((id) => demands.find((d) => d.id === id)?.productName)
            .filter((n): n is string => !!n)
            .map((n) => productNameText(t, n));
          const quote = line.quoteId
            ? quotes.find((q) => q.id === line.quoteId)
            : null;
          return (
            <Card key={line.demandId}>
              <section data-strategy-send-line={line.demandId}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    {names.join(", ") || "—"}
                  </h2>
                  {demand ? (
                    <Link
                      href={`/app/requests/${demand.id}`}
                      className={`${linkClass} text-xs`}
                    >
                      {demand.origin === "replenishment"
                        ? t("strategy.line.replenishment", {
                            n: demand.number ?? "—",
                          })
                        : t("strategy.line.order", { n: demand.number ?? "—" })}
                    </Link>
                  ) : null}
                  <Badge tone="neutral">
                    {t(`strategy.choice.${line.choice}` as DictionaryKey)}
                  </Badge>
                </div>
                {quote ? (
                  <p className="mt-1 text-xs text-zinc-700">
                    {t("strategy.send.quote", { n: quote.number })} ·{" "}
                    <Link
                      href={`/app/purchase-quotes/${quote.id}`}
                      className={linkClass}
                      data-strategy-send-quote={quote.id}
                    >
                      {t("strategy.send.openQuote")}
                    </Link>
                  </p>
                ) : null}
                {line.choice === "last_supplier" && line.decisionId ? (
                  <p className="mt-1 text-xs text-zinc-700">
                    {t("strategy.send.direct")}{" "}
                    <Link
                      href={`/app/purchase-strategy?tab=open#decision-${line.decisionId}`}
                      className={linkClass}
                      data-strategy-send-decision={line.decisionId}
                    >
                      {t("strategy.send.back")}
                    </Link>
                  </p>
                ) : null}
                {line.error ? (
                  <p
                    className="mt-1 text-xs font-medium text-red-700"
                    data-strategy-send-line-error={line.error}
                  >
                    {t("strategy.send.lineError", {
                      error: lineError(line.error),
                    })}
                  </p>
                ) : null}
                {line.recipients.length ? (
                  <div className="mt-2">
                    <Table tools={false}>
                      <thead>
                        <tr>
                          <Th>{t("quote.supplier")}</Th>
                          <Th>{t("quote.state")}</Th>
                          <Th>{t("strategy.send.details")}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {line.recipients.map((r) => {
                          const party = parties.find((p) => p.id === r.partyId);
                          return (
                            <tr
                              key={r.partyId}
                              className={rowClass}
                              data-strategy-send-recipient={r.partyId}
                              data-strategy-send-recipient-status={r.status}
                            >
                              <Td className="font-medium">
                                {party ? (
                                  <Link
                                    href={
                                      party.type === "supplier"
                                        ? `/app/suppliers/${party.id}?tab=info`
                                        : `/app/parties/${party.id}`
                                    }
                                    className="text-zinc-900 hover:underline"
                                  >
                                    {party.name}
                                  </Link>
                                ) : (
                                  r.partyId
                                )}
                                {party ? (
                                  <span className="block text-xs font-normal text-zinc-500">
                                    {partyTypeLabel(party, catalog, t)}
                                  </span>
                                ) : null}
                              </Td>
                              <Td>
                                <Badge tone={STATUS_TONE[r.status]}>
                                  {t(
                                    `strategy.send.status.${r.status}` as DictionaryKey,
                                  )}
                                </Badge>
                              </Td>
                              <Td className="text-xs text-zinc-700">
                                {r.status === "sent"
                                  ? t("strategy.send.logins", { n: r.logins })
                                  : null}
                                {r.status === "blocked"
                                  ? r.reasons
                                      .map((code) =>
                                        t(
                                          `strategy.issue.${code}` as DictionaryKey,
                                        ),
                                      )
                                      .join(" ")
                                  : null}
                                {r.status === "failed" && r.error
                                  ? lineError(r.error)
                                  : null}
                                <span className="block text-zinc-400">
                                  {formatDate(r.at, t)}
                                </span>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                ) : null}
              </section>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {canRetry ? (
          <form action={retryStrategySendAction}>
            <input type="hidden" name="sendId" value={send.id} />
            <SubmitButton data-strategy-send-retry>
              {t("strategy.send.retry")}
            </SubmitButton>
            <span className="ml-2 text-xs text-zinc-600">
              {t("strategy.send.retryHint")}
            </span>
          </form>
        ) : null}
        <LinkButton href="/app/purchase-strategy" variant="secondary">
          {t("strategy.send.back")}
        </LinkButton>
      </div>
    </div>
  );
}
