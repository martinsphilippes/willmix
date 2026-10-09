"use client";

import { useEffect } from "react";
import { Alert, type Tone } from "./ui";

export interface MissingItem {
  /** Chave do campo (data-field-anchor do campo na ficha). */
  key: string;
  label: string;
}

/** Leva até o campo: rola até ele, dá foco e pisca a borda. */
function goToField(key: string) {
  const el = document.querySelector<HTMLElement>(
    `[data-field-anchor~="${key}"]`,
  );
  if (!el) return false;
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  const target = el.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
  );
  window.setTimeout(
    () => target?.focus({ preventScroll: true }),
    reduce ? 0 : 350,
  );
  if (!reduce)
    el.animate?.(
      [
        { boxShadow: "0 0 0 4px rgba(239, 68, 68, 0.45)" },
        { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0)" },
      ],
      { duration: 1400, easing: "ease-out" },
    );
  return true;
}

/**
 * Aviso "faltam: …" da ficha com cada campo clicável: um clique leva até o
 * campo (rola, dá foco e destaca). Logo depois de salvar com pendências
 * (`autoFocus`), já leva até o primeiro que falta.
 */
export function MissingFields({
  before,
  after,
  items,
  hint,
  tone = "warning",
  autoFocus = false,
}: {
  /** Texto antes e depois da lista (da tradução com {fields}). */
  before: string;
  after: string;
  items: MissingItem[];
  /** Instrução curta (ex.: "Toque em um item para ir até ele."). */
  hint?: string;
  tone?: Tone;
  autoFocus?: boolean;
}) {
  const first = items[0]?.key;
  useEffect(() => {
    if (!autoFocus || !first) return;
    // Depois do primeiro desenho (e do salto para a âncora da seção). A
    // limpeza cancela o salto se o aviso sair da tela antes.
    const id = window.setTimeout(() => goToField(first), 200);
    return () => window.clearTimeout(id);
  }, [autoFocus, first]);
  if (!items.length) return null;
  return (
    <Alert tone={tone}>
      <p data-missing-fields={items.map((i) => i.key).join(" ")}>
        {before}
        {items.map((item, i) => (
          <span key={item.key}>
            {i > 0 ? ", " : null}
            <button
              type="button"
              onClick={() => goToField(item.key)}
              className="font-semibold underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-1"
              data-missing-field={item.key}
            >
              {item.label}
            </button>
          </span>
        ))}
        {after}
      </p>
      {hint ? <p className="mt-1 text-xs opacity-80">{hint}</p> : null}
    </Alert>
  );
}
