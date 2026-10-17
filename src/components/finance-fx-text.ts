import type { Translate } from "@/i18n";
import type { OrderFinance } from "@/lib/services/finance";
import { formatMoney } from "./ui";

/*
 * Textos do câmbio no financeiro (tela Financeiro e card do pedido): deixa
 * sempre claro o que é real (câmbio dos pagamentos) e o que é estimado ("~",
 * câmbio do dia no que falta pagar), e o efeito do câmbio desde a venda.
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

/** De onde veio o câmbio da parte estimada ("~ câmbio de 17/10"). */
export function fxSourceText(t: Translate, f: OrderFinance): string | null {
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

/**
 * Câmbio do pedido: o número principal e as notas embaixo (real, saldo
 * estimado, câmbio da venda). Nulo quando não há câmbio nenhum.
 */
export function fxRateLines(
  t: Translate,
  f: OrderFinance,
): { main: string; notes: string[] } | null {
  const notes: string[] = [];
  let main: string;
  switch (f.fxBasis) {
    case "same":
      return { main: "1", notes };
    case "paid":
      main = rate(t, f.avgFx as number);
      notes.push(t("finance.fx.paid"));
      break;
    case "partial":
      main = rate(t, f.avgFx as number);
      notes.push(t("finance.fx.paid"));
      notes.push(
        `${t("finance.fx.balance", { rate: rate(t, f.estimateRate as number) })} (${fxSourceText(t, f)?.replace(/^~\s*/, "") ?? ""})`,
      );
      break;
    case "estimate":
      main = `~${rate(t, f.estimateRate as number)}`;
      notes.push(fxSourceText(t, f) ?? "");
      break;
    default:
      return null;
  }
  if (f.saleFx !== null)
    notes.push(t("finance.fx.sale", { rate: rate(t, f.saleFx) }));
  return { main, notes: notes.filter(Boolean) };
}

/** "estimado a 5,4000 (~ câmbio de 17/10)" para o custo estimado. */
export function costEstimateNote(t: Translate, f: OrderFinance): string | null {
  if (!f.estimated || f.estimateRate === null) return null;
  const source = fxSourceText(t, f);
  return `${t("finance.fx.estimatedAt", { rate: rate(t, f.estimateRate) })}${source ? ` (${source.replace(/^~\s*/, "")})` : ""}`;
}

/** Efeito do câmbio na margem desde a venda, com o texto da dica. */
export function fxEffectText(
  t: Translate,
  f: OrderFinance,
): { text: string; title: string; negative: boolean } | null {
  if (f.fxEffect === null || f.saleFx === null) return null;
  const value = `${f.fxEffect > 0 ? "+" : ""}${formatMoney(f.fxEffect, f.sellCurrency, t)}`;
  const now = f.estimateRate ?? f.avgFx;
  return {
    text: t("finance.fx.effect", { value }),
    title: t("finance.fx.effectTitle", {
      sale: rate(t, f.saleFx),
      now: now !== null ? rate(t, now) : "—",
    }),
    negative: f.fxEffect < 0,
  };
}
