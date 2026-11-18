"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  companyRounds,
  equalShares,
  fromBaseCompany,
  sharesTotal,
  splitByPercent,
  taxIdText,
  type CompanyAmounts,
  type EconomicGroup,
} from "@/lib/economic-group";
import { saveGroupSharesAction } from "@/app/app/actions/economic-groups";
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
  group: EconomicGroup;
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

/** Peças de cada empresa gravadas antes (rascunho) → quantidade digitada. */
export function amountsFromAllocations(
  allocations: ReadonlyArray<{ customerId: string; quantities: number[] }>,
  perCarton: number | null,
): CompanyAmounts {
  const per = perCarton && perCarton > 0 ? perCarton : 1;
  return Object.fromEntries(
    allocations.map((a) => [
      a.customerId,
      Math.round(a.quantities.reduce((s, q) => s + q, 0) / per),
    ]),
  );
}

/**
 * Empresa do grupo em cada produto: o seletor (com ✓ em quem já tem
 * quantidade e "Completo" quando todas têm), o ícone do preenchimento em
 * massa e a quantidade da empresa escolhida. "Todas as empresas" mostra a
 * soma. A soma por entrega vai para a programação do produto.
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
  initial: CompanyAmounts | null;
  intl: string;
}) {
  const shared = useRequestCustomer();
  const group = shared?.group ?? null;
  const anchor = useRef<HTMLDivElement>(null);
  const [amounts, setAmounts] = useState<CompanyAmounts>(initial ?? {});
  const [selected, setSelected] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const ids = group ? group.companies.map((c) => c.id) : [];
  // Só as empresas do grupo de agora (trocar de cliente esquece as outras).
  const current: CompanyAmounts = Object.fromEntries(
    ids.filter((id) => (amounts[id] ?? 0) > 0).map((id) => [id, amounts[id]]),
  );
  const filled = Object.keys(current).length;
  const split = companyRounds(current, ids, rounds, perCarton);
  const key = filled ? JSON.stringify(split.total) : "";
  // A soma por entrega vai para a programação do produto (o campo de
  // quantidade da linha escuta o evento).
  useEffect(() => {
    if (!key) return;
    anchor.current?.closest("form")?.dispatchEvent(
      new CustomEvent<RoundsEventDetail>(ROUNDS_EVENT, {
        detail: { prefix, quantities: JSON.parse(key) as number[] },
      }),
    );
  }, [key, prefix]);
  if (!group) return null;
  const fmt = (n: number) => n.toLocaleString(intl);
  const unitCartons = !!perCarton && perCarton > 0;
  const load = shared?.loads[rowKey];
  const shown = load?.pieces ?? [];
  const mismatch =
    filled > 0 &&
    (shown.length !== split.total.length ||
      shown.some((p, i) => p !== split.total[i]));
  const company = group.companies.find((c) => c.id === selected) ?? null;
  const sumPieces = split.total.reduce((a, b) => a + b, 0);
  const sumAmount = Object.values(current).reduce((a, b) => a + b, 0);
  const allocations = ids
    .filter((id) => split.byCompany[id])
    .map((id) => ({ customerId: id, quantities: split.byCompany[id] }));
  return (
    <div
      ref={anchor}
      className="flex max-w-full flex-col items-end gap-1 text-xs"
      data-group-row={rowKey}
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
            <option
              key={c.id}
              value={c.id}
              data-done={current[c.id] ? "" : undefined}
            >
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
        <label className="flex items-center gap-1.5">
          <span className="text-zinc-600">
            {unitCartons
              ? labels["econGroup.row.cartonsOf"]
              : labels["econGroup.row.piecesOf"]}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={current[company.id] ? String(current[company.id]) : ""}
            onChange={(e) => {
              const n = Math.max(0, Math.floor(num(e.target.value)));
              setAmounts((prev) => ({ ...prev, [company.id]: n }));
            }}
            className={cx(inputDenseClass, "w-24 tabular-nums")}
            data-group-company-amount={company.id}
          />
        </label>
      ) : null}
      <p className="text-right text-zinc-600" data-group-summary>
        {company
          ? split.byCompany[company.id]
            ? fillLabel(labels["econGroup.row.split"], {
                list: split.byCompany[company.id].map(fmt).join(" / "),
              })
            : labels["econGroup.row.noQty"]
          : filled
            ? unitCartons
              ? fillLabel(labels["econGroup.row.sum"], {
                  cartons: fmt(sumAmount),
                  pieces: fmt(sumPieces),
                })
              : fillLabel(labels["econGroup.row.sumPieces"], {
                  pieces: fmt(sumPieces),
                })
            : null}
      </p>
      {mismatch ? (
        <p
          className="max-w-xs rounded-md bg-amber-50 px-2 py-1 text-right text-amber-800"
          role="status"
          data-group-mismatch
        >
          {labels["econGroup.mismatch"]}
        </p>
      ) : null}
      <BulkDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        group={group}
        labels={labels}
        productName={productName}
        unitCartons={unitCartons}
        amounts={current}
        onApply={(next) => {
          setAmounts(next);
          setBulkOpen(false);
        }}
        intl={intl}
      />
    </div>
  );
}

/** Preenchimento em massa de um produto: por percentual ou uma a uma. */
function BulkDialog({
  open,
  onClose,
  group,
  labels,
  productName,
  unitCartons,
  amounts,
  onApply,
  intl,
}: {
  open: boolean;
  onClose: () => void;
  group: EconomicGroup;
  labels: EconomicGroupLabels;
  productName: string;
  unitCartons: boolean;
  amounts: CompanyAmounts;
  onApply: (next: CompanyAmounts) => void;
  intl: string;
}) {
  const ids = group.companies.map((c) => c.id);
  const [tab, setTab] = useState<"percent" | "manual">("percent");
  const [percents, setPercents] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"base" | "total">("total");
  const [baseId, setBaseId] = useState(ids[0] ?? "");
  const [qty, setQty] = useState("");
  const [manual, setManual] = useState<Record<string, string>>({});
  // Abrir: o padrão do grupo (ou o igual) e as quantidades de agora.
  const [openedFor, setOpenedFor] = useState(false);
  if (open && !openedFor) {
    setOpenedFor(true);
    const hasDefault = sharesTotal(group.shares) > 0;
    setPercents(toText(hasDefault ? group.shares : equalShares(ids)));
    setManual(
      Object.fromEntries(
        ids.map((id) => [id, amounts[id] ? String(amounts[id]) : ""]),
      ),
    );
    setQty("");
  }
  if (!open && openedFor) setOpenedFor(false);
  const shares = toNumbers(percents);
  const total = sharesTotal(shares);
  const amount = Math.max(0, Math.floor(num(qty)));
  const preview: CompanyAmounts | null = !amount
    ? null
    : mode === "total"
      ? splitByPercent(amount, ids, shares)
      : fromBaseCompany(baseId, amount, ids, shares);
  const fmt = (n: number) => n.toLocaleString(intl);
  const tabClass = (on: boolean) =>
    cx(
      "rounded-full border px-3 py-1 text-xs font-semibold",
      on
        ? "border-brand-600 bg-brand-50 text-brand-700"
        : "border-zinc-200 text-zinc-700 hover:bg-zinc-50",
    );
  const unitLabel = unitCartons
    ? labels["econGroup.col.cartons"]
    : labels["econGroup.col.pieces"];
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
                  ? unitCartons
                    ? labels["econGroup.bulk.baseQty"]
                    : labels["econGroup.bulk.baseQtyPieces"]
                  : unitCartons
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
              onClick={() => preview && onApply(preview)}
              disabled={!preview || Math.abs(total - 100) > 0.01}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-group-bulk-apply
            >
              {labels["econGroup.bulk.apply"]}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-600">
            {labels["econGroup.bulk.manualHint"]}
          </p>
          <div className="max-h-[55dvh] overflow-auto rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-50 text-left text-xs text-zinc-600">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">
                    {labels["econGroup.col.company"]}
                  </th>
                  <th className="px-2 py-1.5 font-semibold">
                    {labels["econGroup.col.taxId"]}
                  </th>
                  <th className="w-28 px-2 py-1.5 font-semibold">
                    {unitLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.companies.map((c) => (
                  <tr key={c.id} className="border-t border-zinc-100">
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1 tabular-nums text-zinc-600">
                      {taxIdText(c.taxId)}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={manual[c.id] ?? ""}
                        onChange={(e) =>
                          setManual({ ...manual, [c.id]: e.target.value })
                        }
                        aria-label={`${unitLabel} ${c.name}`}
                        className={cx(inputDenseClass, "w-24 tabular-nums")}
                        data-group-manual={c.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
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
              onClick={() =>
                onApply(
                  Object.fromEntries(
                    ids.map((id) => [
                      id,
                      Math.max(0, Math.floor(num(manual[id] ?? ""))),
                    ]),
                  ),
                )
              }
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
