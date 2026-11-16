"use client";

import { useState } from "react";
import { Field, Input } from "./ui";
import { SubmitButton } from "./submit-button";
import { cnpjDigits, formatCnpj, validCnpj } from "@/lib/order-terms";

export interface CustomerOrderConfirmLabels {
  title: string;
  intro: string;
  disclaimerTitle: string;
  disclaimer: string;
  accept: string;
  redispatchTitle: string;
  redispatchHint: string;
  /** Quem chama = Cliente (16/11/2026): a transportadora do pedido. */
  carrierTitle?: string;
  carrierHint?: string;
  cnpj: string;
  cnpjPlaceholder: string;
  lookup: string;
  looking: string;
  cnpjInvalid: string;
  notFound: string;
  manual: string;
  carrierName: string;
  found: string;
  submit: string;
  submitting: string;
}

interface Found {
  cnpj: string;
  name: string;
  tradeName: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
}

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; data: Found }
  | { kind: "manual" }
  | { kind: "not_found" }
  | { kind: "invalid" };

/**
 * Confirmação do pedido pelo cliente (dono, 15/11/2026; docs/ORDER_TERMS.md
 * seção 4): o aviso "sem devoluções" com "Li e concordo" obrigatório e as
 * transportadoras que o cliente informa pelo CNPJ (o portal busca os dados
 * e cadastra; sem a consulta, o nome se digita): a do pedido, quando quem
 * chama o transportador é o cliente (16/11/2026), e a do re-despacho.
 */
export function CustomerOrderConfirm({
  requestId,
  redispatchRequired,
  carrierRequired = false,
  action,
  labels,
}: {
  requestId: string;
  /** Pede a transportadora do re-despacho. */
  redispatchRequired: boolean;
  /** Pede a transportadora do pedido (quem chama = Cliente). */
  carrierRequired?: boolean;
  action: (form: FormData) => void | Promise<void>;
  labels: CustomerOrderConfirmLabels;
}) {
  const [mainReady, setMainReady] = useState(false);
  const [redispatchReady, setRedispatchReady] = useState(false);
  const ready =
    (!carrierRequired || mainReady) && (!redispatchRequired || redispatchReady);

  return (
    <section
      id="confirmar"
      className="scroll-mt-24 space-y-3 rounded-2xl border-2 border-brand-200 bg-white p-4"
      data-customer-confirm
    >
      <div>
        <h2 className="text-base font-semibold text-zinc-900">
          {labels.title}
        </h2>
        <p className="text-sm text-zinc-600">{labels.intro}</p>
      </div>
      <form action={action} className="space-y-3">
        <input type="hidden" name="requestId" value={requestId} />
        {carrierRequired ? (
          <CarrierByCnpj
            cnpjName="mainCnpj"
            nameName="mainCarrierName"
            title={labels.carrierTitle ?? labels.redispatchTitle}
            hint={labels.carrierHint ?? labels.redispatchHint}
            labels={labels}
            onReady={setMainReady}
            dataKey="carrier"
          />
        ) : null}
        {redispatchRequired ? (
          <CarrierByCnpj
            cnpjName="cnpj"
            nameName="carrierName"
            title={labels.redispatchTitle}
            hint={labels.redispatchHint}
            labels={labels}
            onReady={setRedispatchReady}
            dataKey="redispatch"
          />
        ) : null}

        {/* Aviso: sem devoluções neste modelo de venda (dono, 15/11/2026). */}
        <div
          role="note"
          className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900"
          data-customer-confirm-disclaimer
        >
          <p className="font-semibold">{labels.disclaimerTitle}</p>
          <p className="mt-1 leading-relaxed">{labels.disclaimer}</p>
          <label className="mt-2 flex cursor-pointer items-start gap-2 font-semibold">
            <input
              type="checkbox"
              name="accept"
              value="1"
              required
              className="mt-0.5 h-4 w-4 shrink-0"
              data-customer-confirm-accept
            />
            <span>{labels.accept}</span>
          </label>
        </div>
        <SubmitButton pendingText={labels.submitting} disabled={!ready}>
          {labels.submit}
        </SubmitButton>
      </form>
    </section>
  );
}

/** Uma transportadora pelo CNPJ: busca os dados e, sem a consulta, o nome. */
function CarrierByCnpj({
  cnpjName,
  nameName,
  title,
  hint,
  labels,
  onReady,
  dataKey,
}: {
  cnpjName: string;
  nameName: string;
  title: string;
  hint: string;
  labels: CustomerOrderConfirmLabels;
  onReady: (ready: boolean) => void;
  dataKey: "carrier" | "redispatch";
}) {
  const [cnpj, setCnpj] = useState("");
  const [lookup, setLookupState] = useState<LookupState>({ kind: "idle" });
  const setLookup = (next: LookupState) => {
    setLookupState(next);
    onReady(next.kind === "found" || next.kind === "manual");
  };

  async function search() {
    if (!validCnpj(cnpj)) {
      setLookup({ kind: "invalid" });
      return;
    }
    setLookup({ kind: "loading" });
    try {
      const res = await fetch(`/api/cnpj?cnpj=${cnpjDigits(cnpj)}`);
      const body = (await res.json()) as
        | { state: "found"; data: Found }
        | { state: "manual" }
        | { state: "not_found" }
        | { error: string };
      if ("state" in body && body.state === "found")
        setLookup({ kind: "found", data: body.data });
      else if ("state" in body && body.state === "not_found")
        setLookup({ kind: "not_found" });
      else if ("error" in body) setLookup({ kind: "invalid" });
      else setLookup({ kind: "manual" });
    } catch {
      setLookup({ kind: "manual" });
    }
  }

  return (
    <div
      className="space-y-2 rounded-xl border border-zinc-200 p-3"
      {...{ [`data-customer-confirm-${dataKey}`]: "" }}
    >
      <p className="text-sm font-semibold text-zinc-800">{title}</p>
      <p className="text-xs text-zinc-500">{hint}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field label={labels.cnpj}>
            <Input
              name={cnpjName}
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={18}
              placeholder={labels.cnpjPlaceholder}
              value={cnpj}
              onChange={(e) => {
                setCnpj(e.target.value);
                setLookup({ kind: "idle" });
              }}
              onBlur={() => {
                if (validCnpj(cnpj)) setCnpj(formatCnpj(cnpj));
              }}
              data-customer-confirm-cnpj
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={lookup.kind === "loading"}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          data-customer-confirm-lookup
        >
          {lookup.kind === "loading" ? labels.looking : labels.lookup}
        </button>
      </div>
      {lookup.kind === "invalid" ? (
        <p className="text-xs font-medium text-red-700">{labels.cnpjInvalid}</p>
      ) : lookup.kind === "not_found" ? (
        <p className="text-xs font-medium text-red-700">{labels.notFound}</p>
      ) : lookup.kind === "found" ? (
        <div
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          data-customer-confirm-found
        >
          <p className="text-xs font-semibold uppercase tracking-wide">
            {labels.found}
          </p>
          <p className="font-medium">
            {lookup.data.tradeName
              ? `${lookup.data.tradeName} (${lookup.data.name})`
              : lookup.data.name}
          </p>
          <p className="text-xs">
            {[
              lookup.data.address,
              [lookup.data.city, lookup.data.state].filter(Boolean).join(" - "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ) : lookup.kind === "manual" ? (
        <div className="space-y-1" data-customer-confirm-manual>
          <p className="text-xs text-amber-700">{labels.manual}</p>
          <Field label={labels.carrierName}>
            <Input name={nameName} required minLength={2} maxLength={160} />
          </Field>
        </div>
      ) : null}
    </div>
  );
}
