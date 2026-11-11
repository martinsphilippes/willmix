"use client";

import { useEffect, useRef } from "react";

/**
 * Dentro de um formulário de filtros (GET): mudar uma lista ou uma caixa
 * marcada com `data-auto-submit` envia o formulário sozinho.
 */
export function AutoSubmit() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    const onChange = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-auto-submit]")) form.requestSubmit();
    };
    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);
  return <span ref={marker} hidden />;
}
