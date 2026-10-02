"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Barra de progresso no topo ao clicar em qualquer link interno ou enviar um formulário: a tela responde
 * na hora, enquanto a próxima página chega. Some quando a rota muda. Não usa
 * Suspense (loading.tsx), para as páginas manterem o código de resposta (404).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // A barra pertence à rota em que o clique aconteceu: mudou a rota, ela some.
  const route = `${pathname}?${searchParams.toString()}`;
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const active = startedAt === route;

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest?.("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api/")) return;
      const here = window.location;
      if (url.pathname === here.pathname && url.search === here.search) return;
      setStartedAt(
        `${here.pathname}?${new URLSearchParams(here.search).toString()}`,
      );
    }
    // Envio de formulário (ação no servidor ou filtro): a barra aparece na hora e
    // some quando a rota muda ou o botão avisa que terminou (wellmix:form-done).
    // Não olha defaultPrevented: o React cancela o envio nativo das Server Actions.
    function onSubmit() {
      const here = window.location;
      setStartedAt(
        `${here.pathname}?${new URLSearchParams(here.search).toString()}`,
      );
    }
    function onDone() {
      setStartedAt(null);
    }
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("wellmix:form-done", onDone);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("wellmix:form-done", onDone);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    // Segurança: se a navegação não acontecer, a barra some sozinha.
    const timer = setTimeout(() => setStartedAt(null), 15_000);
    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-white/30"
    >
      <div className="h-full w-1/3 animate-[loading_1.1s_ease-in-out_infinite] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
    </div>
  );
}
