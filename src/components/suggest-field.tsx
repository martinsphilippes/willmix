"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";

/**
 * Campo com sugestões: cada opção vira um botão que preenche o campo (e pode
 * ser editado depois). "Nenhuma dessas" já vem marcado: nada é preenchido sem
 * a escolha da pessoa. O valor enviado é sempre o do campo.
 */
export function SuggestField({
  name,
  label,
  options,
  multiline = false,
  required = false,
  minLength,
  placeholder,
  noneLabel,
  hint,
  sourceLabels,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; source: string }>;
  multiline?: boolean;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  noneLabel: string;
  hint: string;
  sourceLabels: Record<string, string>;
}) {
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const chip =
    "inline-flex max-w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-sm transition";
  const on =
    "border-brand-600 bg-brand-50 text-brand-900 ring-2 ring-brand-100";
  const off =
    "border-zinc-300 bg-white text-zinc-800 hover:border-brand-300 hover:bg-brand-50/40";
  return (
    <div className="space-y-2">
      <label
        htmlFor={`sf-${name}`}
        className="block text-sm font-medium text-zinc-800"
      >
        {label}
      </label>
      {options.length > 0 ? (
        <div role="group" aria-label={hint} className="space-y-1.5">
          <p className="text-xs text-zinc-500">{hint}</p>
          <div className="flex flex-wrap gap-2">
            {options.map((o, i) => (
              <button
                key={`${o.source}-${i}`}
                type="button"
                aria-pressed={picked === i}
                onClick={() => {
                  setPicked(i);
                  setValue(o.value);
                }}
                className={`${chip} ${picked === i ? on : off}`}
              >
                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                  {sourceLabels[o.source] ?? o.source}
                </span>
                <span className="min-w-0 break-words">{o.value}</span>
              </button>
            ))}
            <button
              type="button"
              aria-pressed={picked === null}
              onClick={() => {
                setPicked(null);
                setValue("");
              }}
              className={`${chip} ${picked === null ? on : off}`}
            >
              {noneLabel}
            </button>
          </div>
        </div>
      ) : null}
      {multiline ? (
        <textarea
          id={`sf-${name}`}
          name={name}
          value={value}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          className={inputClass}
        />
      ) : (
        <input
          id={`sf-${name}`}
          name={name}
          value={value}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
        />
      )}
    </div>
  );
}
