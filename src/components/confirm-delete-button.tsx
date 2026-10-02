"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de excluir dentro de um formulário: pede confirmação antes de enviar e
 * mostra o indicador enquanto a exclusão roda. O formulário (Server Action) fica
 * com quem usa; aqui só a confirmação e o estado.
 */
export function ConfirmDeleteButton({
  label,
  confirmText,
  className,
}: {
  label: string;
  confirmText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={label}
      title={label}
      onClick={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-700 shadow ring-1 ring-red-200 transition hover:bg-red-50 active:bg-red-100 disabled:cursor-wait ${className ?? ""}`}
    >
      {pending ? (
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : (
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M8.5 2a1 1 0 0 0-.9.55L7.1 3.5H4a1 1 0 0 0 0 2h.3l.8 10.1A2 2 0 0 0 7.1 17.5h5.8a2 2 0 0 0 2-1.9l.8-10.1h.3a1 1 0 1 0 0-2h-3.1l-.5-.95A1 1 0 0 0 11.5 2h-3Zm-.4 6a.75.75 0 0 1 .8.7l.25 5a.75.75 0 0 1-1.5.08l-.25-5A.75.75 0 0 1 8.1 8Zm3.8 0a.75.75 0 0 1 .7.78l-.25 5a.75.75 0 1 1-1.5-.08l.25-5a.75.75 0 0 1 .8-.7Z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
}
