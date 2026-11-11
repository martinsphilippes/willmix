/*
 * Abrir o bloco da ficha de compra que guarda um campo. Quem leva até um
 * campo (aviso "faltam", restauração de rascunho) avisa antes, para o bloco
 * aparecer; a tabela de blocos (SheetSectionsNav) escuta e abre na hora.
 * Sem "use client": vale no servidor e no navegador.
 */
export const SHEET_REVEAL_EVENT = "wellmix:sheet-reveal";

export interface SheetRevealDetail {
  /** Chave da âncora do campo (`data-field-anchor`). */
  key: string;
}

/** Pede para abrir o bloco do campo; devolve a âncora, visível, se existir. */
export function revealSheetField(key: string): HTMLElement | null {
  if (typeof window === "undefined") return null;
  window.dispatchEvent(
    new CustomEvent<SheetRevealDetail>(SHEET_REVEAL_EVENT, { detail: { key } }),
  );
  const el = document.querySelector<HTMLElement>(
    `[data-field-anchor~="${key}"]`,
  );
  // Quadro recolhido (<details> fechado): abre para o campo aparecer.
  for (
    let d = el?.closest("details");
    d;
    d = d.parentElement?.closest("details")
  )
    d.open = true;
  return el;
}
