"use client";

import {
  startTransition,
  useActionState,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  FORM_ACTION_INITIAL,
  type FormActionState,
} from "@/lib/form-action-state";
import { ActionPendingContext } from "./action-pending";
import { useFormDoneSignal } from "./submit-button";

/*
 * Formulário que fica na tela quando a ação dá erro (docs/SUPPLIER_REQUESTS.md,
 * "Tela da negociação reorganizada"). A Server Action (as variantes
 * `...StateAction`, que chamam o mesmo serviço da ação comum) devolve o
 * código do erro: a página não recarrega, o que foi digitado continua nos
 * campos e o aviso aparece logo abaixo. Dando certo, a ação leva à tela de
 * sempre, com o aviso de sucesso. Enquanto envia, campos e botões ficam
 * travados (um envio só) e o botão mostra o indicador. O botão clicado vai
 * junto (decisão, aceitar...).
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
  /** Texto para um código sem tradução ("{code}" vira o código). */
  fallbackError: string;
  /** "Enviando…", lido pelo leitor de tela enquanto envia. */
  pendingLabel?: string;
  children: ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(
    action,
    FORM_ACTION_INITIAL,
  );
  // Erro de um envio anterior: some no envio seguinte. Se este der certo, a
  // ação redireciona e o estado não muda; o aviso velho não volta.
  const [hiddenAt, setHiddenAt] = useState(0);
  // A barra de progresso do topo começa no envio; termina na troca de tela
  // ou com este aviso (o erro volta sem trocar de tela).
  useFormDoneSignal(pending);
  const error = state.error && state.at > hiddenAt ? state.error : null;
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
        setHiddenAt(state.at);
        startTransition(() => dispatch(data));
      }}
    >
      {/* Travado enquanto envia: nada de envio em dobro. */}
      <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
        <ActionPendingContext value={pending}>{children}</ActionPendingContext>
      </fieldset>
      {pending && pendingLabel ? (
        <p className="sr-only" role="status">
          {pendingLabel}
        </p>
      ) : null}
      {error ? (
        <p
          key={state.at}
          role="alert"
          className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700"
          data-action-form-error={error}
        >
          {errors[error] ?? fallbackError.replace("{code}", error)}
        </p>
      ) : null}
    </form>
  );
}
