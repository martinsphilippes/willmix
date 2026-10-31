"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Table, Td, Th, cx, rowClass } from "./ui";
import {
  SHEET_REVEAL_EVENT,
  type SheetRevealDetail,
} from "@/lib/sheet-sections";
import type {
  SheetSectionKey,
  SheetSectionRow,
  SheetSectionsLabels,
} from "./sheet-sections-view";

/*
 * Tabela de blocos da ficha de compra: uma linha por bloco com o que falta em
 * vermelho. Tocar numa linha abre só aquele bloco embaixo (os outros somem);
 * "Mostrar tudo" volta a ficha inteira. O bloco de um campo que a página
 * precisa mostrar (aviso "faltam", campo inválido ao enviar) abre sozinho.
 *
 * Os blocos são os elementos `[data-sheet-section]` dentro de
 * `[data-sheet-sections-root]` (a grade da ficha); eles vêm do servidor e
 * aqui só se esconde/mostra. A escolha "tudo" fica no navegador da pessoa.
 */

const MODE_KEY = "wellmix:sheet-sections";
type Mode = "one" | "all";

/*
 * Modo lembrado no navegador, lido como "fonte externa": o servidor desenha
 * sempre "um bloco por vez" e o cliente assume o lembrado sem divergir na
 * hidratação.
 */
const listeners = new Set<() => void>();
function readMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === "all" ? "all" : "one";
  } catch {
    return "one";
  }
}
function writeMode(mode: Mode) {
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* navegador sem armazenamento: só não lembra */
  }
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const serverMode = (): Mode => "one";

export function SheetSectionsNav({
  sections,
  labels,
  initial,
}: {
  sections: SheetSectionRow[];
  labels: SheetSectionsLabels;
  /** Bloco aberto de início (o servidor já esconde os outros). */
  initial: SheetSectionKey;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mode = useSyncExternalStore(subscribe, readMode, serverMode);
  // Bloco aberto; nulo = todos recolhidos (tocar de novo no bloco aberto fecha).
  const [selected, setSelected] = useState<SheetSectionKey | null>(initial);
  // Mesma lista de pendências → mesmo efeito (não refaz à toa).
  const sectionsKey = sections
    .map((s) => `${s.key}:${s.missing.map((m) => m.key).join(",")}`)
    .join("|");

  const rootOf = () =>
    ref.current?.closest<HTMLElement>("[data-sheet-sections-root]") ?? document;

  /** Esconde/mostra os blocos conforme o modo; bloco sozinho ocupa a largura. */
  const apply = useCallback((m: Mode, s: SheetSectionKey | null) => {
    const root = rootOf();
    for (const el of root.querySelectorAll<HTMLElement>(
      "[data-sheet-section]",
    )) {
      const visible = m === "all" || el.dataset.sheetSection === s;
      el.hidden = !visible;
      el.classList.toggle("lg:col-span-2", m === "one");
    }
    if (root instanceof HTMLElement)
      root.setAttribute("data-sheet-sections-mode", m);
  }, []);

  /** Abre o bloco; `toggle`: tocar de novo no bloco aberto recolhe. */
  const choose = useCallback(
    (key: SheetSectionKey, toggle = false) => {
      const next = toggle && mode === "one" && selected === key ? null : key;
      setSelected(next);
      apply(mode, next);
    },
    [apply, mode, selected],
  );

  const toggleMode = () => {
    const next: Mode = mode === "all" ? "one" : "all";
    writeMode(next);
    apply(next, selected);
  };

  // Cada mudança no servidor (salvou, a lista do que falta mudou) refaz o
  // esconde/mostra por cima do que o React desenhou de novo.
  useEffect(() => {
    apply(mode, selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionsKey, mode]);

  // Pedido de abrir o bloco de um campo (aviso "faltam", rascunho) e campo
  // inválido ao enviar (o navegador não consegue focar o que está escondido).
  useEffect(() => {
    const root = rootOf();
    const openFor = (el: Element | null) => {
      const key = el?.closest<HTMLElement>("[data-sheet-section]")?.dataset
        .sheetSection as SheetSectionKey | undefined;
      if (key) choose(key);
    };
    const onReveal = (e: Event) => {
      const { key } = (e as CustomEvent<SheetRevealDetail>).detail ?? {};
      if (!key) return;
      openFor(root.querySelector(`[data-field-anchor~="${CSS.escape(key)}"]`));
    };
    const onInvalid = (e: Event) => openFor(e.target as Element);
    window.addEventListener(SHEET_REVEAL_EVENT, onReveal);
    root.addEventListener("invalid", onInvalid, true);
    return () => {
      window.removeEventListener(SHEET_REVEAL_EVENT, onReveal);
      root.removeEventListener("invalid", onInvalid, true);
    };
  }, [choose]);

  const pending = useMemo(
    () => sections.filter((s) => s.missing.length).length,
    [sections],
  );

  return (
    <div ref={ref} data-sheet-sections={pending} className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">{labels.hint}</p>
        <button
          type="button"
          onClick={toggleMode}
          data-sheet-sections-mode={mode}
          className="rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {mode === "all" ? labels.showOne : labels.showAll}
        </button>
      </div>
      <Table>
        <thead>
          <tr>
            <Th className="w-56">{labels.section}</Th>
            <Th>{labels.status}</Th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => {
            const active = mode === "one" && selected === s.key && !s.href;
            const label = s.href ? (
              <a
                href={s.href}
                className="font-medium text-zinc-900 underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                {s.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => choose(s.key, true)}
                aria-current={active ? "true" : undefined}
                aria-expanded={s.href ? undefined : active}
                className="font-medium text-zinc-900 underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                {s.label}
              </button>
            );
            return (
              <tr
                key={s.key}
                data-sheet-section-row={s.key}
                data-selected={active ? "true" : undefined}
                onClick={(e) => {
                  if (s.href) return;
                  // Toque na linha vale como no nome (o botão já cuidou).
                  if ((e.target as HTMLElement).closest("button,a")) return;
                  choose(s.key, true);
                }}
                className={cx(
                  rowClass,
                  "cursor-pointer",
                  active && "bg-brand-50/70",
                )}
              >
                <Td className="whitespace-nowrap">{label}</Td>
                <Td>
                  {s.missing.length ? (
                    <span className="text-red-700">
                      {labels.missingBefore}
                      {s.missing.map((m, i) => (
                        <span key={m.key}>
                          {i > 0 ? ", " : null}
                          <span
                            data-missing-field={m.key}
                            className="font-semibold data-[done]:line-through data-[done]:opacity-60"
                          >
                            {m.label}
                          </span>
                        </span>
                      ))}
                      {labels.missingAfter}
                    </span>
                  ) : s.optional ? (
                    <span className="text-zinc-500">{labels.optional}</span>
                  ) : (
                    <span className="font-medium text-emerald-700">
                      ✓ {labels.complete}
                    </span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
