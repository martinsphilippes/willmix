"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRequestCustomer } from "./request-customer-context";
import { Field, Select } from "./ui";
import {
  SearchPicker,
  type SearchOption,
  type SearchPickerLabels,
} from "./search-picker";
import {
  ENABLED_OPERATION_TYPES,
  OPERATION_TYPES,
  SALE_FORMATS,
  WELLMIX_TIERS,
  carrierValue,
  CARRIER_CALLERS,
  type CarrierCaller,
  countryAllowed,
  formatCnpj,
  type OperationType,
  type RequestPaymentPlan,
  type SaleFormat,
  type WellmixTier,
} from "@/lib/order-terms";

export interface RequestOrderTermsLabels {
  title: string;
  hint: string;
  operationType: string;
  operation: Record<OperationType, string>;
  /** "(em breve)" ao lado do tipo desabilitado. */
  operationDisabled: string;
  /**
   * Explicação do tipo fixo pela tela (TS - Trading Sales ou Venda -
   * Encomenda; docs/REQUEST_SCREENS.md).
   */
  operationFixed?: string;
  saleFormat: string;
  format: Record<SaleFormat, string>;
  tier: string;
  tierChoose: string;
  tiers: Record<WellmixTier, string>;
  delivery: string;
  carrier: string;
  carrierNone: string;
  redispatch: string;
  redispatchYes: string;
  redispatchNo: string;
  redispatchHint: string;
  carrierSankhya: string;
  carrierSankhyaOff: string;
  carrierSankhyaError: string;
  /** Quem chama o transportador (16/11/2026): Cliente ou Wellmix. */
  carrierCaller: string;
  carrierCallers: Record<CarrierCaller, string>;
  carrierCallerHint: Record<CarrierCaller, string>;
  /** Transportador do re-despacho (quem chama = Wellmix, com Sim). */
  redispatchCarrier: string;
  /** Valor do transporte (R$, total) e a dica; valor total do pedido. */
  freight?: string;
  freightHint?: string;
  orderTotal?: string;
  /**
   * Forma de pagamento e a previsão das parcelas (dono, 16/11/2026), logo
   * abaixo do Valor total.
   */
  payment?: PaymentLabels;
  intl?: string;
  country: string;
  countryChoose: string;
  /** "(não vale no TS)" */
  countryDisabled: string;
  group: string;
  groupChoose: string;
  groupPickCountry: string;
  groupNone: string;
  /**
   * País - Porto (dono, 21/11/2026; docs/ORDER_TERMS.md 11.23): o buscador
   * único no lugar do País; um pedido fica num só país, porto e família.
   */
  port: {
    field: string;
    choose: string;
    noPort: string;
    /** "{country} - {port}" */
    option: string;
    hint: string;
    groupPick: string;
    picker: SearchPickerLabels;
  };
  originHint: string;
  loading: string;
  error: string;
  /** "{n} produtos" */
  productsCount: string;
  stock: string;
  confirmNote: string;
  /** "Buscar por nome, código ou CNPJ". */
  carrierSearch: string;
  /** "Código {code}" e "CNPJ {cnpj}" no resumo abaixo do campo. */
  summaryCode: string;
  summaryCnpj: string;
  /** Aviso ao trocar o país ou a família com produtos no pedido. */
  switchTitle: string;
  switchBody: string;
  switchKeep: string;
  switchConfirm: string;
  /**
   * Bloco recolhido quando tudo está preenchido (dono, 19/11/2026): o
   * resumo numa linha, com Editar.
   */
  collapsed?: {
    edit: string;
    done: string;
    hint: string;
    operation: string;
    format: string;
    redispatch: string;
    carrier: string;
    origin: string;
    payment: string;
    total: string;
  };
}

/** Textos da forma de pagamento na Nova solicitação. */
export interface PaymentLabels {
  plan: string;
  choose: string;
  hint: string;
  preview: string;
  /** Rótulo de cada evento (No pedido, No embarque…). */
  events: Record<RequestPaymentPlan["installments"][number]["event"], string>;
  /** "{event} + {days} dias". */
  eventDays: string;
  noCharge: string;
  /** "+ juros de {rate}% ao mês ({days} dias)". */
  interest: string;
  needsApproval: string;
  /** Sem valor total ainda (sem preço previsto). */
  noTotal: string;
  none: string;
}

/** Valores já escolhidos (rascunho). */
export interface OrderTermsInitial {
  operationType?: string;
  saleFormat?: string;
  wellmixTier?: string;
  carrier?: string;
  redispatchCarrier?: string;
  carrierCaller?: string;
  deliveryFreightBrl?: string;
  redispatch?: string;
  originCountry?: string;
  originPort?: string;
  productFamily?: string;
  paymentPlanId?: string;
}

interface Country {
  key: string;
  name: string;
  products: number;
}
interface OriginPort {
  key: string;
  country: string;
  countryName: string;
  port: string;
  portName: string;
  products: number;
}
interface Group {
  id: string;
  name: string;
  products: number;
}
interface Carrier {
  source: "portal" | "sankhya";
  code: string;
  name: string;
  city: string | null;
  erpCode?: string | null;
  taxId?: string | null;
}

interface Options {
  countries: Country[];
  ports?: OriginPort[];
  carriers: Carrier[];
  sankhya: "ok" | "off" | "error";
}

type Pick = { value: string; name: string | null };

const radioClass =
  "flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60";

/**
 * Condições do pedido na Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md), da Wellmix vendendo ao cliente: Tipo de operação
 * (hoje só TS; Venda desabilitada), Formato de venda (WD ou Wellmix e o
 * nível), Entrega (Transportador do portal ou do Sankhya e Re-despacho
 * Sim/Não), País de origem (BRASIL desabilitado no TS) e Grupo de produto
 * (a família), nesta ordem (a busca de produto só oferece os deles). O aviso
 * "sem devoluções" fica para o cliente, na confirmação do pedido. Na compra
 * para estoque não aparece.
 */
export function RequestOrderTerms({
  labels,
  initial = {},
  fixedOperation,
  paymentPlans = [],
}: {
  labels: RequestOrderTermsLabels;
  initial?: OrderTermsInitial;
  /**
   * Formas de pagamento ativas de Configurações → Formas de pagamento do
   * cliente (dono, 16/11/2026), na ordem da lista.
   */
  paymentPlans?: RequestPaymentPlan[];
  /**
   * Tipo de operação fixo pela tela (TS - Trading Sales ou Venda -
   * Encomenda; docs/REQUEST_SCREENS.md): só ele aparece, já marcado, e o
   * servidor grava o da tela. Sem ele (Encomendas), TS marcado e Venda
   * desabilitada, como sempre.
   */
  fixedOperation?: OperationType;
}) {
  const shared = useRequestCustomer();
  const stock = !!shared?.stock;
  const [options, setOptions] = useState<Options | null>(null);
  const [failed, setFailed] = useState(false);
  const operation: OperationType = fixedOperation ?? "ts";
  const [format, setFormat] = useState<SaleFormat | "">(
    (SALE_FORMATS as readonly string[]).includes(initial.saleFormat ?? "")
      ? (initial.saleFormat as SaleFormat)
      : "",
  );
  // País e porto andam juntos (rascunho de antes do País - Porto, sem o
  // porto, volta sem país: escolher de novo).
  const draftOrigin =
    !!initial.originCountry && initial.originPort !== undefined;
  const [country, setCountry] = useState<string>(
    draftOrigin ? (initial.originCountry ?? "") : "",
  );
  const [port, setPort] = useState<string | null>(
    draftOrigin ? (initial.originPort ?? "") : null,
  );
  const originKey = country && port !== null ? `${country}|${port}` : "";
  // Remonta o buscador quando a troca é cancelada no aviso.
  const [originPickerKey, setOriginPickerKey] = useState(0);
  const [groups, setGroups] = useState<{ key: string; list: Group[] } | null>(
    null,
  );
  const [groupsFailed, setGroupsFailed] = useState(false);
  const [family, setFamily] = useState(initial.productFamily ?? "");
  const setOrigin = shared?.setOrigin;
  // Transportador: busca por nome, código ou CNPJ (dono, 15/11/2026) e o
  // resumo do escolhido (código, CNPJ e nome) abaixo do campo.
  const [tier, setTier] = useState(
    (WELLMIX_TIERS as readonly string[]).includes(initial.wellmixTier ?? "")
      ? (initial.wellmixTier as string)
      : "",
  );
  const [redispatch, setRedispatch] = useState(initial.redispatch ?? "");
  const [planId, setPlanId] = useState(() =>
    paymentPlans.some((p) => p.planId === initial.paymentPlanId)
      ? (initial.paymentPlanId ?? "")
      : "",
  );
  const [caller, setCaller] = useState<CarrierCaller | "">(
    (CARRIER_CALLERS as readonly string[]).includes(initial.carrierCaller ?? "")
      ? (initial.carrierCaller as CarrierCaller)
      : "",
  );
  // A previsão de preço lê o formato, o nível e quem chama (VIP e rota da
  // cotação V2 do Sankhya; dono, 16/11/2026).
  const setSaleTerms = shared?.setSaleTerms;
  const [freight, setFreight] = useState(initial.deliveryFreightBrl ?? "");
  const freightValue = parseMoney(freight);
  useEffect(() => {
    setSaleTerms?.({
      saleFormat: format || null,
      wellmixTier: format === "wellmix" && tier ? (tier as WellmixTier) : null,
      carrierCaller: caller || null,
      // O valor do transporte digitado (Wellmix chama) vai no lugar do frete
      // padrão das Configurações (dono, 16/11/2026).
      // No formato WD também (dono, 16/11/2026), mesmo com o cliente chamando.
      // Com o cliente chamando também (dono, 18/11/2026): o transporte tem
      // custo de toda forma.
      deliveryFreightBrl: caller ? freightValue : null,
    });
  }, [format, tier, caller, freightValue, setSaleTerms]);
  // Trocar o país ou a família com produto no pedido (dono, 15/11/2026): o
  // aviso recomenda terminar este pedido e começar outro; "trocar" limpa os
  // produtos.
  const hasProducts = (shared?.chosenProductIds.length ?? 0) > 0;
  const switchDialog = useRef<HTMLDialogElement>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{
    kind: "origin" | "family";
    value: string;
  } | null>(null);
  const applySwitch = (kind: "origin" | "family", value: string) => {
    if (kind === "origin") {
      const at = value.indexOf("|");
      setCountry(at < 0 ? "" : value.slice(0, at));
      setPort(at < 0 ? null : value.slice(at + 1));
      setFamily("");
    } else setFamily(value);
  };
  const askSwitch = (kind: "origin" | "family", value: string) => {
    const current = kind === "origin" ? originKey : family;
    if (value === current) return;
    if (!hasProducts) {
      applySwitch(kind, value);
      return;
    }
    setPendingSwitch({ kind, value });
    switchDialog.current?.showModal();
  };

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/requests/order-options", {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        setOptions((await res.json()) as Options);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!country || port === null) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/requests/order-options?${new URLSearchParams({ country, port })}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { groups: Group[] };
        setGroupsFailed(false);
        setGroups({ key: `${country}|${port}`, list: body.groups });
      } catch {
        if (!controller.signal.aborted) setGroupsFailed(true);
      }
    })();
    return () => controller.abort();
  }, [country, port]);

  // A busca de produto lê o país, o porto e a família escolhidos.
  useEffect(() => {
    setOrigin?.(
      country && port !== null && family ? { country, port, family } : null,
    );
  }, [country, port, family, setOrigin]);

  // Transportadores escolhidos (para saber se está tudo preenchido e para
  // o resumo do bloco recolhido).
  const [carrierPick, setCarrierPick] = useState<Pick>({
    value: "",
    name: null,
  });
  const [redispatchPick, setRedispatchPick] = useState<Pick>({
    value: "",
    name: null,
  });
  const onCarrier = useCallback(
    (value: string, name: string | null) => setCarrierPick({ value, name }),
    [],
  );
  const onRedispatchCarrier = useCallback(
    (value: string, name: string | null) => setRedispatchPick({ value, name }),
    [],
  );
  // Tudo preenchido (dono, 19/11/2026): o bloco se recolhe sozinho num
  // resumo de uma linha; "Editar" abre de novo. Volta a recolher quando
  // fica completo de novo depois de faltar algo, ou pelo "Recolher".
  const needsPlan = !!labels.payment && paymentPlans.length > 0;
  const complete =
    !!labels.collapsed &&
    !!format &&
    (format !== "wellmix" || !!tier) &&
    !!redispatch &&
    !!caller &&
    (caller !== "wellmix" ||
      (!!carrierPick.value &&
        (redispatch !== "yes" || !!redispatchPick.value))) &&
    !!originKey &&
    !!family &&
    (!needsPlan || !!planId);
  const [editing, setEditing] = useState(false);
  const [seenComplete, setSeenComplete] = useState(false);
  if (complete !== seenComplete) {
    setSeenComplete(complete);
    if (complete) setEditing(false);
  }
  const collapsed = complete && !editing;

  if (stock)
    return (
      <p
        className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
        data-order-terms="stock"
      >
        {labels.stock}
      </p>
    );

  const myGroups = groups && groups.key === originKey ? groups.list : null;
  const count = (n: number) =>
    labels.productsCount.replace("{n}", n.toLocaleString("pt-BR"));
  // País - Porto pelo buscador único (dono, 21/11/2026): "CHINA - NINGBO".
  const originLabel = (o: OriginPort) =>
    labels.port.option
      .replace("{country}", o.countryName)
      .replace("{port}", o.port ? o.portName : labels.port.noPort);
  const originOptions: SearchOption[] = (options?.ports ?? []).map((o) => {
    const allowed = countryAllowed(operation, o.country);
    return {
      id: o.key,
      name: originLabel(o),
      hint: `${count(o.products)}${allowed ? "" : ` ${labels.countryDisabled}`}`,
      code: o.port || null,
      disabled: !allowed,
      keywords: o.country,
    };
  });
  const originChosen = originOptions.find((o) => o.id === originKey) ?? null;
  const orderTotal = orderTotalOf(shared?.rowTotals);

  // Valor do transporte (dono, 16/11/2026): o total da entrega; vai na
  // previsão de preço no lugar do padrão. Com a Wellmix chamando, ao lado do
  // transportador; no formato WD com o cliente chamando, sozinho.
  const freightField = (
    <Field
      label={labels.freight ?? "Valor do transporte (R$)"}
      hint={labels.freightHint}
    >
      <input
        name="deliveryFreightBrl"
        inputMode="decimal"
        autoComplete="off"
        value={freight}
        onChange={(e) => setFreight(e.target.value)}
        className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm tabular-nums"
        data-order-terms-freight
      />
    </Field>
  );

  return (
    <section
      className="space-y-3 rounded-xl border border-zinc-200 p-3"
      data-order-terms
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900">
            {labels.title}
          </h3>
          <p className="text-xs text-zinc-500">
            {collapsed && labels.collapsed
              ? labels.collapsed.hint
              : labels.hint}
          </p>
        </div>
        {complete && labels.collapsed ? (
          <button
            type="button"
            onClick={() => setEditing(collapsed)}
            aria-expanded={!collapsed}
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            data-order-terms-toggle={collapsed ? "edit" : "collapse"}
          >
            {collapsed ? labels.collapsed.edit : labels.collapsed.done}
          </button>
        ) : null}
      </div>

      {collapsed && labels.collapsed ? (
        <OrderTermsSummary
          labels={labels}
          cells={[
            [labels.collapsed.operation, labels.operation[operation]],
            [
              labels.collapsed.format,
              format
                ? `${labels.format[format]}${format === "wellmix" && tier ? ` · ${labels.tiers[tier as WellmixTier]}` : ""}`
                : "—",
            ],
            [
              labels.collapsed.redispatch,
              redispatch === "yes"
                ? `${labels.redispatchYes}${caller === "wellmix" && redispatchPick.name ? ` · ${redispatchPick.name}` : ""}`
                : labels.redispatchNo,
            ],
            [
              labels.collapsed.carrier,
              caller === "wellmix"
                ? `${labels.carrierCallers.wellmix}${carrierPick.name ? ` · ${carrierPick.name}` : ""}`
                : caller
                  ? labels.carrierCallers[caller]
                  : "—",
            ],
            [
              labels.collapsed.origin,
              [
                originChosen?.name ?? country,
                (myGroups ?? []).find((g) => g.id === family)?.name,
              ]
                .filter(Boolean)
                .join(" › ") || "—",
            ],
            ...(needsPlan
              ? ([
                  [
                    labels.collapsed.payment,
                    paymentPlans.find((p) => p.planId === planId)?.name ?? "—",
                  ],
                ] as Array<[string, string]>)
              : []),
            [
              labels.collapsed.total,
              orderTotalOf(shared?.rowTotals)?.toLocaleString(
                labels.intl ?? "pt-BR",
                { style: "currency", currency: "BRL" },
              ) ?? "—",
            ],
          ]}
        />
      ) : null}

      <div hidden={collapsed} className="space-y-3" data-order-terms-body>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          {/* Tipo de operação: em Encomendas, hoje só TS (Venda desabilitada);
            nas telas de TS e de Venda, só o tipo da tela, já marcado. */}
          <fieldset
            className="min-w-0 space-y-1"
            data-order-terms-operation
            data-order-terms-operation-fixed={fixedOperation}
          >
            <legend className="block text-xs font-medium leading-5 text-zinc-700">
              {labels.operationType}
            </legend>
            <div className="flex flex-wrap gap-2">
              {(fixedOperation ? [fixedOperation] : OPERATION_TYPES).map(
                (op) => {
                  const enabled =
                    op === fixedOperation ||
                    ENABLED_OPERATION_TYPES.includes(op);
                  return (
                    <label key={op} className={radioClass}>
                      <input
                        type="radio"
                        name="operationType"
                        value={op}
                        required
                        disabled={!enabled}
                        defaultChecked={op === operation}
                        data-order-terms-operation-option={op}
                      />
                      {labels.operation[op]}
                      {enabled ? null : (
                        <span className="text-xs text-zinc-500">
                          {labels.operationDisabled}
                        </span>
                      )}
                    </label>
                  );
                },
              )}
            </div>
            {fixedOperation && labels.operationFixed ? (
              <p className="text-xs text-zinc-500">{labels.operationFixed}</p>
            ) : null}
          </fieldset>

          {/* Formato de venda e, no Wellmix, o nível */}
          <fieldset className="min-w-0 space-y-1" data-order-terms-format>
            <legend className="block text-xs font-medium leading-5 text-zinc-700">
              {labels.saleFormat}
            </legend>
            <div className="flex flex-wrap gap-2">
              {SALE_FORMATS.map((f) => (
                <label key={f} className={radioClass}>
                  <input
                    type="radio"
                    name="saleFormat"
                    value={f}
                    required
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    data-order-terms-format-option={f}
                  />
                  {labels.format[f]}
                </label>
              ))}
            </div>
            {format === "wellmix" ? (
              <Field label={labels.tier}>
                <Select
                  name="wellmixTier"
                  required
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  data-order-terms-tier
                >
                  <option value="" disabled>
                    {labels.tierChoose}
                  </option>
                  {WELLMIX_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {labels.tiers[tier]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </fieldset>

          {/* Valor total do pedido (dono, 16/11/2026): a soma do valor total
            de cada produto (preço previsto × quantidade). */}
          <div
            className="min-w-0 space-y-1 sm:text-right"
            data-order-terms-total={
              orderTotal === null ? "" : orderTotal.toFixed(2)
            }
          >
            <p className="text-xs font-medium leading-5 text-zinc-700">
              {labels.orderTotal ?? "Valor total"}
            </p>
            <p className="text-lg font-semibold tabular-nums text-zinc-900">
              {orderTotal === null
                ? "—"
                : orderTotal.toLocaleString(labels.intl ?? "pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
            </p>
          </div>
        </div>

        {/* Forma de pagamento (dono, 16/11/2026): logo abaixo do Valor total,
          uma das formas ativas das Configurações, com a previsão das
          parcelas pelo valor total do pedido. */}
        {labels.payment ? (
          <PaymentPlanField
            labels={labels.payment}
            intl={labels.intl ?? "pt-BR"}
            plans={paymentPlans}
            value={planId}
            onChange={setPlanId}
            total={orderTotal}
          />
        ) : null}

        {/* Entrega: Transportador (obrigatório) e Re-despacho Sim/Não */}
        <div className="space-y-1" data-order-terms-delivery>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {labels.delivery}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <fieldset
                className="min-w-0 space-y-1"
                data-order-terms-redispatch
              >
                <legend className="block text-xs font-medium leading-5 text-zinc-700">
                  {labels.redispatch}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <label key={v} className={radioClass}>
                      <input
                        type="radio"
                        name="redispatch"
                        value={v}
                        required
                        checked={redispatch === v}
                        onChange={() => setRedispatch(v)}
                        data-order-terms-redispatch-option={v}
                      />
                      {v === "yes" ? labels.redispatchYes : labels.redispatchNo}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">{labels.redispatchHint}</p>
              </fieldset>
              {/* Quem chama o transportador (dono, 16/11/2026): define quem
                vincula a(s) transportadora(s) e a rota da entrega. */}
              <fieldset
                className="min-w-0 space-y-1"
                data-order-terms-carrier-caller
              >
                <legend className="block text-xs font-medium leading-5 text-zinc-700">
                  {labels.carrierCaller}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {CARRIER_CALLERS.map((v) => (
                    <label key={v} className={radioClass}>
                      <input
                        type="radio"
                        name="carrierCaller"
                        value={v}
                        required
                        checked={caller === v}
                        onChange={() => setCaller(v)}
                        data-order-terms-carrier-caller-option={v}
                      />
                      {labels.carrierCallers[v]}
                    </label>
                  ))}
                </div>
                {caller ? (
                  <p
                    className="text-xs text-zinc-500"
                    data-order-terms-carrier-caller-hint
                  >
                    {labels.carrierCallerHint[caller]}
                  </p>
                ) : null}
              </fieldset>
            </div>
            <div className="min-w-0 space-y-3">
              {caller !== "wellmix" ? (
                // O cliente chama (dono, 18/11/2026): sem escolher a
                // transportadora, mas o valor do transporte aparece (tem custo
                // de toda forma).
                caller ? (
                  freightField
                ) : null
              ) : failed ? (
                <p className="text-xs font-medium text-red-700">
                  {labels.error}
                </p>
              ) : !options ? (
                <p className="text-xs text-zinc-500">{labels.loading}</p>
              ) : (
                <>
                  <CarrierPicker
                    name="carrier"
                    label={labels.carrier}
                    initial={initial.carrier ?? ""}
                    carriers={options.carriers}
                    labels={labels}
                    dataKey="carrier"
                    onValue={onCarrier}
                  />
                  {freightField}
                  {redispatch === "yes" ? (
                    <CarrierPicker
                      name="redispatchCarrier"
                      label={labels.redispatchCarrier}
                      initial={initial.redispatchCarrier ?? ""}
                      carriers={options.carriers}
                      labels={labels}
                      dataKey="redispatch-carrier"
                      onValue={onRedispatchCarrier}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
          {options && options.sankhya !== "ok" ? (
            <p
              className="text-xs text-amber-700"
              data-order-terms-sankhya={options.sankhya}
            >
              {options.sankhya === "off"
                ? labels.carrierSankhyaOff
                : labels.carrierSankhyaError}
            </p>
          ) : null}
        </div>

        {/* País de origem > Grupo de produto (família) */}
        <div className="space-y-1" data-order-terms-origin>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <label
                htmlFor="order-terms-origin-port"
                className="block text-xs font-medium leading-5 text-zinc-700"
              >
                {labels.port.field}
              </label>
              <input type="hidden" name="originCountry" value={country} />
              <input
                type="hidden"
                name="originPort"
                value={port ?? ""}
                disabled={port === null}
              />
              <div data-order-terms-country data-order-terms-port={originKey}>
                {options ? (
                  <SearchPicker
                    key={`${originPickerKey}:${originKey}`}
                    options={originOptions}
                    summary
                    marker="origin-port-picker"
                    kind={operation}
                    inputId="order-terms-origin-port"
                    required
                    initial={originChosen}
                    ariaLabel={labels.port.field}
                    labels={{
                      ...labels.port.picker,
                      placeholder: labels.port.choose,
                    }}
                    onChoose={(o) => {
                      if (o) askSwitch("origin", o.id);
                    }}
                  />
                ) : (
                  <Select disabled value="">
                    <option value="">
                      {failed ? labels.error : labels.loading}
                    </option>
                  </Select>
                )}
              </div>
            </div>
            <Field label={labels.group}>
              <Select
                name="productFamily"
                value={family}
                required
                disabled={!myGroups || !myGroups.length}
                onChange={(e) => askSwitch("family", e.target.value)}
                data-order-terms-group
              >
                <option value="" disabled>
                  {!originKey
                    ? labels.port.groupPick
                    : groupsFailed
                      ? labels.error
                      : !myGroups
                        ? labels.loading
                        : myGroups.length
                          ? labels.groupChoose
                          : labels.groupNone}
                </option>
                {(myGroups ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {`${g.name} — ${count(g.products)}`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="text-xs text-zinc-500">{labels.port.hint}</p>
        </div>
      </div>

      <dialog
        ref={switchDialog}
        aria-labelledby="order-terms-switch-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl backdrop:bg-zinc-900/40"
        onClose={() => {
          setPendingSwitch(null);
          setOriginPickerKey((k) => k + 1);
        }}
        data-order-terms-switch
      >
        <div className="space-y-3 p-5">
          <h3
            id="order-terms-switch-title"
            className="text-base font-semibold text-zinc-900"
          >
            {labels.switchTitle}
          </h3>
          <p className="text-sm leading-relaxed text-zinc-700">
            {labels.switchBody}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => switchDialog.current?.close()}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              data-order-terms-switch-keep
              autoFocus
            >
              {labels.switchKeep}
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingSwitch) {
                  shared?.requestClearProducts();
                  applySwitch(pendingSwitch.kind, pendingSwitch.value);
                }
                switchDialog.current?.close();
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              data-order-terms-switch-confirm
            >
              {labels.switchConfirm}
            </button>
          </div>
        </div>
      </dialog>

      {/* O aviso "sem devoluções" agora é do cliente (dono, 15/11/2026). */}
      <p
        className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600"
        data-order-terms-confirm-note
      >
        {labels.confirmNote}
      </p>
    </section>
  );
}

/**
 * Uma transportadora (do portal ou do Sankhya): só a lista "Escolha o
 * transportador" (a busca por nome, código ou CNPJ saiu: dono, 16/11/2026)
 * e, abaixo da escolhida, código · CNPJ · nome (dono, 15/11/2026).
 */
function CarrierPicker({
  name,
  label,
  initial,
  carriers,
  labels,
  dataKey,
  onValue,
}: {
  name: string;
  label: string;
  initial: string;
  carriers: Carrier[];
  labels: RequestOrderTermsLabels;
  dataKey: "carrier" | "redispatch-carrier";
  /** O escolhido (valor e nome), para o resumo do bloco recolhido. */
  onValue?: (value: string, name: string | null) => void;
}) {
  const [pick, setPick] = useState(initial);
  const value = carriers.some((c) => carrierValue(c) === pick) ? pick : "";
  const picked = carriers.find((c) => carrierValue(c) === value);
  const pickedName = picked?.name ?? null;
  useEffect(() => {
    onValue?.(value, pickedName);
  }, [value, pickedName, onValue]);
  const carrierLabel = (c: Carrier) =>
    `${c.erpCode ? `${c.erpCode} · ` : ""}${c.name}${c.city ? ` · ${c.city}` : ""}${c.source === "sankhya" ? ` (${labels.carrierSankhya})` : ""}`;
  return (
    <div className="space-y-1">
      <label
        htmlFor={`order-terms-${dataKey}`}
        className="block text-xs font-medium leading-5 text-zinc-700"
      >
        {label}
      </label>
      <Select
        name={name}
        value={value}
        onChange={(e) => setPick(e.target.value)}
        required
        aria-label={label}
        id={`order-terms-${dataKey}`}
        {...{ [`data-order-terms-${dataKey}`]: "" }}
      >
        <option value="" disabled>
          {labels.carrierNone}
        </option>
        {carriers.map((c) => (
          <option key={carrierValue(c)} value={carrierValue(c)}>
            {carrierLabel(c)}
          </option>
        ))}
      </Select>
      {picked ? (
        <p
          className="text-xs text-zinc-600"
          {...{ [`data-order-terms-${dataKey}-summary`]: "" }}
        >
          <span className="font-medium text-zinc-800">
            {labels.summaryCode.replace("{code}", picked.erpCode || "—")}
          </span>
          {picked.taxId
            ? ` · ${labels.summaryCnpj.replace("{cnpj}", formatCnpj(picked.taxId))}`
            : ""}
          {` · ${picked.name}`}
        </p>
      ) : null}
    </div>
  );
}

/** Soma do valor total de cada produto (nulo sem nenhum). */
function orderTotalOf(rowTotals: Record<string, number> | undefined) {
  const totals = Object.values(rowTotals ?? {});
  return totals.length ? totals.reduce((a, b) => a + b, 0) : null;
}

/** Resumo de uma linha das condições do pedido recolhidas. */
function OrderTermsSummary({
  cells,
}: {
  labels: RequestOrderTermsLabels;
  cells: Array<[string, string]>;
}) {
  return (
    <div
      className="overflow-x-auto rounded-lg border border-zinc-200"
      data-order-terms-collapsed
    >
      <table className="w-full text-left text-xs">
        <thead className="bg-zinc-50 text-zinc-500">
          <tr>
            {cells.map(([label]) => (
              <th
                key={label}
                className="whitespace-nowrap px-2.5 py-1.5 font-medium"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cells.map(([label, value]) => (
              <td
                key={label}
                className="px-2.5 py-1.5 font-medium text-zinc-900"
                data-order-terms-collapsed-cell=""
              >
                {value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** "8.000,00", "8000" ou "8000.5" → número ≥ 0; vazio ou inválido = nulo. */
function parseMoney(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Centavo, meio para cima (a mesma conta das parcelas do pedido). */
const cents = (n: number) =>
  Math.round(Number((n * 100).toPrecision(12))) / 100;

/**
 * Forma de pagamento e a previsão das parcelas (dono, 16/11/2026): cada
 * parcela com o percentual, o momento (evento + dias) e o valor previsto
 * (valor total × %, mais os juros compostos ao mês depois da entrega, como
 * no pedido; docs/CUSTOMER_PAYMENT.md). As datas saem no pedido, quando os
 * eventos acontecem.
 */
function PaymentPlanField({
  labels,
  intl,
  plans,
  value,
  onChange,
  total,
}: {
  labels: PaymentLabels;
  intl: string;
  plans: RequestPaymentPlan[];
  value: string;
  onChange: (id: string) => void;
  total: number | null;
}) {
  const plan = plans.find((p) => p.planId === value) ?? null;
  const money = (n: number) =>
    n.toLocaleString(intl, { style: "currency", currency: "BRL" });
  const when = (i: RequestPaymentPlan["installments"][number]) =>
    i.days > 0
      ? labels.eventDays
          .replace("{event}", labels.events[i.event])
          .replace("{days}", String(i.days))
      : labels.events[i.event];
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-order-terms-payment>
      <Field label={labels.plan} hint={labels.hint}>
        <Select
          name="paymentPlanId"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-order-terms-payment-plan
        >
          <option value="" disabled>
            {plans.length ? labels.choose : labels.none}
          </option>
          {plans.map((p) => (
            <option key={p.planId} value={p.planId}>
              {p.name}
              {p.requiresApproval ? ` (${labels.needsApproval})` : ""}
            </option>
          ))}
        </Select>
      </Field>
      {plan ? (
        <div className="min-w-0 space-y-1" data-order-terms-payment-preview>
          <p className="text-xs font-medium leading-5 text-zinc-700">
            {labels.preview}
          </p>
          <ol className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white text-sm">
            {plan.installments.map((i, k) => {
              const base =
                total === null ? null : cents((total * i.percent) / 100);
              const late =
                i.event === "delivery" &&
                i.days > 0 &&
                !!plan.monthlyInterestPercent &&
                plan.monthlyInterestPercent > 0;
              const amount =
                base === null
                  ? null
                  : late
                    ? cents(
                        base *
                          Math.pow(
                            1 + plan.monthlyInterestPercent! / 100,
                            i.days / 30,
                          ),
                      )
                    : base;
              return (
                <li
                  key={k}
                  className="flex items-start justify-between gap-3 px-2.5 py-1.5"
                  data-order-terms-payment-row={k + 1}
                  data-amount={amount === null ? "" : amount.toFixed(2)}
                >
                  <span className="min-w-0">
                    <span className="font-semibold tabular-nums text-zinc-900">
                      {i.percent.toLocaleString(intl)}%
                    </span>{" "}
                    <span className="text-zinc-700">{when(i)}</span>
                    {late ? (
                      <span className="block text-xs text-zinc-500">
                        {labels.interest
                          .replace(
                            "{rate}",
                            plan.monthlyInterestPercent!.toLocaleString(intl),
                          )
                          .replace("{days}", String(i.days))}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right tabular-nums text-zinc-900">
                    {i.percent <= 0
                      ? labels.noCharge
                      : amount === null
                        ? "—"
                        : money(amount)}
                  </span>
                </li>
              );
            })}
          </ol>
          {total === null ? (
            <p className="text-xs text-zinc-500">{labels.noTotal}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
