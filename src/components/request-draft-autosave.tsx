"use client";

import { useEffect, useRef, useState } from "react";
import { autosaveRequestDraftAction } from "@/app/app/actions/request-drafts";

/** Evento para pedir um rascunho novo quando algo saiu da tela sem digitação. */
export const REQUEST_DRAFT_TOUCH = "request-draft-touch";

/*
 * Rascunho automático da Nova solicitação (dono, 17/11/2026): a cada pausa
 * (digitação, escolha, produto que entra ou sai), o formulário inteiro vai
 * para o rascunho do vendedor, sem recarregar a página. O primeiro cria o
 * rascunho (e o endereço passa a ter ?draft=, para voltar a ele); os
 * seguintes gravam por cima. Só grava depois de alguma mudança: abrir a tela
 * não cria rascunho. Ao enviar, o servidor apaga o rascunho (draftId).
 */
export function RequestDraftAutosave({
  formId,
  mode,
  initialDraftId,
  savedText,
  delayMs = 1500,
}: {
  formId: string;
  /** Tela de TS ou de Venda (nulo: Encomendas). */
  mode: "ts" | "sale" | null;
  initialDraftId: string | null;
  /** "Rascunho salvo automaticamente às {time}". */
  savedText: string;
  delayMs?: number;
}) {
  const [draftId, setDraftId] = useState(initialDraftId);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const idRef = useRef(initialDraftId);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    let again = false;
    let sentAt = 0;
    // Só grava depois de uma ação da pessoa na tela (dono, 18/11/2026): abrir
    // um rascunho (e a tela se completar sozinha, com as fichas que chegam)
    // nunca grava por cima do que foi salvo.
    let touched = false;
    const onUser = (event: Event) => {
      if (event.isTrusted) touched = true;
    };
    const snapshotOf = () => {
      const entries: Array<[string, string]> = [];
      for (const [k, v] of new FormData(form).entries())
        if (
          typeof v === "string" &&
          k !== "draftId" &&
          !k.startsWith("$ACTION")
        )
          entries.push([k, v]);
      return entries;
    };
    // O que a tela abriu (nada a gravar enquanto não mudar).
    let last = "";
    const baseline = setTimeout(() => {
      last = JSON.stringify(snapshotOf());
    }, 600);
    const save = async () => {
      if (!touched || Date.now() - sentAt < 8000) return;
      if (busy) {
        again = true;
        return;
      }
      const entries = snapshotOf();
      const snapshot = JSON.stringify(entries);
      if (!last || snapshot === last) return;
      busy = true;
      const result = await autosaveRequestDraftAction({
        mode,
        draftId: idRef.current,
        entries,
      }).catch(() => null);
      busy = false;
      if (result?.ok) {
        last = snapshot;
        setSavedAt(result.savedAt);
        if (idRef.current !== result.draftId) {
          idRef.current = result.draftId;
          setDraftId(result.draftId);
          // O endereço guarda o rascunho (recarregar volta a ele), sem
          // recarregar a tela.
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("draft", result.draftId);
            url.searchParams.delete("draftSaved");
            url.searchParams.delete("draftDeleted");
            url.searchParams.delete("created");
            window.history.replaceState(window.history.state, "", url);
          } catch {
            /* sem o endereço: o rascunho segue gravado */
          }
        }
      }
      if (again) {
        again = false;
        schedule();
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void save(), delayMs);
    };
    const onField = (event: Event) => {
      const target = event.target as { form?: HTMLFormElement | null } | null;
      if (target?.form === form) schedule();
    };
    const onSubmit = () => {
      sentAt = Date.now();
      clearTimeout(timer);
    };
    // Produto que entra ou sai pela lupa ou pelo histórico (sem digitação).
    const observer = new MutationObserver(schedule);
    observer.observe(form, { childList: true, subtree: true });
    for (const type of ["pointerdown", "keydown", "input", "change"])
      document.addEventListener(type, onUser, true);
    document.addEventListener("input", onField, true);
    document.addEventListener("change", onField, true);
    document.addEventListener(REQUEST_DRAFT_TOUCH, schedule);
    form.addEventListener("submit", onSubmit);
    form.setAttribute("data-request-autosave-ready", "");
    return () => {
      clearTimeout(timer);
      clearTimeout(baseline);
      observer.disconnect();
      for (const type of ["pointerdown", "keydown", "input", "change"])
        document.removeEventListener(type, onUser, true);
      document.removeEventListener("input", onField, true);
      document.removeEventListener("change", onField, true);
      document.removeEventListener(REQUEST_DRAFT_TOUCH, schedule);
      form.removeEventListener("submit", onSubmit);
      form.removeAttribute("data-request-autosave-ready");
    };
  }, [formId, mode, delayMs]);

  return (
    <>
      {draftId ? (
        <input type="hidden" name="draftId" value={draftId} form={formId} />
      ) : null}
      <span
        role="status"
        aria-live="polite"
        className="text-xs text-zinc-500"
        data-request-autosaved={savedAt ? "1" : undefined}
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
    </>
  );
}
