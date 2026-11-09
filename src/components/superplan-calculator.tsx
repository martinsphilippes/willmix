"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
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
 */

export type SuperplanLabels = Record<keyof typeof superplanTexts, string>;
type LabelKey = keyof SuperplanLabels;

export interface SuperplanProductOption {
  id: string;
  label: string;
}

/** Dados do produto escolhido (vazios sem produto). */
export interface SuperplanPrefill {
  productId: string | null;
  productName: string | null;
  unitPrice: number | null;
  currency: "RMB" | "USD";
  /** Moeda do cadastro que o Superplan não usa (EUR, BRL): o preço fica vazio. */
  otherCurrency: string | null;
  pcsPerCarton: number | null;
  grossWeightPcKg: number | null;
  cbmPerCarton: number | null;
  ncm: string | null;
  /** II e IPI do NCM na tabela fiscal; nulos quando o NCM não foi achado. */
  iiPct: number | null;
  ipiPct: number | null;
}

/** O que vem do sistema: parâmetros, containers, câmbio e tributos da importação. */
export interface SuperplanContext {
  params: SuperplanParams;
  containers: Array<{ code: string; capacityCbm: number; maxWeightKg: number }>;
  defaultContainer: string | null;
  /** R$ por US$ (câmbio do dia) e RMB por US$; nulos sem câmbio. */
  official: number | null;
  rmbPerUsd: number | null;
  fxDate: string | null;
  fxStatus: "today" | "stale" | "manual" | "none";
  insurancePct: number;
  pisImportPct: number;
  cofinsImportPct: number;
  /** null = não configurado em Configurações (conta como 0%). */
  icmsImportPct: number | null;
}

type Fields = {
  unitPrice: string;
  currency: "RMB" | "USD";
  pcsPerCarton: string;
  grossWeightPcKg: string;
  cbmPerCarton: string;
  iiPct: string;
  ipiPct: string;
  container: string;
  containerCbm: string;
  containerMaxKg: string;
  freightUsd: string;
  roadFreightBrl: string;
  deliveryFreightBrl: string;
  officialRate: string;
  futureRate: string;
  rmbPerUsd: string;
  businessType: string;
  markup: string;
  commissionPct: string;
  adminExpensesPct: string;
  targetProfitPct: string;
  wdPct: string;
  tradingCommissionPct: string;
  chinaChargesRmb: string;
  salePrice: string;
};

/** Campos em que "1.000" é mil (peças, kg, valores em reais e dólares cheios). */
const WHOLE: ReadonlyArray<keyof Fields> = [
  "pcsPerCarton",
  "containerMaxKg",
  "freightUsd",
  "roadFreightBrl",
  "deliveryFreightBrl",
  "chinaChargesRmb",
];

const fill = (text: string, params?: Record<string, string | number>) =>
  params
    ? Object.entries(params).reduce(
        (out, [k, v]) => out.replaceAll(`{${k}}`, String(v)),
        text,
      )
    : text;

/** Número para o campo: sem separador de milhar, com a vírgula do idioma. */
function toInput(
  value: number | null | undefined,
  decimal: string,
  digits = 2,
) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "";
  const rounded = Number(value.toFixed(digits));
  return String(rounded).replace(".", decimal);
}

function read(raw: string, whole = false): number | null {
  const n = parseNumberInput(raw, { int: whole });
  return n === null || Number.isNaN(n) ? null : n;
}

export function SuperplanCalculator({
  labels,
  intl,
  products,
  prefill,
  ctx,
}: {
  labels: SuperplanLabels;
  /** Tag do idioma para os números (pt-BR, en-US, zh-CN). */
  intl: string;
  products: SuperplanProductOption[];
  prefill: SuperplanPrefill;
  ctx: SuperplanContext;
}) {
  const router = useRouter();
  const L = (key: LabelKey, params?: Record<string, string | number>) =>
    fill(labels[key], params);
  const decimal = intl.startsWith("pt") ? "," : ".";
  const show = (n: number | null | undefined, digits = 2) =>
    toInput(n, decimal, digits);
  const { params } = ctx;

  const [f, setF] = useState<Fields>(() => {
    const type = businessTypeOf(params, params.defaultBusinessType);
    const box =
      ctx.containers.find((c) => c.code === ctx.defaultContainer) ??
      ctx.containers[0] ??
      null;
    return {
      unitPrice: show(prefill.unitPrice, 4),
      currency: prefill.currency,
      pcsPerCarton: show(prefill.pcsPerCarton, 0),
      grossWeightPcKg: show(prefill.grossWeightPcKg, 4),
      cbmPerCarton: show(prefill.cbmPerCarton, 4),
      iiPct: show(prefill.iiPct),
      ipiPct: show(prefill.ipiPct),
      container: box?.code ?? "",
      containerCbm: show(box?.capacityCbm),
      containerMaxKg: show(box?.maxWeightKg, 0),
      freightUsd: show(params.freightUsd),
      roadFreightBrl: show(params.roadFreightBrl),
      deliveryFreightBrl: "",
      officialRate: show(ctx.official, 4),
      futureRate: show(
        ctx.official === null ? null : ctx.official + params.futureSpreadBrl,
        4,
      ),
      rmbPerUsd: show(ctx.rmbPerUsd, 4),
      businessType: type.name,
      markup: show(type.markup, 4),
      commissionPct: show(type.commissionPct),
      adminExpensesPct: show(type.adminExpensesPct),
      targetProfitPct: show(type.targetProfitPct),
      wdPct: show(type.wdPct),
      tradingCommissionPct: "",
      chinaChargesRmb: "",
      salePrice: "",
    };
  });
  const [expenses, setExpenses] = useState<string[]>(() =>
    params.expenses.map((e) => show(e.amountBrl)),
  );
  // O dólar futuro acompanha o oficial (+ diferença dos parâmetros) até a
  // pessoa digitar o futuro à mão.
  const [futureTouched, setFutureTouched] = useState(false);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const chooseType = (name: string) => {
    const type = businessTypeOf(params, name);
    setF((prev) => ({
      ...prev,
      businessType: type.name,
      markup: show(type.markup, 4),
      commissionPct: show(type.commissionPct),
      adminExpensesPct: show(type.adminExpensesPct),
      targetProfitPct: show(type.targetProfitPct),
      wdPct: show(type.wdPct),
    }));
  };
  const chooseContainer = (code: string) => {
    const box = ctx.containers.find((c) => c.code === code);
    setF((prev) => ({
      ...prev,
      container: code,
      containerCbm: box ? show(box.capacityCbm) : prev.containerCbm,
      containerMaxKg: box ? show(box.maxWeightKg, 0) : prev.containerMaxKg,
    }));
  };
  const setOfficial = (raw: string) => {
    setF((prev) => {
      const official = read(raw);
      return {
        ...prev,
        officialRate: raw,
        futureRate:
          futureTouched || official === null
            ? prev.futureRate
            : show(official + params.futureSpreadBrl, 4),
      };
    });
  };

  const num = (key: keyof Fields) =>
    read(f[key] as string, WHOLE.includes(key));
  const input: SuperplanInput = {
    unitPrice: num("unitPrice"),
    currency: f.currency,
    pcsPerCarton: num("pcsPerCarton"),
    grossWeightPcKg: num("grossWeightPcKg"),
    cbmPerCarton: num("cbmPerCarton"),
    containerCbm: num("containerCbm"),
    containerMaxKg: num("containerMaxKg"),
    iiPct: num("iiPct") ?? 0,
    ipiPct: num("ipiPct") ?? 0,
    freightUsd: num("freightUsd"),
    roadFreightBrl: num("roadFreightBrl") ?? 0,
    deliveryFreightBrl: num("deliveryFreightBrl") ?? 0,
    officialRate: num("officialRate"),
    futureRate: num("futureRate"),
    rmbPerUsd: num("rmbPerUsd"),
    tradingCommissionPct: num("tradingCommissionPct") ?? 0,
    chinaChargesRmb: num("chinaChargesRmb") ?? 0,
    expenses: params.expenses.map((e, i) => ({
      ...e,
      amountBrl: read(expenses[i] ?? "", true) ?? 0,
    })),
    markup: num("markup") ?? 0,
    commissionPct: num("commissionPct") ?? 0,
    adminExpensesPct: num("adminExpensesPct") ?? 0,
    targetProfitPct: num("targetProfitPct") ?? 0,
    wdPct: num("wdPct") ?? 0,
    insurancePct: ctx.insurancePct,
    pisImportPct: ctx.pisImportPct,
    cofinsImportPct: ctx.cofinsImportPct,
    icmsImportPct: ctx.icmsImportPct ?? 0,
    freightFxPct: params.freightFxPct,
    afrmmPct: params.afrmmPct,
    afrmmFixedBrl: params.afrmmFixedBrl,
    priceFactors: params.priceFactors,
    saleTaxes: params.saleTaxes,
    salePrice: num("salePrice"),
  };
  const r = computeSuperplan(input);

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
    key: Exclude<keyof Fields, "currency" | "container" | "businessType">,
    label: LabelKey,
    opts: { hint?: ReactNode; onChange?: (raw: string) => void } = {},
  ) => {
    const bad = Number.isNaN(
      parseNumberInput(f[key], { int: WHOLE.includes(key) }),
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
      <div className="lg:hidden">
        <VerdictBox
          r={r}
          L={L}
          nf={nf}
          pct={pct}
          brl={brl}
          onUse={(p) => set("salePrice", show(p))}
        />
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
              {field("grossWeightPcKg", "superplan.grossWeight")}
              {field("cbmPerCarton", "superplan.cbm")}
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
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="hidden lg:block">
            <VerdictBox
              r={r}
              L={L}
              nf={nf}
              pct={pct}
              brl={brl}
              onUse={(p) => set("salePrice", show(p))}
            />
          </div>
          <Results
            r={r}
            L={L}
            nf={nf}
            pct={pct}
            brl={brl}
            usd={usd}
            icmsUnset={ctx.icmsImportPct === null}
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
  // é batida (o mesmo valor que o botão "Testar esse preço" usa).
  const needed =
    target.price === null ? null : Math.ceil(target.price * 100 - 1e-6) / 100;
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
          <p className="mt-0.5 text-xs text-zinc-600">
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
