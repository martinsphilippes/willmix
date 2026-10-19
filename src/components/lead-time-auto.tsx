"use client";

import { useEffect, useState } from "react";
import { parseNumberInput } from "@/lib/number-input";
import { LOT1_INTERVAL_EVENT } from "@/lib/services/purchase-sheet-calc";

/**
 * Prazo de produção da cotação, só para leitura: é o "Saída em (dias)" da
 * programação 1 (dias entre o início da produção e a saída da 1ª remessa).
 * Acompanha a programação ao vivo (digitada ou gerada), sem esperar salvar.
 * O `id` vem do rótulo do campo (FieldRow): o valor fica num <output>, que o
 * rótulo nomeia e o leitor de tela anuncia quando muda.
 */
export function LeadTimeAuto({
  id,
  initial,
  labels,
}: {
  id?: string;
  initial: number | null;
  labels: { days: string; pending: string; hint: string };
}) {
  const [days, setDays] = useState<number | null>(initial);

  useEffect(() => {
    // Mesma regra do servidor (leadTimeFromLots): inteiro a partir de 0.
    const read = (raw: string) => {
      const n = parseNumberInput(raw, { int: true });
      setDays(n !== null && Number.isInteger(n) && n >= 0 ? n : null);
    };
    const onChange = (e: Event) => read(String((e as CustomEvent).detail));
    document.addEventListener(LOT1_INTERVAL_EVENT, onChange);
    // O que já está na tela (ex.: rascunho restaurado antes de montar).
    const input = document.querySelector<HTMLInputElement>(
      'input[name="lot1Interval"]',
    );
    if (input) read(input.value);
    return () => document.removeEventListener(LOT1_INTERVAL_EVENT, onChange);
  }, []);

  return (
    <div className="text-sm" data-lead-time-auto={days ?? ""}>
      <output
        id={id}
        aria-live="polite"
        className={
          days !== null
            ? "block font-semibold tabular-nums text-zinc-900"
            : "block font-medium text-amber-700"
        }
      >
        {days !== null
          ? labels.days.replace("{days}", String(days))
          : labels.pending}
      </output>
      <p className="text-xs text-zinc-500">{labels.hint}</p>
    </div>
  );
}
