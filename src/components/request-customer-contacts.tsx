"use client";

import { useEffect, useRef, useState } from "react";
import { useRequestCustomer } from "./request-customer-context";
import { Card, Field, Input } from "./ui";
import {
  CONTACT_ROLES,
  MAX_EXTRA_CONTACTS,
  type ContactEntry,
  type ContactRole,
  type CustomerContacts,
} from "@/lib/order-terms";
import { REQUEST_DRAFT_TOUCH } from "./request-draft-autosave";
import { saveCustomerContactsAction } from "@/app/app/actions/customer-contacts";

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
  /** "+": mais um contato na área (dono, 17/11/2026). */
  add: string;
  /** Lixeira: tira o contato extra. */
  remove: string;
  /** "Salvar dados do cliente" (sem enviar o pedido). */
  save: string;
  saving: string;
  saved: string;
  saveFailed: string;
  errors: Record<string, string>;
  roles: Record<ContactRole, string>;
}

/** Os números dos contatos extras de cada área, a partir dos campos do rascunho. */
function extraIdsFrom(
  values: Record<string, string>,
): Record<ContactRole, number[]> {
  const out = {} as Record<ContactRole, number[]>;
  for (const role of CONTACT_ROLES) {
    const re = new RegExp(`^contact\\.${role}\\.(\\d{1,3})\\.(phone|email)$`);
    out[role] = [
      ...new Set(
        Object.keys(values)
          .map((k) => Number(re.exec(k)?.[1]))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ]
      .sort((a, b) => a - b)
      .slice(0, MAX_EXTRA_CONTACTS);
  }
  return out;
}

const PlusIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="h-4 w-4"
    aria-hidden
  >
    <path d="M10 4v12M4 10h12" strokeLinecap="round" />
  </svg>
);

const TrashIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    className="h-4 w-4"
    aria-hidden
  >
    <path
      d="M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6M8.5 9v5M11.5 9v5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
  // Contatos extras por área (o "+" acrescenta, a lixeira tira): números
  // estáveis para os nomes dos campos (`contact.<área>.<n>.<campo>`).
  const [extras, setExtras] = useState<Record<ContactRole, number[]>>(() =>
    extraIdsFrom(initialValues),
  );
  const nextId = useRef(Math.max(0, ...Object.values(extras).flat()) + 1);
  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved" }
    | { kind: "error"; text: string }
  >({ kind: "idle" });
  const boxRef = useRef<HTMLDivElement>(null);

  /** Ao abrir para editar contatos já gravados, uma linha por contato extra. */
  function startEdit(contacts: CustomerContacts | null) {
    const out = {} as Record<ContactRole, number[]>;
    for (const role of CONTACT_ROLES)
      out[role] = (contacts?.more?.[role] ?? []).map(() => nextId.current++);
    setExtras(out);
    setSaveState({ kind: "idle" });
    setEditingFor(customerId);
  }
  function addExtra(role: ContactRole) {
    setExtras((e) =>
      (e[role]?.length ?? 0) >= MAX_EXTRA_CONTACTS
        ? e
        : { ...e, [role]: [...(e[role] ?? []), nextId.current++] },
    );
  }
  function removeExtra(role: ContactRole, id: number) {
    setExtras((e) => ({
      ...e,
      [role]: (e[role] ?? []).filter((n) => n !== id),
    }));
    // O rascunho automático percebe a linha que saiu.
    requestAnimationFrame(() =>
      document.dispatchEvent(new Event(REQUEST_DRAFT_TOUCH)),
    );
  }

  /** "Salvar dados do cliente": grava só os contatos, sem enviar o pedido. */
  async function saveNow() {
    const root = boxRef.current;
    if (!root || !customerId) return;
    const inputs = [
      ...root.querySelectorAll<HTMLInputElement>('input[name^="contact."]'),
    ];
    const invalid = inputs.find((i) => !i.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    const values: Record<string, string> = {};
    for (const i of inputs) values[i.name] = i.value;
    setSaveState({ kind: "saving" });
    const result = await saveCustomerContactsAction({
      customerId,
      values,
    }).catch(() => null);
    if (result?.ok && result.view) {
      setLoaded({ key: customerId, view: result.view, failed: false });
      setEditingFor(null);
      setSaveState({ kind: "saved" });
    } else
      setSaveState({
        kind: "error",
        text:
          (result && !result.ok && labels.errors[result.error]) ||
          labels.saveFailed,
      });
  }

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
      <div ref={boxRef} data-customer-contacts={state}>
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
            {CONTACT_ROLES.map((role) => {
              const knownMore = known?.contacts.more?.[role] ?? [];
              const ids = extras[role] ?? [];
              const entryRow = (
                key: string,
                prefix: string,
                fallback: ContactEntry | undefined,
                onRemove?: () => void,
              ) => (
                <div
                  key={key}
                  className="flex items-end gap-2"
                  data-customer-contact-row={prefix}
                >
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <Field label={labels.phone}>
                      <Input
                        form={formId}
                        name={`${prefix}.phone`}
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        required
                        maxLength={40}
                        defaultValue={
                          initialValues[`${prefix}.phone`] ??
                          (state === "edit" ? fallback?.phone : "") ??
                          ""
                        }
                      />
                    </Field>
                    <Field label={labels.email}>
                      <Input
                        form={formId}
                        name={`${prefix}.email`}
                        type="email"
                        inputMode="email"
                        autoComplete="off"
                        required
                        maxLength={160}
                        defaultValue={
                          initialValues[`${prefix}.email`] ??
                          (state === "edit" ? fallback?.email : "") ??
                          ""
                        }
                      />
                    </Field>
                  </div>
                  {onRemove ? (
                    <button
                      type="button"
                      onClick={onRemove}
                      aria-label={`${labels.remove}: ${labels.roles[role]}`}
                      title={labels.remove}
                      className="mb-0.5 rounded-md p-2 text-red-700 hover:bg-red-50"
                      data-customer-contact-remove={prefix}
                    >
                      <TrashIcon />
                    </button>
                  ) : (
                    <span className="w-8 shrink-0" aria-hidden />
                  )}
                </div>
              );
              return (
                <fieldset
                  key={`${customerId}-${role}`}
                  className="space-y-1.5 rounded-lg border border-zinc-200 p-2.5"
                  data-customer-contact={role}
                >
                  <legend className="flex items-center gap-1 px-1 text-xs font-semibold text-zinc-800">
                    {labels.roles[role]}
                    {ids.length < MAX_EXTRA_CONTACTS ? (
                      <button
                        type="button"
                        onClick={() => addExtra(role)}
                        aria-label={`${labels.add}: ${labels.roles[role]}`}
                        title={labels.add}
                        className="rounded-md p-0.5 text-brand-700 hover:bg-brand-50"
                        data-customer-contact-add={role}
                      >
                        <PlusIcon />
                      </button>
                    ) : null}
                  </legend>
                  {entryRow("main", `contact.${role}`, known?.contacts[role])}
                  {ids.map((id, i) =>
                    entryRow(
                      `x${id}`,
                      `contact.${role}.${id}`,
                      knownMore[i],
                      () => removeExtra(role, id),
                    ),
                  )}
                </fieldset>
              );
            })}
            <p className="text-xs text-amber-700">{labels.rule}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void saveNow()}
                disabled={saveState.kind === "saving"}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
                data-customer-contacts-save
              >
                {saveState.kind === "saving" ? labels.saving : labels.save}
              </button>
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
            {saveState.kind === "error" ? (
              <p
                className="text-xs font-medium text-red-700"
                role="alert"
                data-customer-contacts-save-error
              >
                {saveState.text}
              </p>
            ) : null}
          </div>
        ) : known ? (
          <div className="space-y-2">
            {saveState.kind === "saved" ? (
              <p
                className="text-xs font-medium text-emerald-700"
                role="status"
                data-customer-contacts-saved
              >
                {labels.saved}
              </p>
            ) : null}
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
                  {[
                    known.contacts[role],
                    ...(known.contacts.more?.[role] ?? []),
                  ].map((entry, i) => (
                    <dd key={i} className="break-all text-zinc-900">
                      {entry.phone || "—"} · {entry.email || "—"}
                    </dd>
                  ))}
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
              onClick={() => startEdit(known.contacts)}
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
