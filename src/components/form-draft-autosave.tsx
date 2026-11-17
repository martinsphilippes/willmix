"use client";

import { useEffect, useRef, useState } from "react";
import { savePartyDraftAction } from "@/app/app/actions/form-drafts";

/*
 * Rascunho do Novo parceiro guardado sozinho no banco, por login (dono,
 * 17/11/2026; docs/EQUIPE_ACESSOS.md, D11): a cada pausa da digitação, os
 * campos de texto do formulário vão para o servidor (sem recarregar a
 * página). Fechar a aba, perder a conexão ou voltar depois não perde o que
 * foi digitado; ao salvar o cadastro, o rascunho some.
 */
export function FormDraftAutosave({
  form,
  fields,
  savedText,
  delayMs = 800,
}: {
  /** O formulário com rascunho (FORM_DRAFT_KEYS). */
  form: string;
  /** Os campos de texto que entram no rascunho. */
  fields: readonly string[];
  /** "Rascunho salvo às {time}". */
  savedText: string;
  delayMs?: number;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  useEffect(() => {
    const el = marker.current?.closest("form");
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = "";
    // Enviado (Salvar ou o atalho do tipo): nada de rascunho logo depois,
    // para não recriar o que o cadastro salvo acabou de apagar. Se o envio
    // voltou com erro, a pessoa segue digitando e o rascunho volta a valer.
    let sentAt = 0;
    const save = async () => {
      if (Date.now() - sentAt < 5000) return;
      const values: Record<string, string> = {};
      for (const field of fields) {
        const input = el.elements.namedItem(field);
        if (
          input instanceof HTMLInputElement ||
          input instanceof HTMLTextAreaElement
        )
          values[field] = input.value;
      }
      const snapshot = JSON.stringify(values);
      if (snapshot === last) return;
      last = snapshot;
      const result = await savePartyDraftAction({ form, values }).catch(
        () => null,
      );
      if (result?.ok && result.savedAt) setSavedAt(result.savedAt);
    };
    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target?.name || !fields.includes(target.name)) return;
      clearTimeout(timer);
      timer = setTimeout(() => void save(), delayMs);
    };
    const onSubmit = () => {
      sentAt = Date.now();
      clearTimeout(timer);
    };
    el.addEventListener("input", onInput);
    el.addEventListener("submit", onSubmit);
    el.setAttribute("data-draft-autosave-ready", "");
    return () => {
      clearTimeout(timer);
      el.removeEventListener("input", onInput);
      el.removeEventListener("submit", onSubmit);
      el.removeAttribute("data-draft-autosave-ready");
    };
  }, [form, fields, delayMs]);
  return (
    <span
      ref={marker}
      role="status"
      aria-live="polite"
      className="text-xs text-zinc-500"
      data-draft-saved={savedAt ? "1" : undefined}
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
