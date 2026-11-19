import type { ReactNode } from "react";
import Link from "next/link";
import { cx, linkClass } from "@/components/ui";
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

/** Produtos mostrados no card (os outros ficam no painel Detalhes). */
export const CARD_PRODUCTS = 2;

/** Card da grade: fundo branco, borda discreta e espaço interno pequeno. */
export const cardClass =
  "flex min-w-0 flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-700";

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
 * o foco do teclado (Tab). O leitor de tela lê o rótulo e a explicação
 * (texto só para ele); a caixinha visível fica fora da leitura. A caixinha
 * cabe dentro do próprio card (até 10rem; o card tem no mínimo ~18rem): a
 * grade rola para os lados e corta o que passa da borda dela. Na metade
 * direita do card, `align="end"` abre a caixinha para a esquerda. Quem usa
 * não põe `truncate` (overflow escondido) em volta: cortaria a caixinha.
 */
export function Tip({
  label,
  tip,
  align = "start",
  className,
}: {
  label: ReactNode;
  tip: string;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "group/tip relative inline-flex cursor-help underline decoration-zinc-300 decoration-dotted underline-offset-2 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-brand-500",
        className,
      )}
      tabIndex={0}
      data-strategy-tip
    >
      {label}
      <span className="sr-only">: {tip}</span>
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute top-full z-30 mt-1 hidden w-max max-w-[10rem] whitespace-normal rounded-md bg-zinc-900 px-2 py-1 text-left text-[11px] font-normal normal-case leading-4 tracking-normal text-white shadow-lg group-hover/tip:block group-focus/tip:block",
          align === "end" ? "right-0" : "left-0",
        )}
        data-strategy-tip-box
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
  align,
  children,
  className,
}: {
  label: string;
  tip?: string;
  /** Coluna da direita: a explicação abre para a esquerda. */
  align?: "start" | "end";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className="text-[10px] uppercase tracking-wide text-zinc-500">
        {tip ? <Tip label={label} tip={tip} align={align} /> : label}
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
      className="grid grid-cols-4 gap-1 rounded-md bg-zinc-50 px-1.5 py-0.5"
      data-strategy-compact-pack={marker}
    >
      {cells.map((c, i) => (
        <div key={c.key} className="min-w-0" data-strategy-pack-cell={c.key}>
          {/* Sem `truncate` aqui: cortaria a caixinha da explicação. */}
          <dt className="break-words text-[10px] uppercase tracking-wide text-zinc-500">
            <Tip label={c.label} tip={c.tip} align={i >= 2 ? "end" : "start"} />
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

/** A última compra no card, já escrita (fila e "Em andamento"). */
export interface LastData {
  supplierName: string;
  /** "USD 1,4" (só com "Ver preço de compra"); nulo: não aparece. */
  price: string | null;
  orderHref: string;
  /** "#2 · 19/11/2026". */
  orderLabel: string;
  leadTime: string | null;
  incoterm: string | null;
  moq: string | null;
}

export interface LastTexts {
  /** "Última compra". */
  last: string;
  lastTip: string;
  /** "Pedido". */
  order: string;
  lead: string;
  leadTip: string;
  incoterm: string;
  incotermTip: string;
  moq: string;
  moqTip: string;
}

/**
 * Última compra em duas linhas (dono, 19/11/2026, cards mais baixos):
 * "Última compra: fornecedor · preço · Pedido #2 · 19/11/2026" e, embaixo,
 * Prazo | Incoterm | Mín. As explicações ficam em lugares fixos (início da
 * linha e as três colunas), para a caixinha caber no card.
 */
export function LastLines({
  data,
  texts,
  ...rest
}: {
  data: LastData;
  texts: LastTexts;
} & { [key: `data-${string}`]: string | number | undefined }) {
  const cell = (
    label: string,
    tip: string,
    value: string | null,
    align: "start" | "end" = "start",
  ) => (
    <span
      className={cx("min-w-0 break-words", align === "end" && "text-right")}
    >
      <span className="text-zinc-500">
        <Tip label={label} tip={tip} align={align} />:
      </span>{" "}
      <span className="font-medium text-zinc-900">{value ?? "—"}</span>
    </span>
  );
  return (
    <div className="space-y-0.5 border-t border-zinc-100 pt-1" {...rest}>
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">
          <Tip label={texts.last} tip={texts.lastTip} />
        </span>
        <span
          className="min-w-0 max-w-full truncate font-medium text-zinc-900"
          title={data.supplierName}
        >
          {data.supplierName}
        </span>
        {data.price ? (
          <span className="font-semibold tabular-nums text-zinc-900">
            {data.price}
          </span>
        ) : null}
        <span className="text-zinc-600">
          {texts.order}{" "}
          <Link href={data.orderHref} className={linkClass}>
            {data.orderLabel}
          </Link>
        </span>
      </p>
      <p className="grid grid-cols-3 gap-x-1.5 text-[11px]">
        {cell(texts.lead, texts.leadTip, data.leadTime)}
        {cell(texts.incoterm, texts.incotermTip, data.incoterm)}
        {cell(texts.moq, texts.moqTip, data.moq, "end")}
      </p>
    </div>
  );
}
