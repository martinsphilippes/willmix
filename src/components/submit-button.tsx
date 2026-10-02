"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useRef, type ComponentProps } from "react";
import { Button, cx, linkClass } from "./ui";

/** Avisa a barra de progresso do topo que o envio terminou (navigation-progress). */
function useFormDoneSignal(pending: boolean) {
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !pending)
      window.dispatchEvent(new Event("wellmix:form-done"));
    was.current = pending;
  }, [pending]);
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
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  useFormDoneSignal(pending);
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
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
