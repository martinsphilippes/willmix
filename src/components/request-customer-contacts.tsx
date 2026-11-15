"use client";

import { useEffect, useState } from "react";
import { useRequestCustomer } from "./request-customer-context";
import { Card, Field, Input } from "./ui";
import {
  CONTACT_ROLES,
  type ContactRole,
  type CustomerContacts,
} from "@/lib/order-terms";

export interface RequestCustomerContactsLabels {
  title: string;
  intro: string;
  pick: string;
  stock: string;
  loading: string;
  error: string;
  blind: string;
  known: string;
  /** "Atualizados em {date} por {name}" */
  updated: string;
  edit: string;
  cancel: string;
  phone: string;
  email: string;
  rule: string;
  roles: Record<ContactRole, string>;
}

type View =
  | { state: "blind" }
  | {
      state: "known";
      contacts: CustomerContacts;
      updatedAt: string | null;
      updatedByName: string | null;
    };

interface Loaded {
  key: string;
  view: View | null;
  failed: boolean;
}

/**
 * Bloco do cliente na Nova solicitação (dono, 15/11/2026;
 * docs/ORDER_TERMS.md), no lugar da busca por foto ou link (Wellmix): o
 * representante ou vendedor atualiza os contatos do cliente (sócio,
 * comprador, financeiro e fiscal, logística; telefone e e-mail). Na
 * primeira vez pelo portal, às cegas (nada do cadastro aparece); depois, os
 * dados gravados aparecem com "Editar". Os campos pertencem ao formulário
 * da solicitação (atributo `form`): gravam junto com o envio, e nenhum pode
 * ser igual ao contato do representante ou vendedor (o servidor confere).
 */
export function RequestCustomerContacts({
  formId,
  labels,
  className,
  initialValues = {},
}: {
  formId: string;
  labels: RequestCustomerContactsLabels;
  className?: string;
  /** Contatos já digitados (rascunho): `contact.<área>.<campo>` → valor. */
  initialValues?: Record<string, string>;
}) {
  const shared = useRequestCustomer();
  const stock = !!shared?.stock;
  const customerId = stock ? null : (shared?.customer?.id ?? null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const fromDraft = Object.values(initialValues).some((v) => v.trim());
  // Rascunho com contatos digitados: abre já editando (o cliente da época).
  const [editingFor, setEditingFor] = useState<string | null>(() =>
    fromDraft ? (shared?.customer?.id ?? null) : null,
  );

  useEffect(() => {
    if (!customerId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/customers/contacts?customer=${encodeURIComponent(customerId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        setLoaded({
          key: customerId,
          view: (await res.json()) as View,
          failed: false,
        });
      } catch {
        if (!controller.signal.aborted)
          setLoaded({ key: customerId, view: null, failed: true });
      }
    })();
    return () => controller.abort();
  }, [customerId]);

  const mine = customerId && loaded?.key === customerId ? loaded : null;
  const view = mine?.view ?? null;
  const editing =
    !!customerId &&
    (view?.state === "blind" ||
      (view?.state === "known" && editingFor === customerId));
  const state = stock
    ? "stock"
    : !customerId
      ? "pick"
      : !mine
        ? "loading"
        : mine.failed
          ? "error"
          : editing
            ? view?.state === "blind"
              ? "blind"
              : "edit"
            : "known";

  const known = view?.state === "known" ? view : null;

  return (
    <Card title={labels.title} className={className}>
      <div data-customer-contacts={state}>
        <p className="mb-2 text-sm text-zinc-600">{labels.intro}</p>
        {state === "stock" ? (
          <p className="text-sm text-zinc-500">{labels.stock}</p>
        ) : state === "pick" ? (
          <p className="text-sm text-zinc-500">{labels.pick}</p>
        ) : state === "loading" ? (
          <p className="text-sm text-zinc-500">{labels.loading}</p>
        ) : state === "error" ? (
          <p className="text-sm font-medium text-red-700">{labels.error}</p>
        ) : editing ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              {state === "blind" ? labels.blind : labels.known}
            </p>
            <input type="hidden" name="contactsEdit" value="1" form={formId} />
            {CONTACT_ROLES.map((role) => (
              <fieldset
                key={`${customerId}-${role}`}
                className="space-y-1.5 rounded-lg border border-zinc-200 p-2.5"
                data-customer-contact={role}
              >
                <legend className="px-1 text-xs font-semibold text-zinc-800">
                  {labels.roles[role]}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <Field label={labels.phone}>
                    <Input
                      form={formId}
                      name={`contact.${role}.phone`}
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      required
                      maxLength={40}
                      defaultValue={
                        initialValues[`contact.${role}.phone`] ??
                        (state === "edit" ? known?.contacts[role].phone : "")
                      }
                    />
                  </Field>
                  <Field label={labels.email}>
                    <Input
                      form={formId}
                      name={`contact.${role}.email`}
                      type="email"
                      inputMode="email"
                      autoComplete="off"
                      required
                      maxLength={160}
                      defaultValue={
                        initialValues[`contact.${role}.email`] ??
                        (state === "edit" ? known?.contacts[role].email : "")
                      }
                    />
                  </Field>
                </div>
              </fieldset>
            ))}
            <p className="text-xs text-amber-700">{labels.rule}</p>
            {state === "edit" ? (
              <button
                type="button"
                className="text-xs font-medium text-brand-700 underline"
                onClick={() => setEditingFor(null)}
                data-customer-contacts-cancel
              >
                {labels.cancel}
              </button>
            ) : null}
          </div>
        ) : known ? (
          <div className="space-y-2">
            <dl className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm">
              {CONTACT_ROLES.map((role) => (
                <div
                  key={role}
                  className="px-2.5 py-1.5"
                  data-customer-contact-view={role}
                >
                  <dt className="text-xs font-semibold text-zinc-700">
                    {labels.roles[role]}
                  </dt>
                  <dd className="break-all text-zinc-900">
                    {known.contacts[role].phone || "—"} ·{" "}
                    {known.contacts[role].email || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            {known.updatedAt ? (
              <p className="text-xs text-zinc-500">
                {labels.updated
                  .replace(
                    "{date}",
                    new Date(known.updatedAt).toLocaleDateString(),
                  )
                  .replace("{name}", known.updatedByName ?? "—")}
              </p>
            ) : null}
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              onClick={() => setEditingFor(customerId)}
              data-customer-contacts-edit
            >
              {labels.edit}
            </button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
