import { LiveSearch } from "@/components/live-search";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireScreen } from "@/lib/auth/guard";
import { isWellmix } from "@/lib/auth/permissions";
import { canOpen } from "@/lib/auth/screens";
import { getT } from "@/i18n/server";
import type { DictionaryKey } from "@/i18n/dictionaries";
import {
  customerAccounts,
  type AccountSide,
} from "@/lib/services/customer-accounts";
import {
  Alert,
  Badge,
  Button,
  Empty,
  Input,
  LinkButton,
  PageHeader,
  Table,
  Td,
  TextLink,
  Th,
  cx,
  rowClass,
} from "@/components/ui";
import {
  AccountCards,
  IconLink,
  MoneyLines,
  mainCurrency,
} from "@/components/customer-account";
import { SelectAllCheckbox } from "@/components/select-all-checkbox";
import { ChatIcon } from "@/components/chat-open-button";
import { setCustomersActiveAction } from "../actions/customers";
import { accountBase, accountLabels } from "./labels";
import { startConversationAction } from "../actions/messages";

/*
 * Clientes e Fornecedores (Cadastros), a mesma tela dos dois lados (`side`): cartões com a conta de todos os listados (contrato,
 * entregue, antecipado, a receber, recebido), busca, filtro ativo/inativo,
 * operação em lote (ativar, desativar, exportar) e uma linha por cliente com
 * a conta dele e os atalhos: nova solicitação, ficha, cadastro e conversa.
 * Valores só para quem abre Finanças (o mesmo dinheiro daquela tela).
 */

const STATUSES = ["active", "inactive", "all"] as const;
type Status = (typeof STATUSES)[number];
const BATCH_FORM = "customers-batch";

const param = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

const chipClass = (selected: boolean) =>
  cx(
    "rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition",
    selected
      ? "bg-brand-600 text-white ring-brand-600"
      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-brand-50 hover:text-brand-800 hover:ring-brand-200",
  );

export async function PartyAccountList({
  side,
  searchParams,
}: {
  side: AccountSide;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  requireScreen(user, "parties");
  const t = await getT();
  const L = accountLabels(t, side);
  const base = accountBase(side);
  const sp = await searchParams;
  const q = (param(sp.q) ?? "").slice(0, 120);
  const status: Status = STATUSES.includes(param(sp.status) as Status)
    ? (param(sp.status) as Status)
    : "active";
  const money = canOpen(user, "finance");
  const { rows, totals } = await customerAccounts({ q, status }, side);
  const fallback = mainCurrency(totals);

  const query = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | null> = {
      q: q || null,
      status,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged))
      if (v && !(k === "status" && v === "active")) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const back = `${base}${query({})}`;
  const batch = param(sp.batch);
  const error = param(sp.error);

  return (
    <>
      <PageHeader
        t={t}
        title={L("title")}
        subtitle={L("subtitle")}
        actions={
          <>
            {side === "supplier" && isWellmix(user) ? (
              <LinkButton href="/app/suppliers/scorecard" data-scorecard-link>
                {t("score.link")}
              </LinkButton>
            ) : null}
            <LinkButton
              href={`/app/parties/new?type=${side}`}
              variant="primary"
            >
              + {L("new")}
            </LinkButton>
          </>
        }
      />

      {batch !== undefined ? (
        <div className="mb-3">
          <Alert tone="success">
            {L("batch.done", { n: Number(batch) || 0 })}
          </Alert>
        </div>
      ) : error ? (
        <div className="mb-3">
          <Alert tone="danger">
            {error === "invalid_input" ? L("batch.none") : t("common.error")}
          </Alert>
        </div>
      ) : null}

      {money ? (
        <AccountCards totals={totals} t={t} label={L} />
      ) : (
        <p className="mb-3 text-xs text-zinc-500">{L("money.hidden")}</p>
      )}

      {/* Busca e filtro (GET): o resultado fica no endereço. */}
      <form
        method="get"
        action={base}
        className="mb-3 flex flex-wrap items-center gap-2"
        data-customer-search
      >
        {status !== "active" ? (
          <input type="hidden" name="status" value={status} />
        ) : null}
        <Input
          name="q"
          defaultValue={q}
          placeholder={L("search")}
          aria-label={L("search")}
          className="w-full max-w-md"
        />
        <LiveSearch />
        <Button type="submit" variant="primary">
          {L("search.button")}
        </Button>
        <span className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <a
              key={s}
              href={`${base}${query({ status: s })}`}
              aria-current={status === s ? "page" : undefined}
              className={chipClass(status === s)}
            >
              {L(`status.${s}`)}
            </a>
          ))}
        </span>
      </form>

      {/* Operação em lote: as caixas da tabela pertencem a este formulário. */}
      <form
        id={BATCH_FORM}
        action={setCustomersActiveAction}
        className="mb-2 flex flex-wrap items-center justify-end gap-2"
        data-customer-batch
      >
        <input type="hidden" name="back" value={back} />
        <input type="hidden" name="type" value={side} />
        <span className="mr-auto text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {L("batch.title")}
        </span>
        <Button type="submit" name="active" value="on" variant="secondary">
          {L("batch.activate")}
        </Button>
        <Button type="submit" name="active" value="off" variant="secondary">
          {L("batch.deactivate")}
        </Button>
        <LinkButton
          href={`${base}/export${query({})}`}
          variant="secondary"
          data-customer-export
        >
          {L("batch.exportAll")}
        </LinkButton>
      </form>

      {rows.length === 0 ? (
        <Empty>{L("empty")}</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-8">
                <SelectAllCheckbox
                  formId={BATCH_FORM}
                  name="ids"
                  label={L("batch.selectAll")}
                />
              </Th>
              <Th>{L("col.name")}</Th>
              <Th>{L("col.phone")}</Th>
              <Th className="text-right">{L("col.orders")}</Th>
              {money ? (
                <>
                  <Th className="text-right">{L("card.contract")}</Th>
                  <Th className="text-right">{L("card.delivered")}</Th>
                  <Th className="text-right">{L("card.prepaid")}</Th>
                  <Th className="text-right">{L("card.receivable")}</Th>
                  <Th className="text-right">{L("card.received")}</Th>
                </>
              ) : null}
              <Th className="text-right">{L("col.actions")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({ party, orders, openOrders, openRequests, totals: a }) => (
                <tr
                  key={party.id}
                  className={cx(rowClass, !party.active && "opacity-60")}
                  data-customer-row={party.id}
                >
                  <Td>
                    <input
                      type="checkbox"
                      name="ids"
                      value={party.id}
                      form={BATCH_FORM}
                      aria-label={party.name}
                      className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
                    />
                  </Td>
                  <Td className="min-w-44">
                    <TextLink
                      href={`${base}/${party.id}`}
                      className="font-medium"
                    >
                      {party.name}
                    </TextLink>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      {party.taxId ? <span>{party.taxId}</span> : null}
                      {party.city ? <span>· {party.city}</span> : null}
                      {party.operationMode ? (
                        <Badge tone="info">
                          {t(
                            `operations.mode.badge.${party.operationMode}` as DictionaryKey,
                          )}
                        </Badge>
                      ) : null}
                      {!party.active ? (
                        <Badge tone="neutral">{L("inactive")}</Badge>
                      ) : null}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-zinc-700">
                    {party.phone ?? "—"}
                    {party.email ? (
                      <span className="block text-xs text-zinc-500">
                        {party.email}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {orders}
                    {openOrders ? (
                      <span className="block text-xs text-zinc-500">
                        {L("openOrders", { n: openOrders })}
                      </span>
                    ) : null}
                    {openRequests ? (
                      <span className="block text-xs text-zinc-500">
                        {L("openRequests", { n: openRequests })}
                      </span>
                    ) : null}
                  </Td>
                  {money ? (
                    <>
                      <Td className="text-right">
                        <MoneyLines
                          money={a.contract}
                          t={t}
                          fallback={fallback}
                        />
                      </Td>
                      <Td className="text-right">
                        <MoneyLines
                          money={a.delivered}
                          t={t}
                          fallback={fallback}
                        />
                      </Td>
                      <Td className="text-right">
                        <MoneyLines
                          money={a.prepaid}
                          t={t}
                          fallback={fallback}
                        />
                      </Td>
                      <Td
                        className={cx(
                          "text-right",
                          Object.values(a.receivable).some((v) => v > 0) &&
                            "font-semibold text-rose-700",
                        )}
                      >
                        <MoneyLines
                          money={a.receivable}
                          t={t}
                          fallback={fallback}
                        />
                      </Td>
                      <Td className="text-right text-emerald-700">
                        <MoneyLines
                          money={a.received}
                          t={t}
                          fallback={fallback}
                        />
                      </Td>
                    </>
                  ) : null}
                  <Td className="whitespace-nowrap text-right">
                    <span className="inline-flex items-center gap-0.5">
                      {side === "customer" ? (
                        <IconLink
                          href={`/app/requests/new?customerId=${encodeURIComponent(party.id)}`}
                          icon="plus"
                          label={L("action.request")}
                        />
                      ) : null}
                      <IconLink
                        href={`${base}/${party.id}`}
                        icon="eye"
                        label={L("action.view")}
                      />
                      <IconLink
                        href={`/app/parties/${party.id}`}
                        icon="pencil"
                        label={L("action.edit")}
                      />
                      {/* Conversa com a empresa: sempre no fim da linha. */}
                      <form action={startConversationAction}>
                        <input
                          type="hidden"
                          name="target"
                          value={`party:${party.id}`}
                        />
                        <button
                          type="submit"
                          aria-label={L("action.chat")}
                          title={L("action.chat")}
                          data-chat-open={`party:${party.id}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        >
                          <ChatIcon />
                        </button>
                      </form>
                    </span>
                  </Td>
                </tr>
              ),
            )}
          </tbody>
        </Table>
      )}
      <p className="mt-2 text-xs text-zinc-500" data-customer-count>
        {L("total", { n: rows.length })}
      </p>
    </>
  );
}
