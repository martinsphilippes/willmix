"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "./ui";

/*
 * Data de um requisito com limites vindos das outras datas do pedido (ex.: a
 * previsão de chegada não pode ser antes da data de embarque). O calendário já
 * não oferece os dias de fora (min/max); digitada fora do limite, a data mostra
 * o aviso na hora e o envio fica bloqueado (validação do próprio navegador),
 * antes de chegar ao servidor (que confere de novo).
 */
export function DateRangeInput({
  name,
  min,
  max,
  minMessage,
  maxMessage,
  defaultValue,
  className,
  children,
}: {
  name: string;
  /** AAAA-MM-DD */
  min?: string;
  max?: string;
  /** Aviso quando a data fica antes de `min` / depois de `max`. */
  minMessage?: string;
  maxMessage?: string;
  defaultValue?: string;
  className?: string;
  /** Botão de enviar (fica ao lado do campo; o aviso vai embaixo). */
  children?: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const error =
    value && min && value < min
      ? (minMessage ?? null)
      : value && max && value > max
        ? (maxMessage ?? null)
        : null;
  useEffect(() => {
    ref.current?.setCustomValidity(error ?? "");
  }, [error]);
  // Data digitada antes de a página terminar de carregar (celular lento): o
  // campo já tem o valor, mas o aviso ainda não sabia.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setValue(el.value);
    el.setAttribute("data-ready", "1");
  }, []);
  return (
    <>
      <Input
        ref={ref}
        name={name}
        type="date"
        required
        min={min}
        max={max}
        defaultValue={defaultValue}
        onChange={(e) => setValue(e.currentTarget.value)}
        aria-invalid={error ? true : undefined}
        className={className}
        data-date-input=""
      />
      {children}
      {error ? (
        <span
          role="alert"
          className="basis-full text-xs font-medium text-red-700"
          data-date-error=""
        >
          {error}
        </span>
      ) : null}
    </>
  );
}
