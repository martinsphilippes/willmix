"use client";

import { useRef, useState, useTransition } from "react";
import {
  findCustomerByCnpjAction,
  quickCustomerAction,
} from "@/app/app/actions/quick-customer";
import type { QuickCustomerOption } from "@/lib/services/quick-customer";
import { cnpjDigits, formatCnpj, validCnpj } from "@/lib/order-terms";
import { inputClass } from "./ui";
import type { SearchOption } from "./search-picker";

/*
 * Cadastro rápido de cliente pelo "+" ao lado do campo Cliente da Nova
 * solicitação (dono, 21/11/2026; docs/ORDER_TERMS.md, seção 11.25): abre na
 * própria tela, sem ir a Cadastros. O CNPJ busca o cliente que já existe (não
 * cria outro) e, sem ele, a Receita (BrasilAPI, /api/cnpj) preenche o resto,
 * que dá para corrigir. Salvo, o cliente fica escolhido no pedido.
 *
 * Os campos não têm `name`: estão dentro do formulário da solicitação e não
 * vão no envio dela (o envio por teclado já é barrado pelo
 * KeyboardSubmitGuard da tela).
 */

/** Textos do cadastro rápido (o servidor preenche no idioma de quem vê). */
export interface QuickCustomerLabels {
  open: string;
  title: string;
  hint: string;
  cnpj: string;
  name: string;
  legalName: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  lookup: {
    searching: string;
    found: string;
    notFound: string;
    manual: string;
    invalid: string;
  };
  /** "Este CNPJ já é do cliente {name}." */
  existing: string;
  existingInactive: string;
  useExisting: string;
  save: string;
  saving: string;
  cancel: string;
  /** "Cliente {name} cadastrado e escolhido no pedido." */
  done: string;
  errors: { name: string; email: string; forbidden: string; failed: string };
}

type Lookup =
  "idle" | "searching" | "found" | "notFound" | "manual" | "invalid";

interface Fields {
  name: string;
  legalName: string;
  city: string;
  state: string;
  phone: string;
  email: string;
}

const EMPTY: Fields = {
  name: "",
  legalName: "",
  city: "",
  state: "",
  phone: "",
  email: "",
};

/** A escolha do campo Cliente a partir do cliente cadastrado ou achado. */
const optionOf = (c: QuickCustomerOption): SearchOption => ({
  id: c.id,
  name: c.name,
  hint: c.hint,
  code: c.code,
});

export function QuickCustomerButton({
  labels,
  onChosen,
}: {
  labels: QuickCustomerLabels;
  /** O cliente cadastrado (ou o que já existia) para escolher no pedido. */
  onChosen: (option: SearchOption, created: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [cnpj, setCnpj] = useState("");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [lookup, setLookup] = useState<Lookup>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [existing, setExisting] = useState<QuickCustomerOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Só vale a resposta do último CNPJ digitado.
  const latest = useRef("");

  const open = () => {
    setCnpj("");
    setFields(EMPTY);
    setLookup("idle");
    setAddress(null);
    setExisting(null);
    setError(null);
    latest.current = "";
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();
  const set = (key: keyof Fields, value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  /** CNPJ completo: o cliente que já existe ou a Receita. */
  const search = async (digits: string) => {
    latest.current = digits;
    setExisting(null);
    setError(null);
    if (!validCnpj(digits)) {
      setLookup("invalid");
      return;
    }
    setLookup("searching");
    const found = await findCustomerByCnpjAction(digits).catch(() => ({
      existing: null,
    }));
    if (latest.current !== digits) return;
    if (found.existing) {
      setExisting(found.existing);
      setLookup("idle");
      return;
    }
    try {
      const res = await fetch(`/api/cnpj?cnpj=${digits}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        state?: "found" | "not_found" | "manual";
        data?: {
          name: string;
          tradeName: string | null;
          city: string | null;
          state: string | null;
          address: string | null;
          phone: string | null;
          email: string | null;
        };
      };
      if (latest.current !== digits) return;
      if (body.state === "found" && body.data) {
        const d = body.data;
        setFields({
          name: d.tradeName || d.name,
          legalName: d.name,
          city: d.city ?? "",
          state: d.state ?? "",
          phone: d.phone ?? "",
          email: d.email ?? "",
        });
        setAddress(d.address);
        setLookup("found");
      } else setLookup(body.state === "not_found" ? "notFound" : "manual");
    } catch {
      if (latest.current === digits) setLookup("manual");
    }
  };

  const onCnpj = (value: string) => {
    const digits = cnpjDigits(value).slice(0, 14);
    setCnpj(digits.length === 14 ? formatCnpj(digits) : digits);
    if (digits.length === 14) void search(digits);
    else {
      latest.current = digits;
      setExisting(null);
      setLookup("idle");
    }
  };

  const ready =
    validCnpj(cnpj) && fields.name.trim().length >= 2 && !existing && !pending;

  const save = () => {
    if (!ready) return;
    setError(null);
    start(async () => {
      const result = await quickCustomerAction({
        cnpj: cnpjDigits(cnpj),
        ...fields,
        address,
      }).catch(() => ({ ok: false as const, error: "failed" as const }));
      if (result.ok) {
        onChosen(optionOf(result.customer), true);
        close();
      } else if ("existing" in result) setExisting(result.existing);
      else
        setError(
          result.error === "cnpj_invalid"
            ? labels.lookup.invalid
            : labels.errors[result.error],
        );
    });
  };

  const status =
    lookup === "searching"
      ? labels.lookup.searching
      : lookup === "found"
        ? labels.lookup.found
        : lookup === "notFound"
          ? labels.lookup.notFound
          : lookup === "manual"
            ? labels.lookup.manual
            : lookup === "invalid"
              ? labels.lookup.invalid
              : null;

  const label = "block text-xs font-medium leading-5 text-zinc-700";
  const field = (key: keyof Fields, text: string, extra?: string) => (
    <label className={extra ?? "block min-w-0"}>
      <span className={label}>{text}</span>
      <input
        value={fields[key]}
        onChange={(e) => set(key, e.target.value)}
        className={inputClass}
        maxLength={key === "state" ? 2 : 200}
        autoComplete="off"
        disabled={!!existing}
        data-quick-customer-field={key}
      />
    </label>
  );

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={labels.open}
        title={labels.open}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-lg font-semibold leading-none text-brand-700 shadow-sm transition hover:border-brand-600 hover:bg-brand-50"
        data-quick-customer-open
      >
        +
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="quick-customer-title"
        className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl p-0 shadow-xl backdrop:bg-zinc-900/40"
        onKeyDown={(e) => {
          // Enter salva aqui (nunca envia a solicitação).
          if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            e.stopPropagation();
            save();
          }
        }}
        data-quick-customer
      >
        <div className="space-y-3 p-5">
          <div>
            <h3
              id="quick-customer-title"
              className="text-base font-semibold text-zinc-900"
            >
              {labels.title}
            </h3>
            <p className="text-xs leading-relaxed text-zinc-500">
              {labels.hint}
            </p>
          </div>

          <label className="block">
            <span className={label}>{labels.cnpj}</span>
            <input
              value={cnpj}
              onChange={(e) => onCnpj(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="00.000.000/0000-00"
              className={inputClass}
              autoFocus
              data-quick-customer-cnpj
            />
          </label>
          {status ? (
            <p
              className={
                lookup === "invalid"
                  ? "text-xs font-medium text-red-700"
                  : "text-xs text-zinc-600"
              }
              data-quick-customer-status={lookup}
            >
              {status}
            </p>
          ) : null}

          {existing ? (
            <div
              className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
              data-quick-customer-existing={existing.id}
            >
              <p>
                {(existing.active
                  ? labels.existing
                  : labels.existingInactive
                ).replace("{name}", existing.name)}
                {existing.hint ? (
                  <span className="block text-xs text-amber-800">
                    {existing.hint}
                  </span>
                ) : null}
              </p>
              {existing.active ? (
                <button
                  type="button"
                  onClick={() => {
                    onChosen(optionOf(existing), false);
                    close();
                  }}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  data-quick-customer-use-existing
                >
                  {labels.useExisting}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {field("name", labels.name)}
              {field("legalName", labels.legalName)}
              <div className="grid grid-cols-[1fr_4.5rem] gap-2">
                {field("city", labels.city)}
                {field("state", labels.state)}
              </div>
              {field("phone", labels.phone)}
              {field("email", labels.email, "block min-w-0 sm:col-span-2")}
            </div>
          )}

          {error ? (
            <p
              className="text-xs font-medium text-red-700"
              data-quick-customer-error
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              data-quick-customer-cancel
            >
              {labels.cancel}
            </button>
            {existing ? null : (
              <button
                type="button"
                onClick={save}
                disabled={!ready}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                data-quick-customer-save
              >
                {pending ? labels.saving : labels.save}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
