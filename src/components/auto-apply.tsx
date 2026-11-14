"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Formulário de filtros (GET) que se aplica sozinho, sem recarregar a página
 * nem perder a rolagem: mudar uma lista ou uma caixa aplica na hora; digitar
 * num campo de texto aplica na pausa da digitação. O botão do formulário
 * continua valendo (inclusive sem JavaScript, como envio normal). O resultado
 * fica no endereço, como antes.
 */
export function AutoApply({ delayMs = 350 }: { delayMs?: number }) {
  const marker = useRef<HTMLSpanElement>(null);
  const router = useRouter();
  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form)) {
        if (typeof value !== "string") continue;
        const text = value.trim();
        if (text) params.append(key, text);
      }
      const path = form.getAttribute("action") || window.location.pathname;
      const query = params.toString();
      const next = query ? `${path}?${query}` : path;
      if (next === window.location.pathname + window.location.search) return;
      router.replace(next, { scroll: false });
    };
    const onChange = (event: Event) => {
      const el = event.target as HTMLInputElement | null;
      // Campo sem nome (ex.: a busca de um seletor) não é filtro.
      if (!el?.name) return;
      // Texto: espera a pausa (evento "input"); o resto aplica já.
      if (el.type === "text" || el.type === "search") return;
      clearTimeout(timer);
      apply();
    };
    const onInput = (event: Event) => {
      const el = event.target as HTMLInputElement | null;
      if (!el?.name || (el.type !== "text" && el.type !== "search")) return;
      clearTimeout(timer);
      timer = setTimeout(apply, delayMs);
    };
    const onSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      clearTimeout(timer);
      apply();
    };
    form.addEventListener("change", onChange);
    form.addEventListener("input", onInput);
    form.addEventListener("submit", onSubmit);
    // Ligado: os testes esperam por esta marca antes de mexer nos filtros.
    form.setAttribute("data-auto-apply-ready", "");
    return () => {
      clearTimeout(timer);
      form.removeEventListener("change", onChange);
      form.removeEventListener("input", onInput);
      form.removeEventListener("submit", onSubmit);
      form.removeAttribute("data-auto-apply-ready");
    };
  }, [router, delayMs]);
  return <span ref={marker} hidden data-auto-apply />;
}
