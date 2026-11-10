"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { openSuperplanRfqAction } from "@/app/app/actions/superplan-rfq";
import type { pt as superplanTexts } from "@/i18n/modules/superplan";
import { parseNumberInput } from "@/lib/number-input";
import {
  businessTypeOf,
  computeSuperplan,
  type SuperplanInput,
  type SuperplanParams,
  type SuperplanResult,
} from "@/lib/superplan";
import {
  businessTypeFields,
  containerFields,
  defaultSuperplanForm,
  isWholeSuperplanField,
  readSuperplanNumber,
  superplanFieldText,
  superplanInputOf,
  targetPriceCents,
  type SuperplanContext,
  type SuperplanFields,
  type SuperplanNumberField,
  type SuperplanPrefill,
} from "@/lib/superplan-defaults";
import { estimatedGrossKg } from "@/lib/weights";
import { SubmitButton } from "./submit-button";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
  cx,
  formatMoney,
} from "./ui";

/*
 * Simulação do Superplan (docs/SUPERPLAN.md): os campos vêm preenchidos (o
 * produto do cadastro, o câmbio do dia, o container, as despesas padrão e o
 * tipo de negócio) e o resultado é refeito a cada tecla, com a mesma conta dos
 * testes (src/lib/superplan.ts). Nada é gravado: é uma calculadora. Trocar o
 * tipo de negócio preenche markup, comissão, despesas e meta; trocar o
 * container preenche capacidade e peso máximo; o dólar futuro acompanha o
 * oficial até ser digitado à mão.
 *
 * O estado inicial e a passagem dos campos para a conta vêm de
 * src/lib/superplan-defaults.ts (o servidor usa as mesmas funções para
 * analisar vários produtos de uma vez: os números batem).
 *
 * Pesos: líquido e bruto, cada um no seu campo. Bruto vazio com o líquido
 * preenchido: o campo do bruto CONTINUA vazio e uma linha diz que a conta usa
 * um peso bruto estimado (líquido + folga dos parâmetros). A média do
 * despachante aparece só como informação: não entra em conta nenhuma.
 *
 * `save` (opcional): quem monta a tela pode pedir um botão que envia a
 * simulação que está na tela a uma Server Action (a ação refaz a conta no
 * servidor). O componente não sabe para que a simulação será gravada.
 *
 * `rfq` (opcional, só o administrador): cartão "Viável? Abrir faca e RFQ com
 * o fornecedor" (docs/SUPERPLAN.md). Envia a simulação do mesmo jeito que o
 * `save`; o servidor refaz a conta com os parâmetros do sistema.
 */

export type SuperplanLabels = Record<keyof typeof superplanTexts, string>;
type LabelKey = keyof SuperplanLabels;

export interface SuperplanProductOption {
  id: string;
  label: string;
}

// Os tipos moram em src/lib/superplan-defaults.ts (o servidor também usa);
// continuam exportados daqui para quem já importava do componente.
export type { SuperplanContext, SuperplanPrefill };

/**
 * Botão "gravar esta simulação" (opcional): a tela que usa a calculadora diz
 * para qual Server Action enviar, os campos escondidos dela e os textos.
 */
export interface SuperplanSave {
  action: (form: FormData) => void | Promise<void>;
  /** Campos escondidos de quem pediu o botão (ex.: o id do que será gravado). */
  hidden: Record<string, string>;
  title: string;
  hint: string;
  submit: string;
}

/**
 * Abrir a faca e a RFQ com o fornecedor ganho (só o administrador, com um
 * produto do cadastro): fornecedores (os do produto primeiro) e clientes.
 */
export interface SuperplanRfqOptions {
  suppliers: Array<{ id: string; name: string; linked: boolean }>;
  customers: Array<{ id: string; name: string }>;
}

/** Campos escondidos que a calculadora manda (os de `save.hidden` não os trocam). */
const SAVE_FIELDS = ["input", "businessType", "container", "ncmFound"];

const fill = (text: string, params?: Record<string, string | number>) =>
  params
    ? Object.entries(params).reduce(
        (out, [k, v]) => out.replaceAll(`{${k}}`, String(v)),
        text,
      )
    : text;

export function SuperplanCalculator({
  labels,
  intl,
  products,
  prefill,
  ctx,
  averageUsd,
  averageWeightKg = null,
  save,
  rfq = null,
}: {
  labels: SuperplanLabels;
  /** Tag do idioma para os números (pt-BR, en-US, zh-CN). */
  intl: string;
  products: SuperplanProductOption[];
  prefill: SuperplanPrefill;
  ctx: SuperplanContext;
  /**
   * Média do despachante (US$), da ficha mestre do produto: SÓ informação na
   * tela. Não entra na conta. `null` = ainda não informada; sem a
   * propriedade, a linha não aparece.
   */
  averageUsd?: number | null;
  /**
   * Peso médio por peça (kg), da ficha mestre do produto: aparece na Compra,
   * só para leitura (muda-se na ficha do produto ou no Booking). Não entra
   * na conta.
   */
  averageWeightKg?: number | null;
  save?: SuperplanSave;
  /** Nulo: sem o cartão de abrir a faca e a RFQ. */
  rfq?: SuperplanRfqOptions | null;
}) {
  const router = useRouter();
  const L = (key: LabelKey, params?: Record<string, string | number>) =>
    fill(labels[key], params);
  const decimal = intl.startsWith("pt") ? "," : ".";
  const { params } = ctx;

  // Estado inicial: a mesma simulação padrão que o servidor usa para analisar
  // vários produtos de uma vez (src/lib/superplan-defaults.ts).
  const [initial] = useState(() =>
    defaultSuperplanForm(prefill, ctx, {}, decimal),
  );
  const [f, setF] = useState<SuperplanFields>(initial.fields);
  const [expenses, setExpenses] = useState<string[]>(initial.expenses);
  // O dólar futuro acompanha o oficial (+ diferença dos parâmetros) até a
  // pessoa digitar o futuro à mão.
  const [futureTouched, setFutureTouched] = useState(false);

  const set = <K extends keyof SuperplanFields>(
    key: K,
    value: SuperplanFields[K],
  ) => setF((prev) => ({ ...prev, [key]: value }));

  const chooseType = (name: string) => {
    const type = businessTypeOf(params, name);
    setF((prev) => ({ ...prev, ...businessTypeFields(type, decimal) }));
  };
  const chooseContainer = (code: string) => {
    const box = ctx.containers.find((c) => c.code === code);
    setF((prev) => ({
      ...prev,
      ...(box ? containerFields(box, decimal) : { container: code }),
    }));
  };
  const setOfficial = (raw: string) => {
    setF((prev) => {
      const official = readSuperplanNumber(raw);
      return {
        ...prev,
        officialRate: raw,
        futureRate:
          futureTouched || official === null
            ? prev.futureRate
            : superplanFieldText(
                "futureRate",
                official + params.futureSpreadBrl,
                decimal,
              ),
      };
    });
  };
  const testSalePrice = (price: number) =>
    set("salePrice", superplanFieldText("salePrice", price, decimal));

  const input: SuperplanInput = superplanInputOf({ fields: f, expenses }, ctx);
  const r = computeSuperplan(input);
  // Peso bruto que a conta usa: o digitado ou, só com o líquido, o estimado
  // (a mesma função da conta). O campo do bruto nunca recebe a estimativa.
  const weight = estimatedGrossKg(
    input.netWeightPcKg,
    input.grossWeightPcKg,
    input.grossEstimatePct,
  );
  // II e IPI informados (vieram do produto ou foram digitados): sem eles a
  // conta usa 0 e quem grava a simulação fica sabendo.
  const ratesKnown =
    readSuperplanNumber(f.iiPct) !== null &&
    readSuperplanNumber(f.ipiPct) !== null;

  const nf = (v: number, digits = 2) =>
    new Intl.NumberFormat(intl, { maximumFractionDigits: digits }).format(v);
  const pct = (v: number) =>
    `${new Intl.NumberFormat(intl, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(v)}%`;
  const brl = (v: number) => formatMoney(v, "BRL", intl);
  const usd = (v: number) => formatMoney(v, "USD", intl);

  const field = (
    key: SuperplanNumberField,
    label: LabelKey,
    opts: { hint?: ReactNode; onChange?: (raw: string) => void } = {},
  ) => {
    const bad = Number.isNaN(
      parseNumberInput(f[key], { int: isWholeSuperplanField(key) }),
    );
    return (
      <Field label={L(label)} hint={opts.hint}>
        <Input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={f[key]}
          data-sp={key}
          aria-invalid={bad || undefined}
          className={cx(bad && "border-red-400 ring-2 ring-red-100")}
          onChange={(e) =>
            opts.onChange
              ? opts.onChange(e.target.value)
              : set(key, e.target.value)
          }
        />
      </Field>
    );
  };

  const fxHint =
    ctx.fxStatus === "none"
      ? L("superplan.fx.none")
      : L(
          ctx.fxStatus === "today" ? "superplan.fx.hint" : "superplan.fx.stale",
          {
            date: ctx.fxDate ?? "—",
            spread: nf(params.futureSpreadBrl),
          },
        );
  const expensesTotal = input.expenses.reduce((s, e) => s + e.amountBrl, 0);
  const goTo = (id: string) =>
    router.push(
      id
        ? `/app/superplan?product=${encodeURIComponent(id)}`
        : "/app/superplan",
    );
  // "Gravar esta simulação" (só quando a tela pede): vai a conta que está na
  // tela; a ação refaz o cálculo no servidor (o resultado não sai daqui).
  const saveForm = save ? (
    <form
      action={save.action}
      className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
      data-superplan-save-form
    >
      {Object.entries(save.hidden)
        .filter(([name]) => !SAVE_FIELDS.includes(name))
        .map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <input type="hidden" name="input" value={JSON.stringify(input)} />
      <input type="hidden" name="businessType" value={f.businessType} />
      <input type="hidden" name="container" value={f.container} />
      <input type="hidden" name="ncmFound" value={ratesKnown ? "1" : "0"} />
      <p className="text-sm font-semibold text-zinc-900">{save.title}</p>
      <p className="mt-0.5 text-xs text-zinc-600">{save.hint}</p>
      <SubmitButton className="mt-2" data-superplan-save-simulation>
        {save.submit}
      </SubmitButton>
    </form>
  ) : null;

  return (
    <div className="space-y-4">
      <form
        method="get"
        action="/app/superplan"
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          goTo(String(new FormData(e.currentTarget).get("product") ?? ""));
        }}
      >
        <div className="min-w-0 flex-1 sm:max-w-xl">
          <Field
            label={L("superplan.product")}
            hint={L("superplan.product.hint")}
          >
            <Select
              name="product"
              defaultValue={prefill.productId ?? ""}
              onChange={(e) => goTo(e.target.value)}
              data-sp="product"
            >
              <option value="">{L("superplan.product.none")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" variant="secondary" className="mb-5">
          {L("superplan.product.load")}
        </Button>
      </form>

      {/* No celular o resultado fica embaixo: o resumo aparece aqui também. */}
      <div className="space-y-2 lg:hidden">
        <VerdictBox
          r={r}
          L={L}
          nf={nf}
          pct={pct}
          brl={brl}
          onUse={testSalePrice}
        />
        {saveForm}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,31rem)]">
        <div className="min-w-0 space-y-4">
          <Card dense title={L("superplan.section.purchase")}>
            {prefill.productName ? (
              <p className="-mt-1 mb-3 text-xs text-zinc-600">
                {L("superplan.product.loaded", { name: prefill.productName })}
                {prefill.ncm
                  ? ` · ${L("superplan.ncm", { ncm: prefill.ncm })}`
                  : null}
              </p>
            ) : null}
            {prefill.productId && prefill.otherCurrency ? (
              <div className="mb-3">
                <Alert tone="warning">
                  {L("superplan.product.currency", {
                    currency: prefill.otherCurrency,
                  })}
                </Alert>
              </div>
            ) : null}
            {prefill.productId &&
            (prefill.iiPct === null || prefill.ipiPct === null) ? (
              <div className="mb-3">
                <Alert tone="warning">{L("superplan.ncm.missing")}</Alert>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {field("unitPrice", "superplan.unitPrice")}
              <Field label={L("superplan.currency")}>
                <Select
                  value={f.currency}
                  data-sp="currency"
                  onChange={(e) =>
                    set("currency", e.target.value === "USD" ? "USD" : "RMB")
                  }
                >
                  <option value="RMB">RMB</option>
                  <option value="USD">US$</option>
                </Select>
              </Field>
              {field("pcsPerCarton", "superplan.pcsPerCarton")}
              {field("netWeightPcKg", "superplan.netWeight")}
              {field("grossWeightPcKg", "superplan.grossWeight")}
              <Field
                label={L("superplan.averageWeight")}
                hint={L("superplan.averageWeight.hint")}
              >
                <Input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={averageWeightKg === null ? "" : nf(averageWeightKg, 4)}
                  placeholder="—"
                  data-superplan-average-weight={
                    averageWeightKg === null ? "" : averageWeightKg.toFixed(4)
                  }
                  className="bg-zinc-50 text-zinc-600"
                />
              </Field>
              {field("cbmPerCarton", "superplan.cbm")}
            </div>
            {/* Bruto vazio com o líquido preenchido: o campo continua vazio e
                esta linha diz o peso que a conta está usando. */}
            {weight.estimated && weight.kg !== null ? (
              <p
                className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900"
                data-superplan-gross-estimate={weight.kg.toFixed(4)}
              >
                {L("superplan.grossWeight.estimated", {
                  kg: nf(weight.kg, 4),
                  pct: nf(params.grossEstimatePct, 2),
                })}
              </p>
            ) : null}
            {/* Média do despachante: só informação (não entra na conta). */}
            {prefill.productId && averageUsd !== undefined ? (
              <p
                className="mt-2 text-xs text-zinc-600"
                data-superplan-average={
                  averageUsd === null ? "" : averageUsd.toFixed(2)
                }
              >
                {averageUsd === null
                  ? L("superplan.average.none")
                  : L("superplan.average", { value: usd(averageUsd) })}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {field("iiPct", "superplan.ii")}
              {field("ipiPct", "superplan.ipi")}
            </div>
          </Card>

          <Card dense title={L("superplan.section.container")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label={L("superplan.containerType")}>
                <Select
                  value={f.container}
                  data-sp="container"
                  onChange={(e) => chooseContainer(e.target.value)}
                >
                  {ctx.containers.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              </Field>
              {field("containerCbm", "superplan.containerCbm")}
              {field("containerMaxKg", "superplan.containerKg")}
              {field("freightUsd", "superplan.freight")}
              {field("roadFreightBrl", "superplan.roadFreight")}
              {field("deliveryFreightBrl", "superplan.delivery")}
            </div>
          </Card>

          <Card dense title={L("superplan.section.fx")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {field("officialRate", "superplan.official", {
                onChange: setOfficial,
              })}
              {field("futureRate", "superplan.future", {
                onChange: (raw) => {
                  setFutureTouched(true);
                  set("futureRate", raw);
                },
              })}
              {field("rmbPerUsd", "superplan.rmb")}
            </div>
            <p className="mt-2 text-xs text-zinc-500">{fxHint}</p>
          </Card>

          <Card dense title={L("superplan.section.business")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-3">
                <Field
                  label={L("superplan.businessType")}
                  hint={L("superplan.business.hint")}
                >
                  <Select
                    value={f.businessType}
                    data-sp="businessType"
                    onChange={(e) => chooseType(e.target.value)}
                  >
                    {params.businessTypes.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {field("markup", "superplan.markup")}
              {field("commissionPct", "superplan.commission")}
              {field("adminExpensesPct", "superplan.adminExpenses")}
              {field("targetProfitPct", "superplan.targetProfit")}
              {field("wdPct", "superplan.wd")}
            </div>
          </Card>

          <Card dense title={L("superplan.section.expenses")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {params.expenses.map((e, i) => {
                const bad = Number.isNaN(
                  parseNumberInput(expenses[i] ?? "", { int: true }),
                );
                return (
                  <Field
                    key={e.key}
                    label={e.label}
                    hint={
                      e.customs ? L("superplan.expenses.customs") : undefined
                    }
                  >
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={expenses[i] ?? ""}
                      data-sp={`expense.${e.key}`}
                      aria-invalid={bad || undefined}
                      className={cx(
                        bad && "border-red-400 ring-2 ring-red-100",
                      )}
                      onChange={(ev) => {
                        const value = ev.target.value;
                        setExpenses((prev) =>
                          prev.map((v, j) => (j === i ? value : v)),
                        );
                      }}
                    />
                  </Field>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-zinc-700">
              {L("superplan.expenses.total")}:{" "}
              <strong className="tabular-nums">{brl(expensesTotal)}</strong>
            </p>
          </Card>

          <Card dense title={L("superplan.section.china")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {field("tradingCommissionPct", "superplan.tradingCommission")}
              {field("chinaChargesRmb", "superplan.chinaCharges")}
            </div>
          </Card>

          <Card dense title={L("superplan.salePrice")}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-56">
                {field("salePrice", "superplan.salePrice", {
                  hint: L("superplan.salePrice.hint"),
                })}
              </div>
              {f.salePrice ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="mb-5"
                  onClick={() => set("salePrice", "")}
                >
                  {L("superplan.salePrice.clear")}
                </Button>
              ) : null}
            </div>
          </Card>
          {rfq ? (
            <RfqCard
              L={L}
              r={r}
              rfq={rfq}
              productId={prefill.productId}
              input={input}
              businessType={f.businessType}
              container={f.container}
            />
          ) : null}
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="hidden space-y-2 lg:block">
            <VerdictBox
              r={r}
              L={L}
              nf={nf}
              pct={pct}
              brl={brl}
              onUse={testSalePrice}
            />
            {saveForm}
          </div>
          <Results
            r={r}
            L={L}
            nf={nf}
            pct={pct}
            brl={brl}
            usd={usd}
            icmsUnset={ctx.icmsImportPct === null}
            grossEstimatePct={params.grossEstimatePct}
            factors={params.priceFactors}
            markup={input.markup}
            wdPct={input.wdPct}
            hasDelivery={input.deliveryFreightBrl > 0}
          />
        </div>
      </div>
    </div>
  );
}

type Fmt = (v: number) => string;
type Lbl = (key: LabelKey, params?: Record<string, string | number>) => string;

/** Sinal verde, amarelo ou vermelho, com o preço que bate a meta. */
function VerdictBox({
  r,
  L,
  nf,
  pct,
  brl,
  onUse,
}: {
  r: SuperplanResult;
  L: Lbl;
  nf: (v: number, digits?: number) => string;
  pct: Fmt;
  brl: Fmt;
  onUse: (price: number) => void;
}) {
  if (r.missing.length || !r.sale || !r.target || !r.verdict || !r.prices)
    return (
      <Alert tone="warning">
        <span data-superplan-missing={r.missing.join(" ")}>
          {L("superplan.missing", {
            list: r.missing.map((m) => L(`superplan.missing.${m}`)).join(", "),
          })}
        </span>
      </Alert>
    );
  const { sale, target, verdict, prices } = r;
  const goal = `${nf(target.pct, 1)}%`;
  // Preço da meta em centavos, arredondado para cima: vendendo a ele, a meta
  // é batida (o mesmo valor que o botão "Testar esse preço" usa e que o
  // retrato da simulação guarda).
  const needed = targetPriceCents(r);
  const neededMarkup =
    needed !== null && r.cost ? needed / r.cost.perPiece : null;
  const tested = Math.abs(sale.price - prices.minimum) > 0.0049;
  const style = {
    viable: "border-emerald-500 bg-emerald-50 text-emerald-950",
    below: "border-amber-500 bg-amber-50 text-amber-950",
    loss: "border-red-500 bg-red-50 text-red-950",
  }[verdict];
  const dot = {
    viable: "bg-emerald-500",
    below: "bg-amber-400",
    loss: "bg-red-500",
  }[verdict];
  return (
    <div
      className={cx("rounded-xl border-l-4 px-4 py-3 shadow-sm", style)}
      role={verdict === "loss" ? "alert" : "status"}
      data-superplan-verdict={verdict}
    >
      <p className="flex items-start gap-2 text-base font-semibold">
        <span
          aria-hidden
          className={cx("mt-1.5 h-3 w-3 shrink-0 rounded-full", dot)}
        />
        <span>
          {verdict === "loss"
            ? L("superplan.verdict.loss", {
                value: brl(-sale.profit),
                pct: pct(sale.profitPct),
              })
            : L(`superplan.verdict.${verdict}`, {
                pct: pct(sale.profitPct),
                target: goal,
              })}
        </span>
      </p>
      <p className="mt-1 text-sm">
        {L("superplan.verdict.at", {
          price: brl(sale.price),
          which: L(
            tested
              ? "superplan.verdict.atTested"
              : "superplan.verdict.atMinimum",
          ),
        })}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {needed !== null && neededMarkup !== null ? (
          <>
            <span data-superplan-target={needed.toFixed(2)}>
              {L("superplan.target.price", {
                target: goal,
                price: brl(needed),
                markup: nf(neededMarkup, 2),
              })}
            </span>
            {Math.abs(needed - sale.price) > 0.0049 ? (
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => onUse(needed)}
                data-superplan-use-target
              >
                {L("superplan.target.use")}
              </Button>
            ) : null}
          </>
        ) : (
          <span>{L("superplan.target.impossible", { target: goal })}</span>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  tone,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  muted?: boolean;
  tone?: "good" | "bad";
}) {
  return (
    <div
      className={cx(
        "flex items-baseline justify-between gap-3 border-b border-zinc-100 py-1.5 text-[13px] last:border-b-0",
        strong && "font-semibold text-zinc-900",
        muted && "text-zinc-500",
      )}
    >
      <span className="min-w-0">{label}</span>
      <span
        className={cx(
          "shrink-0 tabular-nums",
          tone === "good" && "text-emerald-700",
          tone === "bad" && "text-red-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Results({
  r,
  L,
  nf,
  pct,
  brl,
  usd,
  icmsUnset,
  grossEstimatePct,
  factors,
  markup,
  wdPct,
  hasDelivery,
}: {
  r: SuperplanResult;
  L: Lbl;
  nf: (v: number, digits?: number) => string;
  pct: Fmt;
  brl: Fmt;
  usd: Fmt;
  icmsUnset: boolean;
  grossEstimatePct: number;
  factors: SuperplanParams["priceFactors"];
  markup: number;
  wdPct: number;
  hasDelivery: boolean;
}) {
  const { container, cost, prices, sale } = r;
  return (
    <>
      {container ? (
        <Card dense title={L("superplan.section.result")}>
          <p
            className="text-sm font-semibold text-zinc-900"
            data-superplan-pieces={container.pieces}
          >
            {L("superplan.container.fit", {
              cartons: nf(container.cartons, 0),
              pieces: nf(container.pieces, 0),
            })}
          </p>
          <p
            className="mt-0.5 text-xs text-zinc-600"
            data-superplan-limited={container.limitedBy}
            data-superplan-weight={
              container.weightUnknown
                ? "unknown"
                : container.weightEstimated
                  ? "estimated"
                  : "informed"
            }
          >
            {container.limitedBy === "weight"
              ? L("superplan.container.byWeight", {
                  kg: nf(container.usedKg ?? 0, 0),
                })
              : L("superplan.container.byVolume", {
                  cbm: nf(container.usedCbm, 2),
                })}
            {container.weightUnknown
              ? ` ${L("superplan.container.noWeight")}`
              : null}
            {container.weightEstimated
              ? ` ${L("superplan.container.estimated", {
                  pct: nf(grossEstimatePct, 2),
                })}`
              : null}
          </p>
        </Card>
      ) : null}

      {prices && cost ? (
        <Card dense title={L("superplan.prices.title")}>
          <Row
            strong
            label={L("superplan.prices.minimum", { markup: nf(markup, 4) })}
            value={
              <span data-superplan-minimum={prices.minimum.toFixed(2)}>
                {brl(prices.minimum)}
              </span>
            }
          />
          <Row
            label={L("superplan.prices.table", { f: nf(factors.table, 2) })}
            value={brl(prices.table)}
          />
          <Row
            label={L("superplan.prices.wholesale", {
              f: nf(factors.wholesale, 2),
            })}
            value={brl(prices.wholesale)}
          />
          <Row
            label={L("superplan.prices.retail", { f: nf(factors.retail, 2) })}
            value={brl(prices.retail)}
          />
          <Row
            label={L("superplan.prices.wd", { pct: `${nf(wdPct, 2)}%` })}
            value={brl(prices.wd)}
          />
          {hasDelivery ? (
            <Row
              label={L("superplan.prices.delivered")}
              value={brl(prices.delivered)}
            />
          ) : null}
          <Row
            muted
            label={L("superplan.cost.perPiece")}
            value={brl(cost.perPiece)}
          />
        </Card>
      ) : null}

      {sale ? (
        <Card
          dense
          title={L("superplan.sale.title", { price: brl(sale.price) })}
        >
          <Row label={L("superplan.sale.ipi")} value={brl(sale.ipi)} />
          <Row label={L("superplan.sale.icms")} value={brl(sale.icms)} />
          <Row label={L("superplan.sale.pis")} value={brl(sale.pis)} />
          <Row label={L("superplan.sale.cofins")} value={brl(sale.cofins)} />
          <Row label={L("superplan.sale.ir")} value={brl(sale.ir)} />
          <Row label={L("superplan.sale.csll")} value={brl(sale.csll)} />
          <Row
            label={L("superplan.sale.commission")}
            value={brl(sale.commission)}
          />
          <Row
            label={L("superplan.sale.admin")}
            value={brl(sale.adminExpenses)}
          />
          <Row
            strong
            label={L("superplan.sale.deductions")}
            value={brl(sale.deductions)}
          />
          <Row
            strong
            label={L("superplan.sale.profit")}
            value={
              <span data-superplan-profit={sale.profitPct.toFixed(1)}>
                {brl(sale.profit)} ({pct(sale.profitPct)})
              </span>
            }
            tone={sale.profit > 0 ? "good" : "bad"}
          />
          <Row
            label={L("superplan.sale.perContainer")}
            value={brl(sale.profitPerContainer)}
            tone={sale.profit > 0 ? "good" : "bad"}
          />
          <Row
            muted
            label={L("superplan.sale.revenue")}
            value={brl(sale.revenuePerContainer)}
          />
          <p className="mt-2 text-xs text-zinc-500">
            {L("superplan.sale.credit")}
          </p>
        </Card>
      ) : null}

      {cost ? (
        <Card dense title={L("superplan.cost.title")}>
          <Row
            label={L("superplan.cost.goods", { usd: usd(cost.fobUsd) })}
            value={brl(cost.goodsBrl)}
          />
          <Row
            label={L("superplan.cost.freight")}
            value={brl(cost.freightBrl)}
          />
          {cost.insuranceBrl > 0 ? (
            <Row
              label={L("superplan.cost.insurance")}
              value={brl(cost.insuranceBrl)}
            />
          ) : null}
          <Row
            muted
            label={`${L("superplan.cost.customsValue")} (${L("superplan.cost.base")})`}
            value={brl(cost.customsValueBrl)}
          />
          <Row label={L("superplan.cost.ii")} value={brl(cost.iiBrl)} />
          <Row label={L("superplan.cost.ipi")} value={brl(cost.ipiBrl)} />
          <Row label={L("superplan.cost.pis")} value={brl(cost.pisBrl)} />
          <Row label={L("superplan.cost.cofins")} value={brl(cost.cofinsBrl)} />
          <Row label={L("superplan.cost.afrmm")} value={brl(cost.afrmmBrl)} />
          <Row label={L("superplan.cost.icms")} value={brl(cost.icmsBrl)} />
          {icmsUnset ? (
            <p className="py-1 text-xs text-amber-800">
              {L("superplan.icms.unset")}
            </p>
          ) : null}
          <Row
            label={L("superplan.cost.expenses")}
            value={brl(cost.expensesBrl)}
          />
          <Row
            label={L("superplan.cost.road")}
            value={brl(cost.roadFreightBrl)}
          />
          {cost.chinaBrl > 0 ? (
            <Row label={L("superplan.cost.china")} value={brl(cost.chinaBrl)} />
          ) : null}
          <Row
            strong
            label={L("superplan.cost.total")}
            value={brl(cost.totalBrl)}
          />
          <Row
            strong
            label={L("superplan.cost.perPiece")}
            value={
              <span data-superplan-cost={cost.perPiece.toFixed(2)}>
                {brl(cost.perPiece)}
              </span>
            }
          />
        </Card>
      ) : null}
    </>
  );
}

/**
 * Viabilidade feita: abre a solicitação e a RFQ só com o fornecedor ganho
 * (docs/SUPERPLAN.md). Com prejuízo ou conta incompleta, o botão não aparece
 * e a tela diz por quê; o servidor confere de novo.
 */
function RfqCard({
  L,
  r,
  rfq,
  productId,
  input,
  businessType,
  container,
}: {
  L: Lbl;
  r: SuperplanResult;
  rfq: SuperplanRfqOptions;
  productId: string | null;
  input: SuperplanInput;
  businessType: string;
  container: string;
}) {
  const pieces = r.container?.pieces ?? null;
  // A quantidade acompanha o container até a pessoa digitar outra.
  const [quantity, setQuantity] = useState<string | null>(null);
  const shown = quantity ?? (pieces ? String(pieces) : "");
  const blocked = !productId
    ? L("superplan.rfq.needProduct")
    : r.missing.length || !r.verdict
      ? L("superplan.rfq.needResult")
      : r.verdict === "loss"
        ? L("superplan.rfq.loss")
        : !rfq.suppliers.length
          ? L("superplan.rfq.noSuppliers")
          : null;
  return (
    <div id="superplan-rfq" className="scroll-mt-4" data-superplan-rfq>
      <Card dense title={L("superplan.rfq.title")}>
        <p className="-mt-1 mb-3 text-sm text-zinc-600">
          {L("superplan.rfq.hint")}
        </p>
        {blocked ? (
          <Alert tone={r.verdict === "loss" ? "danger" : "neutral"}>
            {blocked}
          </Alert>
        ) : (
          <form action={openSuperplanRfqAction} className="space-y-3">
            <input type="hidden" name="productId" value={productId ?? ""} />
            <input type="hidden" name="input" value={JSON.stringify(input)} />
            <input type="hidden" name="businessType" value={businessType} />
            <input type="hidden" name="container" value={container} />
            {r.verdict === "below" ? (
              <Alert tone="warning">{L("superplan.rfq.below")}</Alert>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={L("superplan.rfq.supplier")}>
                <Select name="supplierId" required data-sp="rfq.supplier">
                  {rfq.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.linked
                        ? `${s.name} (${L("superplan.rfq.linked")})`
                        : s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={L("superplan.rfq.customer")}>
                <Select name="customerId" data-sp="rfq.customer">
                  <option value="__stock">{L("superplan.rfq.stock")}</option>
                  {rfq.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={L("superplan.rfq.quantity")}
                hint={L("superplan.rfq.quantity.hint")}
              >
                <Input
                  name="quantity"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={shown}
                  data-sp="rfq.quantity"
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Field>
            </div>
            <SubmitButton
              pendingText={L("superplan.rfq.sending")}
              data-superplan-rfq-submit
            >
              {L("superplan.rfq.submit")}
            </SubmitButton>
          </form>
        )}
      </Card>
    </div>
  );
}
