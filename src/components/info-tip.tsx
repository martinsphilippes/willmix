"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./ui";

/*
 * Informação complementar acessível por mouse, toque e teclado (dono,
 * 19/11/2026; Encomendas, docs/ORDER_LEVEL_LISTS.md, seção 6): um botão que
 * abre um balão com a explicação. O mouse abre ao passar; o toque e o
 * teclado (Enter ou Espaço) abrem e fecham; Esc e o toque fora fecham.
 *
 * O balão vai para a camada do topo do navegador (popover), fora da tabela:
 * não é cortado pela rolagem lateral e o texto dele não entra na busca nem
 * na ordenação da TableTools. O botão leva `data-table-hint`: clicar nele
 * não ordena a coluna (src/components/table-tools.tsx).
 */
export function InfoTip({
  label,
  children,
  trigger,
  className,
  bubbleClassName,
  ...rest
}: {
  /** Nome acessível do botão (sem `trigger`, é o único texto dele). */
  label: string;
  /** O conteúdo do balão. */
  children: ReactNode;
  /** Conteúdo visível do botão; sem ele, o ícone "i". */
  trigger?: ReactNode;
  className?: string;
  bubbleClassName?: string;
} & { [key: `data-${string}`]: string | undefined }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Aberto pelo clique (toque ou teclado): o mouse saindo não fecha.
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const close = useCallback(() => {
    clear();
    pinned.current = false;
    setOpen(false);
  }, []);

  const place = useCallback(() => {
    const anchor = button.current;
    const box = bubble.current;
    if (!anchor || !box) return;
    const r = anchor.getBoundingClientRect();
    const width = Math.min(box.offsetWidth || 288, window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    const below = r.bottom + 6;
    const height = box.offsetHeight;
    const top =
      below + height > window.innerHeight - 8 && r.top - height - 6 > 8
        ? r.top - height - 6
        : below;
    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(top)}px`;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const box = bubble.current;
    if (!box) return;
    try {
      box.showPopover?.();
    } catch {
      // Sem popover: fica como camada fixa (z-index alto).
    }
    place();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (button.current?.contains(target) || box.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      try {
        box.hidePopover?.();
      } catch {
        // já estava fechado
      }
    };
  }, [open, place, close]);

  useEffect(() => clear, []);

  const hoverOpen = () => {
    clear();
    timer.current = setTimeout(() => setOpen(true), 120);
  };
  const hoverClose = () => {
    clear();
    if (pinned.current) return;
    timer.current = setTimeout(() => setOpen(false), 180);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={trigger ? undefined : label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        title={trigger ? label : undefined}
        data-table-hint=""
        onClick={() => {
          clear();
          if (open && pinned.current) close();
          else {
            pinned.current = true;
            setOpen(true);
          }
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") hoverOpen();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") hoverClose();
        }}
        className={cx(
          trigger
            ? "cursor-help rounded text-left underline decoration-zinc-300 decoration-dotted underline-offset-2 hover:decoration-zinc-500"
            : "inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full align-[-2px] text-zinc-400 hover:text-zinc-700",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
          className,
        )}
        {...rest}
      >
        {trigger ?? (
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 7.2v3.8M8 4.8v.2" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {/* Só abre depois de um clique ou do mouse: o documento já existe. */}
      {open
        ? createPortal(
            <div
              ref={bubble}
              id={id}
              role="tooltip"
              popover="manual"
              data-info-tip=""
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") clear();
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") hoverClose();
              }}
              className={cx(
                "fixed inset-auto z-[1000] m-0 w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-zinc-200 bg-white p-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-zinc-700 shadow-lg",
                bubbleClassName,
              )}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
