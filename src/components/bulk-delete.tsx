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
}: {
  count: number;
  label: string;
  confirmText: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={count === 0 || pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(confirmText.replace("{n}", String(count))))
          event.preventDefault();
      }}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
}: {
  formId: string;
  action: (form: FormData) => Promise<void>;
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
      <DeleteSelectedButton
        count={checked}
        label={labels.deleteSelected}
        confirmText={labels.confirmMany}
      />
    </form>
  );
}
