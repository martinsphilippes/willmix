"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Formulário de filtros (GET) igual ao endereço depois de navegar: "Limpar
 * filtros", voltar do navegador ou um link de ordem mudam o endereço, mas os
 * campos já mexidos guardavam o valor de antes (e o próximo filtro os
 * mandava de novo). Aqui cada campo listado recebe o valor do endereço (ou
 * vazio), menos o campo em que a pessoa está digitando.
 */
export function FormUrlSync({ names }: { names: readonly string[] }) {
  const marker = useRef<HTMLSpanElement>(null);
  const params = useSearchParams();
  const key = names.join(",");
  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    for (const name of key.split(",")) {
      const el = form.elements.namedItem(name);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement))
        continue;
      // O seletor com busca guarda o valor num campo escondido e se refaz
      // sozinho pela chave; o campo em uso não muda debaixo do dedo.
      if (el.type === "hidden" || el === document.activeElement) continue;
      const value = params.get(name) ?? "";
      if (el.value !== value) el.value = value;
    }
  }, [params, key]);
  return <span ref={marker} hidden />;
}
