import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { MemoryLine, ReplacedRule } from "@/lib/commission";

/*
 * Memória de cálculo de uma comissão (docs/COMMISSIONS.md): cada linha com o
 * item, a regra, a base, a taxa e o valor; o que foi substituído e por quê;
 * e o que ficou pendente. Usada nos lançamentos e no simulador.
 */

export const fmtMoney = (t: Translate, n: number, currency: string) =>
  `${n.toLocaleString(t.intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

export function pendingText(t: Translate, code: string) {
  const [kind, what] = code.split(":");
  if (kind === "base")
    return t("commission.pending.base", {
      what: t(`commission.rule.base.${what}` as DictionaryKey),
    });
  if (kind === "currency") return t("commission.pending.currency", { what });
  return t("commission.pending.item_price");
}

export function CommissionMemory({
  lines,
  replaced,
  pending,
  currency,
  t,
}: {
  lines: MemoryLine[];
  replaced: ReplacedRule[];
  pending: string[];
  currency: string;
  t: Translate;
}) {
  return (
    <div className="space-y-2 text-sm" data-commission-memory>
      {lines.length ? (
        <table className="w-full text-left">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-1 pr-3 font-medium">
                {t("commission.memory.item")}
              </th>
              <th className="py-1 pr-3 font-medium">
                {t("commission.memory.rule")}
              </th>
              <th className="py-1 pr-3 text-right font-medium">
                {t("commission.memory.base")}
              </th>
              <th className="py-1 pr-3 text-right font-medium">
                {t("commission.memory.rate")}
              </th>
              <th className="py-1 text-right font-medium">
                {t("commission.memory.value")}
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-zinc-100">
                <td className="py-1 pr-3">
                  {l.itemName ?? t("commission.memory.order")}
                </td>
                <td className="py-1 pr-3">
                  {l.componentName}
                  {l.note === "floor" || l.note === "cap"
                    ? ` · ${t(`commission.memory.note.${l.note}`)}`
                    : ""}
                  <span className="block text-xs text-zinc-500">
                    {l.agreementName} · v{l.version}
                  </span>
                </td>
                <td className="py-1 pr-3 text-right">
                  {l.base === null
                    ? "—"
                    : l.kind === "per_unit"
                      ? l.base.toLocaleString(t.intl)
                      : fmtMoney(t, l.base, currency)}
                </td>
                <td className="py-1 pr-3 text-right">
                  {l.rate === null ? "—" : `${l.rate.toLocaleString(t.intl)}%`}
                </td>
                <td className="py-1 text-right font-medium">
                  {fmtMoney(t, l.value, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {replaced.length ? (
        <div>
          <p className="text-xs font-medium text-zinc-600">
            {t("commission.memory.replaced")}
          </p>
          <ul className="text-xs text-zinc-600">
            {replaced.map((r, i) => (
              <li key={i}>
                {r.itemName ? `${r.itemName}: ` : ""}
                {t("commission.memory.replacedLine", {
                  rule: r.componentName,
                  agreement: r.agreementName,
                  by: r.byAgreementName,
                  reason: t(`commission.memory.reason.${r.reason}`),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {pending.length ? (
        <div>
          <p className="text-xs font-medium text-amber-800">
            {t("commission.memory.pending")}
          </p>
          <ul className="text-xs text-amber-800">
            {pending.map((p) => (
              <li key={p}>{pendingText(t, p)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
