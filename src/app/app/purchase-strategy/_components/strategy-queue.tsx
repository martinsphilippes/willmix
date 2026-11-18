"use client";

import {
  startTransition,
  useActionState,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
  Textarea,
  cx,
  linkClass,
} from "@/components/ui";
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

/*
 * Estratégia de Compra por produto (dono, 18/11/2026; docs/PURCHASE_DEMAND.md,
 * "Estratégia de Compra por produto"). Um produto por linha: a encomenda de
 * origem, o cliente, a quantidade, a especificação, a programação de entrega
 * e a última compra; a escolha (cotar com a última compra, cotar com outros
 * parceiros, pedido direto ou não enviar agora) e, para cotar, os
 * destinatários com o que falta a quem não pode receber. "Revisar o envio"
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
}

export interface StrategyTexts {
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
  cantWin: string;
  issues: Record<string, string>;
  warnings: Record<string, string>;
  fix: string;
  review: string;
  reviewNone: string;
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
  checks: initialChecks,
  texts,
  canChoose,
}: {
  lines: StrategyLineData[];
  checks: Record<string, RecipientCheck>;
  texts: StrategyTexts;
  canChoose: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    sendStrategyAction,
    INITIAL,
  );
  const [checks, setChecks] = useState(initialChecks);
  const [checking, setChecking] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [byLine, setByLine] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      lines.map((l) => [
        l.demandId,
        {
          choice: "skip" as Choice,
          // Os vinculados à família e aptos já vêm marcados para "cotar com
          // outros" (o cadastro já diz que atendem a família).
          recipients: l.linkedIds.filter((id) => initialChecks[id]?.ok),
          extra: [],
        },
      ]),
    ),
  );
  const set = (id: string, patch: Partial<LineState>) =>
    setByLine((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const chosen = lines.filter(
    (l) => !l.blocked && byLine[l.demandId]?.choice !== "skip",
  );

  /** Destinatários de uma linha: a última compra ou os marcados. */
  const recipientsOf = (line: StrategyLineData, s: LineState): string[] =>
    s.choice === "quote_last"
      ? line.last
        ? [line.last.supplierId]
        : []
      : s.choice === "quote"
        ? s.recipients
        : [];

  const summary = chosen.map((line) => {
    const s = byLine[line.demandId];
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
  const hasProblem = summary.some((x) => x.problem);

  const confirm = () => {
    const data = new FormData();
    data.set(
      "payload",
      JSON.stringify({
        lines: chosen.map((line) => {
          const s = byLine[line.demandId];
          return {
            demandId: line.demandId,
            choice: s.choice,
            recipientIds: s.choice === "quote" ? s.recipients : [],
          };
        }),
        note: note.trim() || null,
      }),
    );
    startTransition(() => formAction(data));
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
    line: StrategyLineData,
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
              set(line.demandId, {
                recipients: e.target.checked
                  ? [...s.recipients, id]
                  : s.recipients.filter((x) => x !== id),
              })
            }
            className="mt-0.5 h-4 w-4 accent-brand-600"
            aria-label={check?.name ?? id}
            data-strategy-recipient-box={id}
          />
        ) : null}
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-medium text-zinc-900">{check?.name ?? id}</span>
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
              {!check.canWin ? (
                <span className="block text-zinc-500">{texts.cantWin}</span>
              ) : null}
            </span>
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
        <dt className="text-zinc-500">{texts.quantity}</dt>
        <dd className="font-medium tabular-nums">{line.quantity}</dd>
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
      <div
        className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700"
        data-strategy-last={line.last.supplierId}
      >
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
      <p
        className="mt-2 text-xs font-medium text-amber-800"
        data-strategy-no-history
      >
        {texts.noHistory}
      </p>
    );

  const option = (
    line: StrategyLineData,
    s: LineState,
    value: Choice,
    disabled = false,
  ) => (
    <label
      className={cx(
        "flex items-center gap-2 text-sm",
        disabled && "cursor-not-allowed text-zinc-400",
      )}
    >
      <input
        type="radio"
        name={`choice-${line.demandId}`}
        value={value}
        checked={s.choice === value}
        disabled={disabled || !canChoose}
        onChange={() => {
          set(line.demandId, { choice: value });
          setReviewing(false);
        }}
        className="h-4 w-4 accent-brand-600"
        data-strategy-choice={value}
      />
      {texts.choices[value]}
    </label>
  );

  const lineCard = (line: StrategyLineData) => {
    const s = byLine[line.demandId];
    const lastCheck = line.last ? checks[line.last.supplierId] : undefined;
    const listed = new Set([...line.linkedIds, ...line.suggestedIds]);
    const extra = s.extra.filter((id) => !listed.has(id));
    const all = [...line.linkedIds, ...line.suggestedIds, ...extra];
    return (
      <section
        key={line.demandId}
        className={cx(
          "rounded-2xl border p-3",
          s.choice !== "skip"
            ? "border-brand-300 bg-brand-50/30"
            : "border-zinc-200",
        )}
        data-strategy-line={line.demandId}
        data-strategy-line-choice={s.choice}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-zinc-900">
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
          </h3>
          <Link href={line.demandHref} className={cx(linkClass, "text-xs")}>
            {line.origin}
          </Link>
          {line.batch ? (
            <Link
              href={line.batch.href}
              className={cx(linkClass, "text-xs")}
              data-strategy-batch
            >
              {line.batch.label}
            </Link>
          ) : null}
        </div>
        {details(line)}
        {line.blocked ? (
          <p className="mt-2 text-xs font-medium text-amber-800">
            {line.blocked}
          </p>
        ) : (
          <>
            {lastBox(line)}
            {canChoose ? (
              <fieldset className="mt-3 space-y-1 border-t border-zinc-100 pt-2">
                <legend className="mb-1 text-xs font-medium text-zinc-600">
                  {texts.choose}
                </legend>
                {option(line, s, "skip")}
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
                  <div className="space-y-2 pl-6" data-strategy-recipients>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <button
                        type="button"
                        className={linkClass}
                        onClick={() =>
                          set(line.demandId, {
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
                        onClick={() => set(line.demandId, { recipients: [] })}
                      >
                        {texts.clear}
                      </button>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-700">
                        {fill(texts.linked, {
                          family: line.family?.name || texts.noFamily,
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
                          {fill(texts.none, {
                            family: line.family?.name || texts.noFamily,
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
                    <div className="max-w-md">
                      <p className="mb-1 text-xs text-zinc-600">
                        {texts.search}
                      </p>
                      <SearchPicker
                        endpoint="/api/parties/search?type=quote&active=1"
                        marker="strategy-recipient-picker"
                        kind="quote"
                        dense
                        labels={texts.picker}
                        ariaLabel={texts.search}
                        onChoose={(o) => {
                          if (o) void addFromSearch(line.demandId, o.id);
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
      </section>
    );
  };

  return (
    <div className="space-y-4" data-strategy-queue={lines.length}>
      <Card title={texts.queueTitle}>
        {lines.length ? (
          <div className="space-y-3">{lines.map(lineCard)}</div>
        ) : (
          <p className="text-sm text-zinc-500" data-strategy-queue-empty>
            {texts.queueEmpty}
          </p>
        )}
      </Card>

      {canChoose && lines.length ? (
        <div className="sticky bottom-0 z-10 space-y-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          {reviewing && chosen.length ? (
            <div data-strategy-summary>
              <h2 className="text-sm font-semibold text-zinc-900">
                {texts.summaryTitle}
              </h2>
              <p className="mb-2 text-xs text-zinc-600">{texts.summaryHint}</p>
              {state.error ? (
                <div className="mb-2">
                  <Alert tone="danger">
                    <span data-strategy-send-error={state.error}>
                      {state.message}
                    </span>
                  </Alert>
                </div>
              ) : null}
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {summary.map(({ line, choice, ok, out, problem }) => (
                  <li
                    key={line.demandId}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    data-strategy-summary-line={line.demandId}
                  >
                    <p className="font-medium text-zinc-900">
                      {line.productName}{" "}
                      <span className="text-xs font-normal text-zinc-500">
                        · {line.origin} · {texts.choices[choice]}
                      </span>
                    </p>
                    {choice === "last_supplier" ? (
                      <p className="text-xs text-zinc-600">{texts.direct}</p>
                    ) : (
                      <>
                        {ok.length ? (
                          <p className="text-xs text-emerald-800">
                            {fill(texts.receives, { n: ok.length })}:{" "}
                            {ok.map((id) => checks[id]?.name ?? id).join(", ")}
                          </p>
                        ) : null}
                        {out.length ? (
                          <p className="text-xs text-amber-800">
                            {fill(texts.blockedOut, { n: out.length })}:{" "}
                            {out
                              .map(
                                (id) =>
                                  `${checks[id]?.name ?? id} (${(
                                    checks[id]?.issues ?? []
                                  )
                                    .map((i) => texts.issues[i] ?? i)
                                    .join(" ")})`,
                              )
                              .join(", ")}
                          </p>
                        ) : null}
                        {problem ? (
                          <p
                            className="text-xs font-semibold text-red-700"
                            data-strategy-summary-problem
                          >
                            {problem}
                          </p>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <label className="mt-2 block">
                <span className="mb-1 block text-xs font-medium text-zinc-700">
                  {texts.note}
                </span>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={2000}
                />
              </label>
              {hasProblem ? (
                <p className="mt-2 text-xs font-semibold text-red-700">
                  {texts.fixFirst}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={confirm}
                  disabled={pending || hasProblem}
                  data-strategy-confirm
                >
                  {pending ? texts.working : texts.confirm}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setReviewing(false)}
                  disabled={pending}
                  data-strategy-back
                >
                  {texts.back}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-600">
                {chosen.length ? null : texts.reviewNone}
              </p>
              <Button
                type="button"
                onClick={() => setReviewing(true)}
                disabled={!chosen.length}
                data-strategy-review
              >
                {fill(texts.review, { n: chosen.length })}
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
