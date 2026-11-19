"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  equalShares,
  fromBaseCompany,
  matrixColumns,
  matrixFromTotals,
  matrixPieces,
  matrixTotals,
  rescaleMatrix,
  reshapeMatrix,
  sharesTotal,
  splitByPercent,
  spreadRounds,
  taxIdText,
  type CompanyAmounts,
  type CompanyMatrix,
  type EconomicGroup,
} from "@/lib/economic-group";
import { roundLoad } from "@/lib/purchase-rounds";
import {
  saveGroupSharesAction,
  saveRoundSharesAction,
} from "@/app/app/actions/economic-groups";
import { useRequestCustomer } from "./request-customer-context";
import { ROUNDS_EVENT, type RoundsEventDetail } from "./selection-quantity";
import { fillLabel, type EconomicGroupLabels } from "./economic-group-labels";
import { cx, inputDenseClass } from "./ui";

/*
 * Pedido para um grupo econômico na Nova solicitação (dono, 18/11/2026;
 * docs/ECONOMIC_GROUPS.md): o "+ x empresas do grupo" e a distribuição
 * padrão ao lado do cliente; em cada produto, a empresa do grupo, o
 * "Completo" e o preenchimento em massa. Os campos dos modais não têm
 * `name` (estão dentro do formulário do pedido e não vão para o servidor):
 * só o campo escondido `<linha>.companyAllocations` vai.
 */

const iconButton =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-brand-600";

/** Ícone de distribuição (fatias). */
function SplitIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none">
      <path
        d="M10 2a8 8 0 1 0 8 8h-8V2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12.5 1.8v5.7h5.7a6 6 0 0 0-5.7-5.7Z" fill="currentColor" />
    </svg>
  );
}

/** Ícone de preenchimento em massa (linhas). */
function BulkIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="none">
      <path
        d="M3 5h14M3 10h14M3 15h9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="m14 13 2 2 3-4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Caixa por cima da tela, aberta pelo `open`. */
function GroupDialog({
  open,
  title,
  closeLabel,
  onClose,
  children,
  ...rest
}: {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-auto rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40"
      {...rest}
    >
      {open ? (
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="rounded-md px-2 text-lg leading-none text-zinc-500 hover:bg-zinc-100"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

const num = (text: string) => {
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const pctText = (n: number | undefined) =>
  n === undefined || !Number.isFinite(n) ? "" : String(n);

/** Tabela de percentuais (modal padrão e "Por percentual"). */
function PercentTable({
  group,
  labels,
  values,
  onChange,
}: {
  group: Pick<EconomicGroup, "companies">;
  labels: EconomicGroupLabels;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const total = sharesTotal(
    Object.fromEntries(Object.entries(values).map(([k, v]) => [k, num(v)])),
  );
  return (
    <div className="space-y-2">
      <div className="max-h-[50dvh] overflow-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-left text-xs text-zinc-600">
            <tr>
              <th className="px-2 py-1.5 font-semibold">
                {labels["econGroup.col.company"]}
              </th>
              <th className="px-2 py-1.5 font-semibold">
                {labels["econGroup.col.taxId"]}
              </th>
              <th className="w-24 px-2 py-1.5 font-semibold">
                {labels["econGroup.col.percent"]}
              </th>
            </tr>
          </thead>
          <tbody>
            {group.companies.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100">
                <td className="px-2 py-1">
                  {c.name}
                  {c.head ? (
                    <span className="ml-1 text-xs text-zinc-500">
                      ({labels["econGroup.head"]})
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-1 tabular-nums text-zinc-600">
                  {taxIdText(c.taxId)}
                </td>
                <td className="px-2 py-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={values[c.id] ?? ""}
                    onChange={(e) =>
                      onChange({ ...values, [c.id]: e.target.value })
                    }
                    aria-label={`${labels["econGroup.col.percent"]} ${c.name}`}
                    data-group-percent={c.id}
                    className={cx(inputDenseClass, "w-20 tabular-nums")}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cx(
            "font-semibold",
            Math.abs(total - 100) > 0.01
              ? "text-amber-700"
              : "text-emerald-700",
          )}
          data-group-percent-total={total}
        >
          {fillLabel(labels["econGroup.total"], { pct: total })}
        </span>
        <button
          type="button"
          onClick={() =>
            onChange(
              Object.fromEntries(
                Object.entries(
                  equalShares(group.companies.map((c) => c.id)),
                ).map(([k, v]) => [k, String(v)]),
              ),
            )
          }
          className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-50"
          data-group-equal
        >
          {labels["econGroup.equal"]}
        </button>
      </div>
    </div>
  );
}

const toText = (shares: Record<string, number>) =>
  Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, pctText(v)]));
const toNumbers = (values: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(values)
      .map(([k, v]) => [k, num(v)] as const)
      .filter(([, v]) => v > 0),
  );

/**
 * "+ x empresas do grupo" e o ícone da distribuição padrão, na linha de
 * baixo do cliente.
 */
export function GroupCustomerExtra({
  labels,
}: {
  labels: EconomicGroupLabels;
}) {
  const shared = useRequestCustomer();
  const group = shared?.group ?? null;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  if (shared?.groupLoading)
    return (
      <span className="text-zinc-500" data-group-loading>
        {" · "}
        {labels["econGroup.loading"]}
      </span>
    );
  if (!group) return null;
  const others = group.companies.length - 1;
  const total = sharesTotal(toNumbers(values));
  const save = async () => {
    setState("saving");
    const head = group.companies.find((c) => c.head) ?? group.companies[0];
    const res = await saveGroupSharesAction({
      customerId: head.id,
      shares: toNumbers(values),
    }).catch(() => null);
    if (res?.ok) {
      shared?.setGroupShares(res.group.shares);
      setState("saved");
      setOpen(false);
    } else setState("error");
  };
  return (
    <>
      <span className="font-medium text-brand-700" data-group-more={others}>
        {" "}
        {others === 1
          ? labels["econGroup.moreOne"]
          : fillLabel(labels["econGroup.more"], { n: others })}
      </span>
      <button
        type="button"
        onClick={() => {
          setValues(toText(group.shares));
          setState("idle");
          setOpen(true);
        }}
        title={labels["econGroup.defaults.open"]}
        aria-label={labels["econGroup.defaults.open"]}
        className={cx(iconButton, "ml-1.5 align-middle")}
        data-group-defaults-open
      >
        <SplitIcon />
      </button>
      {state === "saved" ? (
        <span className="ml-1.5 text-emerald-700" role="status">
          {labels["econGroup.saved"]}
        </span>
      ) : null}
      <GroupDialog
        open={open}
        title={fillLabel(labels["econGroup.defaults.title"], {
          name: group.name,
        })}
        closeLabel={labels["econGroup.close"]}
        onClose={() => setOpen(false)}
        data-group-defaults
      >
        <p className="text-xs text-zinc-600">
          {labels["econGroup.defaults.hint"]}
        </p>
        <PercentTable
          group={group}
          labels={labels}
          values={values}
          onChange={setValues}
        />
        {state === "error" ? (
          <p className="text-xs font-medium text-red-700" role="alert">
            {Math.abs(total - 100) > 0.01
              ? labels["econGroup.totalBad"]
              : labels["econGroup.error.generic"]}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            {labels["econGroup.cancel"]}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={state === "saving" || Math.abs(total - 100) > 0.01}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-group-defaults-save
          >
            {labels["econGroup.save"]}
          </button>
        </div>
      </GroupDialog>
    </>
  );
}

/** Peças de cada empresa gravadas antes (rascunho) → matriz digitada. */
export function matrixFromAllocations(
  allocations: ReadonlyArray<{ customerId: string; quantities: number[] }>,
  perCarton: number | null,
): CompanyMatrix {
  const per = perCarton && perCarton > 0 ? perCarton : 1;
  return Object.fromEntries(
    allocations.map((a) => [
      a.customerId,
      a.quantities.map((q) => Math.round(q / per)),
    ]),
  );
}

/** "Entrega 1 — 18/03/2027". */
function roundLabel(
  labels: EconomicGroupLabels,
  i: number,
  date: string | undefined,
  intl: string,
): string {
  const n = fillLabel(labels["econGroup.rounds.delivery"], { n: i + 1 });
  if (!date) return n;
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? n
    : `${n} — ${d.toLocaleDateString(intl, { day: "2-digit", month: "2-digit", year: "numeric" })}`;
}

/** Percentuais de N entregas (texto dos campos). */
function RoundPercentInputs({
  n,
  values,
  onChange,
  labels,
  dates,
  intl,
  compact = false,
}: {
  n: number;
  values: string[];
  onChange: (next: string[]) => void;
  labels: EconomicGroupLabels;
  dates: string[];
  intl: string;
  compact?: boolean;
}) {
  const total = Math.round(values.reduce((s, v) => s + num(v), 0) * 100) / 100;
  return (
    <div className="space-y-2">
      <div
        className={cx(
          "grid gap-2",
          compact ? "grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]" : "",
        )}
      >
        {Array.from({ length: n }, (_, i) => (
          <label
            key={i}
            className={cx(
              "flex items-center gap-2 text-xs",
              compact ? "" : "justify-between",
            )}
          >
            <span className="text-zinc-700">
              {compact
                ? fillLabel(labels["econGroup.rounds.delivery"], { n: i + 1 })
                : roundLabel(labels, i, dates[i], intl)}
            </span>
            <span className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={values[i] ?? ""}
                onChange={(e) => {
                  const next = [...values];
                  while (next.length < n) next.push("");
                  next[i] = e.target.value;
                  onChange(next);
                }}
                aria-label={roundLabel(labels, i, dates[i], intl)}
                data-round-percent={i + 1}
                className={cx(inputDenseClass, "w-16 tabular-nums")}
              />
              <span className="text-zinc-500">%</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cx(
            "font-semibold",
            Math.abs(total - 100) > 0.01
              ? "text-amber-700"
              : "text-emerald-700",
          )}
          data-round-percent-total={total}
        >
          {fillLabel(labels["econGroup.total"], { pct: total })}
        </span>
        <button
          type="button"
          onClick={() =>
            onChange(
              Array.from({ length: n }, (_, i) =>
                String(
                  equalShares(Array.from({ length: n }, (_, k) => String(k)))[
                    String(i)
                  ],
                ),
              ),
            )
          }
          className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 font-semibold text-zinc-700 hover:bg-zinc-50"
          data-round-equal
        >
          {labels["econGroup.equal"]}
        </button>
      </div>
    </div>
  );
}

const percentsText = (p: readonly number[] | null, n: number) =>
  p && p.length === n
    ? p.map((v) => String(v))
    : Array.from({ length: n }, (_, i) =>
        String(
          equalShares(Array.from({ length: n }, (_, k) => String(k)))[
            String(i)
          ],
        ),
      );
const percentsOk = (values: string[], n: number) =>
  values.length === n &&
  Math.abs(values.reduce((s, v) => s + num(v), 0) - 100) <= 0.01 &&
  values.every((v) => num(v) >= 0);

/**
 * Distribuição entre as entregas do pedido (dono, 19/11/2026), no bloco
 * "Programação de entregas ao cliente": o percentual de cada entrega, o
 * padrão do cliente para N entregas e "Salvar como padrão". Aplicar
 * reparte de novo os produtos já preenchidos.
 */
export function RoundSharesControl({
  labels,
  count,
  dates,
  intl,
}: {
  labels: EconomicGroupLabels;
  count: number;
  dates: string[];
  intl: string;
}) {
  const shared = useRequestCustomer();
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<string[]>([]);
  const [saveDefault, setSaveDefault] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  if (!shared || count < 2) return null;
  const current = shared.roundPercents;
  const customer = shared.customer;
  const summary = current
    ? current.map((p) => `${p}%`).join(" / ")
    : labels["econGroup.rounds.equalSplit"];
  const apply = async () => {
    const percents = values.map((v) => Math.round(num(v) * 100) / 100);
    if (saveDefault && customer) {
      setState("saving");
      const res = await saveRoundSharesAction({
        customerId: customer.id,
        percents,
      }).catch(() => null);
      if (!res?.ok) {
        setState("error");
        return;
      }
      shared.setRoundDefault(res.percents);
    }
    shared.setRoundPercents(percents);
    // Os produtos já preenchidos (fora dos do grupo, que se repartem
    // sozinhos) são repartidos de novo nessa proporção.
    const form = anchor.current?.closest("form");
    for (const [key, load] of Object.entries(shared.loads)) {
      const index = key.replace(/^row-/, "");
      if (form?.querySelector(`[data-group-row="${key}"][data-group-filled]`))
        continue;
      const per =
        load.masterCartonQty && load.masterCartonQty > 0
          ? load.masterCartonQty
          : 1;
      const total = load.pieces.reduce((a, b) => a + b, 0);
      if (!total || load.pieces.length !== count) continue;
      const units = Math.round(total / per);
      form?.dispatchEvent(
        new CustomEvent<RoundsEventDetail>(ROUNDS_EVENT, {
          detail: {
            prefix: `p${index}.`,
            quantities: spreadRounds(units, count, percents).map(
              (u) => u * per,
            ),
          },
        }),
      );
    }
    setState("idle");
    setOpen(false);
  };
  return (
    <div ref={anchor} className="space-y-1" data-round-shares>
      <span className="block text-xs font-medium text-zinc-700">
        {labels["econGroup.rounds.open"]}
      </span>
      <div className="flex min-h-9 items-center gap-1.5 text-xs">
        <span className="tabular-nums text-zinc-700" data-round-shares-summary>
          {summary}
        </span>
        <button
          type="button"
          onClick={() => {
            setValues(percentsText(current ?? shared.roundDefault, count));
            setSaveDefault(false);
            setState("idle");
            setOpen(true);
          }}
          title={labels["econGroup.rounds.open"]}
          aria-label={labels["econGroup.rounds.open"]}
          className={iconButton}
          data-round-shares-open
        >
          <SplitIcon />
        </button>
      </div>
      <GroupDialog
        open={open}
        title={fillLabel(labels["econGroup.rounds.title"], { n: count })}
        closeLabel={labels["econGroup.close"]}
        onClose={() => setOpen(false)}
        data-round-shares-dialog
      >
        <p className="text-xs text-zinc-600">
          {labels["econGroup.rounds.hint"]}
        </p>
        {shared.roundDefault ? (
          <button
            type="button"
            onClick={() => setValues(percentsText(shared.roundDefault, count))}
            className="text-xs font-semibold text-brand-700 underline"
            data-round-use-default
          >
            {labels["econGroup.rounds.useDefault"]}
          </button>
        ) : null}
        <RoundPercentInputs
          n={count}
          values={values}
          onChange={setValues}
          labels={labels}
          dates={dates}
          intl={intl}
        />
        {customer ? (
          <label className="flex items-center gap-2 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={saveDefault}
              onChange={(e) => setSaveDefault(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
              data-round-save-default
            />
            {fillLabel(labels["econGroup.rounds.saveDefault"], { n: count })}
          </label>
        ) : null}
        {state === "error" ? (
          <p className="text-xs font-medium text-red-700" role="alert">
            {labels["econGroup.error.generic"]}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            {labels["econGroup.cancel"]}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={state === "saving" || !percentsOk(values, count)}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-round-shares-apply
          >
            {labels["econGroup.bulk.apply"]}
          </button>
        </div>
      </GroupDialog>
    </div>
  );
}

/**
 * Empresa do grupo em cada produto: o seletor (com ✓ em quem já tem
 * quantidade e "Completo" quando todas têm), o ícone do preenchimento em
 * massa e, com uma empresa escolhida, a quantidade dela em cada entrega.
 * "Todas as empresas" mostra a soma. A matriz Empresas × Entregas é a fonte:
 * a soma por entrega vai para a programação do produto e, quando a
 * programação muda fora daqui (gerador ou "Programação X"), a matriz se
 * recalcula na mesma proporção (dono, 19/11/2026).
 */
export function RowGroupAllocation({
  prefix,
  rowKey,
  perCarton,
  rounds,
  productName,
  labels,
  initial,
  intl,
}: {
  prefix: string;
  rowKey: string;
  /** Peças por caixa master (nulo: a quantidade é em peças). */
  perCarton: number | null;
  /** Entregas do pedido (a programação do bloco do pedido). */
  rounds: number;
  productName: string;
  labels: EconomicGroupLabels;
  initial: CompanyMatrix | null;
  intl: string;
}) {
  const shared = useRequestCustomer();
  const group = shared?.group ?? null;
  const anchor = useRef<HTMLDivElement>(null);
  const n = Math.max(1, rounds);
  // Percentual entre entregas: o deste produto (do modal) ou o do pedido.
  const [ownWeights, setOwnWeights] = useState<number[] | null>(null);
  const weights =
    ownWeights?.length === n
      ? ownWeights
      : shared?.roundPercents?.length === n
        ? shared.roundPercents
        : null;
  const [matrix, setMatrix] = useState<CompanyMatrix>(initial ?? {});
  const [selected, setSelected] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const ids = group ? group.companies.map((c) => c.id) : [];
  const per = perCarton && perCarton > 0 ? perCarton : null;
  // Outro número de entregas (ou outro percentual do pedido): o total de
  // cada empresa repartido de novo.
  const shapeKey = `${n}|${JSON.stringify(weights)}`;
  const [shapedFor, setShapedFor] = useState(shapeKey);
  if (shapedFor !== shapeKey) {
    setShapedFor(shapeKey);
    setMatrix((m) => reshapeMatrix(m, Object.keys(m), n, weights));
  }
  const current: CompanyMatrix = Object.fromEntries(
    ids
      .filter((id) => (matrix[id] ?? []).some((v) => v > 0))
      .map((id) => [id, matrix[id]]),
  );
  const totals = matrixTotals(current, ids);
  const filled = Object.keys(current).length;
  const split = matrixPieces(current, ids, n, per);
  const key = filled ? JSON.stringify(split.total) : "";
  const pending = useRef<string | null>(null);
  // A soma por entrega vai para a programação do produto (o campo de
  // quantidade da linha escuta o evento).
  useEffect(() => {
    if (!key) return;
    pending.current = key;
    const timer = window.setTimeout(() => {
      if (pending.current === key) pending.current = null;
    }, 1500);
    anchor.current?.closest("form")?.dispatchEvent(
      new CustomEvent<RoundsEventDetail>(ROUNDS_EVENT, {
        detail: { prefix, quantities: JSON.parse(key) as number[] },
      }),
    );
    return () => window.clearTimeout(timer);
  }, [key, prefix]);
  // A programação do produto mudou fora daqui: a matriz acompanha, na
  // mesma proporção de cada entrega.
  const load = shared?.loads[rowKey];
  const loadKey = load ? JSON.stringify(load.pieces) : "";
  const shares = group?.shares ?? {};
  const sharesKey = JSON.stringify(shares);
  const syncFromLoad = useEffectEvent((loaded: string) => {
    if (!loaded || !group) return;
    if (loaded === key) {
      pending.current = null;
      return;
    }
    if (pending.current) return;
    const pieces = JSON.parse(loaded) as number[];
    if (pieces.length !== n) return;
    const unit = per ?? 1;
    const targets = pieces.map((p) => Math.round(p / unit));
    const total = targets.reduce((a, b) => a + b, 0);
    if (!total && !filled) return;
    const next = rescaleMatrix(matrix, ids, targets, shares);
    if (next) setMatrix(next);
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a programação vem de outro componente (o campo de quantidade da linha)
    syncFromLoad(loadKey);
  }, [loadKey, n, per, sharesKey]);
  if (!group) return null;
  const fmt = (v: number) => v.toLocaleString(intl);
  const company = group.companies.find((c) => c.id === selected) ?? null;
  const sumPieces = split.total.reduce((a, b) => a + b, 0);
  const sumAmount = Object.values(totals).reduce((a, b) => a + b, 0);
  const allocations = ids
    .filter((id) => split.byCompany[id])
    .map((id) => ({ customerId: id, quantities: split.byCompany[id] }));
  const setCell = (id: string, i: number, value: number) =>
    setMatrix((m) => {
      const row = Array.from({ length: n }, (_, k) => m[id]?.[k] ?? 0);
      row[i] = value;
      return { ...m, [id]: row };
    });
  return (
    <div
      ref={anchor}
      className="flex max-w-full flex-col items-end gap-1 text-xs"
      data-group-row={rowKey}
      data-group-filled={filled ? "" : undefined}
    >
      <input
        type="hidden"
        name={`${prefix}companyAllocations`}
        value={allocations.length ? JSON.stringify(allocations) : ""}
      />
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label={labels["econGroup.row.label"]}
          className={cx(inputDenseClass, "max-w-[16rem]")}
          data-group-company-select
        >
          <option value="">{labels["econGroup.row.all"]}</option>
          {group.companies.map((c) => (
            <option key={c.id} value={c.id}>
              {current[c.id] ? "✓ " : "  "}
              {c.name}
            </option>
          ))}
        </select>
        {filled === ids.length ? (
          <span
            className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"
            data-group-complete
          >
            {labels["econGroup.row.complete"]}
          </span>
        ) : (
          <span
            className="text-zinc-500"
            data-group-missing={ids.length - filled}
          >
            {fillLabel(labels["econGroup.row.missing"], {
              n: ids.length - filled,
            })}
          </span>
        )}
        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          title={labels["econGroup.row.bulk"]}
          aria-label={labels["econGroup.row.bulk"]}
          className={iconButton}
          data-group-bulk-open
        >
          <BulkIcon />
        </button>
      </div>
      {company ? (
        <div
          className="flex flex-wrap items-end justify-end gap-1.5"
          data-group-company-rounds
        >
          {Array.from({ length: n }, (_, i) => (
            <label key={i} className="space-y-0.5 text-right">
              <span className="block text-zinc-600">
                {n > 1
                  ? fillLabel(labels["econGroup.rounds.delivery"], { n: i + 1 })
                  : per
                    ? labels["econGroup.row.cartonsOf"]
                    : labels["econGroup.row.piecesOf"]}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={
                  matrix[company.id]?.[i] ? String(matrix[company.id][i]) : ""
                }
                onChange={(e) =>
                  setCell(
                    company.id,
                    i,
                    Math.max(0, Math.floor(num(e.target.value))),
                  )
                }
                className={cx(inputDenseClass, "w-16 tabular-nums")}
                data-group-company-round={i + 1}
              />
            </label>
          ))}
          <span
            className="pb-1.5 font-semibold text-zinc-700"
            data-group-company-total
          >
            = {fmt(totals[company.id] ?? 0)}{" "}
            {(per
              ? labels["econGroup.col.cartons"]
              : labels["econGroup.col.pieces"]
            ).toLowerCase()}
          </span>
        </div>
      ) : null}
      <p className="text-right text-zinc-600" data-group-summary>
        {company
          ? null
          : filled
            ? per
              ? fillLabel(labels["econGroup.row.sum"], {
                  cartons: fmt(sumAmount),
                  pieces: fmt(sumPieces),
                })
              : fillLabel(labels["econGroup.row.sumPieces"], {
                  pieces: fmt(sumPieces),
                })
            : null}
      </p>
      <BulkDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        group={group}
        labels={labels}
        productName={productName}
        per={per}
        rounds={n}
        weights={weights}
        dates={shared?.planDates ?? []}
        matrix={current}
        load={load ?? null}
        onApply={(next, ownW) => {
          if (ownW) setOwnWeights(ownW);
          setShapedFor(
            `${n}|${JSON.stringify(ownW?.length === n ? ownW : weights)}`,
          );
          setMatrix(next);
          setBulkOpen(false);
        }}
        intl={intl}
      />
    </div>
  );
}

/**
 * Preenchimento em massa de um produto: por percentual (das empresas e das
 * entregas) ou uma a uma, na matriz Empresas × Entregas com os totais.
 */
function BulkDialog({
  open,
  onClose,
  group,
  labels,
  productName,
  per,
  rounds,
  weights,
  dates,
  matrix,
  load,
  onApply,
  intl,
}: {
  open: boolean;
  onClose: () => void;
  group: EconomicGroup;
  labels: EconomicGroupLabels;
  productName: string;
  per: number | null;
  rounds: number;
  weights: number[] | null;
  dates: string[];
  matrix: CompanyMatrix;
  load: {
    masterCartonQty: number | null;
    cbmPerCarton: number | null;
    capacityCbm: number | null;
  } | null;
  onApply: (next: CompanyMatrix, ownWeights: number[] | null) => void;
  intl: string;
}) {
  const ids = group.companies.map((c) => c.id);
  const n = rounds;
  const [tab, setTab] = useState<"percent" | "manual">("percent");
  const [percents, setPercents] = useState<Record<string, string>>({});
  const [roundValues, setRoundValues] = useState<string[]>([]);
  // "% só deste produto": só quando mudado aqui (senão vale o do pedido).
  const [roundsTouched, setRoundsTouched] = useState(false);
  const [mode, setMode] = useState<"base" | "total">("total");
  const [baseId, setBaseId] = useState(ids[0] ?? "");
  const [qty, setQty] = useState("");
  const [cells, setCells] = useState<Record<string, string[]>>({});
  // Abrir: o padrão do grupo (ou o igual), as entregas e a matriz de agora.
  const [openedFor, setOpenedFor] = useState(false);
  if (open && !openedFor) {
    setOpenedFor(true);
    const hasDefault = sharesTotal(group.shares) > 0;
    setPercents(toText(hasDefault ? group.shares : equalShares(ids)));
    setRoundValues(percentsText(weights, n));
    setRoundsTouched(false);
    setCells(
      Object.fromEntries(
        ids.map((id) => [
          id,
          Array.from({ length: n }, (_, i) =>
            matrix[id]?.[i] ? String(matrix[id][i]) : "",
          ),
        ]),
      ),
    );
    setQty("");
  }
  if (!open && openedFor) setOpenedFor(false);
  const shares = toNumbers(percents);
  const total = sharesTotal(shares);
  const roundsOk = n < 2 || percentsOk(roundValues, n);
  const roundWeights =
    n >= 2 && roundsOk ? roundValues.map((v) => num(v)) : null;
  const ownWeights = roundsTouched ? roundWeights : null;
  const amount = Math.max(0, Math.floor(num(qty)));
  const preview: CompanyAmounts | null = !amount
    ? null
    : mode === "total"
      ? splitByPercent(amount, ids, shares)
      : fromBaseCompany(baseId, amount, ids, shares);
  const fmt = (v: number) => v.toLocaleString(intl);
  const tabClass = (on: boolean) =>
    cx(
      "rounded-full border px-3 py-1 text-xs font-semibold",
      on
        ? "border-brand-600 bg-brand-50 text-brand-700"
        : "border-zinc-200 text-zinc-700 hover:bg-zinc-50",
    );
  const unitLabel = per
    ? labels["econGroup.col.cartons"]
    : labels["econGroup.col.pieces"];
  const cellMatrix: CompanyMatrix = Object.fromEntries(
    ids.map((id) => [
      id,
      Array.from({ length: n }, (_, i) =>
        Math.max(0, Math.floor(num(cells[id]?.[i] ?? ""))),
      ),
    ]),
  );
  const rowTotals = matrixTotals(cellMatrix, ids);
  const columns = matrixColumns(cellMatrix, ids, n);
  const containersOf = (units: number) => {
    if (!load || !per) return null;
    const l = roundLoad(
      units * per,
      load.masterCartonQty,
      load.cbmPerCarton,
      load.capacityCbm,
    );
    return l?.needed ?? null;
  };
  /** Preenche a matriz com os totais de cada empresa e as entregas. */
  const fillCells = (totals: CompanyAmounts) => {
    const m = matrixFromTotals(totals, ids, n, roundWeights);
    setCells(
      Object.fromEntries(
        ids.map((id) => [
          id,
          Array.from({ length: n }, (_, i) =>
            m[id]?.[i] ? String(m[id][i]) : "",
          ),
        ]),
      ),
    );
  };
  return (
    <GroupDialog
      open={open}
      title={fillLabel(labels["econGroup.bulk.title"], {
        product: productName || "—",
      })}
      closeLabel={labels["econGroup.close"]}
      onClose={onClose}
      data-group-bulk
    >
      <div className="flex flex-wrap gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "percent"}
          onClick={() => setTab("percent")}
          className={tabClass(tab === "percent")}
          data-group-bulk-tab="percent"
        >
          {labels["econGroup.bulk.byPercent"]}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "manual"}
          onClick={() => setTab("manual")}
          className={tabClass(tab === "manual")}
          data-group-bulk-tab="manual"
        >
          {labels["econGroup.bulk.manual"]}
        </button>
      </div>
      {n >= 2 ? (
        <details
          className="rounded-lg border border-zinc-200 p-2"
          data-group-bulk-rounds
        >
          <summary className="cursor-pointer text-xs font-semibold text-zinc-700">
            {labels["econGroup.bulk.roundsLabel"]}:{" "}
            <span className="font-normal tabular-nums">
              {roundValues.map((v) => `${num(v)}%`).join(" / ")}
            </span>
          </summary>
          <div className="mt-2">
            <RoundPercentInputs
              n={n}
              values={roundValues}
              onChange={(v) => {
                setRoundValues(v);
                setRoundsTouched(true);
              }}
              labels={labels}
              dates={dates}
              intl={intl}
              compact
            />
          </div>
        </details>
      ) : null}
      {tab === "percent" ? (
        <div className="space-y-3">
          {sharesTotal(group.shares) > 0 ? (
            <button
              type="button"
              onClick={() => setPercents(toText(group.shares))}
              className="text-xs font-semibold text-brand-700 underline"
              data-group-use-default
            >
              {labels["econGroup.bulk.useDefault"]}
            </button>
          ) : (
            <p className="text-xs text-zinc-500">
              {labels["econGroup.bulk.noDefault"]}
            </p>
          )}
          <PercentTable
            group={group}
            labels={labels}
            values={percents}
            onChange={setPercents}
          />
          <div className="flex flex-wrap items-end gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={mode === "total"}
                onChange={() => setMode("total")}
                className="accent-brand-600"
                data-group-mode="total"
              />
              {labels["econGroup.bulk.fromTotal"]}
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={mode === "base"}
                onChange={() => setMode("base")}
                className="accent-brand-600"
                data-group-mode="base"
              />
              {labels["econGroup.bulk.fromBase"]}
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2 text-xs">
            {mode === "base" ? (
              <label className="space-y-1">
                <span className="block font-medium text-zinc-700">
                  {labels["econGroup.bulk.baseCompany"]}
                </span>
                <select
                  value={baseId}
                  onChange={(e) => setBaseId(e.target.value)}
                  className={cx(inputDenseClass, "max-w-[16rem]")}
                  data-group-base
                >
                  {group.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="space-y-1">
              <span className="block font-medium text-zinc-700">
                {mode === "base"
                  ? per
                    ? labels["econGroup.bulk.baseQty"]
                    : labels["econGroup.bulk.baseQtyPieces"]
                  : per
                    ? labels["econGroup.bulk.totalQty"]
                    : labels["econGroup.bulk.totalQtyPieces"]}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={cx(inputDenseClass, "w-28 tabular-nums")}
                data-group-bulk-qty
              />
            </label>
          </div>
          {mode === "base" && amount && !preview ? (
            <p className="text-xs font-medium text-amber-800" role="alert">
              {labels["econGroup.bulk.baseZero"]}
            </p>
          ) : null}
          {preview ? (
            <ul className="grid gap-x-4 gap-y-0.5 text-xs text-zinc-700 sm:grid-cols-2">
              {group.companies.map((c) => (
                <li
                  key={c.id}
                  className="flex justify-between gap-2"
                  data-group-preview={c.id}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="tabular-nums font-semibold">
                    {fmt(preview[c.id] ?? 0)} {unitLabel.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {labels["econGroup.cancel"]}
            </button>
            <button
              type="button"
              onClick={() =>
                preview &&
                onApply(
                  matrixFromTotals(preview, ids, n, roundWeights),
                  ownWeights,
                )
              }
              disabled={!preview || Math.abs(total - 100) > 0.01 || !roundsOk}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-group-bulk-apply
            >
              {labels["econGroup.bulk.apply"]}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-600">
              {labels["econGroup.bulk.manualHint"]}
            </p>
            <button
              type="button"
              onClick={() => fillCells(rowTotals)}
              disabled={!roundsOk}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              data-group-matrix-spread
            >
              {labels["econGroup.matrix.spread"]}
            </button>
          </div>
          <div className="max-h-[55dvh] overflow-auto rounded-lg border border-zinc-200">
            <table className="w-full text-sm" data-group-matrix>
              <thead className="sticky top-0 z-10 bg-zinc-50 text-left text-xs text-zinc-600">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">
                    {labels["econGroup.col.company"]}
                  </th>
                  {Array.from({ length: n }, (_, i) => (
                    <th
                      key={i}
                      className="px-2 py-1.5 text-right font-semibold whitespace-nowrap"
                    >
                      {n > 1
                        ? roundLabel(labels, i, dates[i], intl)
                        : unitLabel}
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-right font-semibold">
                    {labels["econGroup.matrix.total"]}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.companies.map((c) => (
                  <tr key={c.id} className="border-t border-zinc-100">
                    <td className="px-2 py-1">
                      <span className="block">{c.name}</span>
                      <span className="block text-xs tabular-nums text-zinc-500">
                        {taxIdText(c.taxId)}
                      </span>
                    </td>
                    {Array.from({ length: n }, (_, i) => (
                      <td key={i} className="px-2 py-1 text-right">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={cells[c.id]?.[i] ?? ""}
                          onChange={(e) =>
                            setCells((prev) => {
                              const row = Array.from(
                                { length: n },
                                (_, k) => prev[c.id]?.[k] ?? "",
                              );
                              row[i] = e.target.value;
                              return { ...prev, [c.id]: row };
                            })
                          }
                          aria-label={`${c.name} ${roundLabel(labels, i, dates[i], intl)}`}
                          className={cx(
                            inputDenseClass,
                            "w-20 text-right tabular-nums",
                          )}
                          data-group-cell={`${c.id}:${i + 1}`}
                        />
                      </td>
                    ))}
                    <td
                      className="px-2 py-1 text-right font-semibold tabular-nums"
                      data-group-row-total={c.id}
                    >
                      {fmt(rowTotals[c.id] ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-zinc-50 text-xs">
                <tr className="border-t border-zinc-200">
                  <td className="px-2 py-1.5 font-semibold">
                    {labels["econGroup.matrix.total"]}
                  </td>
                  {columns.map((v, i) => (
                    <td
                      key={i}
                      className="px-2 py-1.5 text-right font-semibold tabular-nums"
                      data-group-column-total={i + 1}
                    >
                      {fmt(v)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {fmt(columns.reduce((a, b) => a + b, 0))}
                  </td>
                </tr>
                {per && load?.capacityCbm ? (
                  <tr>
                    <td className="px-2 py-1 text-zinc-600">
                      {labels["econGroup.matrix.containers"]}
                    </td>
                    {columns.map((v, i) => (
                      <td
                        key={i}
                        className="px-2 py-1 text-right tabular-nums text-zinc-600"
                      >
                        {containersOf(v) ?? "—"}
                      </td>
                    ))}
                    <td />
                  </tr>
                ) : null}
              </tfoot>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {labels["econGroup.cancel"]}
            </button>
            <button
              type="button"
              onClick={() => onApply(cellMatrix, ownWeights)}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
              data-group-manual-save
            >
              {labels["econGroup.save"]}
            </button>
          </div>
        </div>
      )}
    </GroupDialog>
  );
}
