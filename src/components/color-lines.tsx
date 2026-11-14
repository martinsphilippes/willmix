import type { Translate } from "@/i18n";
import type {
  ColorPlan,
  ColorQuantity,
  RequestSchedule,
} from "@/lib/db/schema";
import { cx } from "@/components/ui";
import { addDaysIso } from "@/lib/workflow/request-schedule";

/*
 * Variações de cor do produto (docs/PURCHASE_SCHEDULE.md, "Cores"): cada cor
 * na própria linha, ligada ao mesmo produto. `ColorLines` mostra as peças de
 * cada cor (pedido, rodada, quadro de gerar pedido); `ColorPlanTable` mostra
 * a composição gravada por data (solicitação ao fornecedor), com o subtotal
 * de cada data.
 */

const dateText = (iso: string, intl: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(intl, {
    timeZone: "UTC",
  });
};

export function ColorLines({
  colors,
  name,
  unit = "pcs",
  intl,
  className,
}: {
  colors: ColorQuantity[] | null | undefined;
  /** Nome do produto (cada linha: "Produto · Cor"). */
  name: string;
  unit?: string;
  intl: string;
  className?: string;
}) {
  if (!colors?.length) return null;
  return (
    <ul
      className={cx(
        "mt-1 divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white text-xs font-normal",
        className,
      )}
      data-color-lines={colors.length}
    >
      {colors.map((c) => (
        <li
          key={c.color}
          className="flex items-baseline justify-between gap-3 px-2 py-1"
          data-color-line={c.color}
        >
          <span className="min-w-0 text-zinc-700">
            {name} · <span className="font-semibold">{c.color}</span>
          </span>
          <span className="shrink-0 tabular-nums text-zinc-900">
            {c.quantity.toLocaleString(intl)} {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ColorPlanTable({
  plan,
  name,
  dates,
  intl,
  labels,
}: {
  plan: ColorPlan | null | undefined;
  name: string;
  /** AAAA-MM-DD de cada data (programação); vazio = pedido único. */
  dates: string[];
  intl: string;
  labels: {
    title: string;
    single: string;
    /** "Programação {n} · {date}". */
    round: string;
    subtotal: string;
    total: string;
    excluded: string;
  };
}) {
  if (!plan?.rows.length) return null;
  const fill = (s: string, vars: Record<string, string | number>) =>
    s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
  const count = plan.rows[0]?.rounds.length ?? 1;
  const out = plan.colors.filter((c) => !plan.included.includes(c));
  const fmt = (n: number) => n.toLocaleString(intl);
  return (
    <div className="space-y-1.5 text-sm" data-color-plan={plan.rows.length}>
      <p className="font-semibold text-zinc-800">{labels.title}</p>
      <table className="w-full text-xs">
        {Array.from({ length: count }, (_, i) => (
          <tbody
            key={i}
            className="border-t border-zinc-200"
            data-color-round={i + 1}
          >
            <tr>
              <th
                colSpan={2}
                className="px-2 pt-1.5 text-left font-semibold text-zinc-700"
              >
                {count === 1 && !dates.length
                  ? labels.single
                  : fill(labels.round, {
                      n: i + 1,
                      date: dates[i] ? dateText(dates[i], intl) : "—",
                    })}
              </th>
            </tr>
            {plan.rows.map((r) => (
              <tr key={r.color} data-color-line={r.color}>
                <td className="px-2 py-0.5 text-zinc-700">
                  {name} · <span className="font-semibold">{r.color}</span>
                </td>
                <td className="px-2 py-0.5 text-right tabular-nums">
                  {fmt(r.rounds[i] ?? 0)} pcs
                </td>
              </tr>
            ))}
            {count > 1 ? (
              <tr className="font-semibold text-zinc-800">
                <td className="px-2 py-0.5">{labels.subtotal}</td>
                <td
                  className="px-2 py-0.5 text-right tabular-nums"
                  data-color-subtotal
                >
                  {fmt(plan.rows.reduce((s, r) => s + (r.rounds[i] ?? 0), 0))}{" "}
                  pcs
                </td>
              </tr>
            ) : null}
          </tbody>
        ))}
        <tbody className="border-t-2 border-zinc-300">
          <tr className="font-semibold text-zinc-900">
            <td className="px-2 py-1">{labels.total}</td>
            <td className="px-2 py-1 text-right tabular-nums" data-color-grand>
              {fmt(plan.rows.reduce((s, r) => s + r.quantity, 0))} pcs
            </td>
          </tr>
        </tbody>
      </table>
      {out.length ? (
        <p className="text-xs text-zinc-500" data-color-excluded>
          {labels.excluded}: {out.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

/** Composição por cor da solicitação (ou da escolha), com as datas da programação. */
export function RequestColorPlan({
  plan,
  schedule,
  name,
  t,
}: {
  plan: ColorPlan | null | undefined;
  schedule: RequestSchedule | null | undefined;
  name: string;
  t: Translate;
}) {
  if (!plan?.rows.length) return null;
  const dates = schedule?.items.length
    ? schedule.items.map((_, i) =>
        addDaysIso(schedule.firstDate, schedule.intervalDays * i),
      )
    : [];
  return (
    <div
      className="mt-3 rounded-lg border border-zinc-200 bg-white p-3"
      data-request-color-plan
    >
      <ColorPlanTable
        plan={plan}
        name={name}
        dates={dates}
        intl={t.intl}
        labels={{
          title: t("colors.preview.title"),
          single: t("colors.preview.single"),
          round: t("colors.preview.round", { n: "{n}", date: "{date}" }),
          subtotal: t("colors.preview.subtotal"),
          total: t("colors.preview.total"),
          excluded: t("colors.card.excluded"),
        }}
      />
    </div>
  );
}
