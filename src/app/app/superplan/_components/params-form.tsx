import type { Translate } from "@/i18n";
import type { DictionaryKey } from "@/i18n/dictionaries";
import type { SuperplanParams } from "@/lib/superplan";
import { saveSuperplanParamsAction } from "@/app/app/actions/superplan";
import { SubmitButton } from "@/components/submit-button";
import {
  Card,
  Field,
  Input,
  Select,
  Table,
  Td,
  TextLink,
  Th,
} from "@/components/ui";

/*
 * Parâmetros do Superplan (só o administrador): a tabela de tipos de negócio
 * da planilha, as despesas padrão por container, fretes, câmbio, AFRMM, a
 * folga da embalagem no peso (para o peso bruto estimado), fatores de preço
 * e impostos da venda. Formulário comum (funciona sem
 * JavaScript); o servidor confere tudo antes de gravar e aponta o campo
 * recusado. Linha sem nome sai; a linha vazia do fim cria uma nova.
 */

/** Valor no campo: sem milhar, com a vírgula do idioma. */
const value = (n: number, decimal: string, digits = 4) =>
  String(Number(n.toFixed(digits))).replace(".", decimal);

export function SuperplanParamsForm({
  t,
  params,
  decimal,
}: {
  t: Translate;
  params: SuperplanParams;
  decimal: string;
}) {
  const v = (n: number, digits?: number) => value(n, decimal, digits);
  const types = [...params.businessTypes, null];
  const expenses = [...params.expenses, null];
  const newType = t("superplan.params.newType");
  const typeColumns: Array<{
    key:
      | "markup"
      | "commissionPct"
      | "adminExpensesPct"
      | "targetProfitPct"
      | "wdPct";
    label: DictionaryKey;
  }> = [
    { key: "markup", label: "superplan.markup" },
    { key: "commissionPct", label: "superplan.commission" },
    { key: "adminExpensesPct", label: "superplan.adminExpenses" },
    { key: "targetProfitPct", label: "superplan.targetProfit" },
    { key: "wdPct", label: "superplan.wd" },
  ];
  const num = (
    name: string,
    label: DictionaryKey,
    current: number,
    digits?: number,
    hint?: DictionaryKey,
  ) => (
    <Field label={t(label)} hint={hint ? t(hint) : undefined}>
      <Input
        name={name}
        inputMode="decimal"
        autoComplete="off"
        defaultValue={v(current, digits)}
      />
    </Field>
  );

  return (
    <form action={saveSuperplanParamsAction} className="space-y-4">
      <input type="hidden" name="typesCount" value={types.length} />
      <input type="hidden" name="expensesCount" value={expenses.length} />

      <Card dense title={t("superplan.params.types")}>
        <p className="mb-2 text-xs text-zinc-600">
          {t("superplan.params.removeHint")}
        </p>
        <Table>
          <thead>
            <tr>
              <Th>{t("superplan.params.name")}</Th>
              {typeColumns.map((c) => (
                <Th key={c.key} className="whitespace-nowrap">
                  {t(c.label)}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((type, i) => {
              const who = type?.name ?? newType;
              return (
                <tr key={type?.name ?? "__new"} data-superplan-type-row={i}>
                  <Td className="min-w-[17rem] py-1">
                    <Input
                      dense
                      name={`types.${i}.name`}
                      defaultValue={type?.name ?? ""}
                      placeholder={type ? undefined : newType}
                      aria-label={`${t("superplan.params.name")} — ${who}`}
                      autoComplete="off"
                    />
                  </Td>
                  {typeColumns.map((c) => (
                    <Td key={c.key} className="py-1">
                      <Input
                        dense
                        name={`types.${i}.${c.key}`}
                        inputMode="decimal"
                        autoComplete="off"
                        className="w-20"
                        defaultValue={type ? v(type[c.key]) : ""}
                        aria-label={`${t(c.label)} — ${who}`}
                      />
                    </Td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </Table>
        <div className="mt-3 max-w-xl">
          <Field label={t("superplan.params.default")}>
            <Select
              name="defaultBusinessType"
              defaultValue={params.defaultBusinessType}
            >
              {params.businessTypes.map((type) => (
                <option key={type.name} value={type.name}>
                  {type.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card dense title={t("superplan.params.expenses")}>
        <Table>
          <thead>
            <tr>
              <Th>{t("superplan.params.expenseName")}</Th>
              <Th>R$</Th>
              <Th>{t("superplan.params.expenseCustoms")}</Th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e, i) => {
              const who = e?.label ?? t("superplan.params.newExpense");
              return (
                <tr key={e?.key ?? "__new"}>
                  <Td className="min-w-[14rem] py-1">
                    {e ? (
                      <input
                        type="hidden"
                        name={`expenses.${i}.key`}
                        value={e.key}
                      />
                    ) : null}
                    <Input
                      dense
                      name={`expenses.${i}.label`}
                      defaultValue={e?.label ?? ""}
                      placeholder={
                        e ? undefined : t("superplan.params.newExpense")
                      }
                      aria-label={`${t("superplan.params.expenseName")} — ${who}`}
                      autoComplete="off"
                    />
                  </Td>
                  <Td className="py-1">
                    <Input
                      dense
                      name={`expenses.${i}.amountBrl`}
                      inputMode="decimal"
                      autoComplete="off"
                      className="w-28"
                      defaultValue={e ? v(e.amountBrl, 2) : ""}
                      aria-label={`R$ — ${who}`}
                    />
                  </Td>
                  <Td className="py-1 text-center">
                    <input
                      type="checkbox"
                      name={`expenses.${i}.customs`}
                      defaultChecked={e?.customs ?? false}
                      aria-label={`${t("superplan.params.expenseCustoms")} — ${who}`}
                      className="h-4 w-4 accent-brand-600"
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card dense title={t("superplan.params.general")}>
          <div className="grid grid-cols-2 gap-3">
            {num(
              "freightUsd",
              "superplan.params.freight",
              params.freightUsd,
              2,
            )}
            {num(
              "roadFreightBrl",
              "superplan.params.road",
              params.roadFreightBrl,
              2,
            )}
            {num(
              "futureSpreadBrl",
              "superplan.params.futureSpread",
              params.futureSpreadBrl,
            )}
            {num(
              "freightFxPct",
              "superplan.params.freightFx",
              params.freightFxPct,
            )}
            {num("afrmmPct", "superplan.params.afrmmPct", params.afrmmPct)}
            {num(
              "afrmmFixedBrl",
              "superplan.params.afrmmFixed",
              params.afrmmFixedBrl,
              2,
            )}
            <div className="col-span-2">
              {num(
                "grossEstimatePct",
                "superplan.params.grossEstimate",
                params.grossEstimatePct,
                2,
                "superplan.params.grossEstimate.hint",
              )}
            </div>
          </div>
        </Card>
        <Card dense title={t("superplan.params.factors")}>
          <div className="grid grid-cols-2 gap-3">
            {num(
              "priceFactors.table",
              "superplan.params.table",
              params.priceFactors.table,
            )}
            {num(
              "priceFactors.wholesale",
              "superplan.params.wholesale",
              params.priceFactors.wholesale,
            )}
            {num(
              "priceFactors.retail",
              "superplan.params.retail",
              params.priceFactors.retail,
            )}
          </div>
        </Card>
        <Card dense title={t("superplan.params.saleTaxes")}>
          <div className="grid grid-cols-2 gap-3">
            {num(
              "saleTaxes.icmsPct",
              "superplan.params.icms",
              params.saleTaxes.icmsPct,
            )}
            {num(
              "saleTaxes.pisPct",
              "superplan.params.pis",
              params.saleTaxes.pisPct,
            )}
            {num(
              "saleTaxes.cofinsPct",
              "superplan.params.cofins",
              params.saleTaxes.cofinsPct,
            )}
            {num(
              "saleTaxes.irPct",
              "superplan.params.ir",
              params.saleTaxes.irPct,
            )}
            {num(
              "saleTaxes.csllPct",
              "superplan.params.csll",
              params.saleTaxes.csllPct,
            )}
          </div>
        </Card>
      </div>

      <p className="text-xs text-zinc-600">
        {t("superplan.params.importTaxes")}{" "}
        <TextLink href="/app/settings#tributos">{t("nav.settings")}</TextLink>
      </p>
      <SubmitButton data-superplan-save>
        {t("superplan.params.save")}
      </SubmitButton>
    </form>
  );
}
