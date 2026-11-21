"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui";
import type { RequestInnerRequirement } from "@/lib/db/schema";

/*
 * Caixa inner exigida pelo cliente, por produto da Nova solicitação (dono,
 * 21/11/2026; docs/ORDER_TERMS.md, "Caixa inner exigida pelo cliente"). O
 * padrão é "Não": o inner do cadastro do produto não conta como pedido do
 * cliente. Com "Sim", as peças por inner são obrigatórias e vão para a
 * cotação de compra como exigência travada.
 */

export interface RequestInnerLabels {
  /** "Caixa inner exigida pelo cliente". */
  title: string;
  no: string;
  yes: string;
  /** "Peças por inner". */
  qty: string;
  /** O que acontece com a exigência (a cotação mostra ao fornecedor, travada). */
  hint: string;
  /** "Cadastro do produto: {n} por inner (não marca sozinho)". */
  catalog: string;
}

export function RequestInnerField({
  prefix,
  initial,
  catalogInner,
  labels,
  intl,
}: {
  prefix: string;
  initial: RequestInnerRequirement | null | undefined;
  /** Peças por inner do cadastro do produto (só a dica). */
  catalogInner: number | null;
  labels: RequestInnerLabels;
  intl: string;
}) {
  const [choice, setChoice] = useState<"no" | "yes">(initial ? "yes" : "no");
  const [qty, setQty] = useState(initial?.qty ? String(initial.qty) : "");
  const radio = (value: "no" | "yes", text: string) => (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 text-[13px] text-zinc-800">
      <input
        type="radio"
        name={`${prefix}innerRequired`}
        value={value}
        checked={choice === value}
        onChange={() => setChoice(value)}
        className="h-4 w-4 accent-brand-700"
        data-request-inner-choice={value}
      />
      {text}
    </label>
  );
  return (
    <fieldset
      className="col-span-2 min-w-0 rounded-md border border-zinc-200 px-3 py-2 sm:col-span-4"
      data-request-inner={prefix}
    >
      <legend className="px-1 text-xs font-medium text-zinc-700">
        {labels.title}
      </legend>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {radio("no", labels.no)}
        {radio("yes", labels.yes)}
        {choice === "yes" ? (
          <label className="inline-flex items-center gap-2 text-[13px] text-zinc-800">
            <span>{labels.qty}</span>
            <input
              name={`${prefix}innerQty`}
              inputMode="numeric"
              autoComplete="off"
              required
              pattern="[0-9.]*"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
              className={`${inputClass} h-9! w-24! text-right tabular-nums`}
              data-request-inner-qty=""
            />
          </label>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {labels.hint}
        {catalogInner
          ? ` ${labels.catalog.replace("{n}", catalogInner.toLocaleString(intl))}`
          : null}
      </p>
    </fieldset>
  );
}
