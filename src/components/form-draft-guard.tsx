"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "./ui";

/*
 * Rede de segurança da ficha: o que a pessoa digita fica guardado neste
 * navegador (sessionStorage, só nesta aba) enquanto ela preenche. Se o envio
 * falhar (a tela volta com ?error=…), os campos são preenchidos de novo com o
 * que estava digitado, em vez de voltarem ao último valor salvo (o React
 * reinicia o formulário depois do envio). Salvou certo: o rascunho é apagado.
 * Campos ocultos, de arquivo e de senha não entram.
 */
export function FormDraftGuard({
  formId,
  storageKey,
  failed,
  saved,
  token,
  message,
}: {
  formId: string;
  /** Uma ficha por chave (ex.: "quote:<id>"). */
  storageKey: string;
  /** Esta tela é a volta de um envio que falhou. */
  failed: boolean;
  /** Esta tela é a volta de um envio que salvou. */
  saved: boolean;
  /** Muda a cada envio (ex.: ?at=), para rodar de novo na mesma tela. */
  token: string;
  message: string;
}) {
  const key = `wellmix-draft:${storageKey}`;
  const [restored, setRestored] = useState(false);
  const restoring = useRef(false);

  // Guarda o que se digita (input/change de qualquer campo do formulário).
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const save = () => {
      if (restoring.current) return;
      const values: Record<string, string> = {};
      for (const el of Array.from(form.elements)) {
        if (!eligible(el)) continue;
        values[fieldKey(el)] = el.value;
      }
      try {
        sessionStorage.setItem(key, JSON.stringify(values));
      } catch {
        // Sem armazenamento (aba privada, cota): segue sem rede de segurança.
      }
    };
    form.addEventListener("input", save);
    form.addEventListener("change", save);
    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("change", save);
    };
  }, [formId, key]);

  // Volta de um envio: falhou → devolve o digitado; salvou → apaga o rascunho.
  useEffect(() => {
    let draft: Record<string, string> | null = null;
    try {
      if (saved && !failed) {
        sessionStorage.removeItem(key);
        return;
      }
      if (!failed) return;
      const raw = sessionStorage.getItem(key);
      draft = raw ? (JSON.parse(raw) as Record<string, string>) : null;
    } catch {
      return;
    }
    if (!draft) return;
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    // Depois do reinício do formulário que o React faz ao fim do envio.
    const id = window.setTimeout(() => {
      restoring.current = true;
      let changed = 0;
      for (const el of Array.from(form.elements)) {
        if (!eligible(el) || !(fieldKey(el) in draft!)) continue;
        const value = draft![fieldKey(el)];
        if (el.value === value) continue;
        setNativeValue(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        changed++;
      }
      restoring.current = false;
      if (changed) setRestored(true);
    }, 50);
    return () => window.clearTimeout(id);
  }, [failed, saved, token, formId, key]);

  return restored && message ? (
    <div className="mb-3" data-draft-restored>
      <Alert tone="warning">{message}</Alert>
    </div>
  ) : null;
}

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function eligible(el: Element): el is Field {
  if (!(
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ))
    return false;
  if (!fieldKey(el) || el.disabled) return false;
  if (el instanceof HTMLInputElement)
    return ![
      "hidden",
      "file",
      "password",
      "submit",
      "button",
      "checkbox",
      "radio",
    ].includes(el.type);
  return true;
}

/** Nome do campo; o valor em dinheiro visível (sem nome) usa o do campo oculto. */
function fieldKey(el: Field): string {
  if (el.name) return el.name;
  const money = el.getAttribute("data-money");
  return money ? `money:${money}` : "";
}

/** Troca o valor de um jeito que o React percebe (campos controlados também). */
function setNativeValue(el: Field, value: string) {
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
}
