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
    // Marca que o envio automático já está ligado: antes disto (página ainda
    // carregando) mudar o filtro não envia. Os testes esperam por esta marca.
    const span = marker.current;
    span?.setAttribute("data-auto-submit-ready", "");
    return () => {
      form.removeEventListener("change", onChange);
      span?.removeAttribute("data-auto-submit-ready");
    };
  }, []);
  return <span ref={marker} hidden />;
}
