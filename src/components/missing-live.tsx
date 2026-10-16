"use client";

import { useEffect } from "react";
import { DRAFT_RESTORE_EVENT } from "./form-draft-guard";

/*
 * Campo obrigatório em vermelho ("Preencha este campo") deixa de aparecer
 * pendente assim que recebe valor, sem esperar salvar, e volta ao vermelho se
 * ficar vazio de novo; no aviso "Faltam: …" o item fica riscado. Vale para
 * qualquer linha de campo (FieldRow) marcada como faltando, pelos nomes da
 * âncora (o valor pode estar num campo oculto, como o preço). Linha com regra
 * própria (`data-resolve-self`, ex.: cor com Pantone) decide sozinha; aqui só
 * se desfaz o que foi marcado aqui (`data-resolved-live`).
 */

/** Todos os campos da âncora têm valor? Nulo quando algum não está na tela. */
function rowFilled(row: Element): boolean | null {
  const keys = (row.getAttribute("data-field-anchor") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (!keys.length) return null;
  const form = row.closest("form");
  for (const key of keys) {
    const el = form
      ? form.elements.namedItem(key)
      : row.querySelector(`[name="${CSS.escape(key)}"]`);
    if (!el) return null;
    const value =
      el instanceof RadioNodeList
        ? el.value
        : el instanceof HTMLInputElement ||
            el instanceof HTMLSelectElement ||
            el instanceof HTMLTextAreaElement
          ? el.value
          : null;
    if (value === null) return null;
    if (!value.trim()) return false;
  }
  return true;
}

export function refreshMissingRows(root: ParentNode = document) {
  for (const row of root.querySelectorAll(
    '[data-field-row][data-missing="true"]',
  )) {
    if (!row.hasAttribute("data-resolve-self")) {
      const done = rowFilled(row);
      if (done === true && !row.hasAttribute("data-resolved")) {
        row.setAttribute("data-resolved", "");
        row.setAttribute("data-resolved-live", "");
      } else if (done === false && row.hasAttribute("data-resolved-live")) {
        row.removeAttribute("data-resolved");
        row.removeAttribute("data-resolved-live");
      }
    }
    const resolved = row.hasAttribute("data-resolved");
    for (const key of (row.getAttribute("data-field-anchor") ?? "")
      .split(/\s+/)
      .filter(Boolean))
      for (const item of document.querySelectorAll(
        `[data-missing-field="${CSS.escape(key)}"]`,
      ))
        item.toggleAttribute("data-done", resolved);
  }
}

/** Montado uma vez no layout: escuta o que se digita em qualquer formulário. */
export function MissingLive() {
  useEffect(() => {
    let timer = 0;
    // Depois do React e dos campos que se preenchem sozinhos (CBM, cor).
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => refreshMissingRows(), 0);
    };
    document.addEventListener("input", schedule, true);
    document.addEventListener("change", schedule, true);
    document.addEventListener(DRAFT_RESTORE_EVENT, schedule, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("input", schedule, true);
      document.removeEventListener("change", schedule, true);
      document.removeEventListener(DRAFT_RESTORE_EVENT, schedule, true);
    };
  }, []);
  return null;
}
