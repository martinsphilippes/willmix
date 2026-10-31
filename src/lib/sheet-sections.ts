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
  return document.querySelector<HTMLElement>(`[data-field-anchor~="${key}"]`);
}
