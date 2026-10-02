"use client";

import { useEffect } from "react";

/*
 * Campos numéricos: ao entrar no campo (clique, toque ou Tab), o valor fica
 * todo selecionado; o que se digita substitui o valor (ex.: margem "0" vira
 * "10", e não "010"). Um só ouvinte para o app inteiro, sem mexer em cada tela.
 */
function isNumeric(el: EventTarget | null): el is HTMLInputElement {
  if (!(el instanceof HTMLInputElement) || el.readOnly || el.disabled)
    return false;
  return (
    el.type === "number" ||
    el.inputMode === "decimal" ||
    el.inputMode === "numeric"
  );
}

export function SelectOnFocus() {
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const el = event.target;
      if (!isNumeric(el) || !el.value) return;
      // Depois do clique: senão o navegador põe o cursor e desfaz a seleção.
      requestAnimationFrame(() => {
        if (document.activeElement === el) el.select();
      });
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);
  return null;
}
