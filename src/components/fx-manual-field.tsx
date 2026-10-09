"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/components/ui";
import { fetchFxNowAction } from "@/app/app/actions/fx";

type Currency = "USD" | "RMB" | "EUR";
const CURRENCIES: Currency[] = ["USD", "RMB", "EUR"];

/*
 * Câmbio em Configurações: os três campos (USD, RMB, EUR → R$) e um botão
 * "Buscar cotações" que consulta a cotação do dia (PTAX, AwesomeAPI ou BCE) e
 * preenche os três de uma vez, mostrando a fonte e a hora. A cotação buscada já
 * fica valendo; os campos são gravados ao salvar as Configurações.
 */
export function FxManualFields({
  defaults,
  labels,
}: {
  defaults: Record<Currency, number | null>;
  labels: {
    fetch: string;
    fetching: string;
    from: string;
    sourcePtax: string;
    sourceAwesome: string;
    sourceEcb: string;
    error: string;
  };
}) {
  const inputs = useRef<Partial<Record<Currency, HTMLInputElement | null>>>({});
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function fetchNow() {
    start(async () => {
      const result = await fetchFxNowAction();
      if (!result.ok) {
        const why = result.reason ? ` (${result.reason})` : "";
        setNote({ text: `${labels.error}${why}`, ok: false });
        return;
      }
      for (const c of CURRENCIES) {
        const rate = result.rates[c];
        const input = inputs.current[c];
        if (rate && input) input.value = rate.toFixed(4);
      }
      const source =
        result.source === "awesomeapi"
          ? labels.sourceAwesome
          : result.source === "ecb"
            ? labels.sourceEcb
            : labels.sourcePtax;
      setNote({
        text: labels.from
          .replace("{source}", source)
          .replace("{when}", result.quotedAt.USD ?? ""),
        ok: true,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {/* Três cotações numa linha, cada campo do tamanho de um número. */}
      <div className="grid max-w-md gap-2 @2xs:grid-cols-3">
        {CURRENCIES.map((c) => (
          <div key={c} className="min-w-0">
            <label
              htmlFor={`fx-${c}`}
              className="mb-1 block text-xs font-medium leading-5 text-zinc-700"
            >
              {c} → R$
            </label>
            <input
              ref={(el) => {
                inputs.current[c] = el;
              }}
              id={`fx-${c}`}
              name={`fxManualRates.${c}`}
              type="number"
              step="any"
              min="0"
              defaultValue={defaults[c] ?? ""}
              className={inputClass}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={fetchNow}
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-brand-200 bg-white px-3 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? (
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
          ) : null}
          {pending ? labels.fetching : labels.fetch}
        </button>
        {note ? (
          <p
            role="status"
            className={`text-xs ${note.ok ? "text-emerald-700" : "text-red-700"}`}
          >
            {note.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
