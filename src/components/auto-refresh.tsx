"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Atualiza a tela sozinha enquanto algo termina no servidor (ex.: a escolha
 * aprovada sendo gravada): busca os dados de novo a cada `everyMs`, sem perder
 * a posição da página. Some junto com o trecho que o mostra, então para quando
 * o servidor termina. Não atualiza com a aba em segundo plano.
 */
export function AutoRefresh({ everyMs = 3000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [router, everyMs]);
  return null;
}
