import type { Translate } from "@/i18n";
import type { OrderFinance } from "@/lib/services/finance";
import { formatMoney } from "./ui";

/*
 * Textos do câmbio no financeiro (tela Financeiro e card do pedido): deixa
 * sempre claro o que é real (câmbio informado nos pagamentos) e o que é
 * estimado ("~", câmbio do dia no que foi pago sem câmbio e no que falta
 * pagar), e o efeito do câmbio desde a venda.
 */

const rate = (t: Translate, n: number) =>
  n.toLocaleString(t.intl, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

const shortDay = (t: Translate, day: string | null) =>
  day
    ? new Date(`${day.slice(0, 10)}T00:00:00Z`).toLocaleDateString(t.intl, {
        day: "2-digit",
        month: "2-digit",
        timeZone: "UTC",
      })
    : "—";

/** Valor estimado com "~" na frente ("~ -R$ 200,00" quando negativo, para ler melhor). */
export function approx(text: string, estimated: boolean): string {
  if (!estimated) return text;
  return /^[-−]/.test(text) ? `~ ${text}` : `~${text}`;
}

/** De onde veio o câmbio da parte estimada, sem "~" ("câmbio de 17/10"). */
function sourceText(t: Translate, f: OrderFinance): string | null {
  switch (f.estimateFrom) {
    case "today":
      return t("finance.fx.today", { day: shortDay(t, f.estimateDay) });
    case "stale":
      return t("finance.fx.stale", { day: shortDay(t, f.estimateDay) });
    case "manual":
      return t("finance.fx.manual");
    case "paid":
      return t("finance.fx.avgPaid");
    default:
      return null;
  }
}

/** Fonte do câmbio numa linha própria ("~ câmbio de 17/10"). */
export function fxSourceText(t: Translate, f: OrderFinance): string | null {
  const source = sourceText(t, f);
  return source ? `~ ${source}` : null;
}

/** "texto (fonte)", com os parênteses de cada língua. */
function withSource(t: Translate, text: string, source: string | null) {
  return source ? t("finance.fx.withSource", { text, source }) : text;
}

/**
 * Câmbio do pedido: o número principal e as notas embaixo (real, pago sem
 * câmbio, saldo estimado, conversões, câmbio da venda). Nulo sem câmbio nenhum.
 */
export function fxRateLines(
  t: Translate,
  f: OrderFinance,
): { main: string; notes: string[] } | null {
  const notes: string[] = [];
  let main: string;
  const est = f.estimateRate;
  switch (f.fxBasis) {
    case "same":
      return { main: "1", notes };
    case "paid":
      if (f.avgFx === null) return null;
      main = rate(t, f.avgFx);
      notes.push(t("finance.fx.paid"));
      break;
    case "partial":
      if (f.avgFx !== null) {
        main = rate(t, f.avgFx);
        notes.push(t("finance.fx.paid"));
      } else if (est !== null) main = `~${rate(t, est)}`;
      else return null;
      if (est !== null && f.unpaid > 0.005)
        notes.push(
          withSource(
            t,
            t("finance.fx.balance", { rate: rate(t, est) }),
            sourceText(t, f),
          ),
        );
      break;
    case "estimate":
      if (est === null) return null;
      main = `~${rate(t, est)}`;
      notes.push(fxSourceText(t, f) ?? "");
      break;
    default:
      return null;
  }
  // Pago sem câmbio: estimado, e pede o câmbio (não é "saldo").
  if (est !== null && f.paidNoFx > 0.005)
    notes.push(
      t("finance.fx.noFx", {
        amount: formatMoney(f.paidNoFx, f.fobCurrency, t),
        rate: rate(t, est),
      }),
    );
  if (f.crossConverted) notes.push(t("finance.fx.cross"));
  if (f.sellRate !== null)
    notes.push(
      t("finance.fx.sellAt", {
        currency: f.sellCurrency,
        rate: rate(t, f.sellRate),
      }),
    );
  if (f.saleFx !== null)
    notes.push(t("finance.fx.sale", { rate: rate(t, f.saleFx) }));
  return { main, notes: notes.filter(Boolean) };
}

/** Como o custo estimado foi feito ("estimado a 5,4000 (câmbio de 17/10)"). */
export function costEstimateNote(t: Translate, f: OrderFinance): string | null {
  if (!f.estimated) return null;
  if (f.estimateRate === null) {
    // Estimado só pela conversão (venda fora de reais / pagamento em outra moeda).
    if (f.sellRate !== null)
      return t("finance.fx.sellAt", {
        currency: f.sellCurrency,
        rate: rate(t, f.sellRate),
      });
    return f.crossConverted ? t("finance.fx.cross") : null;
  }
  const value = rate(t, f.estimateRate);
  const text =
    f.fxBasis === "partial"
      ? t("finance.fx.costPartial", { rate: value })
      : t("finance.fx.estimatedAt", { rate: value });
  return withSource(t, text, sourceText(t, f));
}

/** Efeito do câmbio na margem desde a venda, com o texto da dica. */
export function fxEffectText(
  t: Translate,
  f: OrderFinance,
): { text: string; title: string; negative: boolean } | null {
  if (f.fxEffect === null || f.saleFx === null) return null;
  // Câmbio igual ao da venda: nada a dizer (nem "R$ 0,00" nem "-R$ 0,00").
  if (Math.abs(f.fxEffect) < 0.01) return null;
  const money = formatMoney(f.fxEffect, f.sellCurrency, t);
  const value = approx(f.fxEffect > 0 ? `+${money}` : money, f.estimated);
  // Câmbio médio do custo (pago no real, o resto no do dia), na mesma base do efeito.
  const now = f.cost !== null && f.costedFob > 0 ? f.cost / f.costedFob : null;
  return {
    text: t("finance.fx.effect", { value }),
    title: t("finance.fx.effectTitle", {
      sale: rate(t, f.saleFx),
      now: now !== null ? approx(rate(t, now), f.estimated) : "—",
    }),
    negative: f.fxEffect < 0,
  };
}
