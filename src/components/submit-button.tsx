"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Button, cx, linkClass } from "./ui";

/** Avisa a barra de progresso do topo que o envio terminou (navigation-progress). */
export function useFormDoneSignal(pending: boolean) {
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending)
      window.dispatchEvent(new Event("wellmix:form-done"));
    was.current = pending;
  }, [pending]);
}

/**
 * Envio de um formulário identificado por id (botão com atributo `form`): a
 * espera começa no submit do próprio formulário e termina quando a tela muda
 * (a ação redireciona) ou o formulário avisa que terminou.
 */
function useExternalFormPending(formId: string | undefined) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!formId) return;
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const onSubmit = () => setPending(true);
    const onDone = () => setPending(false);
    form.addEventListener("submit", onSubmit);
    window.addEventListener("wellmix:form-done", onDone);
    return () => {
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("wellmix:form-done", onDone);
    };
  }, [formId]);
  return pending;
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
    />
  );
}

/**
 * Botão de formulário com estado de envio: enquanto a ação roda, mostra o
 * indicador girando e fica desativado (evita clique duplo). Progressive
 * enhancement mantido.
 */
export function SubmitButton({
  children,
  pendingText,
  form,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const status = useFormStatus();
  const external = useExternalFormPending(form);
  // Com `form`, o botão fica fora do formulário (ex.: depois do card de fotos,
  // que tem formulários próprios) e o React não informa o envio.
  const pending = form ? external : status.pending;
  useFormDoneSignal(form ? false : pending);
  return (
    <Button
      type="submit"
      form={form}
      disabled={pending}
      aria-busy={pending}
      {...props}
    >
      {pending ? <Spinner /> : null}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

/** Mesmo comportamento, com aparência de link (ações pequenas em listas). */
export function SubmitTextButton({
  children,
  className,
  ...props
}: ComponentProps<"button">) {
  const { pending } = useFormStatus();
  useFormDoneSignal(pending);
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cx(
        linkClass,
        "inline-flex items-center gap-1.5 disabled:cursor-wait disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}
