import type { CSSProperties } from "react";

/*
 * Colunas fixas à esquerda na rolagem horizontal (dono, 27/11/2026: as
 * primeiras colunas de Consultas ficam à vista). Cada coluna fixa tem uma
 * largura certa; a posição de cada uma é a soma das anteriores mais o
 * respiro da célula (o `px-2.5` de Th e Td, dos dois lados). Fixam a partir
 * de 768px; no celular elas ocupariam a tela.
 */

/** Respiro de uma célula (px-2.5 dos dois lados). */
const PAD = "1.25rem";

export interface PinnedColumns {
  /** Classes da célula fixa (cabeçalho ou linha); a última leva o fio e a sombra. */
  cell: (i: number, head?: boolean) => string;
  /** `left` da célula fixa. */
  style: (i: number) => CSSProperties;
  /** Largura da caixa dentro da célula. */
  box: (i: number) => CSSProperties;
  /** Classe da linha, para o fundo da célula fixa acompanhar o realce. */
  row: string;
}

export function pinnedColumns(widths: readonly string[]): PinnedColumns {
  const left = (i: number) =>
    i === 0 ? "0px" : `calc(${widths.slice(0, i).join(" + ")} + ${i} * ${PAD})`;
  return {
    cell: (i, head = false) =>
      [
        "md:sticky md:z-10",
        head
          ? "md:bg-zinc-50"
          : "md:bg-white md:transition-colors md:group-hover/row:bg-[color-mix(in_srgb,var(--color-brand-50)_40%,white)]",
        i === widths.length - 1
          ? "md:shadow-[inset_-1px_0_0_var(--color-zinc-200),6px_0_6px_-6px_rgba(0,0,0,0.15)]"
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    style: (i) => ({ left: left(i) }),
    box: (i) => ({ width: widths[i], minWidth: widths[i] }),
    row: "group/row",
  };
}
