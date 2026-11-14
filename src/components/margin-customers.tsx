"use client";

import { useState } from "react";
import { PartyPicker, type PartyPickerLabels } from "./party-picker";
import { Input } from "./ui";

/*
 * Margem por cliente com o cadastro grande (auditoria de performance,
 * 14/11/2026). A lista com um campo para cada cliente fazia a tela de
 * Configurações sair com 62 MB (26 mil clientes). Aqui aparecem os clientes que
 * já têm margem própria, e a busca inclui outro na lista. Os campos têm o mesmo
 * nome de antes (`marginByCustomer.<id>`), e a gravação não muda: cliente sem
 * valor continua sem margem própria.
 */
export function MarginCustomers({
  rows,
  values,
  placeholder,
  addLabel,
  pickerLabels,
}: {
  rows: Array<{ id: string; name: string }>;
  values: Record<string, number>;
  placeholder: string;
  addLabel: string;
  pickerLabels: PartyPickerLabels;
}) {
  const [added, setAdded] = useState<Array<{ id: string; name: string }>>([]);
  const shown = [
    ...rows,
    ...added.filter((a) => !rows.some((r) => r.id === a.id)),
  ];
  return (
    <>
      <ul
        className="mt-2 grid gap-x-6 gap-y-1.5 @sm:grid-cols-2 @2xl:grid-cols-3"
        data-margin-customers
      >
        {shown.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3">
            <label
              htmlFor={`marginByCustomer-${r.id}`}
              className="min-w-0 truncate text-[13px] text-zinc-700"
            >
              {r.name}
            </label>
            <span className="flex shrink-0 items-center gap-1">
              <Input
                id={`marginByCustomer-${r.id}`}
                name={`marginByCustomer.${r.id}`}
                type="number"
                step="any"
                min="0"
                max="1000"
                placeholder={placeholder}
                defaultValue={values[r.id] ?? ""}
                className="w-24!"
              />
              <span className="text-sm text-zinc-500">%</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 max-w-md" data-margin-customer-add>
        <PartyPicker
          // Nova busca vazia depois de cada inclusão.
          key={added.length}
          type="customer"
          ariaLabel={addLabel}
          labels={{ ...pickerLabels, placeholder: addLabel }}
          onChoose={(option) => {
            if (option)
              setAdded((list) =>
                list.some((a) => a.id === option.id)
                  ? list
                  : [...list, { id: option.id, name: option.name }],
              );
          }}
        />
      </div>
    </>
  );
}
