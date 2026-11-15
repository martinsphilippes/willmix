"use client";

import { Fragment, useMemo, useState } from "react";
import { useRequestCustomer } from "./request-customer-context";
import { Card } from "./ui";
import {
  containerComposition,
  sharePercent,
} from "@/lib/container-composition";

export interface ContainerCompositionLabels {
  title: string;
  hint: string;
  empty: string;
  container: string;
  /** "Container {n}" */
  containerN: string;
  /** "Programação {n}" */
  roundN: string;
  expand: string;
  collapse: string;
  unused: string;
  /** "Container de referência: {code} ({cbm} m³)" */
  reference: string;
  mixed: string;
  /** "Sem caixa master ou CBM no cadastro: {names}" */
  missing: string;
  /** "A caixa não cabe no container: {names}" */
  tooBig: string;
  /** "{cartons} cx" */
  cartons: string;
  intl: string;
}

/**
 * Composição de containers da Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md seção 8): linhas = containers, colunas =
 * programações. Cada célula é a ocupação do container naquela programação
 * (a soma das caixas dos produtos do pedido dentro dele); cada linha nasce
 * fechada e abre para mostrar a ocupação de cada produto. Lê as
 * programações e a carga de cada produto do formulário ao lado.
 */
export function ContainerComposition({
  labels,
  className,
}: {
  labels: ContainerCompositionLabels;
  className?: string;
}) {
  const shared = useRequestCustomer();
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const dates = useMemo(() => shared?.planDates ?? [], [shared?.planDates]);
  const loads = useMemo(
    () => Object.values(shared?.loads ?? {}),
    [shared?.loads],
  );
  // O container de referência: o escolhido na 1ª linha de produto com um.
  const reference = loads.find((l) => l.capacityCbm && l.containerCode);
  const mixed = loads.some(
    (l) =>
      l.containerCode &&
      reference &&
      l.containerCode !== reference.containerCode,
  );
  const rounds = Math.max(
    dates.length,
    ...loads.map((l) => l.pieces.length),
    0,
  );
  const capacity = reference?.capacityCbm ?? null;
  const composition =
    capacity && rounds ? containerComposition(loads, rounds, capacity) : null;
  const fmtDate = (iso: string | undefined) =>
    iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(labels.intl) : "";
  const pct = (share: number) => `${sharePercent(share)}%`;
  const tone = (share: number) =>
    share >= 0.95
      ? "bg-emerald-50 text-emerald-800"
      : share >= 0.6
        ? "bg-amber-50 text-amber-800"
        : "bg-zinc-50 text-zinc-700";

  return (
    <Card title={labels.title} className={className}>
      <div
        data-container-composition={
          composition?.rows.length ? "ready" : "empty"
        }
      >
        <p className="mb-2 text-xs text-zinc-500">{labels.hint}</p>
        {!composition || !composition.rows.length ? (
          <p className="text-sm text-zinc-500">{labels.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-xs">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="sticky left-0 bg-white px-2 py-1.5 font-semibold">
                    {labels.container}
                  </th>
                  {Array.from({ length: composition.rounds }, (_, r) => (
                    <th
                      key={r}
                      className="px-2 py-1.5 text-right font-semibold"
                      data-composition-round={r + 1}
                    >
                      <span className="block">
                        {labels.roundN.replace("{n}", String(r + 1))}
                      </span>
                      <span className="block font-normal">
                        {fmtDate(dates[r])}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {composition.rows.map((row) => {
                  const expanded = !!open[row.n];
                  // Os produtos que entram neste container em alguma programação.
                  const products = [
                    ...new Map(
                      row.cells
                        .flatMap((c) => c?.products ?? [])
                        .map((p) => [p.key, p.name]),
                    ).entries(),
                  ];
                  return (
                    <Fragment key={row.n}>
                      <tr
                        className="border-t border-zinc-100"
                        data-composition-container={row.n}
                      >
                        <th className="sticky left-0 bg-white px-2 py-1.5 text-left font-medium text-zinc-800">
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-label={`${expanded ? labels.collapse : labels.expand}: ${labels.containerN.replace("{n}", String(row.n))}`}
                            onClick={() =>
                              setOpen((o) => ({ ...o, [row.n]: !expanded }))
                            }
                            className="flex items-center gap-1.5"
                            data-composition-toggle={row.n}
                          >
                            <span
                              aria-hidden
                              className={`inline-block transition-transform ${expanded ? "rotate-90" : ""}`}
                            >
                              ▸
                            </span>
                            {labels.containerN.replace("{n}", String(row.n))}
                          </button>
                        </th>
                        {row.cells.map((cell, r) => (
                          <td
                            key={r}
                            className="px-2 py-1.5 text-right"
                            data-composition-cell={`${row.n}-${r + 1}`}
                          >
                            {cell ? (
                              <span
                                className={`inline-block rounded px-1.5 py-0.5 font-semibold ${tone(cell.share)}`}
                              >
                                {pct(cell.share)}
                              </span>
                            ) : (
                              <span className="text-zinc-400">
                                {labels.unused}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                      {expanded
                        ? products.map(([key, name]) => (
                            <tr
                              key={`${row.n}-${key}`}
                              className="bg-zinc-50/60"
                              data-composition-product={`${row.n}-${key}`}
                            >
                              <td className="sticky left-0 max-w-40 truncate bg-zinc-50 py-1 pl-6 pr-2 text-zinc-600">
                                {name}
                              </td>
                              {row.cells.map((cell, r) => {
                                const share = cell?.products.find(
                                  (p) => p.key === key,
                                );
                                return (
                                  <td
                                    key={r}
                                    className="px-2 py-1 text-right text-zinc-600"
                                  >
                                    {share ? (
                                      <>
                                        <span className="font-medium">
                                          {pct(share.share)}
                                        </span>
                                        <span className="ml-1 text-zinc-400">
                                          {labels.cartons.replace(
                                            "{cartons}",
                                            share.cartons.toLocaleString(
                                              labels.intl,
                                            ),
                                          )}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-zinc-300">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {reference?.containerCode && reference.capacityCbm ? (
          <p className="mt-2 text-xs text-zinc-500" data-composition-reference>
            {labels.reference
              .replace("{code}", reference.containerCode)
              .replace(
                "{cbm}",
                reference.capacityCbm.toLocaleString(labels.intl),
              )}
            {mixed ? ` ${labels.mixed}` : ""}
          </p>
        ) : null}
        {composition?.missing.length ? (
          <p className="mt-1 text-xs text-amber-700">
            {labels.missing.replace("{names}", composition.missing.join(", "))}
          </p>
        ) : null}
        {composition?.tooBig.length ? (
          <p className="mt-1 text-xs text-amber-700">
            {labels.tooBig.replace("{names}", composition.tooBig.join(", "))}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
