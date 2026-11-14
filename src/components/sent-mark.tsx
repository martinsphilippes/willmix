"use client";

import { useEffect, useRef, useState } from "react";

/*
 * "✓ Enviado" ao lado do botão de enviar (resposta do fornecedor na
 * solicitação, pedido do dono em 14/11/2026). Aparece quando há uma versão
 * gravada (`saved`), inclusive ao reabrir a página; some assim que algum
 * campo do formulário fica diferente do que foi gravado, e volta quando o
 * envio novo é gravado (a página recarrega com os valores novos) ou quando
 * os campos voltam ao que estava gravado.
 */
export function SentMark({ saved, label }: { saved: boolean; label: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const snapshot = (f: HTMLFormElement) =>
      JSON.stringify(
        [...new FormData(f).entries()].map(([k, v]) => [k, String(v)]),
      );
    const initial = snapshot(form);
    const check = () => setChanged(snapshot(form) !== initial);
    form.addEventListener("input", check);
    form.addEventListener("change", check);
    return () => {
      form.removeEventListener("input", check);
      form.removeEventListener("change", check);
    };
  }, []);

  const show = saved && !changed;
  return (
    <span
      ref={ref}
      className={
        show
          ? "inline-flex items-center gap-1 text-sm font-medium text-emerald-700"
          : "hidden"
      }
      role="status"
      data-sent-mark={show ? "on" : "off"}
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.86-9.86a.75.75 0 0 0-1.22-.88l-3.2 4.43-1.6-1.6a.75.75 0 1 0-1.06 1.06l2.22 2.22a.75.75 0 0 0 1.14-.09l3.72-5.14Z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </span>
  );
}
