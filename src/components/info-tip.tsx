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
 *
 * `interactive` (dono, 20/11/2026; o botão que resolve a pendência no
 * balão "Quem pode agir"): o balão tem campos e botões. Vira um diálogo, o
 * toque ou o foco dentro dele o prende aberto (o mouse saindo não fecha) e,
 * depois de aberto, fica montado escondido: fechar e abrir de novo não perde
 * o que foi digitado nem a resposta (o login criado).
 */
export function InfoTip({
  label,
  children,
  trigger,
  className,
  bubbleClassName,
  interactive = false,
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
  /** O balão tem campos ou botões (diálogo, não dica). */
  interactive?: boolean;
} & { [key: `data-${string}`]: string | undefined }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Interativo, depois da 1ª abertura: o balão fica montado (escondido).
  const [kept, setKept] = useState(false);
  // Aberto pelo clique (toque ou teclado): o mouse saindo não fecha.
  const pinned = useRef(false);
  // Aberto pelo teclado (interativo): o foco entra no balão.
  const focusInside = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(() => {
    setOpen(true);
    if (interactive) setKept(true);
  }, [interactive]);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const close = useCallback(() => {
    clear();
    pinned.current = false;
    setOpen(false);
  }, []);

  /*
   * Posição do balão na parte visível da tela (a `visualViewport`: no iPad
   * em janela menor ou com o teclado aberto ela é menor que a janela).
   * Embaixo do botão; sem espaço, em cima; sem espaço nos dois lados (o
   * formulário do login do cliente numa tela baixa; dono, 20/11/2026), o
   * balão ocupa a altura visível e rola por dentro. Antes ele passava do
   * fim da tela e, por ser fixo, o resto não aparecia.
   */
  const place = useCallback(() => {
    const anchor = button.current;
    const box = bubble.current;
    if (!anchor || !box) return;
    const view = window.visualViewport;
    const viewWidth = view?.width ?? window.innerWidth;
    const viewHeight = view?.height ?? window.innerHeight;
    const viewTop = view?.offsetTop ?? 0;
    const viewLeft = view?.offsetLeft ?? 0;
    const edge = 8;
    const gap = 6;
    const r = anchor.getBoundingClientRect();
    const width = Math.min(box.offsetWidth || 288, viewWidth - 2 * edge);
    const left = Math.min(
      Math.max(viewLeft + edge, r.left + r.width / 2 - width / 2),
      viewLeft + viewWidth - width - edge,
    );
    // Altura do conteúdo inteiro (mesmo com o limite já aplicado) e bordas.
    const height = box.scrollHeight + (box.offsetHeight - box.clientHeight);
    const below = viewTop + viewHeight - edge - (r.bottom + gap);
    const above = r.top - gap - (viewTop + edge);
    let top: number;
    let maxHeight = "";
    if (height <= below) top = r.bottom + gap;
    else if (height <= above) top = r.top - gap - height;
    else {
      top = viewTop + edge;
      maxHeight = `${Math.round(viewHeight - 2 * edge)}px`;
    }
    box.style.maxHeight = maxHeight;
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
    if (focusInside.current) {
      focusInside.current = false;
      box.focus();
    }
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
    // A rolagem de dentro do balão não o reposiciona (ela continua onde
    // está); a da página, da tabela e da tela visível, sim.
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && box.contains(e.target)) return;
      place();
    };
    const view = window.visualViewport;
    // O conteúdo muda de tamanho (erro, login criado): cabe de novo.
    const resized =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    resized?.observe(box);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", onScroll, true);
    view?.addEventListener("resize", place);
    view?.addEventListener("scroll", place);
    return () => {
      resized?.disconnect();
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", onScroll, true);
      view?.removeEventListener("resize", place);
      view?.removeEventListener("scroll", place);
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
    timer.current = setTimeout(show, 120);
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
        aria-haspopup={interactive ? "dialog" : undefined}
        aria-controls={open ? id : undefined}
        aria-describedby={open && !interactive ? id : undefined}
        title={trigger ? label : undefined}
        data-table-hint=""
        onClick={(e) => {
          clear();
          if (open && pinned.current) close();
          else {
            pinned.current = true;
            // Enter ou Espaço (clique sem ponteiro): o foco vai para o balão.
            if (interactive && e.detail === 0) focusInside.current = true;
            show();
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
      {open || kept
        ? createPortal(
            <div
              ref={bubble}
              id={id}
              role={interactive ? "dialog" : "tooltip"}
              aria-label={interactive ? label : undefined}
              tabIndex={interactive ? -1 : undefined}
              hidden={!open}
              popover="manual"
              data-info-tip=""
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") clear();
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "mouse") hoverClose();
              }}
              // Mexeu dentro (campo, botão): fica aberto até fechar de propósito.
              onPointerDown={
                interactive
                  ? () => {
                      clear();
                      pinned.current = true;
                    }
                  : undefined
              }
              onFocus={
                interactive
                  ? () => {
                      clear();
                      pinned.current = true;
                    }
                  : undefined
              }
              className={cx(
                // Com o limite de altura (tela baixa), rola por dentro.
                "fixed inset-auto z-[1000] m-0 w-max max-w-[min(20rem,calc(100vw-1rem))] overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-white p-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-zinc-700 shadow-lg",
                interactive && "focus:outline-none",
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
