import type { Translate } from "@/i18n";
import { fxKey, rateFor } from "@/lib/pricing";
import type {
  FxToday,
  OrderFinance,
  PaymentWithoutFx,
} from "@/lib/services/finance";
import { formatMoney } from "./ui";

/*
 * Textos do câmbio no financeiro (tela Financeiro e card do pedido): cada
 * câmbio com o seu nome, para não parecer informado o que não foi:
 * - câmbio do banco: o informado nos pagamentos (real), com o dia do pagamento;
 * - cotação automática de dd/mm: buscada sozinha todo dia, só para estimar
 *   ("~") o que foi pago sem câmbio e o que falta pagar;
 * - câmbio da venda: o da proposta ao cliente.
 * Pagamento feito sem o câmbio do banco vira "Falta o câmbio do banco…" (a
 * tela põe o botão "Informar câmbio" ao lado), fora das notas do câmbio.
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

/** "câmbio do banco, pago em 05/11" (vários: a média, com o dia do último). */
function bankText(t: Translate, f: OrderFinance): string {
  const bank = f.bankFx;
  if (!bank || !bank.lastDay) return t("finance.fx.paid");
  const day = shortDay(t, bank.lastDay);
  return bank.count === 1
    ? t("finance.fx.bankOne", { day })
    : t("finance.fx.bankMany", { n: String(bank.count), day });
}

/**
 * "Falta o câmbio do banco…": pagamentos ao fornecedor já feitos sem o câmbio
 * do banco (um: valor e dia; vários: quantos e o total por moeda). Nulo
 * quando não falta nenhum.
 */
export function missingFxText(t: Translate, f: OrderFinance): string | null {
  const list = f.missingFx;
  if (!list.length) return null;
  if (list.length === 1)
    return t("finance.fx.missingOne", {
      amount: formatMoney(list[0].amount, list[0].currency, t),
      day: shortDay(t, list[0].day || null),
    });
  const total = new Map<string, number>();
  for (const p of list)
    total.set(p.currency, (total.get(p.currency) ?? 0) + p.amount);
  return t("finance.fx.missingMany", {
    n: String(list.length),
    amount: [...total]
      .map(([currency, value]) => formatMoney(value, currency, t))
      .join(" + "),
  });
}

/** Um pagamento sem câmbio no formulário de informar ("US$ 6.800,00, pago em 05/11"). */
export function missingPaymentText(t: Translate, p: PaymentWithoutFx): string {
  return t("finance.fx.missingPayment", {
    amount: formatMoney(p.amount, p.currency, t),
    day: shortDay(t, p.day || null),
  });
}

/**
 * Referência ao lado do campo do câmbio do banco: a cotação automática do dia
 * da moeda do pagamento ("cotação automática de 09/11, 1 USD = R$ 5,5037").
 * Só referência: o campo fica vazio para a pessoa digitar o do banco.
 */
export function fxReferenceText(
  t: Translate,
  today: FxToday | null,
  currency: string | null | undefined,
): string | null {
  if (!today || fxKey(currency) === null || fxKey(currency) === "BRL")
    return null;
  const value = rateFor(today.rates, currency);
  if (value === null || !(value > 0)) return null;
  const code = (currency ?? "").toUpperCase();
  return today.status === "manual"
    ? t("finance.fx.referenceManual", { currency: code, rate: rate(t, value) })
    : t("finance.fx.reference", {
        day: shortDay(t, today.day),
        currency: code,
        rate: rate(t, value),
      });
}

/**
 * Câmbio do pedido: o número principal e as notas embaixo (câmbio do banco
 * com o dia, estimado do que falta pagar e do pago sem câmbio, conversões,
 * câmbio da venda). Nulo sem câmbio nenhum. O "Falta o câmbio do banco…" é à
 * parte (`missingFxText`), com o botão de informar.
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
      notes.push(bankText(t, f));
      break;
    case "partial": {
      if (f.avgFx !== null) {
        // Real (pagamentos na moeda do FOB com câmbio); venda fora de reais
        // depende do câmbio do dia para chegar à moeda da venda: estimado.
        main = approx(rate(t, f.avgFx), f.sellRate !== null);
        if (f.sellRate === null) notes.push(bankText(t, f));
      } else {
        // Nada pago na moeda do FOB com câmbio (pago em reais, em outra moeda
        // ou sem câmbio): câmbio médio do custo, estimado.
        const effective =
          f.cost !== null && f.costedFob > 0 ? f.cost / f.costedFob : est;
        if (effective === null) return null;
        main = `~${rate(t, effective)}`;
      }
      // O estimado: o que falta pagar e/ou o que foi pago sem câmbio do banco.
      const balance = f.unpaid > 0.005;
      const noFx = f.paidNoFx > 0.005;
      if (est !== null && (balance || noFx))
        notes.push(
          withSource(
            t,
            t(
              balance
                ? noFx
                  ? "finance.fx.balanceNoFx"
                  : "finance.fx.balance"
                : "finance.fx.noFx",
              { rate: rate(t, est) },
            ),
            sourceText(t, f),
          ),
        );
      break;
    }
    case "estimate":
      if (est === null) return null;
      main = `~${rate(t, est)}`;
      notes.push(fxSourceText(t, f) ?? "");
      break;
    default:
      return null;
  }
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
