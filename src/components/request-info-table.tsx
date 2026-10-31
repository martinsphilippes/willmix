import type { ReactNode } from "react";
import { Table, Td, Th } from "@/components/ui";

/*
 * Dados da solicitação em uma linha de tabela: cada coluna é uma informação
 * (quantidade, prazo, validade, descrição e cada linha da especificação,
 * "Categoria", "Material", "Cor"…). Mesmo padrão de linhas das outras telas;
 * em tela estreita a tabela rola de lado.
 */

export type InfoColumn = [label: ReactNode, value: ReactNode];

/**
 * Especificação em texto ("Categoria: Celular\nMaterial: …") vira uma coluna
 * por linha: o que vem antes dos dois-pontos é o título. Linha sem título
 * entra em `fallbackLabel`.
 */
export function specificationColumns(
  text: string | null | undefined,
  fallbackLabel: string,
): InfoColumn[] {
  if (!text) return [];
  const out: InfoColumn[] = [];
  const loose: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([^:]{1,60}):\s*(.+)$/.exec(line);
    if (m) out.push([m[1].trim(), m[2].trim()]);
    else loose.push(line);
  }
  if (loose.length) out.push([fallbackLabel, loose.join(" · ")]);
  return out;
}

export function RequestInfoTable({
  columns,
  rowKey,
}: {
  columns: InfoColumn[];
  /** Atributo da linha (ex.: id da solicitação) para testes e âncoras. */
  rowKey?: string;
}) {
  const shown = columns.filter(([, v]) => v !== null && v !== undefined);
  if (!shown.length) return null;
  return (
    <Table>
      <thead>
        <tr>
          {shown.map(([label], i) => (
            <Th key={i} className="whitespace-nowrap">
              {label}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr data-request-info={rowKey}>
          {shown.map(([, value], i) => (
            <Td key={i} className="min-w-28 max-w-xs align-top">
              {value === "" ? "—" : value}
            </Td>
          ))}
        </tr>
      </tbody>
    </Table>
  );
}
