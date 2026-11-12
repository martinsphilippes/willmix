"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "./ui";

type StepResult =
  | { state: "idle" }
  | {
      state: "running";
      processed: number;
      total: number;
      startedAt: string;
      busy: boolean;
    }
  | { state: "done"; marker: unknown }
  | { state: "error"; detail: string };

/**
 * Reconstrução dos resumos em partes (docs/RESUMOS.md): com a tela aberta,
 * pede uma rodada atrás da outra até terminar e mostra quantos pedidos já
 * foram. Fechou a tela: a reconstrução fica parada onde estava e continua na
 * próxima abertura ou no job noturno.
 */
export function SummaryRebuildProgress({
  processed: initialProcessed,
  total: initialTotal,
  step,
  done,
  labels,
}: {
  processed: number;
  total: number;
  step: () => Promise<StepResult>;
  /** Para onde ir ao terminar. */
  done: string;
  /** Textos já traduzidos; `{processed}`, `{total}` e `{detail}` são trocados aqui. */
  labels: {
    progress: string;
    busy: string;
    error: string;
    retry: string;
  };
}) {
  const router = useRouter();
  const [processed, setProcessed] = useState(initialProcessed);
  const [total, setTotal] = useState(initialTotal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      let result: StepResult;
      try {
        result = await step();
      } catch (e) {
        result = { state: "error", detail: String((e as Error).message ?? e) };
      }
      if (!alive.current) return;
      if (result.state === "running") {
        setProcessed(result.processed);
        setTotal(result.total);
        setBusy(result.busy);
        // Outra rodada trabalhando (outra aba ou o job): espera um pouco.
        timer = setTimeout(tick, result.busy ? 5000 : 0);
      } else if (result.state === "error") {
        setError(result.detail);
      } else if (result.state === "done") {
        router.replace(done);
      } else {
        router.refresh();
      }
    };
    void tick();
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [run, step, done, router]);

  const pct = total ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return (
    <div className="space-y-2" data-summaries-running>
      <p className="text-sm text-zinc-700">
        {labels.progress
          .replace("{processed}", processed.toLocaleString())
          .replace("{total}", total.toLocaleString())}
      </p>
      <div
        className="h-2 w-full overflow-hidden rounded bg-zinc-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full bg-emerald-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {busy ? <p className="text-xs text-zinc-500">{labels.busy}</p> : null}
      {error ? (
        <>
          <Alert tone="danger">{labels.error.replace("{detail}", error)}</Alert>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setError(null);
              setRun((n) => n + 1);
            }}
          >
            {labels.retry}
          </Button>
        </>
      ) : null}
    </div>
  );
}
