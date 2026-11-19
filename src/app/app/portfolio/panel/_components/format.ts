import type { Translate } from "@/i18n";

/** Números do painel no idioma da tela. */
export function formatters(t: Translate) {
  const int = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 });
  const dec = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const pct = new Intl.NumberFormat(t.intl, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const brl = new Intl.NumberFormat(t.intl, {
    style: "currency",
    currency: "BRL",
  });
  const brlShort = new Intl.NumberFormat(t.intl, {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 2,
  });
  return {
    int: (n: number) => int.format(n),
    dec: (n: number) => dec.format(n),
    pct: (n: number) => pct.format(n),
    brl: (n: number | null) => (n === null ? "—" : brl.format(n)),
    /** R$ curto para os cartões ("R$ 1,02 mi"). */
    brlShort: (n: number | null) => (n === null ? "—" : brlShort.format(n)),
    /** AAAA-MM-DD → dd/mm/aaaa */
    day: (d: string | null) =>
      d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—",
    /** AAAA-MM → mm/aaaa */
    month: (m: string) => `${m.slice(5, 7)}/${m.slice(0, 4)}`,
  };
}

export type Formatters = ReturnType<typeof formatters>;
