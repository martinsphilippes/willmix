"use client";

import { useEffect, useState } from "react";
import { useRequestCustomer } from "./request-customer-context";
import { Field, Select } from "./ui";
import {
  OPERATION_TYPES,
  SALE_FORMATS,
  WELLMIX_TIERS,
  carrierValue,
  type OperationType,
  type SaleFormat,
  type WellmixTier,
} from "@/lib/order-terms";

export interface RequestOrderTermsLabels {
  title: string;
  hint: string;
  operationType: string;
  operation: Record<OperationType, string>;
  saleFormat: string;
  format: Record<SaleFormat, string>;
  tier: string;
  tierChoose: string;
  tiers: Record<WellmixTier, string>;
  delivery: string;
  carrier: string;
  carrierNone: string;
  redispatch: string;
  redispatchNone: string;
  carrierSankhya: string;
  carrierSankhyaOff: string;
  carrierSankhyaError: string;
  country: string;
  countryChoose: string;
  countryUnknown: string;
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
  disclaimerTitle: string;
  disclaimer: string;
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

/** Valor do <select> do país: a chave, ou "~" para "não informado" (chave ""). */
const UNKNOWN = "~";

/**
 * Condições do pedido na Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md), da Wellmix vendendo ao cliente: Tipo de operação
 * (TS ou Venda), Formato de venda (WD ou Wellmix e o nível), Entrega
 * (Transportador e Re-despacho, do portal e do Sankhya), País de origem e
 * Grupo de produto, nesta ordem (a busca de produto só oferece os deles), e o
 * aviso de que não há devoluções. Na compra para estoque não aparece.
 */
export function RequestOrderTerms({
  labels,
}: {
  labels: RequestOrderTermsLabels;
}) {
  const shared = useRequestCustomer();
  const stock = !!shared?.stock;
  const [options, setOptions] = useState<Options | null>(null);
  const [failed, setFailed] = useState(false);
  const [format, setFormat] = useState<SaleFormat | "">("");
  const [country, setCountry] = useState<string>("");
  const [groups, setGroups] = useState<{ key: string; list: Group[] } | null>(
    null,
  );
  const [groupsFailed, setGroupsFailed] = useState(false);
  const [lineId, setLineId] = useState("");
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
    const key = country === UNKNOWN ? "" : country;
    (async () => {
      try {
        const res = await fetch(
          `/api/requests/order-options?country=${encodeURIComponent(key)}`,
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

  // A busca de produto lê o país e o grupo escolhidos.
  useEffect(() => {
    setOrigin?.(
      country && lineId
        ? { country: country === UNKNOWN ? "" : country, lineId }
        : null,
    );
  }, [country, lineId, setOrigin]);

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
        {/* Tipo de operação */}
        <fieldset className="min-w-0 space-y-1" data-order-terms-operation>
          <legend className="block text-xs font-medium leading-5 text-zinc-700">
            {labels.operationType}
          </legend>
          <div className="flex flex-wrap gap-2">
            {OPERATION_TYPES.map((op) => (
              <label
                key={op}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
              >
                <input
                  type="radio"
                  name="operationType"
                  value={op}
                  required
                  data-order-terms-operation-option={op}
                />
                {labels.operation[op]}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Formato de venda e, no Wellmix, o nível */}
        <fieldset className="min-w-0 space-y-1" data-order-terms-format>
          <legend className="block text-xs font-medium leading-5 text-zinc-700">
            {labels.saleFormat}
          </legend>
          <div className="flex flex-wrap gap-2">
            {SALE_FORMATS.map((f) => (
              <label
                key={f}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
              >
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
                defaultValue=""
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

      {/* Entrega: Transportador e Re-despacho */}
      <div className="space-y-1" data-order-terms-delivery>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {labels.delivery}
        </p>
        {failed ? (
          <p className="text-xs font-medium text-red-700">{labels.error}</p>
        ) : !options ? (
          <p className="text-xs text-zinc-500">{labels.loading}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={labels.carrier}>
                <Select name="carrier" defaultValue="" data-order-terms-carrier>
                  <option value="">{labels.carrierNone}</option>
                  {options.carriers.map((c) => (
                    <option key={carrierValue(c)} value={carrierValue(c)}>
                      {carrierLabel(c)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={labels.redispatch}>
                <Select
                  name="redispatch"
                  defaultValue=""
                  data-order-terms-redispatch
                >
                  <option value="">{labels.redispatchNone}</option>
                  {options.carriers.map((c) => (
                    <option key={carrierValue(c)} value={carrierValue(c)}>
                      {carrierLabel(c)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {options.sankhya !== "ok" ? (
              <p
                className="text-xs text-amber-700"
                data-order-terms-sankhya={options.sankhya}
              >
                {options.sankhya === "off"
                  ? labels.carrierSankhyaOff
                  : labels.carrierSankhyaError}
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* País de origem > Grupo de produto */}
      <div className="space-y-1" data-order-terms-origin>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.country}>
            <Select
              value={country}
              required
              disabled={!options}
              onChange={(e) => {
                setCountry(e.target.value);
                setLineId("");
              }}
              data-order-terms-country
            >
              <option value="" disabled>
                {labels.countryChoose}
              </option>
              {(options?.countries ?? []).map((c) => (
                <option key={c.key || UNKNOWN} value={c.key || UNKNOWN}>
                  {`${c.key ? c.name : labels.countryUnknown} — ${count(c.products)}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={labels.group}>
            <Select
              value={lineId}
              required
              disabled={!myGroups || !myGroups.length}
              onChange={(e) => setLineId(e.target.value)}
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
        <input
          type="hidden"
          name="originCountry"
          value={country === UNKNOWN ? "" : country}
        />
        <input type="hidden" name="originSet" value={country ? "1" : ""} />
        <input type="hidden" name="productLineId" value={lineId} />
        <p className="text-xs text-zinc-500">{labels.originHint}</p>
      </div>

      {/* Aviso: sem devoluções neste modelo de venda (dono, 15/11/2026). */}
      <div
        role="note"
        className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900"
        data-order-terms-disclaimer
      >
        <p className="font-semibold">{labels.disclaimerTitle}</p>
        <p className="mt-1 leading-relaxed">{labels.disclaimer}</p>
        <input type="hidden" name="noReturnsNotice" value="1" />
      </div>
    </section>
  );
}
