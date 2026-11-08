import type { ReactNode } from "react";
import { cx } from "./ui";

/*
 * Cartões coloridos de valores, no mesmo visual das telas Clientes e
 * Fornecedores (gradiente, valor grande e o nome embaixo). Usados no alto
 * de Solicitações e do pedido. Só exibição: cada tela decide quem vê.
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

export interface ColorCard {
  key: string;
  label: string;
  value: ReactNode;
  tone: CardTone;
  /** Explicação ao parar o dedo/mouse em cima. */
  hint?: string;
  /** Linha pequena embaixo do valor (ex.: percentual). */
  sub?: ReactNode;
}

/** Colunas na tela larga conforme a quantidade (classes fixas para o Tailwind). */
const LG_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
  7: "lg:grid-cols-7",
};

export function ColorCards({
  items,
  name,
}: {
  items: ColorCard[];
  /** Marca para testes (data-color-cards). */
  name: string;
}) {
  if (!items.length) return null;
  return (
    <div
      className={cx(
        "mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3",
        LG_COLS[Math.min(items.length, 7)],
      )}
      data-color-cards={name}
    >
      {items.map((c) => (
        <div
          key={c.key}
          data-color-card={c.key}
          title={c.hint}
          className={cx(
            "flex min-h-24 flex-col justify-between rounded-xl bg-gradient-to-br p-3 text-white shadow-sm",
            CARD_TONES[c.tone],
          )}
        >
          <div className="text-lg font-bold leading-tight sm:text-xl">
            {c.value}
            {c.sub ? (
              <span className="mt-0.5 block text-xs font-medium text-white/85">
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
  );
}
