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
        // Formulário dentro de um <details> fechado (ex.: "Nova multa"): abre.
        for (
          let d = el.closest("details");
          d;
          d = d.parentElement?.closest("details") ?? null
        )
          d.open = true;
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

const LAST_SUBMIT = "wellmix:last-submit";

/**
 * Lembra qual formulário da página foi enviado (posição na página): a volta
 * com erro procura o campo nele primeiro (a mesma tela pode ter "price" em
 * dois formulários). Um ouvinte para o app inteiro.
 */
export function SubmitTracker() {
  useEffect(() => {
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      try {
        sessionStorage.setItem(
          LAST_SUBMIT,
          JSON.stringify({
            path: location.pathname,
            index: Array.from(document.forms).indexOf(form),
            at: Date.now(),
          }),
        );
      } catch {
        // Sem armazenamento: procura na página inteira.
      }
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);
  return null;
}

/** Formulário enviado há pouco nesta mesma tela, se se sabe. */
function submittedForm(): HTMLFormElement | null {
  try {
    const raw = sessionStorage.getItem(LAST_SUBMIT);
    if (!raw) return null;
    const last = JSON.parse(raw) as {
      path?: string;
      index?: number;
      at?: number;
    };
    if (last.path !== location.pathname) return null;
    if (!last.at || Date.now() - last.at > 5 * 60 * 1000) return null;
    return typeof last.index === "number"
      ? (document.forms[last.index] ?? null)
      : null;
  } catch {
    return null;
  }
}

/** O campo visível com esse nome (o dinheiro visível usa data-money). */
function findField(name: string): Field | null {
  const usable = (el: Element): el is Field =>
    (el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    !(el instanceof HTMLInputElement && el.type === "hidden") &&
    !el.disabled;
  const esc = CSS.escape(name);
  const matches = (el: Element) =>
    el.getAttribute("name") === name || el.getAttribute("data-money") === name;
  const form = submittedForm();
  const inForm = form ? Array.from(form.elements).filter(matches) : [];
  const candidates = [
    ...inForm,
    ...Array.from(
      document.querySelectorAll(`[name="${esc}"], [data-money="${esc}"]`),
    ),
  ].filter(usable);
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
  // O texto do rótulo (sem asterisco, ajuda, símbolo de moeda ou opções de
  // uma lista dentro do <label>).
  const marked = (root: Element | null | undefined) =>
    root?.matches?.("[data-field-label]")
      ? clean((root as HTMLElement).innerText)
      : clean(
          root?.querySelector<HTMLElement>("[data-field-label]")?.innerText,
        );
  const label = el.labels?.[0];
  const fromMarker = marked(label) || marked(el.closest("[data-field-row]"));
  if (fromMarker) return fromMarker;
  const fromLabel = clean(label?.innerText.split("\n")[0]);
  if (fromLabel) return fromLabel;
  const aria = clean(el.getAttribute("aria-label"));
  if (aria) return aria;
  // Placeholder só quando é palavra ("Prazo"), não um exemplo ("0,00").
  const hint = clean(el.getAttribute("placeholder"));
  if (hint && !/^[\d\s.,%-]+$/.test(hint)) return hint;
  return name;
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
