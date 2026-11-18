import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import type { SaleTotal, TotalKey, TotalPart } from "@/lib/request-totals";

/*
 * Células dos totais de Encomendas (dono, 18/11/2026; lista, página da
 * encomenda): o número formatado na língua da tela, "Total parcial" com os
 * produtos sem o dado na dica, ou "—" quando nenhum produto tem o dado
 * (diferente de zero). As contas ficam em src/lib/request-totals.ts.
 */

const MAX_NAMES = 8;

/**
 * Rótulo de cabeçalho com a unidade "m³" em minúscula: os cabeçalhos são em
 * caixa alta, e "M³" leria como outra unidade.
 */
export function unitLabel(text: string): ReactNode {
  const parts = text.split("m³");
  if (parts.length === 1) return text;
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <span key={i} className="normal-case">
            m³
          </span>,
          part,
        ],
  );
}

function namesText(t: Translate, names: readonly string[]) {
  return names.length > MAX_NAMES
    ? `${names.slice(0, MAX_NAMES).join(", ")} ${t("reqList.total.more", { n: names.length - MAX_NAMES })}`
    : names.join(", ");
}

/** "Sem o dado: A, B" (ou "nenhum produto tem o dado"). */
export function missingText(t: Translate, names: readonly string[]) {
  return names.length
    ? t("reqList.total.missing", { list: namesText(t, names) })
    : t("reqList.total.empty");
}

/** Quantidades: peças, caixas, inner e mínimo (até 2 casas, se houver). */
export const qtyText = (t: Translate, n: number) =>
  n.toLocaleString(t.intl, { maximumFractionDigits: 2 });

/**
 * m³ com 3 casas na tela (a conta e a dica têm 4): com 3, a soma dos
 * produtos na página da encomenda bate com o total (271,938 + 135,966 =
 * 407,904; com 2 casas daria 407,91 contra 407,90).
 */
export const cbmText = (t: Translate, n: number) =>
  n.toLocaleString(t.intl, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

/** Valor em dinheiro (R$, US$…); moeda desconhecida vai escrita antes. */
export function moneyValue(t: Translate, amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(t.intl, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(t.intl, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

/** Dica de cada total: a regra da conta (o CBM com 4 casas). */
function hintOf(t: Translate, key: TotalKey, value: number) {
  switch (key) {
    case "cbm":
      return t("reqList.total.cbm.hint", {
        exact: value.toLocaleString(t.intl, { maximumFractionDigits: 4 }),
      });
    case "moq":
      return t("reqList.total.moq.hint");
    case "pieces":
      return t("reqList.total.pieces.hint");
    case "boxes":
      return t("reqList.total.boxes.hint");
    case "inner":
      return t("reqList.total.inner.hint");
  }
}

function PartialMark({ t }: { t: Translate }) {
  return (
    <span className="block text-[11px] font-medium text-amber-700">
      {t("reqList.total.partial")}
    </span>
  );
}

/** Um total em quantidade ou m³ (peças, caixas, inner, CBM, mínimo). */
export function TotalValue({
  t,
  part,
  total,
}: {
  t: Translate;
  part: TotalPart;
  total: TotalKey;
}) {
  if (part.value === null)
    return (
      <span
        className="text-zinc-400"
        title={missingText(t, part.missing)}
        data-request-total={total}
        data-total-empty=""
      >
        —
      </span>
    );
  const partial = part.missing.length > 0;
  const hint = hintOf(t, total, part.value);
  return (
    <span
      className="whitespace-nowrap tabular-nums"
      title={partial ? `${hint}. ${missingText(t, part.missing)}` : hint}
      data-request-total={total}
      data-total-value={String(part.value)}
      data-total-partial={partial ? "" : undefined}
    >
      {total === "cbm" ? cbmText(t, part.value) : qtyText(t, part.value)}
      {partial ? <PartialMark t={t} /> : null}
    </span>
  );
}

/** Preço total: a venda prevista, uma linha por moeda. */
export function SaleTotalValue({
  t,
  sale,
  hint,
}: {
  t: Translate;
  sale: SaleTotal;
  /** Dica no lugar da padrão (o preço por peça de um produto, por exemplo). */
  hint?: string;
}) {
  if (!sale.amounts.length)
    return (
      <span
        className="text-zinc-400"
        title={t("reqList.total.price.none")}
        data-request-total="price"
        data-total-empty=""
      >
        —
      </span>
    );
  const partial = sale.missing.length > 0;
  const base = hint ?? t("reqList.total.price.hint");
  return (
    <span
      className="whitespace-nowrap tabular-nums"
      title={partial ? `${base}. ${missingText(t, sale.missing)}` : base}
      data-request-total="price"
      data-total-value={sale.amounts
        .map((a) => `${a.currency} ${a.amount.toFixed(2)}`)
        .join(" ")}
      data-total-partial={partial ? "" : undefined}
    >
      {sale.amounts.map((a) => (
        <span key={a.currency} className="block">
          {moneyValue(t, a.amount, a.currency)}
        </span>
      ))}
      {partial ? <PartialMark t={t} /> : null}
    </span>
  );
}
