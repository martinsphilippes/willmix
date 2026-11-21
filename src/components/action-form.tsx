"use client";

import {
  startTransition,
  useActionState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  FORM_ACTION_INITIAL,
  type FormActionState,
} from "@/lib/form-action-state";

/*
 * Formulário que fica na tela quando a ação dá erro (docs/SUPPLIER_REQUESTS.md,
 * "Tela da negociação reorganizada"). A Server Action (as variantes
 * `...StateAction`, que chamam o mesmo serviço da ação comum) devolve o
 * código do erro: a página não recarrega, o que foi digitado continua nos
 * campos e o aviso aparece logo abaixo. Dando certo, a ação leva à tela de
 * sempre, com o aviso de sucesso. Enquanto envia, campos e botões ficam
 * travados (um envio só). O botão clicado vai junto (decisão, aceitar...).
 */
export function ActionForm({
  action,
  errors,
  fallbackError,
  pendingLabel,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit" | "children"> & {
  action: (prev: FormActionState, form: FormData) => Promise<FormActionState>;
  /** Texto de cada código de erro, no idioma da tela. */
  errors: Record<string, string>;
  /** Texto para um código sem tradução. */
  fallbackError: string;
  /** "Enviando…", lido pelo leitor de tela enquanto envia. */
  pendingLabel?: string;
  children: ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(
    action,
    FORM_ACTION_INITIAL,
  );
  return (
    <form
      {...props}
      aria-busy={pending || undefined}
      data-action-form-pending={pending ? "1" : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(event.currentTarget, submitter ?? null);
        startTransition(() => dispatch(data));
      }}
    >
      {/* Travado enquanto envia: nada de envio em dobro. */}
      <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
        {children}
      </fieldset>
      {pending && pendingLabel ? (
        <p className="sr-only" role="status">
          {pendingLabel}
        </p>
      ) : null}
      {state.error ? (
        <p
          key={state.at}
          role="alert"
          className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700"
          data-action-form-error={state.error}
        >
          {errors[state.error] ?? fallbackError}
        </p>
      ) : null}
    </form>
  );
}
