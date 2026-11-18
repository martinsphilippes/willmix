"use client";

import { useMemo, useState } from "react";
import { familyMatches } from "@/lib/party-families";

/** Família oferecida no cadastro do parceiro (já sem códigos repetidos). */
export interface FamilyChoice {
  code: string;
  name: string;
  active: boolean;
}

export interface PartyFamiliesLabels {
  search: string;
  /** "Selecionadas ({n})". */
  selected: string;
  none: string;
  noMatch: string;
  /** "Cód. {code}". */
  code: string;
  inactive: string;
  /** "Tirar {name}". */
  remove: string;
}

/*
 * Grupo de produto (família) do parceiro (docs/PARTNER_FAMILIES.md): busca
 * por nome ou código, várias seleções e as selecionadas à vista, com o
 * código ao lado do nome (distingue famílias de mesmo nome). As caixas
 * escondidas pela busca continuam no formulário: gravar não perde a seleção.
 */
export function PartyFamiliesPicker({
  families,
  selected,
  labels,
}: {
  families: FamilyChoice[];
  selected: string[];
  labels: PartyFamiliesLabels;
}) {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(selected));
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () =>
      new Set(
        families.filter((f) => familyMatches(f, query)).map((f) => f.code),
      ),
    [families, query],
  );
  const toggle = (code: string, on: boolean) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (on) next.add(code);
      else next.delete(code);
      return next;
    });
  const picked = families.filter((f) => chosen.has(f.code));
  const codeText = (code: string) => labels.code.replace("{code}", code);
  return (
    <div className="space-y-3" data-party-families-picker>
      <div data-party-families-selected={picked.length}>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {labels.selected.replace("{n}", String(picked.length))}
        </p>
        {picked.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {picked.map((f) => (
              <li
                key={f.code}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-900 ring-1 ring-inset ring-brand-200"
                data-party-family-chip={f.code}
              >
                {f.name}
                <span className="font-mono text-[11px] text-brand-700">
                  {codeText(f.code)}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(f.code, false)}
                  className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-brand-700 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-600"
                  aria-label={labels.remove.replace("{name}", f.name)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">{labels.none}</p>
        )}
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={labels.search}
        aria-label={labels.search}
        className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-brand-600"
        data-party-families-search
      />
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {families.map((f) => (
          <label
            key={f.code}
            hidden={!shown.has(f.code)}
            className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-zinc-50"
            data-party-family-option={f.code}
          >
            <input
              type="checkbox"
              name="familyCode"
              value={f.code}
              checked={chosen.has(f.code)}
              onChange={(e) => toggle(f.code, e.target.checked)}
              className="h-4 w-4 shrink-0 accent-brand-600"
              data-party-family={f.code}
            />
            <span className="min-w-0 truncate">{f.name}</span>
            <span className="shrink-0 font-mono text-[11px] text-zinc-500">
              {codeText(f.code)}
            </span>
            {!f.active ? (
              <span className="shrink-0 text-[11px] text-amber-700">
                {labels.inactive}
              </span>
            ) : null}
          </label>
        ))}
      </div>
      {shown.size === 0 ? (
        <p className="text-sm text-zinc-500" data-party-families-no-match>
          {labels.noMatch}
        </p>
      ) : null}
    </div>
  );
}
