"use client";

import { useEffect, useState } from "react";
import { Alert } from "./ui";

/*
 * "Algum campo tem valor inválido" dizendo QUAL: a volta de um envio recusado
 * traz os nomes dos campos (?fields=…); aqui cada um é achado na tela pelo
 * nome, aparece com o rótulo que a pessoa vê, fica com a borda vermelha e um
 * clique leva até ele (o primeiro já recebe o foco). Campo que não está na
 * tela: fica o aviso geral.
 */
type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

interface Found {
  name: string;
  label: string;
}

export function FieldErrors({
  names,
  before,
  fallback,
  hint,
  token,
}: {
  /** Nomes dos campos recusados (atributo name do formulário). */
  names: string[];
  /** Texto antes da lista ("Confira: "). */
  before: string;
  /** Aviso geral (enquanto procura, ou se nenhum campo está na tela). */
  fallback: string;
  hint: string;
  /** Muda a cada envio: remonta e leva de novo ao primeiro campo. */
  token?: string;
}) {
  const [found, setFound] = useState<Found[] | null>(null);
  const key = names.join(",");

  // Depois da hidratação (os campos já estão na tela): acha, marca e leva
  // até o primeiro.
  useEffect(() => {
    let focus = 0;
    const find = window.setTimeout(() => {
      const list: Found[] = [];
      for (const name of key.split(",").filter(Boolean)) {
        const el = findField(name);
        if (!el) continue;
        el.setAttribute("aria-invalid", "true");
        el.classList.add("ring-2", "ring-red-400");
        const clear = () => {
          el.removeAttribute("aria-invalid");
          el.classList.remove("ring-2", "ring-red-400");
        };
        el.addEventListener("input", clear, { once: true });
        list.push({ name, label: labelOf(el, name) });
      }
      setFound(list);
      const first = list[0]?.name;
      if (first) focus = window.setTimeout(() => goTo(first), 150);
    }, 50);
    return () => {
      window.clearTimeout(find);
      window.clearTimeout(focus);
    };
  }, [key, token]);

  if (!found || !found.length) return <Alert tone="danger">{fallback}</Alert>;
  return (
    <Alert tone="danger">
      <p data-field-errors={found.map((f) => f.name).join(" ")}>
        {before}
        {found.map((f, i) => (
          <span key={f.name}>
            {i > 0 ? ", " : null}
            <button
              type="button"
              onClick={() => goTo(f.name)}
              className="font-semibold underline underline-offset-2"
            >
              {f.label}
            </button>
          </span>
        ))}
        .
      </p>
      <p className="mt-0.5 text-xs opacity-80">{hint}</p>
    </Alert>
  );
}

/** O campo visível com esse nome (o dinheiro visível usa data-money). */
function findField(name: string): Field | null {
  const sel = (q: string) =>
    Array.from(document.querySelectorAll<Field>(q)).filter(
      (el) =>
        !(el instanceof HTMLInputElement && el.type === "hidden") &&
        !el.disabled,
    );
  const esc = CSS.escape(name);
  const candidates = [
    ...sel(`[name="${esc}"]`),
    ...sel(`[data-money="${esc}"]`),
  ];
  return (
    candidates.find((el) => el.offsetParent !== null) ?? candidates[0] ?? null
  );
}

function labelOf(el: Field, name: string): string {
  const clean = (s: string | null | undefined) =>
    (s ?? "")
      .replace(/\s*\*\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  const fromLabel = clean(el.labels?.[0]?.innerText);
  if (fromLabel) return fromLabel;
  const row = el.closest("[data-field-row]");
  const rowLabel = clean(
    row?.querySelector<HTMLElement>("label, [data-field-label], legend")
      ?.innerText,
  );
  if (rowLabel) return rowLabel;
  return (
    clean(el.getAttribute("aria-label")) ||
    clean(el.getAttribute("placeholder")) ||
    name
  );
}

function goTo(name: string) {
  const el = findField(name);
  if (!el) return;
  const reduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  window.setTimeout(() => el.focus({ preventScroll: true }), reduce ? 0 : 350);
}
