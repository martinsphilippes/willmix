"use client";

import { useEffect } from "react";

/**
 * Nova solicitação (dono, 19/11/2026): Enter num campo e Enter ou espaço
 * com o foco num botão de envio ("Enviar", "Salvar rascunho") não mandam a
 * solicitação; só o clique (mouse ou toque) envia. O navegador dispara o
 * envio pelo teclado como um clique sem contagem (`detail === 0`) no botão
 * de envio, que é o que se segura aqui.
 */
export function KeyboardSubmitGuard({ formId }: { formId: string }) {
  useEffect(() => {
    const guard = (event: MouseEvent) => {
      if (event.detail !== 0) return;
      const target = event.target as HTMLElement | null;
      const button = target?.closest?.(
        'button[type="submit"], button:not([type]), input[type="submit"]',
      ) as HTMLButtonElement | HTMLInputElement | null;
      if (!button || button.form?.id !== formId) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [formId]);
  return null;
}
