import type { ReactNode } from "react";
import type { TranslationDisplay } from "@/lib/message-translation";
import { cx } from "./ui";

/*
 * Linha da tradução automática embaixo de uma mensagem (tela de Mensagens e
 * painel lateral): "Traduzido automaticamente do chinês · Ver original",
 * "Traduzindo…" ou o botão "Traduzir"/"Tentar de novo" (o botão vem de quem
 * usa: formulário na tela, clique no painel). Sem estado próprio: serve ao
 * servidor e ao navegador.
 */

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cx("inline-block h-3.5 w-3.5 shrink-0", className)}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export function MessageTranslationNote({
  tr,
  mine,
  retry,
}: {
  tr: TranslationDisplay;
  mine: boolean;
  /** Botão "Traduzir"/"Tentar de novo" (quando `tr.retry`). */
  retry?: ReactNode;
}) {
  const tone = mine
    ? "text-white/85"
    : tr.tone === "warn"
      ? "text-amber-700"
      : "text-zinc-500";
  const note = tr.note ? (
    <span className="inline-flex items-center gap-1">
      <GlobeIcon />
      {tr.note}
    </span>
  ) : null;
  if (tr.details)
    return (
      <details
        className={cx("mt-1 text-[11px]", tone)}
        data-translation={tr.state}
      >
        <summary className="inline-flex cursor-pointer list-none flex-wrap items-center gap-x-1.5 [&::-webkit-details-marker]:hidden">
          {note}
          <span
            className="font-semibold underline underline-offset-2"
            data-translation-toggle
          >
            {tr.details.label}
          </span>
        </summary>
        <div
          className={cx(
            "mt-1 space-y-1 whitespace-pre-wrap break-words rounded-lg px-2 py-1.5 text-xs",
            mine ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-700",
          )}
          data-translation-details
        >
          {tr.details.items.map((item, i) => (
            <p key={i}>
              {item.label ? (
                <span className="font-semibold">{item.label}: </span>
              ) : null}
              {item.text}
            </p>
          ))}
        </div>
      </details>
    );
  return (
    <div
      className={cx(
        "mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]",
        tone,
      )}
      data-translation={tr.state}
    >
      {note}
      {tr.retry ? retry : null}
    </div>
  );
}
