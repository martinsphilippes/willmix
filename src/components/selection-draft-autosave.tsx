"use client";

import { useEffect, useRef, useState } from "react";
import { saveSelectionDraftAction } from "@/app/app/actions/supplier-requests";

/*
 * Seleção em andamento (dono, 26/11/2026; docs/SUPPLIER_REQUESTS.md,
 * "Trabalho na Seleção"): depois da primeira mexida na aba Seleção (escolher,
 * alterar a caixa, embalagens, variações, quantidade, programação, o que a
 * Wellmix precisa), o formulário vai sozinho para o servidor a cada mudança.
 * Abrir a aba sem mexer não cria rascunho. Os campos que a tela muda sem
 * evento (o JSON das embalagens, as caixas por combinação) entram porque o
 * formulário é conferido a cada instante e só vai quando mudou.
 */
export function SelectionDraftAutosave({
  ids,
  restored,
  savedText,
  intervalMs = 1500,
}: {
  /** Os itens da seleção (o grupo aberto). */
  ids: string[];
  /** A seleção voltou de um rascunho: continua salvando desde já. */
  restored: boolean;
  /** "Rascunho salvo às {time}". */
  savedText: string;
  intervalMs?: number;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const key = ids.join(",");
  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    let touched = restored;
    let last = "";
    let busy = false;
    let sentAt = 0;
    const snapshot = () => {
      const values: Record<string, string[]> = {};
      for (const [name, value] of new FormData(form)) {
        if (typeof value !== "string") continue;
        (values[name] ??= []).push(value);
      }
      return values;
    };
    const tick = async () => {
      if (!touched || busy || Date.now() - sentAt < 5000) return;
      const values = snapshot();
      const text = JSON.stringify(values);
      if (text === last) return;
      busy = true;
      try {
        const result = await saveSelectionDraftAction({
          ids: key.split(","),
          values,
        });
        if (result.ok) {
          last = text;
          if (result.savedAt) setSavedAt(result.savedAt);
        }
      } catch {
        // Sem conexão: tenta de novo na próxima volta.
      } finally {
        busy = false;
      }
    };
    // O que conta como mexer: digitar, mudar um campo ou tocar num botão do
    // formulário (embalagem, variação, toggles), menos o de gravar.
    const touch = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-selection-submit]")) return;
      touched = true;
    };
    const onSubmit = () => {
      sentAt = Date.now();
    };
    // Volta do restaurado: o primeiro retrato vale como já salvo.
    if (restored) last = JSON.stringify(snapshot());
    form.addEventListener("input", touch);
    form.addEventListener("change", touch);
    form.addEventListener("click", touch);
    form.addEventListener("submit", onSubmit);
    const timer = setInterval(() => void tick(), intervalMs);
    form.setAttribute("data-selection-draft-ready", "");
    return () => {
      clearInterval(timer);
      form.removeEventListener("input", touch);
      form.removeEventListener("change", touch);
      form.removeEventListener("click", touch);
      form.removeEventListener("submit", onSubmit);
      form.removeAttribute("data-selection-draft-ready");
    };
  }, [key, restored, intervalMs]);
  return (
    <span
      ref={marker}
      role="status"
      aria-live="polite"
      className="text-xs text-zinc-500"
      data-selection-draft-saved={savedAt ? "1" : undefined}
    >
      {savedAt
        ? savedText.replace(
            "{time}",
            new Date(savedAt).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            }),
          )
        : null}
    </span>
  );
}
