"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { bulkValueValid, type BookingItemField } from "@/lib/booking-lots";
import {
  bulkSetBookingItemsAction,
  bulkSetPartnerBookingItemsAction,
  refuseBookingItemsAction,
  type BulkFillResult,
} from "@/app/app/actions/booking-lots";
import { cx, inputDenseClass } from "@/components/ui";

/*
 * Preenchimento em massa dos itens do Book (dono, 16/11/2026): uma caixa em
 * cada linha (e a do cabeçalho, que marca ou desmarca todas), um campo vazio
 * acima de cada coluna editável e "Carregar", que grava de uma vez os
 * valores digitados nas linhas marcadas. Sem nenhuma linha marcada, o valor
 * vai para todas as linhas à vista (dono, 23/11/2026: a linha de cima serve
 * para preencher todas). Campo vazio deixa a coluna como está; com linhas
 * marcadas, as desmarcadas não mudam. Enter no campo de cima também carrega.
 * Seta para baixo e para cima levam o foco à célula de baixo e de cima. A gravação é a da célula (as
 * mesmas regras no servidor). Os campos ficam no cabeçalho congelado da
 * tabela (TableTools com stickyHead): dá para marcar linhas lá embaixo e
 * carregar sem voltar ao topo.
 */

export type BulkField = BookingItemField | "ncm";

/** Como o campo em massa é digitado: o mesmo tipo e as opções da coluna. */
export type BulkFieldKind = "text" | "number" | "select";

export interface BulkFillLabels {
  /** Caixa do cabeçalho. */
  selectAll: string;
  /** Caixa da linha ("Marcar a linha {n}"). */
  selectRow: string;
  /** Campo acima da coluna ("{field} para as linhas marcadas"). */
  field: string;
  load: string;
  loading: string;
  /** "Marcados: {n}". */
  selected: string;
  /** Sem linha marcada: o valor vai para todas. */
  allRows: string;
  /** "Selecionar os marcados" (leva à Seleção de itens) e o aviso sem marcados. */
  toSelection?: string;
  toSelectionNone?: string;
  /** "Até {n} itens por vez." */
  toSelectionMax?: string;
  /** "Recusar os marcados", a pergunta ("Recusar {n} item(ns)?") e os avisos. */
  refuse?: string;
  refuseAsk?: string;
  refusing?: string;
  /** Por que "Carregar" está desligado. */
  disabled: string;
  invalid: string;
  /** "Itens atualizados: {n}." */
  updated: string;
  /** "Não foram salvos: {list}." */
  failed: string;
  /** "{rows} ({field}: {message})" */
  failedGroup: string;
  /** "linha {n}" */
  row: string;
  /** "Nada foi salvo: {message}" */
  refused: string;
  offline: string;
  retry: string;
  close: string;
}

type Status =
  | { kind: "ok"; updated: number }
  | {
      kind: "partial";
      updated: number;
      groups: string[];
      retry: { ids: string[]; values: Record<string, string> };
    }
  | {
      kind: "refused";
      message: string;
      retry: { ids: string[]; values: Record<string, string> };
    };

interface BulkContext {
  lotId: string;
  labels: BulkFillLabels;
  selected: ReadonlySet<string>;
  toggle: (id: string, on: boolean) => void;
  toggleAll: () => void;
  allState: "none" | "some" | "all";
  values: Partial<Record<BulkField, string>>;
  setValue: (field: BulkField, value: string) => void;
  /** Os valores preenchidos estão todos legíveis (e há pelo menos um). */
  ready: boolean;
  pending: boolean;
  load: () => void;
  status: Status | null;
  retry: () => void;
  dismiss: () => void;
  rowLabel: (id: string) => string;
}

const Ctx = createContext<BulkContext | null>(null);

function useBulk() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("BookingBulkFill fora do provedor");
  return ctx;
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) =>
    key in values ? String(values[key]) : all,
  );

/**
 * Quem guarda as linhas marcadas e os valores. Envolve a tabela inteira
 * (cabeçalho congelado, linhas e o aviso).
 */
export function BookingBulkProvider({
  lotId,
  mode,
  itemIds,
  rowLabels,
  fieldLabels,
  labels,
  children,
}: {
  lotId: string;
  /** Wellmix (a ação da tela da Wellmix) ou o parceiro que lança o booking. */
  mode: "wellmix" | "partner";
  /** Todos os itens do booking, na ordem da tabela. */
  itemIds: string[];
  /** Como cada linha é chamada no aviso (o número da linha). */
  rowLabels: Record<string, string>;
  /** Nome de cada coluna, para dizer qual campo não gravou. */
  fieldLabels: Record<string, string>;
  labels: BulkFillLabels;
  children: ReactNode;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [values, setValues] = useState<Partial<Record<BulkField, string>>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, start] = useTransition();

  // Itens que saíram do booking (outra pessoa excluiu): saem da marcação.
  const known = useMemo(() => new Set(itemIds), [itemIds]);
  const marked = useMemo(
    () => new Set([...selected].filter((id) => known.has(id))),
    [selected, known],
  );

  const filled = Object.entries(values).filter(
    ([, v]) => (v ?? "").trim() !== "",
  ) as Array<[BulkField, string]>;
  const ready =
    filled.length > 0 && filled.every(([f, v]) => bulkValueValid(f, v));

  const allState: BulkContext["allState"] =
    marked.size === 0 ? "none" : marked.size >= itemIds.length ? "all" : "some";

  const rowLabel = (id: string) =>
    fill(labels.row, { n: rowLabels[id] ?? "?" });

  /** As linhas que a busca da tabela deixa à vista (em qualquer página). */
  const shownIds = () => {
    const rows =
      scope.current?.querySelectorAll<HTMLTableRowElement>(
        "tr[data-bulk-row]:not([data-table-filtered])",
      ) ?? [];
    return Array.from(rows, (row) => row.dataset.bulkRow!).filter((id) =>
      known.has(id),
    );
  };

  const send = (ids: string[], sent: Record<string, string>) => {
    setStatus(null);
    start(async () => {
      let result: BulkFillResult;
      try {
        result =
          mode === "wellmix"
            ? await bulkSetBookingItemsAction(lotId, ids, sent)
            : await bulkSetPartnerBookingItemsAction(lotId, ids, sent);
      } catch {
        setStatus({
          kind: "refused",
          message: labels.offline,
          retry: { ids, values: sent },
        });
        return;
      }
      if (!result.ok) {
        setStatus({
          kind: "refused",
          message: fill(labels.refused, { message: result.message }),
          retry: { ids, values: sent },
        });
        return;
      }
      if (!result.failed.length) {
        setStatus({ kind: "ok", updated: result.updated });
        // Tudo gravado: os campos esvaziam (as linhas continuam marcadas).
        setValues({});
        return;
      }
      // Os que não gravaram, juntos pelo motivo: "linhas 5, 8 (Preço: ...)".
      const byReason = new Map<string, string[]>();
      for (const f of result.failed) {
        const reason = `${f.field ? (fieldLabels[f.field] ?? f.field) : ""}\u0000${f.message}`;
        byReason.set(reason, [...(byReason.get(reason) ?? []), f.itemId]);
      }
      const groups = [...byReason].map(([reason, ids]) => {
        const [field, message] = reason.split("\u0000");
        return fill(labels.failedGroup, {
          rows: ids.map(rowLabel).join(", "),
          field: field || "—",
          message,
        });
      });
      setStatus({
        kind: "partial",
        updated: result.updated,
        groups,
        retry: {
          ids: result.failed.map((f) => f.itemId),
          values: sent,
        },
      });
    });
  };

  const ctx: BulkContext = {
    lotId,
    labels,
    selected: marked,
    toggle: (id, on) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    // Marcadas (todas ou algumas): desmarca tudo; nenhuma: marca as linhas
    // que a busca deixa à vista.
    toggleAll: () => setSelected(marked.size ? new Set() : new Set(shownIds())),
    allState,
    values,
    setValue: (field, value) =>
      setValues((prev) => ({ ...prev, [field]: value })),
    ready,
    pending,
    load: () => {
      if (!ready || pending) return;
      // Nenhuma marcada: todas as linhas que a busca deixa à vista.
      const ids = marked.size ? [...marked] : shownIds();
      if (!ids.length) return;
      send(ids, Object.fromEntries(filled));
    },
    status,
    retry: () => {
      if (!status || status.kind === "ok" || pending) return;
      send(status.retry.ids, status.retry.values);
    },
    dismiss: () => setStatus(null),
    rowLabel,
  };

  return (
    <Ctx.Provider value={ctx}>
      <div ref={scope} data-bulk-scope={lotId} onKeyDown={arrowKeys}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/**
 * Seta para baixo ou para cima num campo da tabela: o foco vai para o campo
 * da mesma coluna na linha de baixo ou de cima (dono, 23/11/2026), como numa
 * planilha. Da linha de preenchimento em massa, para baixo cai na primeira
 * linha. Sair do campo grava o que foi digitado, como sempre. Listas
 * (FOB/EXW, moeda) e a busca com opções ficam com as setas delas.
 */
function arrowKeys(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const from = event.target;
  if (
    !(from instanceof HTMLInputElement) ||
    from.type === "checkbox" ||
    from.getAttribute("role") === "combobox"
  )
    return;
  const cell = from.closest("td,th");
  const row = cell?.closest("tr");
  if (!(cell instanceof HTMLTableCellElement) || !row) return;
  const down = event.key === "ArrowDown";
  const field = (r: Element | null | undefined) =>
    r?.children[cell.cellIndex]?.querySelector<HTMLElement>(
      "input:not([type=checkbox]):not([type=hidden]):not([disabled]), select:not([disabled])",
    ) ?? null;
  const shown = (r: Element) =>
    r instanceof HTMLElement && r.offsetParent !== null;
  let target: HTMLElement | null = null;
  if (row.hasAttribute("data-bulk-fill-row")) {
    // Do cabeçalho congelado para a primeira linha à vista da tabela.
    if (!down) return;
    const rows = event.currentTarget.querySelectorAll("tr[data-bulk-row]");
    target = field(Array.from(rows).find(shown));
  } else {
    let next = down ? row.nextElementSibling : row.previousElementSibling;
    while (next && !shown(next))
      next = down ? next.nextElementSibling : next.previousElementSibling;
    target = field(next);
    // Da primeira linha para cima: o campo de preenchimento da coluna.
    if (!next && !down)
      target = field(
        event.currentTarget.querySelector("tr[data-bulk-fill-row]"),
      );
  }
  if (!target) return;
  event.preventDefault();
  target.focus();
  if (target instanceof HTMLInputElement) target.select();
}

/**
 * "Selecionar os marcados": leva os itens marcados do book direto para a
 * Seleção de itens, como um grupo para comparar (um item só também vale).
 * Dono, 23/11/2026; só na tela da Wellmix.
 */
export function BulkSelectionLink({ max }: { max: number }) {
  const { selected, labels } = useBulk();
  const ids = [...selected];
  const over = ids.length > max;
  const off = !ids.length || over;
  const title = !ids.length
    ? labels.toSelectionNone
    : over
      ? (labels.toSelectionMax ?? "").replace("{n}", String(max))
      : undefined;
  const className =
    "inline-flex min-h-9 items-center justify-center rounded-md px-3 text-sm font-semibold shadow-sm transition";
  return off ? (
    <span
      title={title}
      aria-disabled
      className={cx(className, "cursor-not-allowed bg-zinc-200 text-zinc-600")}
      data-bulk-to-selection="off"
    >
      {labels.toSelection} ({ids.length})
    </span>
  ) : (
    <a
      href={`/app/booking/selection?tab=selection&ids=${ids.join(",")}`}
      className={cx(className, "bg-brand-700 text-white hover:bg-brand-800")}
      data-bulk-to-selection={ids.length}
    >
      {labels.toSelection} ({ids.length})
    </a>
  );
}

/** Caixa do cabeçalho: marca as linhas (à vista pela busca) ou desmarca todas. */
export function BulkSelectAll() {
  const { allState, toggleAll, labels, pending } = useBulk();
  return (
    <input
      type="checkbox"
      checked={allState === "all"}
      ref={(el) => {
        if (el) el.indeterminate = allState === "some";
      }}
      onChange={toggleAll}
      disabled={pending}
      aria-label={labels.selectAll}
      title={labels.selectAll}
      className="h-5 w-5 cursor-pointer accent-brand-700"
      data-bulk-select-all={allState}
    />
  );
}

/** Caixa da linha: a área toda da célula marca (dedo no iPad). */
export function BulkRowCheck({ itemId, n }: { itemId: string; n: string }) {
  const { selected, toggle, labels, pending } = useBulk();
  const on = selected.has(itemId);
  return (
    <input
      type="checkbox"
      checked={on}
      onChange={(e) => toggle(itemId, e.target.checked)}
      disabled={pending}
      aria-label={fill(labels.selectRow, { n })}
      className="h-5 w-5 cursor-pointer accent-brand-700"
      data-bulk-check={itemId}
    />
  );
}

/**
 * Campo vazio acima da coluna: o mesmo tipo da coluna (lista com as mesmas
 * opções em incoterm e moeda). Valor que a gravação não aceita fica
 * apontado e "Carregar" não liga.
 */
export function BulkFieldInput({
  field,
  kind,
  label,
  options = [],
}: {
  field: BulkField;
  kind: BulkFieldKind;
  /** Nome da coluna. */
  label: string;
  /** Lista (incoterm, moeda): as opções das linhas. */
  options?: readonly string[];
}) {
  const { values, setValue, labels, pending, load } = useBulk();
  const value = values[field] ?? "";
  const bad = value.trim() !== "" && !bulkValueValid(field, value);
  const name = fill(labels.field, { field: label });
  const common = {
    "aria-label": name,
    title: name,
    disabled: pending,
    "aria-invalid": bad || undefined,
    "data-bulk-field": field,
    className: cx(
      inputDenseClass,
      "w-full",
      kind === "number" && "text-right",
      // Preenchido e válido: verde (vai para as linhas marcadas).
      value.trim() !== "" &&
        !bad &&
        "border-emerald-500 bg-emerald-50 hover:border-emerald-500",
      bad && "border-red-500 bg-red-50 hover:border-red-500",
    ),
  } as const;
  return (
    <span className="block">
      {kind === "select" ? (
        <select
          {...common}
          value={value}
          onChange={(e) => setValue(field, e.target.value)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type="text"
          value={value}
          inputMode={kind === "number" ? "decimal" : undefined}
          autoComplete="off"
          onChange={(e) => setValue(field, e.target.value)}
          onKeyDown={(e) => {
            // Enter carrega (nas marcadas ou, sem marcadas, em todas).
            if (e.key !== "Enter") return;
            e.preventDefault();
            load();
          }}
        />
      )}
      {bad ? (
        <span
          className="mt-0.5 block text-[11px] leading-tight font-normal normal-case tracking-normal text-red-700"
          data-bulk-field-invalid={field}
        >
          {labels.invalid}
        </span>
      ) : null}
    </span>
  );
}

/** "Carregar": grava os valores nas linhas marcadas; diz quantas estão marcadas. */
export function BulkLoadButton() {
  const { ready, selected, pending, load, labels } = useBulk();
  // Sem linha marcada, o valor vai para todas (dono, 23/11/2026).
  const enabled = ready && !pending;
  return (
    <span className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={load}
        disabled={!enabled}
        title={enabled ? undefined : labels.disabled}
        className="inline-flex min-h-8 items-center justify-center rounded-md bg-brand-700 px-2.5 text-xs font-semibold normal-case tracking-normal text-white shadow-sm transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
        aria-busy={pending}
        data-bulk-load
      >
        {pending ? labels.loading : labels.load}
      </button>
      <span
        className="text-[11px] font-normal normal-case tracking-normal text-zinc-500 tabular-nums"
        data-bulk-selected={selected.size}
      >
        {selected.size
          ? fill(labels.selected, { n: selected.size })
          : labels.allRows}
      </span>
    </span>
  );
}

/**
 * O resultado do último "Carregar", no cabeçalho congelado (à vista em
 * qualquer ponto da tabela): quantos gravaram; os que não, com o motivo e
 * "Tentar de novo".
 */
export function BulkStatus() {
  const { status, labels, retry, dismiss, pending } = useBulk();
  if (!status) return null;
  const ok = status.kind === "ok";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "flex flex-wrap items-start gap-x-3 gap-y-1 border-b px-3 py-2 text-[13px]",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900",
      )}
      data-bulk-status={status.kind}
    >
      <span className="min-w-0 flex-1">
        {status.kind === "refused" ? (
          status.message
        ) : (
          <>
            {fill(labels.updated, { n: status.updated })}
            {status.kind === "partial" ? (
              <> {fill(labels.failed, { list: status.groups.join("; ") })}</>
            ) : null}
          </>
        )}
      </span>
      {status.kind !== "ok" ? (
        <button
          type="button"
          onClick={retry}
          disabled={pending}
          className="rounded-md border border-red-300 bg-white px-2 py-0.5 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
          data-bulk-retry
        >
          {pending ? labels.loading : labels.retry}
        </button>
      ) : null}
      <button
        type="button"
        onClick={dismiss}
        aria-label={labels.close}
        title={labels.close}
        className="rounded px-1 text-base leading-none opacity-70 hover:opacity-100"
        data-bulk-dismiss
      >
        ×
      </button>
    </div>
  );
}

/**
 * "Recusar os marcados" (dono, 24/11/2026): os itens marcados não vão para a
 * seleção e ficam trabalhados. Pergunta antes; o erro aparece ao lado. Só na
 * tela da Wellmix, com o book já fora do rascunho.
 */
export function BulkRefuseButton() {
  const { lotId, selected, labels, toggle } = useBulk();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ids = [...selected];
  const off = !ids.length || busy;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={off}
        title={ids.length ? undefined : labels.toSelectionNone}
        onClick={() => {
          const ask = (labels.refuseAsk ?? "").replace(
            "{n}",
            String(ids.length),
          );
          if (ask && !window.confirm(ask)) return;
          setError(null);
          start(async () => {
            try {
              const result = await refuseBookingItemsAction(lotId, ids);
              if (!result.ok) return setError(result.message);
              // Recusados: saem da marcação.
              for (const id of ids) toggle(id, false);
            } catch {
              setError(labels.offline);
            }
          });
        }}
        className="inline-flex min-h-9 items-center justify-center rounded-md border border-red-300 bg-white px-3 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-500"
        aria-busy={busy}
        data-bulk-refuse={ids.length}
      >
        {busy ? labels.refusing : labels.refuse} ({ids.length})
      </button>
      {error ? (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
