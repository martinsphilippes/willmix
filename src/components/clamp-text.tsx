"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cx } from "./ui";

/*
 * Texto longo numa célula compacta (dono, 19/11/2026; Encomendas): até duas
 * linhas e, quando o texto não cabe, o botão "mais" mostra o texto inteiro
 * (mouse, toque e teclado; "menos" volta). O texto completo também fica na
 * dica do mouse. O texto não muda: a busca e a ordem da tabela o leem igual.
 *
 * `lines={1}` (dono, 21/11/2026; Ficha técnica das respostas da Cotação de
 * compra): uma linha só, cortada com "…", e o "mais" ao lado, na mesma linha,
 * para a linha da tabela ficar fina. A célula precisa de uma largura máxima
 * (`className`, ex.: "max-w-[12rem]") para o corte acontecer.
 */
export function ClampText({
  text,
  more,
  less,
  className,
  lines = 2,
}: {
  text: string;
  /** "mais" */
  more: string;
  /** "menos" */
  less: string;
  className?: string;
  /** Linhas antes do "mais": 2 (padrão) ou 1. */
  lines?: 1 | 2;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);
  /** Uma linha: a largura de antes de abrir, para a coluna não encolher. */
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    // Duas linhas: sobra na altura; uma linha: sobra na largura.
    const measure = () =>
      setCut(
        el.scrollHeight > el.clientHeight + 1 ||
          el.scrollWidth > el.clientWidth + 1,
      );
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [text, open]);
  const toggle =
    cut || open ? (
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setWidth(open ? null : (boxRef.current?.offsetWidth ?? null));
          setOpen(!open);
        }}
        className={cx(
          "text-[11px] font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600",
          lines === 1 && "shrink-0",
        )}
        data-clamp-toggle=""
      >
        {open ? less : more}
      </button>
    ) : null;
  if (lines === 1)
    return (
      <span
        ref={boxRef}
        className={cx(
          open
            ? "block whitespace-normal"
            : "flex min-w-0 items-baseline gap-1",
          className,
        )}
        style={open && width ? { width } : undefined}
        data-clamp-lines="1"
      >
        <span
          ref={ref}
          title={text}
          className={cx(open ? "mr-1" : "min-w-0 truncate")}
        >
          {text}
        </span>
        {toggle}
      </span>
    );
  return (
    <span className={cx("block", className)}>
      <span
        ref={ref}
        title={text}
        className={cx("block", !open && "line-clamp-2")}
      >
        {text}
      </span>
      {toggle}
    </span>
  );
}
