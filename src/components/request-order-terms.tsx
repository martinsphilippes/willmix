"use client";

import { useEffect, useRef, useState } from "react";
import { useRequestCustomer } from "./request-customer-context";
import { Field, Select } from "./ui";
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
  country: string;
  countryChoose: string;
  /** "(não vale no TS)" */
  countryDisabled: string;
  group: string;
  groupChoose: string;
  groupPickCountry: string;
  groupNone: string;
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
}

/** Valores já escolhidos (rascunho). */
export interface OrderTermsInitial {
  operationType?: string;
  saleFormat?: string;
  wellmixTier?: string;
  carrier?: string;
  redispatchCarrier?: string;
  carrierCaller?: string;
  redispatch?: string;
  originCountry?: string;
  productFamily?: string;
}

interface Country {
  key: string;
  name: string;
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

const foldText = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

interface Options {
  countries: Country[];
  carriers: Carrier[];
  sankhya: "ok" | "off" | "error";
}

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
}: {
  labels: RequestOrderTermsLabels;
  initial?: OrderTermsInitial;
}) {
  const shared = useRequestCustomer();
  const stock = !!shared?.stock;
  const [options, setOptions] = useState<Options | null>(null);
  const [failed, setFailed] = useState(false);
  const operation: OperationType = "ts";
  const [format, setFormat] = useState<SaleFormat | "">(
    (SALE_FORMATS as readonly string[]).includes(initial.saleFormat ?? "")
      ? (initial.saleFormat as SaleFormat)
      : "",
  );
  const [country, setCountry] = useState<string>(initial.originCountry ?? "");
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
  const [caller, setCaller] = useState<CarrierCaller | "">(
    (CARRIER_CALLERS as readonly string[]).includes(initial.carrierCaller ?? "")
      ? (initial.carrierCaller as CarrierCaller)
      : "",
  );
  // A previsão de preço lê o formato, o nível e quem chama (VIP e rota da
  // cotação V2 do Sankhya; dono, 16/11/2026).
  const setSaleTerms = shared?.setSaleTerms;
  useEffect(() => {
    setSaleTerms?.({
      saleFormat: format || null,
      wellmixTier: format === "wellmix" && tier ? (tier as WellmixTier) : null,
      carrierCaller: caller || null,
    });
  }, [format, tier, caller, setSaleTerms]);
  // Trocar o país ou a família com produto no pedido (dono, 15/11/2026): o
  // aviso recomenda terminar este pedido e começar outro; "trocar" limpa os
  // produtos.
  const hasProducts = (shared?.chosenProductIds.length ?? 0) > 0;
  const switchDialog = useRef<HTMLDialogElement>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{
    kind: "country" | "family";
    value: string;
  } | null>(null);
  const applySwitch = (kind: "country" | "family", value: string) => {
    if (kind === "country") {
      setCountry(value);
      setFamily("");
    } else setFamily(value);
  };
  const askSwitch = (kind: "country" | "family", value: string) => {
    const current = kind === "country" ? country : family;
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
    if (!country) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/requests/order-options?country=${encodeURIComponent(country)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { groups: Group[] };
        setGroupsFailed(false);
        setGroups({ key: country, list: body.groups });
      } catch {
        if (!controller.signal.aborted) setGroupsFailed(true);
      }
    })();
    return () => controller.abort();
  }, [country]);

  // A busca de produto lê o país e a família escolhidos.
  useEffect(() => {
    setOrigin?.(country && family ? { country, family } : null);
  }, [country, family, setOrigin]);

  if (stock)
    return (
      <p
        className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600"
        data-order-terms="stock"
      >
        {labels.stock}
      </p>
    );

  const myGroups = groups && groups.key === country ? groups.list : null;
  const count = (n: number) =>
    labels.productsCount.replace("{n}", n.toLocaleString("pt-BR"));

  return (
    <section
      className="space-y-3 rounded-xl border border-zinc-200 p-3"
      data-order-terms
    >
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{labels.title}</h3>
        <p className="text-xs text-zinc-500">{labels.hint}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Tipo de operação: hoje só TS (Venda desabilitada). */}
        <fieldset className="min-w-0 space-y-1" data-order-terms-operation>
          <legend className="block text-xs font-medium leading-5 text-zinc-700">
            {labels.operationType}
          </legend>
          <div className="flex flex-wrap gap-2">
            {OPERATION_TYPES.map((op) => {
              const enabled = ENABLED_OPERATION_TYPES.includes(op);
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
            })}
          </div>
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
      </div>

      {/* Entrega: Transportador (obrigatório) e Re-despacho Sim/Não */}
      <div className="space-y-1" data-order-terms-delivery>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {labels.delivery}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <fieldset className="min-w-0 space-y-1" data-order-terms-redispatch>
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
            {caller !== "wellmix" ? null : failed ? (
              <p className="text-xs font-medium text-red-700">{labels.error}</p>
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
                />
                {redispatch === "yes" ? (
                  <CarrierPicker
                    name="redispatchCarrier"
                    label={labels.redispatchCarrier}
                    initial={initial.redispatchCarrier ?? ""}
                    carriers={options.carriers}
                    labels={labels}
                    dataKey="redispatch-carrier"
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
          <Field label={labels.country}>
            <Select
              name="originCountry"
              value={country}
              required
              disabled={!options}
              onChange={(e) => askSwitch("country", e.target.value)}
              data-order-terms-country
            >
              <option value="" disabled>
                {labels.countryChoose}
              </option>
              {/* Produto sem país não é vendido; BRASIL não vale no TS. */}
              {(options?.countries ?? [])
                .filter((c) => c.key)
                .map((c) => {
                  const allowed = countryAllowed(operation, c.key);
                  return (
                    <option key={c.key} value={c.key} disabled={!allowed}>
                      {`${c.name} — ${count(c.products)}${allowed ? "" : ` ${labels.countryDisabled}`}`}
                    </option>
                  );
                })}
            </Select>
          </Field>
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
                {!country
                  ? labels.groupPickCountry
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
        <p className="text-xs text-zinc-500">{labels.originHint}</p>
      </div>

      <dialog
        ref={switchDialog}
        aria-labelledby="order-terms-switch-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl backdrop:bg-zinc-900/40"
        onClose={() => setPendingSwitch(null)}
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
 * Uma transportadora (do portal ou do Sankhya): busca por nome, código ou
 * CNPJ e, abaixo da escolhida, código · CNPJ · nome (dono, 15/11/2026).
 */
function CarrierPicker({
  name,
  label,
  initial,
  carriers,
  labels,
  dataKey,
}: {
  name: string;
  label: string;
  initial: string;
  carriers: Carrier[];
  labels: RequestOrderTermsLabels;
  dataKey: "carrier" | "redispatch-carrier";
}) {
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState(initial);
  const q = foldText(query.trim());
  const digits = query.replace(/\D/g, "");
  const matches = (c: Carrier) =>
    !q ||
    foldText(c.name).includes(q) ||
    (!!digits &&
      (!!c.erpCode?.includes(digits) || !!c.taxId?.includes(digits)));
  const value = carriers.some((c) => carrierValue(c) === pick) ? pick : "";
  const picked = carriers.find((c) => carrierValue(c) === value);
  const carrierLabel = (c: Carrier) =>
    `${c.erpCode ? `${c.erpCode} · ` : ""}${c.name}${c.city ? ` · ${c.city}` : ""}${c.source === "sankhya" ? ` (${labels.carrierSankhya})` : ""}`;
  return (
    <div className="space-y-1">
      <Field label={label}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={labels.carrierSearch}
          aria-label={`${label}: ${labels.carrierSearch}`}
          className="mb-1 w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
          {...{ [`data-order-terms-${dataKey}-search`]: "" }}
        />
      </Field>
      <Select
        name={name}
        value={value}
        onChange={(e) => setPick(e.target.value)}
        required
        aria-label={label}
        {...{ [`data-order-terms-${dataKey}`]: "" }}
      >
        <option value="" disabled>
          {labels.carrierNone}
        </option>
        {carriers
          .filter((c) => carrierValue(c) === value || matches(c))
          .map((c) => (
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
