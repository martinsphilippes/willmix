"use client";

import { useEffect } from "react";

/**
 * Endereços antigos (avisos e pendências já gravados) apontam para
 * `#decision-<id>` sem a aba: se a estratégia não está na aba aberta, abre
 * "Em andamento" no mesmo ponto (dono, 22/11/2026: uma aba por estágio).
 */
export function HashTab() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#decision-")) return;
    if (document.getElementById(hash.slice(1))) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") === "open") return;
    url.searchParams.set("tab", "open");
    window.location.replace(url.toString());
  }, []);
  return null;
}
