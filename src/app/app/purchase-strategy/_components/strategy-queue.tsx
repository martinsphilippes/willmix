"use client";

import {
  startTransition,
  useActionState,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Alert, Badge, Button, Textarea, cx, linkClass } from "@/components/ui";
import {
  SearchPicker,
  type SearchPickerLabels,
} from "@/components/search-picker";
import type {
  RecipientCheck,
  StrategyLineChoice,
} from "@/lib/purchase-recipients";
import {
  sendStrategyAction,
  type StrategySendState,
} from "../../actions/purchase-demand";
import type { PackingBasis, PackingTotals } from "@/lib/strategy-packing";
import { PackingCells, type PackingTexts } from "./packing-cells";
import {
  CARD_PRODUCTS,
  CompactPack,
  LastLines,
  StrategyGrid,
  cardClass,
  type CardTexts,
  type LastTexts,
} from "./strategy-card";
import { StrategyTable, StrategyTableRow } from "./strategy-view";
import { QuickDialog } from "@/components/quick-dialog";
import {
  PartnerLoginFix,
  type PartnerLoginFixTexts,
} from "@/components/partner-login-fix";

/*
 * Estratégia de Compra (dono, 18/11/2026; docs/PURCHASE_DEMAND.md,
 * "Estratégia de Compra por produto" e "Estratégia por solicitação"). Um
 * cartão por solicitação, com todos os produtos dela (a encomenda de origem,
 * o cliente, a quantidade, a especificação, a programação de entrega e a
 * última compra de cada um); uma escolha só para a solicitação inteira
 * (cotar com a última compra, cotar com outros parceiros, pedido direto ou
 * não enviar agora) e, para cotar, os destinatários do País × Família,
 * marcados, com o que falta a quem não pode receber. "Revisar o envio"
 * mostra o resumo; "Confirmar o envio" grava e leva ao resultado. As escolhas
 * ficam na tela entre um passo e outro (e se o servidor recusar).
 */

export interface StrategyLineData {
  demandId: string;
  /** "Encomenda nº 12" ou "Reposição nº 3", já no idioma. */
  origin: string;
  demandHref: string;
  batch: { label: string; href: string } | null;
  productName: string;
  productHref: string | null;
  quantity: string;
  customerName: string | null;
  specification: string | null;
  schedule: string[];
  desiredAt: string | null;
  deadline: string | null;
  family: { key: string; name: string } | null;
  last: {
    supplierId: string;
    supplierName: string;
    price: string | null;
    orderHref: string;
    orderLabel: string;
    leadTime: string | null;
    incoterm: string | null;
    moq: string | null;
  } | null;
  linkedIds: string[];
  suggestedIds: string[];
  /** Sem produto do catálogo: não dá para escolher. */
  blocked: string | null;
  /**
   * Quantidade (peças), caixas master, caixas inner e cubagem (dono,
   * 18/11/2026), com as fontes da ficha completa. Nulo: sem leitura.
   */
  packing: {
    totals: PackingTotals | null;
    basis: PackingBasis;
    piecesText: string;
    /** Avisos do servidor, já escritos (programação, unidade). */
    warnings: string[];
  } | null;
}

/** Uma solicitação da fila: a escolha e os destinatários são dela inteira. */
export interface StrategyGroupData {
  key: string;
  /** "Solicitação nº 12" ou "Reposição nº 3", já no idioma. */
  title: string;
  customerName: string | null;
  /** "China › UTILIDADES DOMESTICAS", já montado; nulo = sem país e família. */
  origin: string | null;
  demandIds: string[];
  /** A última compra comum (todos do mesmo fornecedor); nula = não vale. */
  last: StrategyLineData["last"];
  /** Por que a última compra não vale (algum sem compra, fornecedores diferentes). */
  lastReason: string | null;
  linkedIds: string[];
  suggestedIds: string[];
  /** Algum produto fora do catálogo: a solicitação espera. */
  blocked: string | null;
}

export interface StrategyTexts {
  /** Lista do País × Família ("Fornecedores de {origin}"). */
  originList: string;
  originNone: string;
  queueTitle: string;
  queueEmpty: string;
  customer: string;
  quantity: string;
  spec: string;
  schedule: string;
  desiredAt: string;
  deadline: string;
  family: string;
  noFamily: string;
  choose: string;
  lastTitle: string;
  lastPrice: string;
  lastOrder: string;
  lastLeadTime: string;
  lastIncoterm: string;
  lastMoq: string;
  noHistory: string;
  choices: Record<"skip" | StrategyLineChoice, string>;
  lastHint: string;
  directHint: string;
  linked: string;
  suggested: string;
  none: string;
  search: string;
  added: string;
  checking: string;
  allOk: string;
  clear: string;
  logins: string;
  ok: string;
  lastBadge: string;
  issues: Record<string, string>;
  warnings: Record<string, string>;
  fix: string;
  review: string;
  reviewNone: string;
  /** Abaixo do card sem escolha: o que falta para enviar esta solicitação. */
  chooseOne: string;
  summaryTitle: string;
  summaryHint: string;
  receives: string;
  blockedOut: string;
  direct: string;
  noRecipient: string;
  missingRecipient: string;
  confirm: string;
  back: string;
  fixFirst: string;
  note: string;
  working: string;
  picker: SearchPickerLabels;
  packing: PackingTexts;
  /** Cards compactos (dono, 19/11/2026): rótulos curtos e o painel Detalhes. */
  card: CardTexts & {
    waiting: string;
    emptyStrip: string;
    customer: string;
    /** A última compra em duas linhas. */
    last: LastTexts;
    details: string;
    /** "Detalhes · {title}". */
    detailsTitle: string;
    close: string;
    /** "+{n} produtos (veja Detalhes)". */
    more: string;
  };
  /** Idioma dos números (pt-BR, en-US, zh-CN). */
  intl: string;
}

type Choice = "skip" | StrategyLineChoice;

interface LineState {
  choice: Choice;
  recipients: string[];
  /** Escolhidos pela busca (além dos vinculados e sugeridos). */
  extra: string[];
}

const INITIAL: StrategySendState = {
  ok: false,
  error: null,
  message: null,
  at: null,
};

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) =>
    key in values ? String(values[key]) : all,
  );

/** Cadastro do parceiro para regularizar (o Fornecedor tem a tela dele). */
const recordHref = (check: RecipientCheck) =>
  check.type === "supplier"
    ? `/app/suppliers/${check.partyId}?tab=info`
    : `/app/parties/${check.partyId}`;

export function StrategyQueue({
  lines,
  groups,
  checks: initialChecks,
  texts,
  canChoose,
  partnerLogin = null,
  view = "cards",
  tableTexts = null,
}: {
  /** Por cards (como sempre) ou em tabela (dono, 23/11/2026). */
  view?: "cards" | "table";
  tableTexts?: {
    heads: string[];
    open: string;
    close: string;
    /** "{n} produto(s)". */
    productsN: string;
  } | null;
  lines: StrategyLineData[];
  groups: StrategyGroupData[];
  checks: Record<string, RecipientCheck>;
  texts: StrategyTexts;
  canChoose: boolean;
  /**
   * Gerar o login do parceiro aqui (dono, 20/11/2026): só o administrador
   * (nulo para os outros, que seguem pelo "Abrir o cadastro").
   */
  partnerLogin?: { texts: PartnerLoginFixTexts; minPassword: number } | null;
}) {
  const [state, formAction, pending] = useActionState(
    sendStrategyAction,
    INITIAL,
  );
  const [checks, setChecks] = useState(initialChecks);
  const [checking, setChecking] = useState<string[]>([]);
  // Formulários do login abertos (linha:parceiro): ficam na tela mesmo
  // depois de o parceiro virar Apto, com o login e a senha para copiar.
  const [loginFixOpen, setLoginFixOpen] = useState<string[]>([]);
  // A observação e o envio são de cada solicitação (dono, 22/11/2026).
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [byLine, setByLine] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      groups.map((g) => [
        g.key,
        {
          choice: "skip" as Choice,
          // Os do País × Família e aptos já vêm marcados para "cotar com
          // outros" (dono, 18/11/2026): o Comprador desmarca quem não recebe.
          recipients: g.linkedIds.filter((id) => initialChecks[id]?.ok),
          extra: [],
        },
      ]),
    ),
  );
  const set = (id: string, patch: Partial<LineState>) =>
    setByLine((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const linesOf = (group: StrategyGroupData) =>
    group.demandIds
      .map((id) => lines.find((l) => l.demandId === id))
      .filter((l): l is StrategyLineData => !!l);

  const chosen = groups.filter(
    (g) => !g.blocked && byLine[g.key]?.choice !== "skip",
  );

  /** Destinatários de uma solicitação: a última compra ou os marcados. */
  const recipientsOf = (line: StrategyGroupData, s: LineState): string[] =>
    s.choice === "quote_last"
      ? line.last
        ? [line.last.supplierId]
        : []
      : s.choice === "quote"
        ? s.recipients
        : [];

  const summary = chosen.map((line) => {
    const s = byLine[line.key];
    const ids = recipientsOf(line, s);
    const ok = ids.filter((id) => checks[id]?.ok);
    const out = ids.filter((id) => !checks[id]?.ok);
    const quotes = s.choice === "quote" || s.choice === "quote_last";
    return {
      line,
      choice: s.choice,
      ok,
      out,
      problem: quotes
        ? !ids.length
          ? texts.missingRecipient
          : !ok.length
            ? texts.noRecipient
            : null
        : null,
    };
  });
  type SummaryLine = (typeof summary)[number];

  /** Confirma o envio de uma solicitação só: a do card. */
  const confirm = (line: StrategyGroupData) => {
    const s = byLine[line.key];
    const data = new FormData();
    data.set(
      "payload",
      JSON.stringify({
        lines: [
          {
            demandIds: line.demandIds,
            choice: s.choice,
            recipientIds: s.choice === "quote" ? s.recipients : [],
          },
        ],
        note: (notes[line.key] ?? "").trim() || null,
      }),
    );
    setSendingKey(line.key);
    startTransition(() => formAction(data));
  };

  /**
   * Login criado aqui (dono, 20/11/2026): o parceiro é conferido de novo e,
   * Apto, fica marcado nos produtos em que é da família ou foi escolhido na
   * busca (o mesmo padrão de quem já vinha Apto).
   */
  const recheck = async (partyId: string) => {
    const res = await fetch(
      `/api/purchase-strategy/recipient?id=${encodeURIComponent(partyId)}`,
    );
    if (!res.ok) return;
    const { check } = (await res.json()) as { check: RecipientCheck };
    setChecks((prev) => ({ ...prev, [partyId]: check }));
    if (!check.ok) return;
    setByLine((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([key, st]) => {
          const g = groups.find((x) => x.key === key);
          const listed =
            !!g?.linkedIds.includes(partyId) || st.extra.includes(partyId);
          return [
            key,
            listed && !st.recipients.includes(partyId)
              ? { ...st, recipients: [...st.recipients, partyId] }
              : st,
          ];
        }),
      ),
    );
  };

  /** Parceiro escolhido na busca: entra marcado e é conferido no servidor. */
  const addFromSearch = async (lineId: string, partyId: string) => {
    const s = byLine[lineId];
    if (!s.extra.includes(partyId))
      set(lineId, {
        extra: [...s.extra, partyId],
        recipients: s.recipients.includes(partyId)
          ? s.recipients
          : [...s.recipients, partyId],
      });
    if (checks[partyId]) return;
    setChecking((c) => [...c, partyId]);
    try {
      const res = await fetch(
        `/api/purchase-strategy/recipient?id=${encodeURIComponent(partyId)}`,
      );
      if (res.ok) {
        const { check } = (await res.json()) as { check: RecipientCheck };
        setChecks((prev) => ({ ...prev, [partyId]: check }));
      }
    } finally {
      setChecking((c) => c.filter((x) => x !== partyId));
    }
  };

  const recipientRow = (
    line: StrategyGroupData,
    id: string,
    s: LineState,
    selectable: boolean,
  ) => {
    const check = checks[id];
    const marked = s.recipients.includes(id);
    return (
      <li
        key={id}
        className="flex flex-wrap items-start gap-x-2 gap-y-0.5 py-1"
        data-strategy-recipient={id}
        data-strategy-recipient-ok={check?.ok ? "1" : "0"}
      >
        {selectable ? (
          <input
            type="checkbox"
            checked={marked}
            onChange={(e) =>
              set(line.key, {
                recipients: e.target.checked
                  ? [...s.recipients, id]
                  : s.recipients.filter((x) => x !== id),
              })
            }
            className="mt-0.5 h-3.5 w-3.5 accent-brand-600 pointer-coarse:h-5 pointer-coarse:w-5"
            aria-label={check?.name ?? id}
            data-strategy-recipient-box={id}
          />
        ) : null}
        <span className="min-w-0 flex-1 text-xs">
          <span className="break-words font-medium text-zinc-900">
            {check?.name ?? id}
          </span>
          {check ? (
            <span className="text-xs text-zinc-500">
              {" "}
              · {check.typeLabel}
              {check.country ? ` · ${check.country}` : ""} ·{" "}
              {fill(texts.logins, { n: check.logins })}
            </span>
          ) : null}
          {line.last?.supplierId === id ? (
            <Badge tone="brand" className="ml-1">
              {texts.lastBadge}
            </Badge>
          ) : null}
          {checking.includes(id) && !check ? (
            <span className="block text-xs text-zinc-500">
              {texts.checking}
            </span>
          ) : null}
          {check ? (
            <span className="block text-xs">
              {check.ok ? (
                <span className="text-emerald-700">{texts.ok}</span>
              ) : (
                <span className="text-amber-800" data-strategy-recipient-issues>
                  {check.issues.map((i) => texts.issues[i] ?? i).join(" ")}{" "}
                  <Link href={recordHref(check)} className={linkClass}>
                    {texts.fix}
                  </Link>
                </span>
              )}
              {check.warnings.map((w) => (
                <span key={w} className="block text-zinc-500">
                  {texts.warnings[w] ?? w}
                </span>
              ))}
            </span>
          ) : null}
          {/* Gerar o login aqui (administrador; dono, 20/11/2026). */}
          {partnerLogin &&
          check &&
          (check.issues.includes("no_login") ||
            loginFixOpen.includes(`${line.key}:${id}`)) ? (
            <PartnerLoginFix
              partyId={id}
              partyName={check.name}
              minPassword={partnerLogin.minPassword}
              texts={partnerLogin.texts}
              onOpen={() =>
                setLoginFixOpen((open) =>
                  open.includes(`${line.key}:${id}`)
                    ? open
                    : [...open, `${line.key}:${id}`],
                )
              }
              onCreated={() => void recheck(id)}
            />
          ) : null}
        </span>
      </li>
    );
  };

  const details = (line: StrategyLineData): ReactNode => (
    <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-zinc-700 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="text-zinc-500">{texts.customer}</dt>
        <dd className="font-medium">{line.customerName ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">{texts.desiredAt}</dt>
        <dd>{line.desiredAt ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">{texts.deadline}</dt>
        <dd>{line.deadline ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">{texts.family}</dt>
        <dd>{line.family?.name || texts.noFamily}</dd>
      </div>
      {line.specification ? (
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="text-zinc-500">{texts.spec}</dt>
          <dd className="whitespace-pre-line">{line.specification}</dd>
        </div>
      ) : null}
      {line.schedule.length ? (
        <div className="sm:col-span-2 lg:col-span-4">
          <dt className="text-zinc-500">{texts.schedule}</dt>
          <dd>{line.schedule.join(" · ")}</dd>
        </div>
      ) : null}
    </dl>
  );

  const lastBox = (line: StrategyLineData) =>
    line.last ? (
      <div className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
        <p className="font-medium text-zinc-900">
          {texts.lastTitle}: {line.last.supplierName}
        </p>
        <p className="mt-0.5">
          <Link href={line.last.orderHref} className={linkClass}>
            {line.last.orderLabel}
          </Link>
          {line.last.price ? ` · ${texts.lastPrice}: ${line.last.price}` : ""}
          {line.last.leadTime
            ? ` · ${texts.lastLeadTime}: ${line.last.leadTime}`
            : ""}
          {line.last.incoterm
            ? ` · ${texts.lastIncoterm}: ${line.last.incoterm}`
            : ""}
          {line.last.moq ? ` · ${texts.lastMoq}: ${line.last.moq}` : ""}
        </p>
      </div>
    ) : (
      <p className="mt-2 text-xs font-medium text-amber-800">
        {texts.noHistory}
      </p>
    );

  /**
   * Última compra no card: fornecedor, preço e moeda, pedido anterior e data,
   * prazo, Incoterm e pedido mínimo (rótulos curtos, explicação ao tocar).
   */
  const compactLast = (last: StrategyLineData["last"]) =>
    last ? (
      <LastLines
        data={{
          supplierName: last.supplierName,
          price: last.price,
          orderHref: last.orderHref,
          orderLabel: last.orderLabel,
          leadTime: last.leadTime,
          incoterm: last.incoterm,
          moq: last.moq,
        }}
        texts={texts.card.last}
        data-strategy-last={last.supplierId}
      />
    ) : (
      <p
        className="text-[11px] font-medium text-amber-800"
        data-strategy-no-history
      >
        {texts.noHistory}
      </p>
    );

  const option = (
    line: StrategyGroupData,
    s: LineState,
    value: Choice,
    disabled = false,
  ) => (
    <label
      className={cx(
        "flex items-center gap-1.5 text-xs",
        disabled && "cursor-not-allowed text-zinc-400",
      )}
    >
      <input
        type="radio"
        name={`choice-${line.key}`}
        value={value}
        checked={s.choice === value}
        disabled={disabled || !canChoose}
        onChange={() => {
          set(line.key, { choice: value });
        }}
        className="h-3.5 w-3.5 accent-brand-600 pointer-coarse:h-5 pointer-coarse:w-5"
        data-strategy-choice={value}
      />
      {texts.choices[value]}
    </label>
  );

  /** Um produto da solicitação no painel Detalhes: tudo, com as contas. */
  const productBlock = (line: StrategyLineData) => (
    <div
      key={line.demandId}
      className="border-t border-zinc-100 pt-2 first:border-t-0 first:pt-0"
      data-strategy-detail-product={line.demandId}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h4 className="text-sm font-semibold text-zinc-900">
          {line.productHref ? (
            <Link
              href={line.productHref}
              className="text-zinc-900 hover:underline"
            >
              {line.productName}
            </Link>
          ) : (
            line.productName
          )}
        </h4>
        <Link href={line.demandHref} className={cx(linkClass, "text-xs")}>
          {line.origin}
        </Link>
      </div>
      {line.packing ? (
        <div className="mt-2">
          <PackingCells
            marker={`detail:${line.demandId}`}
            totals={line.packing.totals}
            basis={line.packing.basis}
            texts={texts.packing}
            intl={texts.intl}
            piecesText={line.packing.piecesText}
            extraWarnings={line.packing.warnings}
          />
        </div>
      ) : null}
      {details(line)}
      {line.blocked ? (
        <p className="mt-2 text-xs font-medium text-amber-800">
          {line.blocked}
        </p>
      ) : (
        lastBox(line)
      )}
    </div>
  );

  /** Um produto no card: nome, encomenda de origem e os totais da embalagem. */
  const productCompact = (line: StrategyLineData) => (
    <div
      key={line.demandId}
      className="space-y-1"
      data-strategy-product={line.demandId}
    >
      <p className="flex min-w-0 items-baseline gap-1.5">
        <span
          className="min-w-0 flex-1 truncate font-semibold text-zinc-900"
          title={line.productName}
        >
          {line.productHref ? (
            <Link
              href={line.productHref}
              className="text-zinc-900 hover:underline"
            >
              {line.productName}
            </Link>
          ) : (
            line.productName
          )}
        </span>
        <Link
          href={line.demandHref}
          className={cx(linkClass, "shrink-0 text-[11px]")}
        >
          {line.origin}
        </Link>
      </p>
      {line.packing ? (
        <CompactPack
          marker={line.demandId}
          totals={line.packing.totals}
          basis={line.packing.basis}
          piecesText={line.packing.piecesText}
          texts={texts.card}
          packTexts={texts.packing}
          intl={texts.intl}
        />
      ) : (
        <p className="text-[11px] text-zinc-600">
          {texts.quantity}: {line.quantity}
        </p>
      )}
      {line.packing?.warnings.length ? (
        <p
          className="truncate text-[11px] text-amber-800"
          title={line.packing.warnings.join(" ")}
        >
          {line.packing.warnings[0]}
        </p>
      ) : null}
      {line.schedule.length ? (
        <p
          className="truncate text-[11px] text-zinc-600"
          title={line.schedule.join(" · ")}
        >
          {texts.schedule}: {line.schedule.join(" · ")}
        </p>
      ) : null}
    </div>
  );

  /** Resumo do envio de uma solicitação: fica abaixo do card dela. */
  const summaryBlock = ({ line, choice, ok, out, problem }: SummaryLine) => (
    <div
      className={cx(
        "rounded-lg border bg-white px-2.5 py-2 text-xs shadow-sm",
        problem ? "border-red-300" : "border-brand-300",
      )}
      data-strategy-summary
      data-strategy-summary-line={line.demandIds[0]}
      data-strategy-summary-lines={line.demandIds.join(" ")}
    >
      <p className="font-semibold text-zinc-900">
        {texts.summaryTitle}{" "}
        <span className="font-normal text-zinc-500">
          · {texts.choices[choice]}
        </span>
      </p>
      {choice === "last_supplier" ? (
        <p className="text-zinc-600">{texts.direct}</p>
      ) : (
        <>
          {ok.length ? (
            <p className="text-emerald-800">
              {fill(texts.receives, { n: ok.length })}:{" "}
              {ok.map((id) => checks[id]?.name ?? id).join(", ")}
            </p>
          ) : null}
          {out.length ? (
            <p className="text-amber-800">
              {fill(texts.blockedOut, { n: out.length })}:{" "}
              {out
                .map(
                  (id) =>
                    `${checks[id]?.name ?? id} (${(checks[id]?.issues ?? [])
                      .map((i) => texts.issues[i] ?? i)
                      .join(" ")})`,
                )
                .join(", ")}
            </p>
          ) : null}
          {problem ? (
            <p
              className="font-semibold text-red-700"
              data-strategy-summary-problem
            >
              {problem}
            </p>
          ) : null}
        </>
      )}
      {canChoose ? (
        <>
          {state.error && sendingKey === line.key && !pending ? (
            <div className="mt-1.5">
              <Alert tone="danger">
                <span data-strategy-send-error={state.error}>
                  {state.message}
                </span>
              </Alert>
            </div>
          ) : null}
          <label className="mt-1.5 block">
            <span className="mb-1 block font-medium text-zinc-700">
              {texts.note}
            </span>
            <Textarea
              value={notes[line.key] ?? ""}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [line.key]: e.target.value }))
              }
              rows={2}
              maxLength={2000}
              className="shadow-none"
            />
          </label>
          <div className="mt-1.5">
            <Button
              type="button"
              onClick={() => confirm(line)}
              disabled={pending || !!problem}
              data-strategy-confirm={line.demandIds[0]}
            >
              {pending && sendingKey === line.key
                ? texts.working
                : texts.confirm}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );

  /** Sem escolha ainda: o lembrete fica no lugar do resumo, abaixo do card. */
  const pendingBlock = (line: StrategyGroupData) => (
    <p
      className="rounded-lg border border-dashed border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-500"
      data-strategy-choose-hint={line.demandIds[0]}
    >
      {texts.chooseOne}
    </p>
  );

  const lineCard = (line: StrategyGroupData) => {
    const s = byLine[line.key];
    const lastCheck = line.last ? checks[line.last.supplierId] : undefined;
    const listed = new Set([...line.linkedIds, ...line.suggestedIds]);
    const extra = s.extra.filter((id) => !listed.has(id));
    const all = [...line.linkedIds, ...line.suggestedIds, ...extra];
    const members = linesOf(line);
    const batch = members.find((m) => m.batch)?.batch ?? null;
    const shown = members.slice(0, CARD_PRODUCTS);
    const hidden = members.length - shown.length;
    // Última compra do card: a comum à solicitação; um produto só, a dele.
    const last = line.last ?? (members.length === 1 ? members[0].last : null);
    const own = summary.find((x) => x.line.key === line.key);
    return (
      // O card e, logo abaixo e na mesma largura, o resumo do envio dele
      // (dono, 22/11/2026).
      <div key={line.key} className="flex min-w-0 flex-col gap-1.5">
        <section
          className={cx(
            cardClass,
            s.choice !== "skip" && "border-brand-300 bg-brand-50/30",
            line.blocked && "border-amber-300",
          )}
          data-strategy-group={line.key}
          data-strategy-line={line.demandIds[0]}
          data-strategy-lines={line.demandIds.join(" ")}
          data-strategy-line-choice={s.choice}
        >
          {/* Solicitação e situação; cliente e identificações. */}
          <div className="flex flex-wrap items-center gap-1">
            <h3 className="text-[13px] font-semibold text-zinc-900">
              {line.title}
            </h3>
            <Badge tone="warning">{texts.card.waiting}</Badge>
            {batch ? (
              <Link
                href={batch.href}
                className={cx(linkClass, "text-[11px]")}
                data-strategy-batch
              >
                {batch.label}
              </Link>
            ) : null}
          </div>
          {line.customerName ? (
            <p
              className="truncate font-medium text-zinc-900"
              title={line.customerName}
            >
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                {texts.card.customer}:{" "}
              </span>
              {line.customerName}
            </p>
          ) : null}
          {line.origin ? (
            <p
              className="truncate text-[11px] text-zinc-600"
              title={line.origin}
            >
              <span data-strategy-origin>{line.origin}</span>
            </p>
          ) : null}
          <div className="space-y-1.5">{shown.map(productCompact)}</div>
          {hidden > 0 ? (
            <p
              className="text-[11px] text-zinc-600"
              data-strategy-more={hidden}
            >
              {fill(texts.card.more, { n: hidden })}
            </p>
          ) : null}
          {line.blocked ? null : (
            <>
              {compactLast(last)}
              {!line.last && line.lastReason && members.length > 1 ? (
                <p className="text-[11px] text-zinc-500">{line.lastReason}</p>
              ) : null}
            </>
          )}
          {line.blocked ? (
            <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
              {line.blocked}
            </p>
          ) : (
            <>
              {canChoose ? (
                <fieldset className="space-y-0.5 border-t border-zinc-100 pt-1.5">
                  <legend className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                    {texts.choose}
                  </legend>
                  {option(line, s, "skip")}
                  {!line.last && line.lastReason ? (
                    <p
                      className="pl-6 text-xs text-zinc-500"
                      data-strategy-last-reason
                    >
                      {line.lastReason}
                    </p>
                  ) : null}
                  {option(line, s, "quote_last", !line.last)}
                  {s.choice === "quote_last" && line.last ? (
                    <div className="pl-6">
                      <p className="text-xs text-zinc-600">
                        {fill(texts.lastHint, { name: line.last.supplierName })}
                      </p>
                      <ul>
                        {lastCheck
                          ? recipientRow(line, line.last.supplierId, s, false)
                          : null}
                      </ul>
                    </div>
                  ) : null}
                  {option(line, s, "quote")}
                  {s.choice === "quote" ? (
                    <div className="space-y-1.5 pl-5" data-strategy-recipients>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <button
                          type="button"
                          className={linkClass}
                          onClick={() =>
                            set(line.key, {
                              recipients: all.filter((id) => checks[id]?.ok),
                            })
                          }
                          data-strategy-all-ok
                        >
                          {texts.allOk}
                        </button>
                        <button
                          type="button"
                          className={linkClass}
                          onClick={() => set(line.key, { recipients: [] })}
                        >
                          {texts.clear}
                        </button>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-700">
                          {fill(texts.originList, {
                            origin: line.origin || texts.noFamily,
                          })}
                        </p>
                        {line.linkedIds.length ? (
                          <ul className="divide-y divide-zinc-100">
                            {line.linkedIds.map((id) =>
                              recipientRow(line, id, s, true),
                            )}
                          </ul>
                        ) : (
                          <p
                            className="text-xs text-zinc-500"
                            data-strategy-no-linked
                          >
                            {fill(texts.originNone, {
                              origin: line.origin || texts.noFamily,
                            })}
                          </p>
                        )}
                      </div>
                      {line.suggestedIds.length ? (
                        <div data-strategy-suggested>
                          <p className="text-xs font-medium text-zinc-700">
                            {texts.suggested}
                          </p>
                          <ul className="divide-y divide-zinc-100">
                            {line.suggestedIds.map((id) =>
                              recipientRow(line, id, s, true),
                            )}
                          </ul>
                        </div>
                      ) : null}
                      {extra.length ? (
                        <div>
                          <p className="text-xs font-medium text-zinc-700">
                            {texts.added}
                          </p>
                          <ul className="divide-y divide-zinc-100">
                            {extra.map((id) => recipientRow(line, id, s, true))}
                          </ul>
                        </div>
                      ) : null}
                      <div>
                        <p className="mb-1 text-xs text-zinc-600">
                          {texts.search}
                        </p>
                        <SearchPicker
                          endpoint="/api/parties/search?type=supplier&also=trading,supplier_partner,factory&active=1"
                          marker="strategy-recipient-picker"
                          kind="quote"
                          dense
                          labels={texts.picker}
                          ariaLabel={texts.search}
                          onChoose={(o) => {
                            if (o) void addFromSearch(line.key, o.id);
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  {option(line, s, "last_supplier", !line.last)}
                  {s.choice === "last_supplier" ? (
                    <p className="pl-6 text-xs text-zinc-600">
                      {texts.directHint}
                    </p>
                  ) : null}
                </fieldset>
              ) : null}
            </>
          )}
          <div className="mt-auto flex flex-wrap gap-1.5 border-t border-zinc-100 pt-1.5">
            <QuickDialog
              label={texts.card.details}
              title={fill(texts.card.detailsTitle, { title: line.title })}
              closeLabel={texts.card.close}
              size="lg"
              data-strategy-details={line.key}
            >
              <div className="space-y-3">
                {line.customerName || line.origin ? (
                  <p className="text-xs text-zinc-600">
                    {[line.customerName, line.origin]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
                {members.map(productBlock)}
                {!line.last && line.lastReason ? (
                  <p className="text-xs text-zinc-600">{line.lastReason}</p>
                ) : null}
              </div>
            </QuickDialog>
          </div>
        </section>
        {own
          ? summaryBlock(own)
          : canChoose && !line.blocked
            ? pendingBlock(line)
            : null}
      </div>
    );
  };

  return (
    <div className="space-y-2" data-strategy-queue={lines.length}>
      {groups.length ? (
        <section>
          {/* O título e a contagem estão na aba (dono, 22/11/2026). */}
          {view === "table" && tableTexts ? (
            // Tabela: uma linha por solicitação; "Abrir" mostra embaixo o
            // mesmo card, com a escolha, os destinatários e o envio.
            <StrategyTable heads={tableTexts.heads} marker="queue">
              {groups.map((line) => {
                const members = linesOf(line);
                const last =
                  line.last ?? (members.length === 1 ? members[0].last : null);
                const choice = byLine[line.key].choice;
                return (
                  <StrategyTableRow
                    key={line.key}
                    rowKey={line.key}
                    columns={tableTexts.heads.length + 1}
                    labels={{ open: tableTexts.open, close: tableTexts.close }}
                    highlight={choice !== "skip"}
                    cells={[
                      <span key="t" className="font-semibold text-zinc-900">
                        {line.title}
                      </span>,
                      line.customerName ?? "—",
                      line.origin ?? "—",
                      <span
                        key="p"
                        title={members.map((m) => m.productName).join(", ")}
                      >
                        {members.length === 1
                          ? members[0].productName
                          : fill(tableTexts.productsN, { n: members.length })}
                      </span>,
                      last
                        ? [last.supplierName, last.price]
                            .filter(Boolean)
                            .join(" · ")
                        : "—",
                      line.blocked ? (
                        <span key="c" className="text-amber-800">
                          {line.blocked}
                        </span>
                      ) : (
                        texts.choices[choice]
                      ),
                    ]}
                  >
                    {lineCard(line)}
                  </StrategyTableRow>
                );
              })}
            </StrategyTable>
          ) : (
            <StrategyGrid marker="queue">{groups.map(lineCard)}</StrategyGrid>
          )}
        </section>
      ) : (
        // Fila vazia: uma faixa baixa, sem card (dono, 19/11/2026).
        <p
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500"
          data-strategy-queue-empty
        >
          {texts.card.emptyStrip}
        </p>
      )}
    </div>
  );
}
