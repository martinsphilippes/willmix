import type { ReactNode } from "react";
import { cx } from "./ui";

/*
 * Cartões coloridos de valores, no mesmo visual das telas Clientes e
 * Fornecedores (gradiente, valor grande e o nome embaixo). Usados no alto
 * do pedido. Só exibição: cada tela decide quem vê.
 *
 * Layout (pedido do dono, 14/11/2026: valores longos em RMB e negativos em
 * reais saíam cortados):
 * - A grade segue a largura da área de conteúdo (container query), não a da
 *   janela, então vale com o menu lateral aberto ou recolhido: 1, 2, 3, 4 e,
 *   cabendo, todos os cartões por linha. Cada degrau garante cartões de pelo
 *   menos ~158 px, onde um valor de dezenas de milhões ainda cabe a 15 px
 *   (dois por linha já num celular de 360 px).
 * - Dinheiro: a moeda numa linha menor e, embaixo, o número inteiro numa
 *   linha só (dígitos, separadores, decimais e o sinal junto), sem cortar.
 * - Uma regra só para o tamanho do número, igual em todos os cartões: cabe
 *   o maior número do conjunto na largura do cartão, até 22 px.
 */

export const CARD_TONES = {
  indigo: "from-indigo-600 to-violet-500",
  orange: "from-orange-500 to-amber-400",
  sky: "from-sky-600 to-blue-500",
  rose: "from-rose-600 to-pink-500",
  emerald: "from-emerald-600 to-teal-500",
  slate: "from-slate-700 to-slate-500",
  violet: "from-violet-700 to-fuchsia-500",
} as const;
export type CardTone = keyof typeof CARD_TONES;

/** Valor em dinheiro do cartão (formatado aqui, no idioma da tela). */
export interface MoneyValue {
  amount: number;
  currency: string | null;
  /** Estimado (câmbio do dia): "~" antes da moeda. */
  approx?: boolean;
}

export interface ColorCard {
  key: string;
  label: string;
  /** Valor pronto (ex.: "—"); dinheiro vai em `money`. */
  value?: ReactNode;
  /** Dinheiro: a moeda numa linha menor e o número inteiro embaixo. */
  money?: MoneyValue;
  tone: CardTone;
  /** Explicação ao parar o dedo/mouse em cima. */
  hint?: string;
  /** Linha pequena embaixo do valor (ex.: percentual). */
  sub?: ReactNode;
}

/**
 * Moeda e número de um valor no formato do idioma. O sinal fica no número
 * ("-287.929,23"); a moeda sai à parte ("R$", "RMB"). Moeda que o navegador
 * não conhece: o código e o número com duas casas.
 */
export function moneyParts(
  value: Pick<MoneyValue, "amount" | "currency">,
  intl: string,
): { currency: string; number: string } {
  const code = value.currency ?? "BRL";
  try {
    const parts = new Intl.NumberFormat(intl, {
      style: "currency",
      currency: code,
    }).formatToParts(value.amount);
    return {
      currency: parts
        .filter((p) => p.type === "currency")
        .map((p) => p.value)
        .join(""),
      number: parts
        .filter((p) => p.type !== "currency" && p.type !== "literal")
        .map((p) => p.value)
        .join(""),
    };
  } catch {
    return {
      currency: code,
      number: value.amount.toLocaleString(intl, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    };
  }
}

/*
 * Cartões por linha conforme a largura da área (container query; classes
 * fixas para o Tailwind). Degraus: 1, 2, 3, 4 e, cabendo, todos; de 4 vai
 * direto a todos, para não sobrar linha com um ou dois cartões soltos.
 */
const COLS_AT: Record<number, string> = {
  2: "@[20.5rem]:grid-cols-2",
  3: "@[32rem]:grid-cols-3",
  4: "@[43rem]:grid-cols-4",
  5: "@[54rem]:grid-cols-5",
  6: "@[65rem]:grid-cols-6",
  7: "@[76rem]:grid-cols-7",
};

/** Classes de colunas para `n` cartões (até 7 numa linha). */
export function columnClasses(n: number): string[] {
  const all = Math.min(n, 7);
  return [2, 3, 4, all]
    .filter((c, i, list) => c >= 2 && c <= all && list.indexOf(c) === i)
    .map((c) => COLS_AT[c]);
}

/**
 * Largura de um caractere do número em negrito, em "em" (dígitos tabulares
 * da fonte do portal; separadores e sinal são mais estreitos). Com folga.
 */
const CHAR_EM = 0.64;
/** Teto do número: 22 px. */
const MAX_REM = 1.375;

/**
 * Tamanho do número, igual em todos os cartões: o maior número do conjunto
 * cabe na largura do cartão (`cqi` = largura do cartão), até 22 px.
 */
export function valueFontSize(longest: number): string {
  const chars = Math.max(6, longest);
  const fit = (100 / (chars * CHAR_EM)).toFixed(3);
  return `min(${MAX_REM}rem, ${fit}cqi)`;
}

export function ColorCards({
  items,
  name,
  intl,
}: {
  items: ColorCard[];
  /** Marca para testes (data-color-cards). */
  name: string;
  /** Idioma dos números (t.intl). */
  intl: string;
}) {
  if (!items.length) return null;
  const cards = items.map((c) => ({
    ...c,
    parts: c.money ? moneyParts(c.money, intl) : null,
  }));
  const longest = Math.max(
    ...cards.map((c) =>
      c.parts
        ? c.parts.number.length
        : typeof c.value === "string"
          ? c.value.length
          : 0,
    ),
  );
  const fontSize = valueFontSize(longest);
  return (
    <div className="@container mb-4" data-color-cards={name}>
      <div
        className={cx(
          "grid grid-cols-1 gap-2.5",
          ...columnClasses(items.length),
        )}
      >
        {cards.map((c) => (
          <div
            key={c.key}
            data-color-card={c.key}
            title={c.hint}
            className={cx(
              "@container flex min-h-24 min-w-0 flex-col justify-between rounded-xl bg-gradient-to-br p-3 text-white shadow-sm",
              CARD_TONES[c.tone],
            )}
          >
            <div
              className="font-bold leading-tight tabular-nums"
              style={{ fontSize }}
              data-color-card-value
            >
              {c.parts ? (
                <>
                  <span
                    className="block text-[11px] leading-4 font-semibold tracking-wide text-white/80"
                    data-color-card-currency
                  >
                    {c.money?.approx ? "~ " : ""}
                    {c.parts.currency}
                  </span>
                  <span
                    className="block whitespace-nowrap"
                    data-color-card-number
                  >
                    {c.parts.number}
                  </span>
                </>
              ) : (
                <span
                  className="block whitespace-nowrap"
                  data-color-card-number
                >
                  {c.value}
                </span>
              )}
              {c.sub ? (
                <span className="mt-0.5 block text-xs font-medium break-words text-white/85">
                  {c.sub}
                </span>
              ) : null}
            </div>
            <span className="mt-1 text-[13px] font-medium text-white/90">
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
