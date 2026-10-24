"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

/*
 * Exclusão em massa numa tabela: as caixas de cada linha são
 * <input type="checkbox" name="ids" form={formId}> (ligadas ao formulário pelo
 * atributo `form`, sem envolver a tabela). Este arquivo traz o "selecionar
 * todas" do cabeçalho e a barra com o contador e o botão de excluir.
 */

function boxes(formId: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `input[type="checkbox"][name="ids"][form="${formId}"]:not(:disabled)`,
    ),
  );
}

function subscribe(onChange: () => void) {
  document.addEventListener("change", onChange);
  return () => document.removeEventListener("change", onChange);
}

/** Marcadas/total lidos do DOM (as caixas são a fonte da verdade). */
function useSelection(formId: string) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      const all = boxes(formId);
      return `${all.filter((b) => b.checked).length}/${all.length}`;
    },
    () => "0/0",
  );
  const [checked, total] = snapshot.split("/").map(Number);
  const setAll = (value: boolean) => {
    for (const b of boxes(formId)) b.checked = value;
    document.dispatchEvent(new Event("change"));
  };
  return { checked, total, setAll };
}

/** Caixa "selecionar todas" (cabeçalho da tabela). */
export function BulkSelectAll({
  formId,
  label,
}: {
  formId: string;
  label: string;
}) {
  const { checked, total, setAll } = useSelection(formId);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = checked > 0 && checked < total;
  }, [checked, total]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      title={label}
      disabled={total === 0}
      checked={total > 0 && checked === total}
      onChange={(e) => setAll(e.target.checked)}
      className="h-4 w-4 accent-brand-600"
    />
  );
}

function DeleteSelectedButton({
  count,
  label,
  confirmText,
  formAction,
  tone = "danger",
}: {
  count: number;
  label: string;
  confirmText: string;
  /** Outra ação no mesmo formulário (ex.: excluir de vez ao lado de restaurar). */
  formAction?: (form: FormData) => Promise<void>;
  tone?: "danger" | "neutral";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={count === 0 || pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(confirmText.replace("{n}", String(count))))
          event.preventDefault();
      }}
      className={
        tone === "danger"
          ? "inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          : "inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {pending ? (
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {label}
      {count > 0 ? ` (${count})` : ""}
    </button>
  );
}

/** Barra acima da tabela: selecionar todas, contador e "Excluir selecionadas". */
export function BulkDeleteBar({
  formId,
  action,
  labels,
  primaryTone = "danger",
  extra,
}: {
  formId: string;
  action: (form: FormData) => Promise<void>;
  /** "neutral" quando a ação principal não apaga (ex.: restaurar). */
  primaryTone?: "danger" | "neutral";
  /** Segunda ação sobre a mesma seleção (botão vermelho à direita). */
  extra?: {
    action: (form: FormData) => Promise<void>;
    label: string;
    confirmText: string;
  };
  labels: {
    selectAll: string;
    clear: string;
    selected: string;
    deleteSelected: string;
    confirmMany: string;
  };
}) {
  const { checked, total, setAll } = useSelection(formId);
  if (total === 0) return null;
  return (
    <form
      id={formId}
      action={action}
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => setAll(checked !== total)}
          className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          {checked === total ? labels.clear : labels.selectAll}
        </button>
        <span className="text-zinc-500">
          {labels.selected.replace("{n}", String(checked))}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DeleteSelectedButton
          count={checked}
          label={labels.deleteSelected}
          confirmText={labels.confirmMany}
          tone={primaryTone}
        />
        {extra ? (
          <DeleteSelectedButton
            count={checked}
            label={extra.label}
            confirmText={extra.confirmText}
            formAction={extra.action}
          />
        ) : null}
      </div>
    </form>
  );
}

/**
 * Caixa de um lote na tabela (uma linha com vários produtos): marca de uma vez
 * as caixas escondidas de cada produto que pode ser excluído, que são as que
 * vão no formulário. "Selecionar todas" também as marca.
 */
export function BatchSelect({
  formId,
  groupKey,
  ids,
  label,
}: {
  formId: string;
  groupKey: string;
  ids: string[];
  label: string;
}) {
  const selector = `input[type="checkbox"][name="ids"][form="${formId}"][data-batch-box="${groupKey}"]`;
  const all = useSyncExternalStore(
    subscribe,
    () => {
      const list = Array.from(
        document.querySelectorAll<HTMLInputElement>(selector),
      );
      return list.length > 0 && list.every((b) => b.checked);
    },
    () => false,
  );
  return (
    <>
      <input
        type="checkbox"
        aria-label={label}
        title={label}
        checked={all}
        onChange={(e) => {
          for (const b of document.querySelectorAll<HTMLInputElement>(selector))
            b.checked = e.target.checked;
          document.dispatchEvent(new Event("change"));
        }}
        className="h-4 w-4 accent-brand-600"
      />
      {ids.map((id) => (
        <input
          key={id}
          type="checkbox"
          name="ids"
          value={id}
          form={formId}
          data-batch-box={groupKey}
          hidden
          aria-hidden
          tabIndex={-1}
          readOnly
        />
      ))}
    </>
  );
}
