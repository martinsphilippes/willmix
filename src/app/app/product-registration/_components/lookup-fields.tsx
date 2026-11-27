"use client";

import { useState } from "react";
import {
  SearchPicker,
  type SearchOption,
  type SearchPickerLabels,
} from "@/components/search-picker";
import { Alert } from "@/components/ui";

/*
 * Campos com as listas do Sankhya no Cadastrar produto (dono, 27/11/2026;
 * docs/PRODUCT_REGISTRATION.md, "Listas do Sankhya"): quem cadastra digita e
 * a lista vai filtrando até escolher o código. O código vai no campo
 * `f.<campo>` e o nome em `f.<campo>:name` (só o código vai ao Sankhya; a
 * marca leva também o nome).
 */

export interface LookupChoice {
  code: string;
  name: string;
}

export function LookupField({
  fieldId,
  options,
  initial,
  labels,
  ariaLabel,
}: {
  fieldId: string;
  options: readonly LookupChoice[];
  initial: LookupChoice | null;
  labels: SearchPickerLabels;
  ariaLabel: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const searchOptions: SearchOption[] = options.map((o) => ({
    id: o.code,
    name: o.name,
    code: o.code,
  }));
  return (
    <div data-registration-lookup={fieldId}>
      <SearchPicker
        options={searchOptions}
        summary
        marker="registration-lookup"
        kind={fieldId}
        name={`f.${fieldId}`}
        initial={
          initial
            ? { id: initial.code, name: initial.name, code: initial.code }
            : null
        }
        ariaLabel={ariaLabel}
        labels={labels}
        onChoose={(o) => setName(o?.name ?? "")}
      />
      <input type="hidden" name={`f.${fieldId}:name`} value={name} />
    </div>
  );
}

/**
 * Um Grupo da lista, com os níveis acima dele, em tupla para a página não
 * pesar: [valor, código, nome, sub grupo, nome, coleção, nome, categoria,
 * nome]. Níveis que faltam ficam vazios.
 */
export type GroupTuple = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export interface GroupLabels {
  picker: SearchPickerLabels;
  group: string;
  subgroup: string;
  collection: string;
  category: string;
  fromFamily: string;
  otherFamilies: string;
  /** "A Categoria do grupo escolhido ({chosen}) é diferente da família do book ({family})…" */
  mismatch: string;
  /** "Família do book: {family}". */
  family: string;
}

const join = (code: string, name: string) =>
  code ? (name && name !== code ? `${code} - ${name}` : code) : name || "—";

export function GroupField({
  groups,
  initial,
  family,
  labels,
  ariaLabel,
}: {
  groups: readonly GroupTuple[];
  initial: string | null;
  family: { code: string; name: string } | null;
  labels: GroupLabels;
  ariaLabel: string;
}) {
  const byValue = new Map(groups.map((g) => [g[0], g]));
  const [chosen, setChosen] = useState<GroupTuple | null>(
    initial ? (byValue.get(initial) ?? null) : null,
  );
  // Os da família do book primeiro, sob o título; depois os outros.
  const options: SearchOption[] = groups
    .map((g) => ({
      id: g[0],
      name: g[2],
      code: g[1] || null,
      hint: g[8] || null,
      keywords: [g[4], g[6], g[8]].filter(Boolean).join(" "),
      group: family
        ? g[7] === family.code
          ? labels.fromFamily
          : labels.otherFamilies
        : null,
    }))
    .sort((a, b) =>
      family
        ? Number(a.group !== labels.fromFamily) -
          Number(b.group !== labels.fromFamily)
        : 0,
    );
  const start = chosen;
  const mismatch =
    !!chosen && !!family && !!chosen[7] && chosen[7] !== family.code;
  return (
    <div className="space-y-2" data-registration-group>
      <SearchPicker
        options={options}
        summary
        marker="registration-group"
        kind="group"
        name="f.group"
        initial={
          start
            ? { id: start[0], name: start[2], code: start[1] || null }
            : initial
              ? { id: initial, name: initial, code: initial }
              : null
        }
        ariaLabel={ariaLabel}
        labels={labels.picker}
        onChoose={(o) => setChosen(o ? (byValue.get(o.id) ?? null) : null)}
      />
      {chosen ? (
        <dl
          className="grid gap-x-4 gap-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs sm:grid-cols-2"
          data-registration-group-path
        >
          <div>
            <dt className="text-zinc-500">{labels.group}</dt>
            <dd className="font-medium text-zinc-800">
              {join(chosen[1], chosen[2])}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">{labels.subgroup}</dt>
            <dd className="text-zinc-800">{join(chosen[3], chosen[4])}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{labels.collection}</dt>
            <dd className="text-zinc-800">{join(chosen[5], chosen[6])}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">{labels.category}</dt>
            <dd
              className="text-zinc-800"
              data-registration-category={chosen[7]}
            >
              {join(chosen[7], chosen[8])}
            </dd>
          </div>
        </dl>
      ) : null}
      {family ? (
        <p className="text-xs text-zinc-500">
          {labels.family.replace("{family}", join(family.code, family.name))}
        </p>
      ) : null}
      {mismatch ? (
        <div data-registration-family-mismatch>
          <Alert tone="warning">
            {labels.mismatch
              .replace("{chosen}", join(chosen[7], chosen[8]))
              .replace("{family}", join(family.code, family.name))}
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
