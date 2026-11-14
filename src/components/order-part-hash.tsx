"use client";

import { useEffect } from "react";

/**
 * Link com âncora (#production, #receiving…) para dentro de uma parte fechada
 * do pedido: abre a parte e rola até o ponto (ao carregar e ao trocar a âncora).
 */
export function OpenPartFromHash() {
  useEffect(() => {
    const reveal = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const target = document.getElementById(id);
      const part = target?.closest<HTMLDetailsElement>(
        "details[data-order-collapse]",
      );
      if (!target || !part || part.open) return;
      part.open = true;
      target.scrollIntoView({ block: "start" });
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return null;
}
