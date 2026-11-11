import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { loadSupplierScores } from "@/lib/services/supplier-score-load";
import { getStore } from "@/lib/db";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  customerDetail,
  type AccountSide,
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
import { AccountBar, IconLink, TabLink } from "@/components/customer-account";
import { describeTerms } from "@/components/supplier-terms-text";
import { parseTerms } from "@/lib/supplier-terms";
import { accountBase, accountLabels } from "./labels";
import { STOCK_OPTION } from "@/lib/services/stock-party";
import { ChatOpenButton } from "@/components/chat-open-button";
import { createUserAction } from "../actions";
import { Alert, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { catalogError } from "../products/_components/shared";
import { LOCALE_NAMES } from "@/i18n";
import { LOCALES } from "@/lib/db/schema";
import {
  PORTAL_MIN_PASSWORD,
  suggestPassword,
} from "@/lib/services/portal-access";
import { canSeeMoney } from "@/lib/auth/function-access";

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

export async function PartyAccountDetail({
  side,
  params,
  searchParams,
}: {
  side: AccountSide;
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const { id } = await params;
  const sp = await searchParams;
  const detail = await customerDetail(id, side);
  if (!detail) notFound();
  const t = await getT();
  const L = accountLabels(t, side);
  const supplier = side === "supplier";
  // Pagamento ao fornecedor fica numa parte própria do pedido.
  const payAnchor = supplier ? "#supplier-payment" : "#payments";
  const money = canSeeMoney(user);
  const tab: Tab = TABS.includes(param(sp.tab) as Tab)
    ? (param(sp.tab) as Tab)
    : "sales";
  const onlyDelivered = param(sp.show) === "delivered";
  const { account, orders, payments } = detail;
  const party = account.party;
  const terms = supplier ? parseTerms(party.paymentTerms ?? null) : null;
  // Nota do fornecedor: só a Wellmix vê.
  const scoreRow =
    supplier && isWellmix(user)
      ? ((await loadSupplierScores()).find((r) => r.supplier.id === party.id) ??
        null)
      : null;
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
    return `${accountBase(side)}/${party.id}${s ? `?${s}` : ""}`;
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
            {scoreRow?.score.grade ? (
              <TextLink href="/app/suppliers/scorecard" data-supplier-score>
                {t("score.inSupplier", {
                  grade: scoreRow.score.grade,
                  score: (scoreRow.score.score ?? 0).toLocaleString(t.intl),
                })}
              </TextLink>
            ) : null}
            {!party.active ? (
              <Badge tone="neutral">{L("inactive")}</Badge>
            ) : null}
          </span>
        }
        actions={
          <LinkButton href={`/app/parties/${party.id}`}>
            {L("detail.edit")}
          </LinkButton>
        }
      />

      {money ? (
        <Card title={L("detail.account")} className="mb-4">
          <AccountBar totals={account.totals} t={t} label={L} />
        </Card>
      ) : (
        <p className="mb-3 text-xs text-zinc-500">{L("money.hidden")}</p>
      )}

      <nav
        className="mb-3 flex border-b border-zinc-200"
        aria-label={L("title")}
      >
        {TABS.map((k) => (
          <TabLink
            key={k}
            href={href({ tab: k === "sales" ? null : k, show: null })}
            active={tab === k}
          >
            {L(`tab.${k}`)}
          </TabLink>
        ))}
      </nav>

      {tab === "sales" ? (
        <section data-customer-tab="sales">
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            {money && toReceive ? (
              <LinkButton
                href={`/app/orders/${toReceive.orderId}${payAnchor}`}
                title={L("sales.receiveHint")}
              >
                {L("sales.receive")}
              </LinkButton>
            ) : null}
            <LinkButton
              href={href({ show: onlyDelivered ? null : "delivered" })}
              aria-pressed={onlyDelivered}
            >
              {onlyDelivered ? L("sales.all") : L("sales.deliveries")}
            </LinkButton>
            {/* Cliente: solicitação para ele. Fornecedor: compra para estoque
                (o fornecedor entra na RFQ, como em toda compra). */}
            <LinkButton
              href={
                supplier
                  ? `/app/requests/new?customerId=${STOCK_OPTION}`
                  : `/app/requests/new?customerId=${encodeURIComponent(party.id)}`
              }
              title={supplier ? L("sales.newRequestHint") : undefined}
              variant="primary"
            >
              + {L("sales.newRequest")}
            </LinkButton>
          </div>
          {shown.length === 0 ? (
            <Empty>{L("sales.empty")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{L("col.order")}</Th>
                  <Th>{L("col.date")}</Th>
                  <Th>{L("col.product")}</Th>
                  {money ? (
                    <>
                      <Th className="text-right">{L("col.contract")}</Th>
                      <Th className="text-right">{L("col.delivered")}</Th>
                      <Th className="text-right">{L("col.receivable")}</Th>
                      <Th className="text-right">{L("col.received")}</Th>
                      <Th>{L("col.receipt")}</Th>
                    </>
                  ) : null}
                  <Th>{L("col.delivery")}</Th>
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
                      {/* Abre o pedido em lista (venda ao cliente ou compra do fornecedor). */}
                      <TextLink
                        href={`${accountBase(side)}/${party.id}/orders/${r.orderId}`}
                        data-customer-order-link
                      >
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
                            {L(`receipt.${r.receipt}`)}
                          </Badge>
                        </Td>
                      </>
                    ) : null}
                    <Td className="whitespace-nowrap">
                      <Badge tone={DELIVERY_TONE[r.delivery]}>
                        {L(`delivery.${r.delivery}`)}
                      </Badge>
                      {r.delivery === "in_progress" ? (
                        <span className="block text-xs text-zinc-500">
                          {t(`stage.${r.status}` as DictionaryKey)}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {/* Pedido completo (etapas, aprovações, registros). */}
                      <IconLink
                        href={`/app/orders/${r.orderId}`}
                        icon="eye"
                        label={t("sale.openFull")}
                      />
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
            <Empty>{L("money.hidden")}</Empty>
          ) : payments.length === 0 ? (
            <Empty>{L("funds.empty")}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{L("col.date")}</Th>
                  <Th>{L("col.reference")}</Th>
                  <Th className="text-right">{L("col.amount")}</Th>
                  <Th>{L("col.method")}</Th>
                  <Th>{L("col.status")}</Th>
                  <Th>{L("col.proof")}</Th>
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
                        <TextLink href={`/app/orders/${p.orderId}${payAnchor}`}>
                          #{p.orderNumber ?? "?"}
                        </TextLink>
                      ) : p.requestId ? (
                        <TextLink href={`/app/requests/${p.requestId}`}>
                          {L("funds.request", {
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
                          {L("funds.proof")}
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
          <Card title={L("tab.info")}>
            <DescriptionList
              items={[
                [L("info.name"), party.name],
                [L("info.taxId"), party.taxId],
                [L("info.contact"), party.contactName],
                [L("info.email"), party.email],
                [L("info.phone"), party.phone],
                [L("info.city"), party.city],
                [L("info.country"), party.country],
                [L("info.address"), party.address],
                ...(supplier
                  ? ([
                      [L("info.storeNumber"), party.storeNumber ?? null],
                      [L("info.terms"), terms ? describeTerms(t, terms) : null],
                      [
                        L("info.bank"),
                        party.bankName || party.bankAccount ? (
                          <span className="whitespace-pre-line">
                            {[
                              party.bankBeneficiary,
                              party.bankName,
                              party.bankAccount,
                              party.bankSwift
                                ? `SWIFT ${party.bankSwift}`
                                : null,
                              party.bankAddress,
                            ]
                              .filter(Boolean)
                              .join("\n")}
                          </span>
                        ) : null,
                      ],
                    ] as Array<[string, ReactNode]>)
                  : ([[L("info.owner"), owner?.name ?? null]] as Array<
                      [string, ReactNode]
                    >)),
                ...(supplier
                  ? []
                  : ([
                      [
                        L("info.operation"),
                        party.operationMode
                          ? t(
                              `operations.mode.badge.${party.operationMode}` as DictionaryKey,
                            )
                          : null,
                      ],
                    ] as Array<[string, ReactNode]>)),
                [L("info.since"), formatDate(party.createdAt, t)],
                [
                  L("info.notes"),
                  party.notes ? (
                    <span className="whitespace-pre-line">{party.notes}</span>
                  ) : null,
                ],
              ]}
            />
          </Card>
          <Card
            title={
              <span id="access" className="scroll-mt-24">
                {L("info.users")}
              </span>
            }
          >
            {param(sp.saved) === "user" ? (
              <div className="mb-3" data-login-created>
                <Alert tone="success">
                  {t("portalAccess.saved.login", {
                    name: party.name,
                    login: param(sp.login) ?? "",
                  })}
                </Alert>
              </div>
            ) : null}
            {param(sp.error) ? (
              <div className="mb-3">
                <Alert tone="danger">{catalogError(t, param(sp.error))}</Alert>
              </div>
            ) : null}
            {users.length === 0 ? (
              <Empty>{L("info.noUsers")}</Empty>
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
                      {u.active ? L("yes") : L("no")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {/* Criar o acesso deste cadastro ao portal: e-mail (ou nome de
                usuário) e senha. Só a Wellmix; o login nasce preso a este
                fornecedor/cliente e só vê o que é dele. */}
            {isWellmix(user) ? (
              <form
                action={createUserAction}
                className="mt-4 space-y-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3"
                data-account-login-form
              >
                <input type="hidden" name="partyId" value={party.id} />
                <input
                  type="hidden"
                  name="from"
                  value={`${accountBase(side)}/${party.id}`}
                />
                <input
                  type="hidden"
                  name="role"
                  value={supplier ? "supplier" : "customer"}
                />
                <p className="text-sm font-semibold text-zinc-900">
                  {t("portalAccess.create")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("common.name")}>
                    <Input
                      name="name"
                      defaultValue={
                        users.length ? "" : (party.contactName ?? party.name)
                      }
                      required
                    />
                  </Field>
                  <Field
                    label={t("portalAccess.login.field")}
                    hint={t("portalAccess.login.hint")}
                  >
                    <Input
                      name="login"
                      defaultValue={users.length ? "" : (party.email ?? "")}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="off"
                      maxLength={254}
                      required
                    />
                  </Field>
                  <Field
                    label={t("login.password")}
                    hint={t("portalAccess.password.hint", {
                      n: PORTAL_MIN_PASSWORD,
                    })}
                  >
                    <Input
                      name="password"
                      type="text"
                      minLength={PORTAL_MIN_PASSWORD}
                      maxLength={128}
                      defaultValue={suggestPassword()}
                      autoComplete="off"
                      required
                    />
                  </Field>
                  <Field label={t("common.language")}>
                    <Select
                      name="locale"
                      defaultValue={
                        /^(cn|china|中国)$/i.test((party.country ?? "").trim())
                          ? "zh"
                          : "pt"
                      }
                    >
                      {LOCALES.map((l) => (
                        <option key={l} value={l}>
                          {LOCALE_NAMES[l]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <p className="text-xs text-zinc-500">
                  {t("portalAccess.copy.hint")}
                </p>
                <SubmitButton>{t("portalAccess.create")}</SubmitButton>
              </form>
            ) : null}
          </Card>
        </section>
      ) : null}
    </>
  );
}
