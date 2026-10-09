import { redirect } from "next/navigation";
import { fallbackError } from "@/i18n/error-text";
import { getCurrentUser } from "@/lib/auth/session";
import { isWellmix } from "@/lib/auth/permissions";
import { getStore, type Document } from "@/lib/db";
import {
  ackTrails,
  recordAck,
  type AckSummary,
} from "@/lib/services/acknowledgements";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  Stat,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  formatDate,
  formatMoney,
  linkClass,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { acknowledgePaymentAction } from "../actions/orders-extra";
import { listCertifications } from "@/lib/services/compliance";
import { CertificationsSection } from "../products/_components/certifications-section";

/** Conta corrente do fornecedor: pedidos, valores, pagamentos, saldo. */
export default async function AccountPage({
  searchParams,
}: PageProps<"/app/account">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { supplier, error } = await searchParams;
  const supplierId =
    user.role === "supplier"
      ? user.partyId
      : isWellmix(user) && typeof supplier === "string"
        ? supplier
        : null;
  if (!supplierId) redirect("/app");
  const t = await getT();
  const store = getStore();
  const wellmix = isWellmix(user);
  const [orders, payments, party] = await Promise.all([
    store.list("orders", {
      filter: { supplierId },
      orderBy: "number",
      direction: "desc",
    }),
    store.list("payments", { filter: { direction: "supplier_out" } }),
    store.get("parties", supplierId),
  ]);
  const mine = payments.filter((p) => orders.some((o) => o.id === p.orderId));
  const totalOrders = orders.reduce((s, o) => s + (o.fobTotal ?? 0), 0);
  const totalReceived = mine
    .filter((p) => p.status === "received")
    .reduce((s, p) => s + p.amount, 0);
  const totalPending = mine
    .filter((p) => p.status === "confirmed")
    .reduce((s, p) => s + p.amount, 0);
  const currency = orders[0]?.fobCurrency ?? "USD";

  /* Trilha: listar os pagamentos para o fornecedor registra "visualizado"
     (uma vez por usuário); confirmar continua sendo o ato explícito do botão. */
  if (user.role === "supplier") {
    for (const p of mine) await recordAck(user, "payment", p.id, "viewed");
  }
  const proofIds = mine
    .map((p) => p.proofDocumentId)
    .filter((id): id is string => !!id);
  const [proofDocs, users, history] = await Promise.all([
    proofIds.length
      ? store.list("documents", { filter: { id: proofIds } })
      : Promise.resolve([] as Document[]),
    store.list("users"),
    mine.length
      ? store.list("audit_log", {
          filter: { entity: "payment", entityId: mine.map((p) => p.id) },
          orderBy: "createdAt",
          direction: "desc",
        })
      : Promise.resolve([]),
  ]);
  const [paymentTrails, proofTrails] = await Promise.all([
    ackTrails("payment", mine, (p) => p.registeredByUserId),
    ackTrails("document", proofDocs, (d) => d.uploadedByUserId),
  ]);
  const userName = (uid: string | null) =>
    users.find((u) => u.id === uid)?.name ?? "—";
  /* Segunda Onda: o fornecedor registra as próprias certificações aqui (entram
     pendentes; a Wellmix valida em /app/parties/[id]). */
  const certifications =
    user.role === "supplier"
      ? await listCertifications("party", supplierId)
      : [];
  /* Rótulo traduzido da ação de auditoria; cai no código técnico se não houver chave. */
  const actionLabel = (action: string) => {
    const key = `orders.account.action.${action}` as DictionaryKey;
    const translated = t(key);
    return translated === key ? action : translated;
  };

  return (
    <>
      <PageHeader
        help={{ body: "help.account.body" }}
        t={t}
        title={t("account.title")}
        subtitle={party?.name}
      />
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {fallbackError(t, String(error))}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          label={t("common.total")}
          value={formatMoney(totalOrders, currency, t)}
        />
        <Stat
          label={t("account.received")}
          value={formatMoney(totalReceived, currency, t)}
        />
        <Stat
          label={t("account.balance")}
          value={formatMoney(
            totalOrders - totalReceived - totalPending,
            currency,
            t,
          )}
        />
      </div>
      <div className="mt-6">
        {mine.length === 0 && orders.length === 0 ? (
          <Empty>{t("common.none")}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="whitespace-nowrap">{t("account.order")}</Th>
                <Th>{t("common.date")}</Th>
                <Th>{t("orders.value")}</Th>
                <Th>{t("finance.fx")}</Th>
                <Th>{t("common.status")}</Th>
                <Th>{t("orders.account.proof")}</Th>
                <Th>{t("orders.account.trail")}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="bg-zinc-50/80">
                  <Td>
                    <TextLink href={`/app/orders/${o.id}`}>
                      #{o.number}
                    </TextLink>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(o.createdAt, t)}
                  </Td>
                  <Td className="whitespace-nowrap font-semibold text-zinc-900">
                    {formatMoney(o.fobTotal, o.fobCurrency, t)}
                  </Td>
                  <Td>—</Td>
                  <Td className="whitespace-nowrap">
                    <Badge tone={o.status === "CLOSED" ? "success" : "neutral"}>
                      {t(`stage.${o.status}`)}
                    </Badge>
                  </Td>
                  <Td />
                  <Td />
                  <Td />
                </tr>
              ))}
              {mine.map((p) => {
                const order = orders.find((o) => o.id === p.orderId);
                const proof = p.proofDocumentId
                  ? (proofTrails[p.proofDocumentId] ?? null)
                  : null;
                return (
                  <tr key={p.id}>
                    <Td className="pl-6">
                      <span className="text-zinc-500">#{order?.number}</span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(p.createdAt, t)}
                    </Td>
                    <Td className="whitespace-nowrap font-medium">
                      <span className="text-emerald-700">
                        − {formatMoney(p.amount, p.currency, t)}
                      </span>
                    </Td>
                    <Td>{p.fxRate ?? "—"}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge
                        tone={p.status === "received" ? "success" : "warning"}
                      >
                        {t(`paymentStatus.${p.status}`)}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {p.proofDocumentId ? (
                        <>
                          <a
                            href={`/api/files/${p.proofDocumentId}`}
                            className={`${linkClass} text-xs`}
                            target="_blank"
                          >
                            {t("requests.payment.proof")}
                          </a>
                          {proof?.viewedAt ? (
                            <span className="block text-[11px] text-zinc-500">
                              {t("orders.account.viewedAt")}{" "}
                              {formatDateTime(proof.viewedAt, t.intl)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <Trail
                        t={t}
                        summary={paymentTrails[p.id]}
                        showNames={wellmix}
                      />
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        {p.status === "confirmed" ? (
                          <form action={acknowledgePaymentAction}>
                            <input
                              type="hidden"
                              name="paymentId"
                              value={p.id}
                            />
                            <input
                              type="hidden"
                              name="back"
                              value="/app/account"
                            />
                            <SubmitButton variant="secondary">
                              {t("account.confirm")}
                            </SubmitButton>
                          </form>
                        ) : null}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>

      {orders.length > 0 ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card title={t("orders.account.summary")}>
            <Table>
              <thead>
                <tr>
                  <Th>{t("account.order")}</Th>
                  <Th className="text-right">
                    {t("orders.account.contracted")}
                  </Th>
                  <Th className="text-right">{t("orders.account.paid")}</Th>
                  <Th className="text-right">
                    {t("orders.account.pendingConfirm")}
                  </Th>
                  <Th className="text-right">{t("account.balance")}</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const rows = mine.filter((p) => p.orderId === o.id);
                  const paid = rows
                    .filter((p) => p.status === "received")
                    .reduce((s, p) => s + p.amount, 0);
                  const pending = rows
                    .filter((p) => p.status === "confirmed")
                    .reduce((s, p) => s + p.amount, 0);
                  const balance = (o.fobTotal ?? 0) - paid - pending;
                  return (
                    <tr key={o.id}>
                      <Td>
                        <TextLink href={`/app/orders/${o.id}`}>
                          #{o.number}
                        </TextLink>
                      </Td>
                      <Td className="text-right whitespace-nowrap tabular-nums">
                        {formatMoney(o.fobTotal, o.fobCurrency, t)}
                      </Td>
                      <Td className="text-right whitespace-nowrap tabular-nums text-emerald-700">
                        {formatMoney(paid, o.fobCurrency, t)}
                      </Td>
                      <Td className="text-right whitespace-nowrap tabular-nums text-amber-700">
                        {formatMoney(pending, o.fobCurrency, t)}
                      </Td>
                      <Td
                        className={cx(
                          "text-right whitespace-nowrap font-semibold tabular-nums",
                          balance > 0 ? "text-zinc-900" : "text-emerald-700",
                        )}
                      >
                        {formatMoney(balance, o.fobCurrency, t)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          <Card title={t("orders.account.history")}>
            <p className="mb-3 text-xs leading-relaxed text-zinc-500">
              {t("orders.account.historyHint")}
            </p>
            {history.length === 0 ? (
              <Empty>{t("orders.account.historyEmpty")}</Empty>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {history.map((h) => {
                  const payment = mine.find((p) => p.id === h.entityId);
                  const order = orders.find((o) => o.id === payment?.orderId);
                  return (
                    <li
                      key={h.id}
                      className="flex flex-col gap-1 py-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <span className="mr-2">
                          <Badge
                            tone={
                              h.action === "payment.received"
                                ? "success"
                                : "neutral"
                            }
                          >
                            {actionLabel(h.action)}
                          </Badge>
                        </span>
                        <span className="text-zinc-800">{h.summary}</span>
                      </div>
                      <span className="shrink-0 text-xs text-zinc-500">
                        {order ? `#${order.number} · ` : ""}
                        {userName(h.userId)} ·{" "}
                        {formatDateTime(h.createdAt, t.intl)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {user.role === "supplier" ? (
        <div className="mt-6">
          <Card title={t("catalog.cert.party.title")}>
            <CertificationsSection
              entity="party"
              entityId={supplierId}
              certs={certifications}
              users={users}
              user={user}
              t={t}
              back="account"
            />
          </Card>
        </div>
      ) : null}
    </>
  );
}

function formatDateTime(value: string | null | undefined, intl = "pt-BR") {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(intl, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Visualizado / confirmado, um por linha (nomes só para a Wellmix). */
function Trail({
  t,
  summary,
  showNames,
}: {
  t: Translate;
  summary: AckSummary | undefined;
  showNames: boolean;
}) {
  if (!summary) return <span className="text-zinc-400">—</span>;
  const who = (name: string | null) =>
    showNames && name ? `${t("orders.ack.by")} ${name} ` : "";
  return (
    <span className="block text-[11px] leading-relaxed">
      <span
        className={cx(
          "block whitespace-nowrap",
          summary.viewedAt ? "text-zinc-700" : "text-zinc-400",
        )}
      >
        {t("orders.ack.viewed")}:{" "}
        {summary.viewedAt
          ? `${who(summary.viewedBy)}${formatDateTime(summary.viewedAt, t.intl)}`
          : t("orders.ack.pending")}
      </span>
      <span
        className={cx(
          "block whitespace-nowrap",
          summary.confirmedAt ? "text-emerald-700" : "text-zinc-400",
        )}
      >
        {t("orders.ack.confirmed")}:{" "}
        {summary.confirmedAt
          ? `${who(summary.confirmedBy)}${formatDateTime(summary.confirmedAt, t.intl)}`
          : t("orders.ack.pending")}
      </span>
    </span>
  );
}
