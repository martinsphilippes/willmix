import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import type { PackingBasis, PackingTotals } from "@/lib/strategy-packing";

/*
 * Quantidade (peças) | Caixas master (total) | Caixas inner (total) |
 * Cubagem total (m³), lado a lado (dono, 18/11/2026; docs/PURCHASE_DEMAND.md,
 * "Embalagem e cubagem na Estratégia"). Sem estado: a fila e "Em andamento"
 * mostram os totais do servidor; o formulário do pedido passa o campo da
 * quantidade e os totais refeitos a cada tecla.
 *
 * Campo editável: fundo branco com borda. Total calculado: fundo cinza, sem
 * borda. Dado gravado (a quantidade fora do formulário): o número, sem caixa.
 */

export interface PackingTexts {
  pieces: string;
  master: string;
  inner: string;
  cbm: string;
  perMaster: string;
  perMasterMissing: string;
  perInner: string;
  perInnerMissing: string;
  noInner: string;
  cbmPerMaster: string;
  cbmPerMasterMissing: string;
  calculated: string;
  legend: string;
  noteMasterExact: string;
  noteMasterUp: string;
  noteMasterRounds: string;
  noteCbm: string;
  warnMasterIncomplete: string;
  warnMasterIncompleteRounds: string;
  warnInnerIncomplete: string;
  warnInnerMismatch: string;
  warnInnerBigger: string;
  warnInnerSame: string;
  warnCbmOtherBox: string;
  warnQtyInvalid: string;
}

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (all, key: string) =>
    key in values ? String(values[key]) : all,
  );

/** Rótulo dos campos da tela (o mesmo do `Field`, acima do campo). */
export const packingLabelClass =
  "block text-xs font-medium leading-5 text-zinc-700";

/**
 * A grade da tela: quatro colunas iguais no computador e no iPad (os campos
 * de uma linha ficam embaixo dos da outra) e duas no celular.
 */
export const packingGridClass =
  "grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-[repeat(4,minmax(0,11.5rem))] sm:gap-x-5";

/** Linha de apoio embaixo do valor (peças por embalagem, CBM da master). */
const subClass = "mt-0.5 block text-[11px] leading-4 text-zinc-500";

/** Valor calculado: mesma altura do campo, fundo cinza e sem borda. */
const calcClass =
  "flex min-h-8 items-center rounded-md bg-zinc-100 px-2.5 text-[13px] font-semibold tabular-nums text-zinc-900 pointer-coarse:min-h-10";

/** Quantidade gravada (fora do formulário): o número, sem caixa. */
const plainClass =
  "flex min-h-8 items-center text-[13px] font-semibold tabular-nums text-zinc-900 pointer-coarse:min-h-10";

function Cell({
  label,
  sub,
  children,
  marker,
}: {
  label: string;
  sub?: string | null;
  children: ReactNode;
  marker: string;
}) {
  return (
    <div className="min-w-0" data-strategy-pack-cell={marker}>
      <span className={packingLabelClass}>{label}</span>
      {children}
      {sub ? <span className={subClass}>{sub}</span> : null}
    </div>
  );
}

function Calc({
  value,
  texts,
  marker,
}: {
  value: string;
  texts: PackingTexts;
  marker: string;
}) {
  return (
    <output
      className={calcClass}
      title={texts.calculated}
      aria-live="polite"
      data-strategy-pack={marker}
    >
      {value}
      <span className="sr-only"> ({texts.calculated})</span>
    </output>
  );
}

/** Os avisos e a conta escrita dos totais (no idioma de quem lê). */
export function packingMessages(
  totals: PackingTotals | null,
  basis: PackingBasis | null,
  texts: PackingTexts,
  intl: string,
): { notes: string[]; warnings: string[] } {
  const notes: string[] = [];
  const warnings: string[] = [];
  if (!totals || !basis) return { notes, warnings };
  const n = (v: number) => v.toLocaleString(intl);
  const per = basis.perMaster;
  if (totals.masterBoxes !== null && per) {
    if (totals.masterByParcel.length > 1)
      notes.push(
        fill(texts.noteMasterRounds, {
          list: totals.masterByParcel.map(n).join(" + "),
        }),
      );
    else if (totals.masterIncomplete.length)
      notes.push(
        fill(texts.noteMasterUp, {
          pieces: n(totals.pieces),
          per: n(per),
          exact: (totals.pieces / per).toLocaleString(intl, {
            maximumFractionDigits: 2,
          }),
          boxes: n(totals.masterBoxes),
        }),
      );
    else
      notes.push(
        fill(texts.noteMasterExact, {
          pieces: n(totals.pieces),
          per: n(per),
          boxes: n(totals.masterBoxes),
        }),
      );
    if (totals.masterIncomplete.length)
      warnings.push(
        totals.masterByParcel.length > 1
          ? fill(texts.warnMasterIncompleteRounds, {
              n: totals.masterIncomplete.length,
              list: totals.masterIncomplete.map(n).join(" / "),
            })
          : fill(texts.warnMasterIncomplete, {
              rest: n(totals.masterIncomplete[0]),
              per: n(per),
            }),
      );
  }
  if (totals.cbm !== null && totals.masterBoxes !== null && basis.cbmPerMaster)
    notes.push(
      fill(texts.noteCbm, {
        boxes: n(totals.masterBoxes),
        cbm: basis.cbmPerMaster.toLocaleString(intl, {
          maximumFractionDigits: 4,
        }),
        total: totals.cbm.toLocaleString(intl, { maximumFractionDigits: 4 }),
      }),
    );
  const check = totals.innerCheck;
  if (totals.inner === "mismatch" && check && basis.perInner && per)
    warnings.push(
      fill(
        check.kind === "bigger"
          ? texts.warnInnerBigger
          : texts.warnInnerMismatch,
        { inner: n(basis.perInner), master: n(per) },
      ),
    );
  else if (totals.inner === "count" && check?.kind === "same")
    warnings.push(texts.warnInnerSame);
  else if (
    totals.inner === "count" &&
    totals.innerIncomplete.length === 1 &&
    totals.innerByParcel.length <= 1 &&
    basis.perInner
  )
    warnings.push(
      fill(texts.warnInnerIncomplete, {
        rest: n(totals.innerIncomplete[0]),
        per: n(basis.perInner),
      }),
    );
  if (totals.cbmState === "otherBox" && basis.cbmOtherBox && per)
    warnings.push(
      fill(texts.warnCbmOtherBox, {
        box: n(basis.cbmOtherBox),
        per: n(per),
      }),
    );
  return { notes, warnings };
}

export function PackingCells({
  totals,
  basis,
  texts,
  intl,
  quantity,
  piecesText,
  extraWarnings = [],
  marker,
}: {
  /** Totais da quantidade; nulo = sem quantidade válida (ou sem embalagem). */
  totals: PackingTotals | null;
  /** Embalagem; nula = encomendas do produto com embalagens diferentes. */
  basis: PackingBasis | null;
  texts: PackingTexts;
  intl: string;
  /** O campo da quantidade (formulário do pedido); sem ele, `piecesText`. */
  quantity?: ReactNode;
  /** A quantidade gravada, já escrita (fora do formulário). */
  piecesText?: string | null;
  /** Avisos que vêm do servidor (programação, unidade, embalagens diferentes). */
  extraWarnings?: string[];
  marker: string;
}) {
  const n = (v: number) => v.toLocaleString(intl);
  const dash = "—";
  const perMaster = basis?.perMaster ?? null;
  const perInner = basis?.perInner ?? null;
  const cbmPer = basis?.cbmPerMaster ?? null;
  const master =
    totals?.masterBoxes !== null && totals?.masterBoxes !== undefined
      ? n(totals.masterBoxes)
      : dash;
  const inner =
    totals && totals.innerBoxes !== null ? n(totals.innerBoxes) : dash;
  const cbm =
    totals && totals.cbm !== null
      ? totals.cbm.toLocaleString(intl, { maximumFractionDigits: 4 })
      : dash;
  const { notes, warnings } = packingMessages(totals, basis, texts, intl);
  const allWarnings = [...extraWarnings, ...warnings];
  return (
    <div className="space-y-1" data-strategy-packing={marker}>
      <div className={packingGridClass}>
        <Cell label={texts.pieces} marker="pieces">
          {quantity ?? (
            <span className={plainClass} data-strategy-pack="pieces">
              {piecesText ?? dash}
            </span>
          )}
        </Cell>
        <Cell
          label={texts.master}
          marker="master"
          sub={
            perMaster
              ? fill(texts.perMaster, { n: n(perMaster) })
              : texts.perMasterMissing
          }
        >
          <Calc value={master} texts={texts} marker="master" />
        </Cell>
        <Cell
          label={texts.inner}
          marker="inner"
          sub={
            perInner === 0
              ? texts.noInner
              : perInner
                ? fill(texts.perInner, { n: n(perInner) })
                : texts.perInnerMissing
          }
        >
          <Calc value={inner} texts={texts} marker="inner" />
        </Cell>
        <Cell
          label={texts.cbm}
          marker="cbm"
          sub={
            cbmPer
              ? fill(texts.cbmPerMaster, {
                  cbm: cbmPer.toLocaleString(intl, {
                    maximumFractionDigits: 4,
                  }),
                })
              : texts.cbmPerMasterMissing
          }
        >
          <Calc value={cbm} texts={texts} marker="cbm" />
        </Cell>
      </div>
      {notes.length ? (
        <p
          className="text-[11px] leading-4 text-zinc-500"
          data-strategy-pack-note
        >
          {notes.join(" · ")}
        </p>
      ) : null}
      {allWarnings.length ? (
        <ul
          className={cx("space-y-0.5 text-[11px] font-medium leading-4")}
          data-strategy-pack-warnings
        >
          {allWarnings.map((w) => (
            <li key={w} className="text-amber-800">
              {w}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
