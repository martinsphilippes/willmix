"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "./ui";

/*
 * Rede de segurança da ficha: nada do que a pessoa digitou se perde num envio.
 *
 * - No momento de QUALQUER envio da página (o Salvar/Enviar da ficha ou outro
 *   formulário, como foto, cadastro ou produto), guarda neste navegador
 *   (sessionStorage, só nesta aba) o que mudou na ficha desde que a tela
 *   abriu: campos dentro do <form> e os ligados a ele por `form=` (prazo e
 *   condições da cotação), a programação (inclusive linhas novas e o que os
 *   botões Completar/Reduzir/Gerar mudaram) e as cores Pantone.
 * - A tela volta (o Next remonta a página a cada envio): se a ficha não foi
 *   salva com sucesso (erro, campo ilegível, sessão expirada e novo login,
 *   outro formulário enviado), os campos voltam com o que estava digitado e
 *   um aviso, com a opção de descartar. Salvou certo: o rascunho é apagado.
 * - Só restaura o que esta aba enviou, deste usuário, há menos de 30 minutos:
 *   rascunho antigo ou de outra pessoa (tablet compartilhado) não aparece.
 * Campos de arquivo e de senha não entram.
 */
const PREFIX = "wellmix-draft:";
const MAX_AGE_MS = 30 * 60 * 1000;
/** Evento na <form>: componentes com estado próprio (programação, Pantone) se restauram. */
export const DRAFT_RESTORE_EVENT = "wellmix:draft-restore";

interface Draft {
  v: 2;
  at: number;
  /** Houve envio e a volta ainda não foi tratada. */
  pending: boolean;
  /** Só os campos que mudaram desde que a tela abriu. */
  values: Record<string, string>;
}

/**
 * Ficha enviada com sucesso numa tela que não é a dela (ex.: cotação enviada
 * leva às Pendências): o rascunho dela não volta mais.
 */
export function ClearDraft({
  userId,
  storageKey,
  token,
}: {
  userId: string;
  storageKey: string;
  /** Um por envio (ex.: data da resposta): voltar a esta tela não apaga de novo. */
  token: string;
}) {
  useEffect(() => {
    const mark = `wellmix:draft-cleared:${userId}:${storageKey}`;
    try {
      if (sessionStorage.getItem(mark) === token) return;
      sessionStorage.setItem(mark, token);
    } catch {
      // Sem armazenamento: não há rascunho para apagar.
      return;
    }
    remove(`${PREFIX}${userId}:${storageKey}`);
  }, [userId, storageKey, token]);
  return null;
}

export function FormDraftGuard({
  formId,
  storageKey,
  userId,
  failed,
  saved,
  token,
  message,
  discardLabel,
}: {
  formId: string;
  /** Uma ficha por chave (ex.: "quote:<id>"). */
  storageKey: string;
  /** Rascunho é de quem digitou (tablet compartilhado). */
  userId: string;
  /** Esta tela é a volta de um envio que falhou (só para o texto do aviso). */
  failed: boolean;
  /** Esta tela é a volta de um envio que salvou esta ficha. */
  saved: boolean;
  /** Muda a cada envio (ex.: ?at=), para rodar de novo na mesma tela. */
  token: string;
  message: string;
  discardLabel: string;
}) {
  const key = `${PREFIX}${userId}:${storageKey}`;
  const [restored, setRestored] = useState(false);
  // Valores da tela como veio do servidor (antes de restaurar): o que mudar
  // em relação a eles é o que a pessoa digitou.
  const initial = useRef<Record<string, string> | null>(null);

  // Enter num campo de uma linha vai para o próximo campo, em vez de enviar
  // o formulário (na cotação o botão padrão é "Enviar cotação": um Enter no
  // meio do preenchimento tentava enviar e voltava com erro). Enviar e salvar
  // só pelos botões.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // IME (chinês/japonês): o Enter que confirma o texto não navega (o
      // Safari manda keyCode 229 sem isComposing).
      if (
        e.key !== "Enter" ||
        e.isComposing ||
        e.keyCode === 229 ||
        e.defaultPrevented
      )
        return;
      const el = e.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement))
        return;
      const form = formById(formId);
      if (!form || el.form !== form) return;
      if (
        el instanceof HTMLInputElement &&
        [
          "submit",
          "button",
          "image",
          "reset",
          "file",
          "checkbox",
          "radio",
        ].includes(el.type)
      )
        return;
      // Campos com Enter próprio (ex.: busca de Pantone) chamam
      // preventDefault antes e não chegam aqui.
      e.preventDefault();
      const fields = Array.from(form.elements).filter(
        (f): f is Field =>
          (f instanceof HTMLInputElement ||
            f instanceof HTMLSelectElement ||
            f instanceof HTMLTextAreaElement) &&
          !f.disabled &&
          !(f instanceof HTMLInputElement && f.type === "hidden") &&
          !(f instanceof HTMLInputElement && f.readOnly) &&
          (f as HTMLElement).offsetParent !== null,
      );
      const next = fields[fields.indexOf(el) + 1];
      next?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [formId]);

  // Guarda o que mudou no momento de qualquer envio da página.
  useEffect(() => {
    const onSubmit = () => {
      const form = formById(formId);
      if (!form) return;
      const now = collect(form);
      const base = initial.current ?? {};
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(now))
        if ((base[k] ?? "") !== v) values[k] = v;
      // Campo que sumiu (linha da programação removida com × ou "Gerar" com
      // menos linhas): vai vazio, senão a linha voltaria na restauração.
      for (const k of Object.keys(base))
        if (!(k in now) && base[k] !== "") values[k] = "";
      write(key, { v: 2, at: Date.now(), pending: true, values });
    };
    // Captura: antes de o React tratar o envio (ação do servidor).
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [formId, key]);

  // Tela montada (ou volta de um envio): salvou → apaga; senão, devolve.
  useEffect(() => {
    const form = formById(formId);
    if (!form) return;
    let second = 0;
    // Depois da hidratação e do primeiro efeito dos campos com estado próprio.
    const first = window.setTimeout(() => {
      initial.current = collect(form);
      const draft = read(key);
      if (!draft) return;
      if (saved) {
        remove(key);
        return;
      }
      if (!draft.pending || Date.now() - draft.at > MAX_AGE_MS) return;
      write(key, { ...draft, pending: false });
      const values = draft.values;
      if (!Object.keys(values).length) return;
      form.dispatchEvent(
        new CustomEvent(DRAFT_RESTORE_EVENT, { detail: values }),
      );
      // Segunda passada: linhas e campos que o evento acabou de abrir.
      second = window.setTimeout(() => {
        apply(form, values);
        // Aviso só se algo voltou de fato (diferente do que o servidor mostrou).
        const after = collect(form);
        const base = initial.current ?? {};
        if (
          Object.keys(values).some((k) => (after[k] ?? "") !== (base[k] ?? ""))
        )
          setRestored(true);
      }, 40);
    }, 60);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, [failed, saved, token, formId, key]);

  if (!restored || !message) return null;
  return (
    <div className="mb-3" data-draft-restored>
      <Alert tone="warning">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="min-w-0 flex-1">{message}</span>
          <button
            type="button"
            className="text-sm font-medium underline underline-offset-2"
            onClick={() => {
              remove(key);
              window.location.reload();
            }}
            data-draft-discard
          >
            {discardLabel}
          </button>
        </span>
      </Alert>
    </div>
  );
}

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function formById(id: string): HTMLFormElement | null {
  const el = document.getElementById(id);
  return el instanceof HTMLFormElement ? el : null;
}

/** Todos os campos da ficha, inclusive os ligados por `form=` fora do <form>. */
function collect(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of Array.from(form.elements)) {
    if (!eligible(el)) continue;
    out[fieldKey(el)] = el.value;
  }
  return out;
}

function eligible(el: Element): el is Field {
  if (!(
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ))
    return false;
  if (!fieldKey(el) || el.disabled) return false;
  if (el instanceof HTMLInputElement) {
    // Oculto só quando marcado (ex.: cores Pantone escolhidas).
    if (el.type === "hidden") return el.hasAttribute("data-draft");
    return ![
      "file",
      "password",
      "submit",
      "button",
      "image",
      "reset",
      "checkbox",
      "radio",
    ].includes(el.type);
  }
  return true;
}

/** Nome do campo; o valor em dinheiro visível (sem nome) usa o do campo oculto. */
function fieldKey(el: Field): string {
  if (el.name) return el.name;
  const money = el.getAttribute("data-money");
  return money ? `money:${money}` : "";
}

/**
 * Devolve os valores aos campos. Listas primeiro: escolher o fornecedor
 * preenche Local/Loja/Telefone, e o que foi digitado neles vem depois.
 */
function apply(form: HTMLFormElement, values: Record<string, string>) {
  const fields = Array.from(form.elements).filter(
    (el): el is Field =>
      eligible(el) &&
      !(el instanceof HTMLInputElement && el.type === "hidden") &&
      fieldKey(el) in values,
  );
  fields.sort(
    (a, b) =>
      Number(b instanceof HTMLSelectElement) -
      Number(a instanceof HTMLSelectElement),
  );
  let changed = 0;
  for (const el of fields) {
    const value = values[fieldKey(el)];
    if (el.value === value) continue;
    setNativeValue(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    changed++;
  }
  return changed > 0;
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

function read(key: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<Draft>;
    return draft?.v === 2 && draft.values ? (draft as Draft) : null;
  } catch {
    return null;
  }
}

function write(key: string, draft: Draft) {
  try {
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Sem armazenamento (aba privada, cota): segue sem rede de segurança.
  }
}

function remove(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // idem
  }
}
