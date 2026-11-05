import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { canOpen } from "@/lib/auth/screens";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  customerDetail,
  type CustomerOrderRow,
} from "@/lib/services/customer-accounts";
import {
  Badge,
  Card,
  DescriptionList,
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
  linkClass,
  rowClass,
} from "@/components/ui";
import { AccountBar, TabLink } from "@/components/customer-account";
import { ChatOpenButton } from "@/components/chat-open-button";

/*
 * Ficha do cliente: barra de contas a receber (contrato, entregue,
 * antecipado, a receber, recebido) e três abas: registros de vendas (um
 * pedido por linha, com recebimento e entrega), recebimentos (cada
 * pagamento do cliente, inclusive o sinal da solicitação) e informações do
 * cadastro. Valores só para quem abre Finanças.
 */

const TABS = ["sales", "funds", "info"] as const;
type Tab = (typeof TABS)[number];

const RECEIPT_TONE = {
  paid: "success",
  partial: "warning",
  open: "danger",
  cancelled: "neutral",
} as const;
const DELIVERY_TONE = {
  delivered: "success",
  in_progress: "info",
  cancelled: "neutral",
} as const;
const PAYMENT_TONE = {
  pending: "warning",
  confirmed: "info",
  received: "success",
} as const;

const param = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default async function CustomerPage({
  params,
  searchParams,
}: PageProps<"/app/customers/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const { id } = await params;
  const sp = await searchParams;
  const detail = await customerDetail(id);
  if (!detail) notFound();
  const t = await getT();
  const money = canOpen(user, "finance");
  const tab: Tab = TABS.includes(param(sp.tab) as Tab)
    ? (param(sp.tab) as Tab)
    : "sales";
  const onlyDelivered = param(sp.show) === "delivered";
  const { account, orders, payments } = detail;
  const party = account.party;
  const store = getStore();
  const [users, owner] = await Promise.all([
    tab === "info"
      ? store.list("users", { filter: { partyId: party.id } })
      : Promise.resolve([]),
    party.ownerUserId
      ? store.get("users", party.ownerUserId)
      : Promise.resolve(null),
  ]);
  const shown = onlyDelivered
    ? orders.filter((o) => o.delivery === "delivered")
    : orders;
  // Recebimento: o pedido mais antigo que ainda tem saldo.
  const toReceive = [...orders]
    .filter((o) => o.receivable > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | null> = {
      tab: tab === "sales" ? null : tab,
      show: onlyDelivered ? "delivered" : null,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/app/customers/${party.id}${s ? `?${s}` : ""}`;
  };
  const cell = (r: CustomerOrderRow, value: number) =>
    formatMoney(value, r.currency, t);

  return (
    <>
      <PageHeader
        t={t}
        title={party.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {party.operationMode ? (
              <Badge tone="info">
                {t(
                  `operations.mode.badge.${party.operationMode}` as DictionaryKey,
                )}
              </Badge>
            ) : null}
            {party.city ? <span>{party.city}</span> : null}
            {!party.active ? (
              <Badge tone="neutral">{t("cust.inactive")}</Badge>
            ) : null}
          </span>
        }
        actions={
          <LinkButton href={`/app/parties/${party.id}`}>
            {t("cust.detail.edit")}
          </LinkButton>
        }
      />

      {money ? (
        <Card title={t("cust.detail.account")} className="mb-4">
          <AccountBar totals={account.totals} t={t} />
        </Card>
      ) : (
        <p className="mb-3 text-xs text-zinc-500">{t("cust.money.hidden")}</p>
      )}

      <nav
        className="mb-3 flex border-b border-zinc-200"
        aria-label={t("cust.title")}
      >
        {TABS.map((k) => (
          <TabLink
            key={k}
            href={href({ tab: k === "sales" ? null : k, show: null })}
            active={tab === k}
          >
            {t(`cust.tab.${k}`)}
          </TabLink>
        ))}
      </nav>

      {tab === "sales" ? (
        <section data-customer-tab="sales">
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            {money && toReceive ? (
              <LinkButton
                href={`/app/orders/${toReceive.orderId}#payments`}
                title={t("cust.sales.receiveHint")}
              >
                {t("cust.sales.receive")}
              </LinkButton>
            ) : null}
            <LinkButton
              href={href({ show: onlyDelivered ? null : "delivered" })}
              aria-pressed={onlyDelivered}
            >
              {onlyDelivered ? t("cust.sales.all") : t("cust.sales.deliveries")}
            </LinkButton>
            <LinkButton
              href={`/app/requests/new?customerId=${encodeURIComponent(party.id)}`}
              variant="primary"
            >
              + {t("cust.sales.newRequest")}
            </LinkButton>
          </div>
          {shown.length === 0 ? (
            <Empty>{t("cust.sales.empty")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("cust.col.order")}</Th>
                  <Th>{t("cust.col.date")}</Th>
                  <Th>{t("cust.col.product")}</Th>
                  {money ? (
                    <>
                      <Th className="text-right">{t("cust.col.contract")}</Th>
                      <Th className="text-right">{t("cust.col.delivered")}</Th>
                      <Th className="text-right">{t("cust.col.receivable")}</Th>
                      <Th className="text-right">{t("cust.col.received")}</Th>
                      <Th>{t("cust.col.receipt")}</Th>
                    </>
                  ) : null}
                  <Th>{t("cust.col.delivery")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr
                    key={r.orderId}
                    className={rowClass}
                    data-customer-order={r.number}
                  >
                    <Td className="whitespace-nowrap">
                      <TextLink href={`/app/orders/${r.orderId}`}>
                        #{r.number}
                      </TextLink>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDate(r.createdAt, t)}
                    </Td>
                    <Td className="min-w-40">{r.product}</Td>
                    {money ? (
                      <>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {cell(r, r.contract)}
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {cell(r, r.delivered)}
                        </Td>
                        <Td
                          className={cx(
                            "whitespace-nowrap text-right tabular-nums",
                            r.receivable > 0 && "font-semibold text-rose-700",
                          )}
                        >
                          {cell(r, r.receivable)}
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums text-emerald-700">
                          {cell(r, r.received)}
                        </Td>
                        <Td className="whitespace-nowrap">
                          <Badge tone={RECEIPT_TONE[r.receipt]}>
                            {t(`cust.receipt.${r.receipt}`)}
                          </Badge>
                        </Td>
                      </>
                    ) : null}
                    <Td className="whitespace-nowrap">
                      <Badge tone={DELIVERY_TONE[r.delivery]}>
                        {t(`cust.delivery.${r.delivery}`)}
                      </Badge>
                      {r.delivery === "in_progress" ? (
                        <span className="block text-xs text-zinc-500">
                          {t(`stage.${r.status}` as DictionaryKey)}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <ChatOpenButton
                        target={{ orderId: r.orderId }}
                        label={t("chat.open")}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      ) : null}

      {tab === "funds" ? (
        <section data-customer-tab="funds">
          {!money ? (
            <Empty>{t("cust.money.hidden")}</Empty>
          ) : payments.length === 0 ? (
            <Empty>{t("cust.funds.empty")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("cust.col.date")}</Th>
                  <Th>{t("cust.col.reference")}</Th>
                  <Th className="text-right">{t("cust.col.amount")}</Th>
                  <Th>{t("cust.col.method")}</Th>
                  <Th>{t("cust.col.status")}</Th>
                  <Th>{t("cust.col.proof")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={rowClass} data-customer-payment>
                    <Td className="whitespace-nowrap">
                      {formatDate(p.confirmedAt ?? p.createdAt, t)}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {p.orderId ? (
                        <TextLink href={`/app/orders/${p.orderId}#payments`}>
                          #{p.orderNumber ?? "?"}
                        </TextLink>
                      ) : p.requestId ? (
                        <TextLink href={`/app/requests/${p.requestId}`}>
                          {t("cust.funds.request", {
                            n: String(p.requestNumber ?? "?"),
                          })}
                        </TextLink>
                      ) : (
                        "—"
                      )}
                      {p.note ? (
                        <span className="block text-xs text-zinc-500">
                          {p.note}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-right font-medium tabular-nums">
                      {formatMoney(p.amount, p.currency, t)}
                    </Td>
                    <Td>{p.method ?? "—"}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={PAYMENT_TONE[p.status]}>
                        {t(`paymentStatus.${p.status}`)}
                      </Badge>
                    </Td>
                    <Td>
                      {p.proofDocumentId ? (
                        <a
                          href={`/api/files/${p.proofDocumentId}`}
                          target="_blank"
                          rel="noreferrer"
                          className={linkClass}
                        >
                          {t("cust.funds.proof")}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {p.orderId ? (
                        <ChatOpenButton
                          target={{ orderId: p.orderId }}
                          label={t("chat.open")}
                        />
                      ) : p.requestId ? (
                        <ChatOpenButton
                          target={{ requestId: p.requestId }}
                          label={t("chat.open")}
                        />
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      ) : null}

      {tab === "info" ? (
        <section className="grid gap-4 lg:grid-cols-2" data-customer-tab="info">
          <Card title={t("cust.tab.info")}>
            <DescriptionList
              items={[
                [t("cust.info.name"), party.name],
                [t("cust.info.taxId"), party.taxId],
                [t("cust.info.contact"), party.contactName],
                [t("cust.info.email"), party.email],
                [t("cust.info.phone"), party.phone],
                [t("cust.info.city"), party.city],
                [t("cust.info.country"), party.country],
                [t("cust.info.address"), party.address],
                [t("cust.info.owner"), owner?.name ?? null],
                [
                  t("cust.info.operation"),
                  party.operationMode
                    ? t(
                        `operations.mode.badge.${party.operationMode}` as DictionaryKey,
                      )
                    : null,
                ],
                [t("cust.info.since"), formatDate(party.createdAt, t)],
                [
                  t("cust.info.notes"),
                  party.notes ? (
                    <span className="whitespace-pre-line">{party.notes}</span>
                  ) : null,
                ],
              ]}
            />
          </Card>
          <Card title={t("cust.info.users")}>
            {users.length === 0 ? (
              <Empty>{t("cust.info.noUsers")}</Empty>
            ) : (
              <ul className="divide-y divide-zinc-100 text-sm">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span>
                      <span className="font-medium text-zinc-900">
                        {u.name}
                      </span>
                      <span className="block text-xs text-zinc-500">
                        {u.email}
                      </span>
                    </span>
                    <Badge tone={u.active ? "success" : "neutral"}>
                      {u.active ? t("cust.yes") : t("cust.no")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      ) : null}
    </>
  );
}
