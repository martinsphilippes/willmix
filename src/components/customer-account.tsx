import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import { cx, formatMoney } from "@/components/ui";
import type { AccountTotals, Money } from "@/lib/services/customer-accounts";

/*
 * Peças da tela Clientes: cartões coloridos da conta (contrato, entregue,
 * antecipado, a receber, recebido), a barra proporcional da ficha e os
 * botões de ícone da linha. Valores por moeda: um por linha, nunca somados.
 */

export const ACCOUNT_KEYS = [
  "contract",
  "delivered",
  "prepaid",
  "receivable",
  "received",
] as const satisfies readonly (keyof AccountTotals)[];
export type AccountKey = (typeof ACCOUNT_KEYS)[number];

/** Cor de cada valor (mesma ordem e cores na lista, na ficha e na barra). */
const TONE: Record<AccountKey, { card: string; bar: string; dot: string }> = {
  contract: {
    card: "from-indigo-600 to-violet-500",
    bar: "bg-indigo-500",
    dot: "bg-indigo-500",
  },
  delivered: {
    card: "from-orange-500 to-amber-400",
    bar: "bg-orange-400",
    dot: "bg-orange-400",
  },
  prepaid: {
    card: "from-sky-600 to-blue-500",
    bar: "bg-sky-500",
    dot: "bg-sky-500",
  },
  receivable: {
    card: "from-rose-600 to-pink-500",
    bar: "bg-rose-500",
    dot: "bg-rose-500",
  },
  received: {
    card: "from-emerald-600 to-teal-500",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
};

/** Moeda principal (a de maior valor contratado; sem nada, real). */
export function mainCurrency(totals: AccountTotals): string {
  const entries = Object.entries(totals.contract).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? Object.keys(totals.received)[0] ?? "BRL";
}

/** Valor por moeda, um por linha; sem nada, zero na moeda principal. */
export function MoneyLines({
  money,
  t,
  fallback = "BRL",
  className,
}: {
  money: Money;
  t: Translate;
  fallback?: string;
  className?: string;
}) {
  const entries = Object.entries(money).filter(([, v]) => v);
  if (!entries.length)
    return <span className={className}>{formatMoney(0, fallback, t)}</span>;
  return (
    <span className={cx("flex flex-col", className)}>
      {entries.map(([c, v]) => (
        <span key={c} className="whitespace-nowrap tabular-nums">
          {formatMoney(v, c, t)}
        </span>
      ))}
    </span>
  );
}

/** Cinco cartões coloridos no alto da lista de clientes. */
export function AccountCards({
  totals,
  t,
  label,
}: {
  totals: AccountTotals;
  t: Translate;
  /** Textos do lado (cliente ou fornecedor): "card.contract", "hint.contract"… */
  label: (key: string) => string;
}) {
  const fallback = mainCurrency(totals);
  return (
    <div
      className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
      data-customer-cards
    >
      {ACCOUNT_KEYS.map((k) => (
        <div
          key={k}
          data-customer-card={k}
          className={cx(
            "flex min-h-24 flex-col justify-between rounded-xl bg-gradient-to-br p-3 text-white shadow-sm",
            TONE[k].card,
          )}
        >
          <MoneyLines
            money={totals[k]}
            t={t}
            fallback={fallback}
            className="text-lg font-bold leading-tight sm:text-xl"
          />
          <span
            className="mt-1 text-[13px] font-medium text-white/90"
            title={label(`hint.${k}`)}
          >
            {label(`card.${k}`)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Barra da ficha do cliente: as cinco partes na mesma ordem, cada uma do
 * tamanho do seu valor na moeda principal (mínimo visível quando há valor).
 */
export function AccountBar({
  totals,
  t,
  label,
}: {
  totals: AccountTotals;
  t: Translate;
  label: (key: string) => string;
}) {
  const currency = mainCurrency(totals);
  const values = ACCOUNT_KEYS.map((k) => totals[k][currency] ?? 0);
  const sum = values.reduce((a, b) => a + b, 0);
  return (
    <div data-customer-bar>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100">
        {ACCOUNT_KEYS.map((k, i) => (
          <span
            key={k}
            className={TONE[k].bar}
            style={{
              width: sum
                ? `${Math.max(values[i] ? 4 : 0, (values[i] / sum) * 100)}%`
                : "20%",
              opacity: sum ? 1 : 0.35,
            }}
          />
        ))}
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
        {ACCOUNT_KEYS.map((k) => (
          <div key={k} data-customer-value={k}>
            <dt
              className="flex items-center gap-1.5 text-xs text-zinc-500"
              title={label(`hint.${k}`)}
            >
              <span className={cx("h-2 w-2 rounded-full", TONE[k].dot)} />
              {label(`card.${k}`)}
            </dt>
            <dd className="mt-0.5 font-semibold text-zinc-900">
              <MoneyLines money={totals[k]} t={t} fallback={currency} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const ICON_PATH = {
  plus: "M12 5v14M5 12h14",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  pencil: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  box: "M3 7l9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10",
} as const;

/** Ícone de linha (link), como os da lista de pedidos. */
export function IconLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: keyof typeof ICON_PATH;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      data-customer-action={icon}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="h-4 w-4"
      >
        <path d={ICON_PATH[icon]} />
      </svg>
    </Link>
  );
}

/**
 * Aba da ficha (link; a aba escolhida fica sublinhada na cor da marca). Trocar
 * de aba muda o conteúdo embaixo sem levar a tela de volta ao topo.
 */
export function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex-1 border-b-2 px-3 py-2.5 text-center text-sm font-semibold transition sm:text-base",
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900",
      )}
    >
      {children}
    </Link>
  );
}
