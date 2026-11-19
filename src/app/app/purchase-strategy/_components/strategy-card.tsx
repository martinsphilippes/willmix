import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import type { PackingBasis, PackingTotals } from "@/lib/strategy-packing";
import type { PackingTexts } from "./packing-cells";

/*
 * Peças da grade de estratégias (dono, 19/11/2026; docs/PURCHASE_DEMAND.md,
 * "Grade de estratégias"): três colunas de cards pequenos, fundo branco,
 * borda discreta e fonte menor. Sem estado: servem à fila (navegador) e a
 * "Em andamento" (servidor). Rótulos curtos com a explicação a um toque,
 * passando o mouse ou com o teclado (Tab); o texto completo, as contas e os
 * avisos ficam no painel Detalhes.
 */

/** Textos curtos dos cards (já no idioma de quem lê). */
export interface CardTexts {
  pieces: string;
  piecesTip: string;
  master: string;
  inner: string;
  cbm: string;
  /** "{n} pç/cx". */
  perBox: string;
  /** "{cbm} m³/cx". */
  cbmPerBox: string;
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) =>
    key in values ? String(values[key]) : all,
  );

/** Card da grade: fundo branco, borda discreta e espaço interno pequeno. */
export const cardClass =
  "flex min-w-0 flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white p-2.5 text-xs text-zinc-700";

/**
 * Três colunas lado a lado. Tela estreita: as três colunas continuam, numa
 * área com rolagem para os lados (cada card com largura mínima legível).
 */
export function StrategyGrid({
  children,
  marker,
}: {
  children: ReactNode;
  marker: string;
}) {
  return (
    <div
      className="-mx-1 overflow-x-auto px-1 pb-1"
      data-strategy-grid={marker}
    >
      <div className="grid min-w-[54rem] grid-cols-3 items-start gap-2">
        {children}
      </div>
    </div>
  );
}

/**
 * Rótulo curto com a explicação: aparece ao passar o mouse, ao tocar ou com
 * o foco do teclado (o leitor de tela lê junto, pelo `aria-describedby`).
 */
export function Tip({
  label,
  tip,
  className,
}: {
  label: ReactNode;
  tip: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "group/tip relative inline-flex cursor-help underline decoration-zinc-300 decoration-dotted underline-offset-2 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-brand-500",
        className,
      )}
      tabIndex={0}
      aria-label={tip}
      data-strategy-tip
    >
      {label}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-max max-w-[15rem] whitespace-normal rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-normal leading-4 text-white shadow-lg group-hover/tip:block group-focus/tip:block"
      >
        {tip}
      </span>
    </span>
  );
}

/** Uma informação do card: rótulo curto em cima, valor embaixo. */
export function KV({
  label,
  tip,
  children,
  className,
}: {
  label: string;
  tip?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-[10px] uppercase tracking-wide text-zinc-500">
        {tip ? <Tip label={label} tip={tip} /> : label}
      </dt>
      <dd className="break-words font-medium text-zinc-900">{children}</dd>
    </div>
  );
}

/**
 * Peças | Cx master | Cx inner | m³ total, com o que vai em cada caixa
 * embaixo ("48 pç/cx", "0,12 m³/cx"): os totais em destaque e o "por caixa"
 * em letra menor, para não confundir. INNER sem cadastro: "—". Os números
 * são os do servidor (mesma conta e mesmo arredondamento da ficha).
 */
export function CompactPack({
  totals,
  basis,
  piecesText,
  texts,
  packTexts,
  intl,
  marker,
}: {
  totals: PackingTotals | null;
  basis: PackingBasis | null;
  piecesText: string;
  texts: CardTexts;
  packTexts: PackingTexts;
  intl: string;
  marker: string;
}) {
  const n = (v: number) => v.toLocaleString(intl);
  const m3 = (v: number) =>
    v.toLocaleString(intl, { maximumFractionDigits: 4 });
  const dash = "—";
  const perMaster = basis?.perMaster ?? null;
  const perInner = basis?.perInner ?? null;
  const cbmPer = basis?.cbmPerMaster ?? null;
  const masterSub = perMaster
    ? fill(packTexts.perMaster, { n: n(perMaster) })
    : packTexts.perMasterMissing;
  const innerSub =
    perInner === 0
      ? packTexts.noInner
      : perInner
        ? fill(packTexts.perInner, { n: n(perInner) })
        : packTexts.perInnerMissing;
  const cbmSub = cbmPer
    ? fill(packTexts.cbmPerMaster, { cbm: m3(cbmPer) })
    : packTexts.cbmPerMasterMissing;
  const cells: Array<{
    key: string;
    label: string;
    tip: string;
    value: string;
    sub: string;
  }> = [
    {
      key: "pieces",
      label: texts.pieces,
      tip: `${packTexts.pieces}. ${texts.piecesTip}`,
      value: piecesText,
      sub: "",
    },
    {
      key: "master",
      label: texts.master,
      tip: `${packTexts.master}. ${masterSub}.`,
      value:
        totals?.masterBoxes !== null && totals?.masterBoxes !== undefined
          ? n(totals.masterBoxes)
          : dash,
      sub: perMaster ? fill(texts.perBox, { n: n(perMaster) }) : dash,
    },
    {
      key: "inner",
      label: texts.inner,
      tip: `${packTexts.inner}. ${innerSub}.`,
      value: totals && totals.innerBoxes !== null ? n(totals.innerBoxes) : dash,
      sub: perInner ? fill(texts.perBox, { n: n(perInner) }) : dash,
    },
    {
      key: "cbm",
      label: texts.cbm,
      tip: `${packTexts.cbm}. ${cbmSub}.`,
      value: totals && totals.cbm !== null ? m3(totals.cbm) : dash,
      sub: cbmPer ? fill(texts.cbmPerBox, { cbm: m3(cbmPer) }) : dash,
    },
  ];
  return (
    <dl
      className="grid grid-cols-4 gap-1 rounded-md bg-zinc-50 px-1.5 py-1"
      data-strategy-compact-pack={marker}
    >
      {cells.map((c) => (
        <div key={c.key} className="min-w-0" data-strategy-pack-cell={c.key}>
          <dt className="truncate text-[10px] uppercase tracking-wide text-zinc-500">
            <Tip label={c.label} tip={c.tip} />
          </dt>
          <dd
            className="truncate text-[13px] font-semibold tabular-nums text-zinc-900"
            title={c.value}
            data-strategy-pack={c.key}
          >
            {c.value}
          </dd>
          {c.sub ? (
            <dd className="truncate text-[10px] tabular-nums text-zinc-500">
              {c.sub}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
