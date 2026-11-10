import type { SuperplanContext } from "@/lib/superplan-defaults";
import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import { Card } from "@/components/ui";

/**
 * A lógica do cálculo do Superplan, escrita na tela (pedido do dono): os
 * passos na ordem em que `computeSuperplan` (src/lib/superplan.ts) faz a
 * conta, com as fórmulas e os percentuais em uso. Só texto: mudar a conta é
 * no código (e, nos impostos, com o contador); mudar percentual é nos
 * Parâmetros. Se a conta mudar, este quadro muda junto.
 */
export function SuperplanLogic({
  ctx,
  t,
}: {
  ctx: SuperplanContext;
  t: Translate;
}) {
  const { params } = ctx;
  const n = (value: number, digits = 2) =>
    value.toLocaleString(t.intl, { maximumFractionDigits: digits });
  const customs = params.expenses.filter((e) => e.customs);
  const values = {
    gross: n(params.grossEstimatePct),
    spread: n(params.futureSpreadBrl),
    freightFx: n(params.freightFxPct),
    insurance: n(ctx.insurancePct, 4),
    customs: customs.length ? customs.map((e) => e.label).join(", ") : "—",
    icmsImport:
      ctx.icmsImportPct === null
        ? t("superplanLogic.icms.none")
        : t("superplanLogic.icms.pct", { pct: n(ctx.icmsImportPct) }),
    pisImport: n(ctx.pisImportPct, 4),
    cofinsImport: n(ctx.cofinsImportPct, 4),
    afrmm: n(params.afrmmPct),
    fixed: n(params.afrmmFixedBrl),
    expenses: n(params.expenses.reduce((sum, e) => sum + e.amountBrl, 0)),
    list: params.expenses.map((e) => e.label).join(", "),
    table: n(params.priceFactors.table),
    wholesale: n(params.priceFactors.wholesale),
    retail: n(params.priceFactors.retail),
    icms: n(params.saleTaxes.icmsPct),
    pis: n(params.saleTaxes.pisPct),
    cofins: n(params.saleTaxes.cofinsPct),
    ir: n(params.saleTaxes.irPct),
    csll: n(params.saleTaxes.csllPct),
  };
  const text = (key: string) =>
    t(`superplanLogic.${key}` as DictionaryKey, values);
  /** Passos na ordem da conta: explicações (a, b…) e fórmulas (f, f1…). */
  const steps: Array<{ id: string; notes: string[]; formulas: string[] }> = [
    { id: "s1", notes: ["a", "b", "c", "d"], formulas: ["f"] },
    { id: "s2", notes: ["a", "b"], formulas: ["f1", "f2"] },
    { id: "s3", notes: ["a", "b"], formulas: ["f1", "f2"] },
    {
      id: "s4",
      notes: ["a", "b", "c"],
      formulas: ["f1", "f2", "f3", "f4", "f5", "f6"],
    },
    { id: "s5", notes: ["a", "b"], formulas: ["f1", "f2"] },
    { id: "s6", notes: ["a"], formulas: ["f1", "f2", "f3", "f4"] },
    {
      id: "s7",
      notes: ["a", "b"],
      formulas: ["f1", "f2", "f3", "f4", "f5", "f6", "f7"],
    },
    { id: "s8", notes: ["a", "b", "c", "d"], formulas: [] },
  ];
  return (
    <section id="como-calcula" className="mt-6 scroll-mt-4" data-superplan-how>
      <Card title={t("superplan.how.title")}>
        <p className="mb-3 text-sm text-zinc-600">
          {t("superplanLogic.intro")}
        </p>
        <ol className="grid items-start gap-3 lg:grid-cols-2">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className="min-w-0 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3"
              data-superplan-logic-step={step.id}
            >
              <h3 className="flex items-start gap-2 text-sm font-semibold text-zinc-900">
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white"
                >
                  {i + 1}
                </span>
                {text(`${step.id}.title`)}
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                {step.notes.map((note) => (
                  <li key={note}>{text(`${step.id}.${note}`)}</li>
                ))}
              </ul>
              {step.formulas.length ? (
                <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {t("superplanLogic.formula")}
                  </p>
                  <ul className="space-y-1 text-[13px] leading-snug text-zinc-900">
                    {step.formulas.map((formula) => (
                      <li key={formula} className="break-words">
                        {text(`${step.id}.${formula}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-xl border border-zinc-200/80 p-3">
          <h3 className="text-sm font-semibold text-zinc-900">
            {t("superplanLogic.sources.title")}
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            <li>{t("superplanLogic.sources.a")}</li>
            <li>{t("superplanLogic.sources.b")}</li>
            <li>{t("superplanLogic.sources.c")}</li>
          </ul>
        </div>
        <p className="mt-3 text-sm text-zinc-600">
          {t("superplan.how.change")}
        </p>
      </Card>
    </section>
  );
}
