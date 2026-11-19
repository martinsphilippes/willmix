"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cx } from "./ui";

/*
 * Texto longo numa célula compacta (dono, 19/11/2026; Encomendas): até duas
 * linhas e, quando o texto não cabe, o botão "mais" mostra o texto inteiro
 * (mouse, toque e teclado; "menos" volta). O texto completo também fica na
 * dica do mouse. O texto não muda: a busca e a ordem da tabela o leem igual.
 */
export function ClampText({
  text,
  more,
  less,
  className,
}: {
  text: string;
  /** "mais" */
  more: string;
  /** "menos" */
  less: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const measure = () => setCut(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [text, open]);
  return (
    <span className={cx("block", className)}>
      <span
        ref={ref}
        title={text}
        className={cx("block", !open && "line-clamp-2")}
      >
        {text}
      </span>
      {cut || open ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
          data-clamp-toggle=""
        >
          {open ? less : more}
        </button>
      ) : null}
    </span>
  );
}
