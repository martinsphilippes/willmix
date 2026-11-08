import { Fragment, type ReactNode } from "react";
import { Table, Td, rowClass } from "./ui";

/**
 * Campos e valores em linhas (duas duplas por linha na tela larga), no lugar
 * da lista de rótulos empilhados: o mesmo conteúdo, "em linha".
 */
export function PairsTable({
  items,
  perRow = 2,
}: {
  items: Array<[ReactNode, ReactNode]>;
  /** Duplas campo/valor por linha. */
  perRow?: 1 | 2;
}) {
  const rows: Array<Array<[ReactNode, ReactNode]>> = [];
  for (let i = 0; i < items.length; i += perRow)
    rows.push(items.slice(i, i + perRow));
  return (
    <Table>
      <tbody>
        {rows.map((pair, i) => (
          <tr key={i} className={rowClass}>
            {pair.map(([label, value], j) => (
              <Fragment key={j}>
                <Td className="w-44 bg-zinc-50/70 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {label}
                </Td>
                <Td className="min-w-40">{value}</Td>
              </Fragment>
            ))}
            {pair.length < perRow ? (
              <Td colSpan={2 * (perRow - pair.length)} />
            ) : null}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
