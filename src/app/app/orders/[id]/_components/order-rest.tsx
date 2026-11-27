"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ORDER_REST_COOKIE } from "@/lib/order-rest";

/*
 * Tela do pedido até "Marcos do pedido" (dono, 27/11/2026): o restante fica
 * num quadro recolhido, aberto com um clique. Aberto, o cookie guarda o
 * pedido, e o restante continua aberto quando uma ação dele volta para a
 * tela (src/lib/order-rest.ts).
 */
export function OrderRest({
  orderId,
  open,
  label,
  hint,
  children,
}: {
  orderId: string;
  /** Aberto pelo cookie deste pedido. */
  open: boolean;
  label: string;
  hint: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const remember = () => {
    const opened = ref.current?.open ?? false;
    window.document.cookie = opened
      ? `${ORDER_REST_COOKIE}=${encodeURIComponent(orderId)}; path=/; samesite=lax`
      : `${ORDER_REST_COOKIE}=; path=/; max-age=0; samesite=lax`;
  };
  return (
    <details
      ref={ref}
      id="order-rest"
      open={open}
      onToggle={remember}
      className="group/rest mt-6 min-w-0 scroll-mt-24"
      data-order-rest=""
    >
      <summary
        className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 group-open/rest:mb-2 [&::-webkit-details-marker]:hidden"
        data-order-rest-toggle=""
      >
        <span className="flex flex-col">
          <span className="font-semibold text-brand-700">{label}</span>
          <span className="text-xs text-zinc-500">{hint}</span>
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="h-5 w-5 shrink-0 text-zinc-500 transition-transform group-open/rest:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </summary>
      {children}
    </details>
  );
}

/**
 * Âncora dentro de um quadro recolhido (o restante do pedido, a Venda ao
 * cliente, o Pagamento do cliente): o link de outra tela (#production,
 * #receiving, #customer-payment...) ou de um marco abre os quadros em volta
 * e rola até ela, ao abrir a página e a cada troca do "#".
 */
export function RevealHashTarget() {
  useEffect(() => {
    const reveal = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = window.document.getElementById(id);
      if (!target) return;
      let opened = false;
      for (
        let el: HTMLElement | null = target;
        el;
        el = el.parentElement
      ) {
        if (el instanceof HTMLDetailsElement && !el.open) {
          el.open = true;
          opened = true;
        }
      }
      if (opened) {
        window.requestAnimationFrame(() =>
          target.scrollIntoView({ block: "start" }),
        );
      }
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return null;
}
