"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Busca enquanto digita: colocado dentro de um formulário de busca (GET),
 * atualiza a lista sozinho a cada pausa na digitação, sem precisar apertar
 * "Buscar" (o botão continua valendo, inclusive sem JavaScript). O resultado
 * fica no endereço, como antes; a página (paginação) volta para o início.
 */
export function LiveSearch({
  field = "q",
  delayMs = 350,
}: {
  /** Nome do campo de texto que dispara a busca. */
  field?: string;
  delayMs?: number;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form)) {
        if (typeof value !== "string" || key === "page") continue;
        const text = value.trim();
        if (text) params.append(key, text);
      }
      const path = form.getAttribute("action") || window.location.pathname;
      const query = params.toString();
      const next = query ? `${path}?${query}` : path;
      // Nada mudou (ex.: só espaços): não busca de novo.
      if (next === window.location.pathname + window.location.search) return;
      router.replace(next, { scroll: false });
    };
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.name !== field) return;
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    };
    form.addEventListener("input", onInput);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", onInput);
    };
  }, [router, field, delayMs]);
  return <span ref={marker} hidden data-live-search />;
}
