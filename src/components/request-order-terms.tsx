"use client";

import { useEffect, useState } from "react";
import { useRequestCustomer } from "./request-customer-context";
import { Field, Select } from "./ui";
import {
  ENABLED_OPERATION_TYPES,
  OPERATION_TYPES,
  SALE_FORMATS,
  WELLMIX_TIERS,
  carrierValue,
  countryAllowed,
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
}

/** Valores já escolhidos (rascunho). */
export interface OrderTermsInitial {
  operationType?: string;
  saleFormat?: string;
  wellmixTier?: string;
  carrier?: string;
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
}

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
  const carrierLabel = (c: Carrier) =>
    `${c.name}${c.city ? ` · ${c.city}` : ""}${c.source === "sankhya" ? ` (${labels.carrierSankhya})` : ""}`;

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
                defaultValue={
                  (WELLMIX_TIERS as readonly string[]).includes(
                    initial.wellmixTier ?? "",
                  )
                    ? initial.wellmixTier
                    : ""
                }
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
          <div className="min-w-0">
            {failed ? (
              <p className="text-xs font-medium text-red-700">{labels.error}</p>
            ) : !options ? (
              <p className="text-xs text-zinc-500">{labels.loading}</p>
            ) : (
              <Field label={labels.carrier}>
                <Select
                  name="carrier"
                  defaultValue={
                    options.carriers.some(
                      (c) => carrierValue(c) === initial.carrier,
                    )
                      ? initial.carrier
                      : ""
                  }
                  required
                  data-order-terms-carrier
                >
                  <option value="" disabled>
                    {labels.carrierNone}
                  </option>
                  {options.carriers.map((c) => (
                    <option key={carrierValue(c)} value={carrierValue(c)}>
                      {carrierLabel(c)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
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
                    defaultChecked={initial.redispatch === v}
                    data-order-terms-redispatch-option={v}
                  />
                  {v === "yes" ? labels.redispatchYes : labels.redispatchNo}
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-500">{labels.redispatchHint}</p>
          </fieldset>
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
              onChange={(e) => {
                setCountry(e.target.value);
                setFamily("");
              }}
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
              onChange={(e) => setFamily(e.target.value)}
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
