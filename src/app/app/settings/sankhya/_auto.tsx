"use client";

import { useEffect } from "react";

/**
 * Carga completa "até o fim": quando a rodada anterior parou no limite de
 * tempo, envia de novo o formulário da mesma entidade, sozinho. Sair da
 * página (ou o link Parar) interrompe.
 */
export function AutoContinue({ formId }: { formId: string }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const form = document.getElementById(formId) as HTMLFormElement | null;
      form?.requestSubmit();
    }, 800);
    return () => clearTimeout(timer);
  }, [formId]);
  return null;
}
