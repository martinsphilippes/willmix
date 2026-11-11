"use client";

import { useEffect } from "react";

/**
 * Seções recolhíveis da página (`FoldSection`): lembra as que estavam
 * abertas (por página, na aba do navegador), para a tela voltar igual depois
 * de salvar, e abre a seção quando um link (#âncora) leva para dentro dela.
 */
export function FoldMemory({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const key = `fold:${storageKey}`;
    const sections = () => [
      ...document.querySelectorAll<HTMLDetailsElement>(
        "details[data-fold-section]",
      ),
    ];
    const read = (): string[] => {
      try {
        const v = JSON.parse(sessionStorage.getItem(key) ?? "[]");
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    };
    const save = () => {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify(
            sections()
              .filter((d) => d.open)
              .map((d) => d.dataset.foldSection),
          ),
        );
      } catch {
        // Sem armazenamento (aba privada): só não lembra.
      }
    };
    const reveal = (hash: string, scroll: boolean) => {
      const id = decodeURIComponent(hash.replace(/^#/, ""));
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      let changed = false;
      for (
        let d = el.closest("details");
        d;
        d = d.parentElement?.closest("details") ?? null
      )
        if (!d.open) {
          d.open = true;
          changed = true;
        }
      if (changed || scroll) el.scrollIntoView({ block: "start" });
    };

    const open = new Set(read());
    for (const d of sections())
      if (open.has(d.dataset.foldSection ?? "")) d.open = true;
    reveal(window.location.hash, false);

    const onToggle = (e: Event) => {
      if (
        (e.target as HTMLElement | null)?.matches?.(
          "details[data-fold-section]",
        )
      )
        save();
    };
    const onHash = () => reveal(window.location.hash, true);
    // Link para a âncora que já está no endereço não dispara "hashchange".
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href^='#']");
      const href = a?.getAttribute("href");
      if (href && href.length > 1)
        window.setTimeout(() => reveal(href, true), 0);
    };
    document.addEventListener("toggle", onToggle, true);
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("toggle", onToggle, true);
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, [storageKey]);
  return null;
}
