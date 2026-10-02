"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui";
import { fetchFxNowAction } from "@/app/app/actions/fx";

/*
 * Campo do câmbio manual com o botão "Buscar agora": busca a cotação do dia
 * (PTAX ou AwesomeAPI), preenche o campo e mostra a fonte e a hora. O valor
 * só é gravado ao salvar as Configurações; a cotação buscada já fica valendo.
 */
export function FxManualField({
  currency,
  defaultValue,
  labels,
}: {
  currency: "USD" | "RMB" | "EUR";
  defaultValue: number | null;
  labels: {
    label: string;
    fetch: string;
    fetching: string;
    from: string;
    sourcePtax: string;
    sourceAwesome: string;
    error: string;
  };
}) {
  const input = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const id = `fx-${currency}`;

  function fetchNow() {
    start(async () => {
      const result = await fetchFxNowAction();
      const rate = result.ok ? result.rates[currency] : undefined;
      if (!result.ok || !rate) {
        setNote({ text: labels.error, ok: false });
        return;
      }
      if (input.current) input.current.value = rate.toFixed(4);
      setNote({
        text: labels.from
          .replace(
            "{source}",
            result.source === "awesomeapi"
              ? labels.sourceAwesome
              : labels.sourcePtax,
          )
          .replace("{when}", result.quotedAt[currency] ?? ""),
        ok: true,
      });
      router.refresh();
    });
  }

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-zinc-800"
      >
        {labels.label}
      </label>
      <div className="flex gap-2">
        <input
          ref={input}
          id={id}
          name={`fxManualRates.${currency}`}
          type="number"
          step="0.0001"
          min="0"
          defaultValue={defaultValue ?? ""}
          className={`${inputClass} min-w-24 flex-1`}
        />
        <button
          type="button"
          onClick={fetchNow}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 text-sm font-medium text-brand-700 shadow-sm transition hover:bg-brand-50 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? (
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
          ) : null}
          {pending ? labels.fetching : labels.fetch}
        </button>
      </div>
      {note ? (
        <p
          role="status"
          className={`mt-1 text-xs ${note.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
