"use client";

import { useId, useState } from "react";
import { SHEET_INCOTERMS } from "@/lib/db/schema";
import { cx, inputClass } from "@/components/ui";

/*
 * FOB ou EXW do book (dono, 24/11/2026; docs/BOOKING.md, "Dinâmica dos
 * books"): quem importa escolhe, e a escolha vale para todos os itens, seja
 * qual for o que a planilha trazia. Com EXW abre o campo do valor do EXW,
 * que fica gravado no book.
 *
 * `compact` (card "Planilha do book" da Wellmix, 24/11/2026): os dois campos
 * estreitos numa linha (FOB ou EXW e, com EXW, o valor ao lado), com a letra
 * e a altura do card (`fieldClassName`) e as dicas abaixo da linha. Sem ele,
 * o de sempre (parceiro e tela do book).
 */
export function BookIncotermFields({
  incoterm = "",
  exwValue = "",
  required = true,
  labels,
  compact = false,
  fieldClassName,
}: {
  incoterm?: string;
  /** Como a pessoa digita ("1,5"). */
  exwValue?: string;
  required?: boolean;
  labels: {
    incoterm: string;
    incotermHint: string;
    exwValue: string;
    exwValueHint: string;
    select: string;
  };
  /** Campos estreitos numa linha, dicas abaixo (o card compacto). */
  compact?: boolean;
  /** Com `compact`: classes dos campos (altura, cantos e letra do card). */
  fieldClassName?: string;
}) {
  const [value, setValue] = useState(incoterm);
  const hintId = useId();
  const exwHintId = useId();
  if (compact) {
    const label =
      "flex flex-col gap-1 text-[13px] font-medium leading-5 text-zinc-700";
    return (
      <div className="space-y-1.5" data-book-incoterm-row>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <label className={cx(label, "w-[120px]")}>
            {labels.incoterm}
            <select
              name="incoterm"
              required={required}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-describedby={hintId}
              className={cx(inputClass, fieldClassName)}
              data-book-incoterm
            >
              <option value="" disabled={required}>
                {labels.select}
              </option>
              {SHEET_INCOTERMS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          {value === "EXW" ? (
            <label className={cx(label, "w-[130px]")}>
              {labels.exwValue}
              <input
                name="exwValue"
                type="text"
                inputMode="decimal"
                required
                maxLength={20}
                autoComplete="off"
                defaultValue={exwValue}
                aria-describedby={exwHintId}
                className={cx(inputClass, fieldClassName, "text-right")}
                data-book-exw-value
              />
            </label>
          ) : null}
        </div>
        <p id={hintId} className="text-xs text-zinc-600">
          {labels.incotermHint}
        </p>
        {value === "EXW" ? (
          <p id={exwHintId} className="text-xs text-zinc-600">
            {labels.exwValueHint}
          </p>
        ) : null}
      </div>
    );
  }
  const label = "flex flex-col gap-1 text-xs font-medium text-zinc-700";
  const hint = "text-xs font-normal text-zinc-500";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={label}>
        {labels.incoterm}
        <select
          name="incoterm"
          required={required}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          data-book-incoterm
        >
          <option value="" disabled={required}>
            {labels.select}
          </option>
          {SHEET_INCOTERMS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <span className={hint}>{labels.incotermHint}</span>
      </label>
      {value === "EXW" ? (
        <label className={label}>
          {labels.exwValue}
          <input
            name="exwValue"
            type="text"
            inputMode="decimal"
            required
            maxLength={20}
            autoComplete="off"
            defaultValue={exwValue}
            className={cx(inputClass, "text-right")}
            data-book-exw-value
          />
          <span className={hint}>{labels.exwValueHint}</span>
        </label>
      ) : null}
    </div>
  );
}
