"use client";

import { useState } from "react";
import { SHEET_INCOTERMS } from "@/lib/db/schema";
import { cx, inputClass } from "@/components/ui";

/*
 * FOB ou EXW do book (dono, 24/11/2026; docs/BOOKING.md, "Dinâmica dos
 * books"): quem importa escolhe, e a escolha vale para todos os itens, seja
 * qual for o que a planilha trazia. Com EXW abre o campo do valor do EXW,
 * que fica gravado no book.
 */
export function BookIncotermFields({
  incoterm = "",
  exwValue = "",
  required = true,
  labels,
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
}) {
  const [value, setValue] = useState(incoterm);
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
