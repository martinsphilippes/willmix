import type { ReactNode } from "react";
import Link from "next/link";
import type { Translate } from "@/i18n";
import { SHEET_CURRENCIES, SHEET_INCOTERMS } from "@/lib/db/schema";
import type { SuperplanInput } from "@/lib/superplan";
import type { QuoteHistoryEntry } from "@/lib/quote-negotiation";
import {
  Badge,
  Card,
  Field,
  OpenLink,
  Table,
  Td,
  Textarea,
  Th,
  cx,
  rowClass,
} from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { QuickDialog } from "@/components/quick-dialog";
import { boardCounterStateAction } from "../../actions/quotation";
import { ProposalFields } from "./proposal-fields";
import { ChatBubbleIcon, SwapIcon } from "./icons";
import { dateTime } from "./negotiation";

/*
 * Quadro comparativo de um produto da cotação (dono, 22/11/2026;
 * docs/QUOTATION.md): uma linha por fornecedor, com a proposta de hoje, o
 * ícone da conversa do par fornecedor × produto e o do histórico de
 * propostas e contrapropostas (cada um num modal), e a caixa que marca quem
 * recebe a contraproposta em massa. A contraproposta fica num bloco à
 * direita (`BoardCounterForm`); as caixas da tabela pertencem ao formulário
 * dele pelo atributo `form`.
 */

export const BOARD_COUNTER_FORM = "board-counter-form";

export interface BoardRow {
  /** Chave estável: "request:<id>" ou "response:<id>". */
  key: string;
  /** Destino da contraproposta; nulo: não pode receber agora. */
  target: string | null;
  /** Marcada de saída (a cotação aberta na tela). */
  checked?: boolean;
  supplierName: string;
  /** A cotação aberta nesta tela. */
  current?: boolean;
  winner?: boolean;
  state: ReactNode;
  price: number | null;
  currency: string | null;
  incoterm: string | null;
  moq: number | null;
  leadTimeDays: number | null;
  /** Porto, observação e o que mais o fornecedor disse. */
  conditions: string | null;
  /** Contraproposta enviada, esperando o fornecedor. */
  pending?: boolean;
  /** Tela da cotação deste fornecedor (outra solicitação ligada). */
  href?: string | null;
  /** Conteúdo do modal da conversa; nulo: sem conversa com ele. */
  chat: ReactNode | null;
  messages: number;
  /** Conteúdo do modal do histórico. */
  history: ReactNode | null;
  /** O modal da conversa abre sozinho (acabou de enviar a mensagem). */
  chatOpen?: boolean;
}

export interface BoardReference {
  label: string;
  price: number | null;
  currency: string | null;
  incoterm: string | null;
  moq: number | null;
  leadTimeDays: number | null;
  note: string | null;
}

const iconButton =
  "h-8 w-8 border-0 bg-transparent p-0 text-zinc-500 hover:bg-brand-50 hover:text-brand-700";

export function QuotationBoard({
  rows,
  reference,
  showPrice,
  t,
}: {
  rows: BoardRow[];
  /** Última compra do produto, como referência (só com o preço à vista). */
  reference?: BoardReference | null;
  showPrice: boolean;
  t: Translate;
}) {
  const num = (n: number | null, digits = 4) =>
    n === null
      ? "—"
      : n.toLocaleString(t.intl, { maximumFractionDigits: digits });
  const selectable = rows.some((r) => r.target);
  return (
    <Card title={t("quote.compare")} dense>
      <div data-quotation-board>
        {selectable ? (
          <p className="mb-2 text-xs text-zinc-500">
            {t("quotation.board.hint")}
          </p>
        ) : null}
        <Table tools={false}>
          <thead>
            <tr>
              {selectable ? (
                <Th className="w-8">
                  <span className="sr-only">
                    {t("quotation.board.col.select")}
                  </span>
                </Th>
              ) : null}
              <Th>{t("quote.supplier")}</Th>
              <Th>{t("quote.state")}</Th>
              {showPrice ? <Th>{t("negotiationScreen.f.price")}</Th> : null}
              <Th>{t("negotiationScreen.f.incoterm")}</Th>
              <Th>{t("negotiationScreen.f.moq")}</Th>
              <Th>{t("negotiationScreen.f.leadTime")}</Th>
              <Th>{t("quote.conditions")}</Th>
              <Th>
                <span className="sr-only">
                  {t("quotation.board.col.actions")}
                </span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {reference && showPrice ? (
              <tr className={rowClass} data-quotation-reference>
                {selectable ? <Td /> : null}
                <Td className="font-medium text-zinc-600">{reference.label}</Td>
                <Td>—</Td>
                <Td className="tabular-nums text-zinc-600">
                  {reference.price !== null
                    ? `${reference.currency ?? ""} ${num(reference.price)}`.trim()
                    : "—"}
                </Td>
                <Td className="text-zinc-600">{reference.incoterm ?? "—"}</Td>
                <Td className="tabular-nums text-zinc-600">
                  {num(reference.moq, 0)}
                </Td>
                <Td className="tabular-nums text-zinc-600">
                  {num(reference.leadTimeDays, 0)}
                </Td>
                <Td className="text-xs text-zinc-600">
                  {reference.note ?? "—"}
                </Td>
                <Td />
              </tr>
            ) : null}
            {rows.map((r) => (
              <tr
                key={r.key}
                className={cx(rowClass, r.current && "bg-brand-50/40")}
                data-quotation-row={r.key}
              >
                {selectable ? (
                  <Td>
                    {r.target ? (
                      <input
                        type="checkbox"
                        name="targets"
                        value={r.target}
                        form={BOARD_COUNTER_FORM}
                        defaultChecked={r.checked}
                        aria-label={t("quotation.board.select", {
                          name: r.supplierName,
                        })}
                        className="h-4 w-4 rounded border-zinc-300 text-brand-600"
                        data-quotation-select={r.target}
                      />
                    ) : null}
                  </Td>
                ) : null}
                <Td className="font-medium">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {r.supplierName}
                    {r.winner ? (
                      <Badge tone="success">{t("quote.winner")}</Badge>
                    ) : null}
                    {r.current ? (
                      <Badge tone="neutral">
                        {t("quotation.board.current")}
                      </Badge>
                    ) : null}
                  </span>
                </Td>
                <Td>
                  <span className="flex flex-wrap items-center gap-1">
                    {r.state}
                    {r.pending ? (
                      <span data-quotation-pending>
                        <Badge tone="warning">
                          {t("quotation.board.pending")}
                        </Badge>
                      </span>
                    ) : null}
                  </span>
                </Td>
                {showPrice ? (
                  <Td className="tabular-nums" data-quotation-price>
                    {r.price !== null
                      ? `${r.currency ?? ""} ${num(r.price)}`.trim()
                      : "—"}
                  </Td>
                ) : null}
                <Td>{r.incoterm ?? "—"}</Td>
                <Td className="tabular-nums">{num(r.moq, 0)}</Td>
                <Td className="tabular-nums">{num(r.leadTimeDays, 0)}</Td>
                <Td className="max-w-56 whitespace-normal text-xs text-zinc-600">
                  {r.conditions ?? "—"}
                </Td>
                <Td>
                  <span className="flex items-center justify-end gap-0.5">
                    {r.chat ? (
                      <QuickDialog
                        size="lg"
                        label={
                          <span className="relative inline-flex">
                            <ChatBubbleIcon className="h-4 w-4" />
                            {r.messages ? (
                              <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-brand-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                                {r.messages}
                              </span>
                            ) : null}
                          </span>
                        }
                        hint={t("quotation.board.chat", {
                          name: r.supplierName,
                        })}
                        title={t("quotation.board.chatTitle", {
                          name: r.supplierName,
                        })}
                        closeLabel={t("quotation.close")}
                        className={iconButton}
                        openOnHash={r.chatOpen ? "conversa" : undefined}
                        data-quotation-chat={r.key}
                      >
                        <div className="p-3">{r.chat}</div>
                      </QuickDialog>
                    ) : null}
                    {r.history ? (
                      <QuickDialog
                        size="lg"
                        label={<SwapIcon className="h-4 w-4" />}
                        hint={t("quotation.board.history", {
                          name: r.supplierName,
                        })}
                        title={t("quotation.board.historyTitle", {
                          name: r.supplierName,
                        })}
                        closeLabel={t("quotation.close")}
                        className={iconButton}
                        data-quotation-history={r.key}
                      >
                        <div className="max-h-[70vh] overflow-y-auto p-3">
                          {r.history}
                        </div>
                      </QuickDialog>
                    ) : null}
                    {r.href ? (
                      <OpenLink
                        href={r.href}
                        label={t("quotation.board.open", {
                          name: r.supplierName,
                        })}
                      />
                    ) : null}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {showPrice ? null : (
          <p className="mt-2 text-xs text-zinc-500">
            {t("quote.priceRestricted")}
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * "Devolver com contraproposta", à direita: os mesmos campos de sempre e o
 * comentário obrigatório. Vai para os fornecedores marcados no quadro, ou
 * para todos os que podem receber ("Enviar a todos").
 */
export function BoardCounterForm({
  kind,
  boardId,
  productId = null,
  targets,
  values,
  simulation = null,
  showPrice,
  errors,
  fallbackError,
  formKey,
  t,
}: {
  /** A tela: uma solicitação ao fornecedor ou uma cotação de compra. */
  kind: "request" | "quote";
  boardId: string;
  productId?: string | null;
  /** Todos os que podem receber agora (para o "Enviar a todos"). */
  targets: string[];
  values: {
    price: number | null;
    currency: string;
    moq: number | null;
    leadTimeDays: number | null;
    incoterm: string;
  };
  simulation?: { base: SuperplanInput; bookingMinimum: number | null } | null;
  showPrice: boolean;
  errors: Record<string, string>;
  fallbackError: string;
  /** Muda a cada contraproposta gravada: o formulário renasce vazio. */
  formKey: string;
  t: Translate;
}) {
  return (
    <Card title={t("quotation.counter.title")} dense>
      {targets.length ? (
        <ActionForm
          id={BOARD_COUNTER_FORM}
          action={boardCounterStateAction}
          errors={errors}
          fallbackError={fallbackError}
          pendingLabel={t("supplierRequests.negotiation.sending")}
          key={formKey}
          className="space-y-2"
          data-negotiation-propose-form
        >
          <p className="text-xs text-zinc-500">{t("quotation.counter.hint")}</p>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="board" value={boardId} />
          {productId ? (
            <input type="hidden" name="product" value={productId} />
          ) : null}
          {targets.map((target) => (
            <input
              key={target}
              type="hidden"
              name="allTargets"
              value={target}
            />
          ))}
          <ProposalFields
            showPrice={showPrice}
            values={{
              ...values,
              price: showPrice ? values.price : null,
              currency: showPrice ? values.currency : "",
            }}
            currencies={SHEET_CURRENCIES}
            incoterms={SHEET_INCOTERMS}
            base={showPrice ? (simulation?.base ?? null) : null}
            bookingMinimum={
              showPrice ? (simulation?.bookingMinimum ?? null) : null
            }
            intl={t.intl}
            labels={{
              price: t("negotiationScreen.f.price"),
              currency: t("negotiationScreen.f.currency"),
              moq: t("negotiationScreen.f.moq"),
              leadTime: t("negotiationScreen.f.leadTime"),
              incoterm: t("negotiationScreen.f.incoterm"),
              simTitle: t("supplierRequests.negotiation.sim.title"),
              simCost: t("supplierRequests.negotiation.sim.cost"),
              simMinimum: t("supplierRequests.negotiation.sim.minimum"),
              simBooking: t("supplierRequests.negotiation.sim.booking"),
              simTarget: t("supplierRequests.negotiation.sim.target"),
              simTargetHint: t("supplierRequests.negotiation.sim.targetHint"),
              simNeeded: t("supplierRequests.negotiation.sim.needed"),
              simUse: t("supplierRequests.negotiation.sim.use"),
              simUnreachable: t("supplierRequests.negotiation.sim.unreachable"),
              simCurrency: t("supplierRequests.negotiation.sim.currency"),
              simMissing: t("supplierRequests.negotiation.sim.missing"),
              simHint: t("supplierRequests.negotiation.sim.hint"),
            }}
          />
          <Field label={t("supplierRequests.negotiation.comment")}>
            <Textarea
              name="text"
              rows={2}
              maxLength={4000}
              required
              className="max-h-48 min-h-9 resize-y"
              data-negotiation-text
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton
              className="min-h-9"
              name="scope"
              value="marked"
              pendingText={t("supplierRequests.negotiation.sending")}
              data-negotiation-propose-submit
            >
              {t("quotation.counter.sendMarked")}
            </SubmitButton>
            {targets.length > 1 ? (
              <SubmitButton
                className="min-h-9"
                name="scope"
                value="all"
                variant="secondary"
                pendingText={t("supplierRequests.negotiation.sending")}
                data-quotation-counter-all
              >
                {t("quotation.counter.sendAll", { n: targets.length })}
              </SubmitButton>
            ) : null}
          </div>
        </ActionForm>
      ) : (
        <p className="text-xs text-zinc-500" data-quotation-counter-none>
          {t("quotation.counter.none")}
        </p>
      )}
    </Card>
  );
}

/** Histórico de propostas e contrapropostas do par na cotação de compra. */
export function QuoteHistoryList({
  entries,
  showPrice,
  t,
}: {
  entries: QuoteHistoryEntry[];
  showPrice: boolean;
  t: Translate;
}) {
  const num = (n: number | null, digits = 4) =>
    n === null
      ? null
      : n.toLocaleString(t.intl, { maximumFractionDigits: digits });
  if (!entries.length)
    return (
      <p className="py-4 text-center text-xs text-zinc-500">
        {t("quotation.history.empty")}
      </p>
    );
  return (
    <ol
      className="relative ml-2 border-l-2 border-zinc-200"
      data-quotation-history-list
    >
      {entries.map((e) => {
        const chips = [
          showPrice && num(e.price) !== null
            ? `${num(e.price)} ${e.currency ?? ""}`.trim()
            : null,
          e.incoterm,
          num(e.moq, 0) !== null ? `MOQ ${num(e.moq, 0)}` : null,
          num(e.leadTimeDays, 0) !== null
            ? t("supplierRequests.timeline.days", {
                n: num(e.leadTimeDays, 0)!,
              })
            : null,
          e.port,
        ].filter((v): v is string => !!v);
        return (
          <li
            key={e.id}
            className="relative pb-5 pl-6 last:pb-0"
            data-quotation-history-entry={e.kind}
          >
            <span
              aria-hidden
              className={cx(
                "absolute -left-[7px] top-1 h-3 w-3 rounded-full ring-4 ring-white",
                e.kind === "proposal"
                  ? "bg-violet-500"
                  : e.kind === "decline"
                    ? "bg-red-500"
                    : "bg-sky-500",
              )}
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <time
                dateTime={e.at}
                className="text-xs font-medium tabular-nums text-zinc-500"
              >
                {dateTime(e.at, t)}
              </time>
              <span
                className={cx(
                  "rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                  e.side === "wellmix"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-amber-100 text-amber-900",
                )}
              >
                {t(`supplierRequests.negotiation.side.${e.side}`)}
              </span>
            </div>
            <p className="mt-0.5 text-sm font-semibold text-zinc-900">
              {t(`quotation.history.${e.kind}`)}
            </p>
            {chips.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs tabular-nums text-zinc-700"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
            {e.text ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
                {e.text}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Link de volta para o nível da cotação (todos os produtos). */
export function BoardBackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-brand-700 hover:underline"
    >
      {children}
    </Link>
  );
}
